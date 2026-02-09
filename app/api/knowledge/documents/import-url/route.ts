/**
 * Knowledge URL Import API
 *
 * POST: Crawl a website and create knowledge_documents records with
 * pre-populated raw_text. Uses SSE for real-time progress streaming.
 *
 * After import completes, the client triggers /api/knowledge/documents/analyze
 * for each imported document to extract voice, strategy, facts, and examples.
 */

import { createClient } from '@/lib/supabase/server'
import { validateUrl, crawlSite, countWords } from '@/lib/web-crawl'
import type { CrawlProgress } from '@/lib/web-crawl'
import { MAX_DOCUMENTS_PER_PROFILE, ERROR_MESSAGES } from '@/lib/knowledge/config'

export const runtime = 'nodejs'
export const maxDuration = 300

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

/** Max characters stored per document's raw_text */
const MAX_RAW_TEXT_CHARS = 100_000

/** Max pages to crawl per URL import (hard cap) */
const MAX_IMPORT_PAGES = 25

/** Max URL imports per hour per user */
const URL_IMPORT_RATE_LIMIT = 3

interface ImportUrlRequest {
  url: string
  profile_id: string
}

export async function POST(request: Request) {
  // Parse request body
  let body: ImportUrlRequest
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400)
  }

  const { url, profile_id: profileId } = body

  if (!url || typeof url !== 'string') {
    return jsonResponse({ error: 'URL is required' }, 400)
  }
  if (!profileId || typeof profileId !== 'string' || !UUID_REGEX.test(profileId)) {
    return jsonResponse({ error: 'Valid profile_id is required' }, 400)
  }

  // Validate URL format and SSRF protection
  const validation = await validateUrl(url)
  if (!validation.valid || !validation.url) {
    return jsonResponse({ error: validation.error || 'Invalid URL' }, 400)
  }
  const validatedUrl = validation.url

  // Auth check
  const supabase = await createClient()
  if (!supabase) {
    return jsonResponse({ error: 'Supabase not configured' }, 503)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonResponse({ error: ERROR_MESSAGES.UNAUTHORIZED }, 401)
  }

  // Verify profile ownership
  const { data: profile } = await (supabase as KnowledgeClient)
    .from('knowledge_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!profile) {
    return jsonResponse({ error: ERROR_MESSAGES.PROFILE_NOT_FOUND }, 404)
  }

  // Check document limit — calculate remaining slots
  const { count: existingCount } = await (supabase as KnowledgeClient)
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .is('deleted_at', null)

  const currentCount = existingCount || 0
  if (currentCount >= MAX_DOCUMENTS_PER_PROFILE) {
    return jsonResponse({ error: ERROR_MESSAGES.DOCUMENT_LIMIT_REACHED }, 400)
  }

  const remainingSlots = MAX_DOCUMENTS_PER_PROFILE - currentCount

  // Rate limit: max URL imports per hour (track via file_type = 'text/html' on recent docs)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentImports } = await (supabase as KnowledgeClient)
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('file_type', 'text/html')
    .gte('created_at', oneHourAgo)
    .is('deleted_at', null)

  if ((recentImports || 0) >= URL_IMPORT_RATE_LIMIT * MAX_IMPORT_PAGES) {
    return jsonResponse(
      { error: `Rate limit: max ${URL_IMPORT_RATE_LIMIT} URL imports per hour. Please try again later.` },
      429
    )
  }

  const maxPages = Math.min(MAX_IMPORT_PAGES, remainingSlots)

  // Start SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: CrawlProgress) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Controller might be closed
        }
      }

      let pagesImported = 0

      try {
        // Crawl the site with progress streaming
        const result = await crawlSite(
          validatedUrl,
          (progress) => sendEvent(progress),
          {
            maxPages,
            signal: request.signal,
            resolvedIps: validation.resolvedIps,
          }
        )

        // For each crawled page, create a knowledge_documents record
        for (const page of result.pages) {
          if (pagesImported >= maxPages) break
          if (request.signal.aborted) break

          try {
            const content = page.content.slice(0, MAX_RAW_TEXT_CHARS)
            const contentSize = Buffer.byteLength(content, 'utf-8')
            const wordCount = countWords(content)

            // Derive file name safely
            let fallbackName = 'index'
            try { fallbackName = new URL(page.url).pathname.slice(1) || 'index' } catch { /* use default */ }

            // Insert knowledge document with pre-populated raw_text
            const { data: document, error: dbError } = await (supabase as KnowledgeClient)
              .from('knowledge_documents')
              .insert({
                user_id: user.id,
                profile_id: profileId,
                file_name: (page.title || fallbackName).slice(0, 255),
                file_url: page.url, // Source web URL, not a storage URL
                file_size: contentSize,
                file_type: 'text/html',
                raw_text: content,
                word_count: wordCount,
                status: 'pending',
                doc_purpose: [],
              })
              .select('id')
              .single()

            if (dbError) {
              console.error(`[Knowledge URL Import] Failed to insert doc for ${page.url}:`, dbError.message)
              sendEvent({
                type: 'page_error',
                url: page.url,
                pagesProcessed: pagesImported,
                pagesTotal: result.pages.length,
                pagesSkipped: result.skippedPages,
                pagesFailed: result.failedPages,
                error: 'Failed to save document',
              })
              continue
            }

            pagesImported++

            sendEvent({
              type: 'page_ready',
              url: page.url,
              title: page.title,
              documentId: document.id,
              pagesProcessed: pagesImported,
              pagesTotal: result.pages.length,
              pagesSkipped: result.skippedPages,
              pagesFailed: result.failedPages,
            })
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Import failed'
            console.error(`[Knowledge URL Import] Error for ${page.url}:`, msg)
            sendEvent({
              type: 'page_error',
              url: page.url,
              pagesProcessed: pagesImported,
              pagesTotal: result.pages.length,
              pagesSkipped: result.skippedPages,
              pagesFailed: result.failedPages + 1,
              error: msg,
            })
          }
        }

        // Audit log
        try {
          await (supabase as KnowledgeClient).from('knowledge_audit_log').insert({
            user_id: user.id,
            profile_id: profileId,
            action: 'import_url',
            entity_type: 'document',
            new_value: {
              url: validatedUrl.href,
              pages_imported: pagesImported,
              pages_crawled: result.totalPages,
            },
          })
        } catch {
          // Non-critical — don't fail the import for audit log errors
        }

        // Final summary
        sendEvent({
          type: 'crawl_complete',
          pagesProcessed: pagesImported,
          pagesTotal: pagesImported,
          pagesSkipped: result.skippedPages,
          pagesFailed: result.failedPages,
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Crawl failed'
        console.error('[Knowledge URL Import] Crawl error:', msg)
        sendEvent({
          type: 'crawl_error',
          pagesProcessed: pagesImported,
          pagesTotal: 0,
          pagesSkipped: 0,
          pagesFailed: 0,
          error: msg,
        })
      }

      try {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch {
        // Controller might already be closed
      }
      try {
        controller.close()
      } catch {
        // Already closed
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function jsonResponse(data: object, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
