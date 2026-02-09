/**
 * URL Import API for RAG
 *
 * POST: Crawl a website and index pages as RAG documents
 * Uses SSE (Server-Sent Events) for real-time progress streaming
 */

import { createClient } from "@/lib/supabase/server"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"
import { validateUrl, crawlSite, CRAWL_MAX_PAGES } from "@/lib/web-crawl"
import type { CrawlProgress, CrawlPage } from "@/lib/web-crawl"
import { chunkText, generateEmbeddingsInBatches, RAG_EMBEDDING_BATCH_SIZE } from "@/lib/rag"
import { RAG_DOCUMENT_LIMIT, RAG_DAILY_UPLOAD_LIMIT } from "@/lib/rag/config"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes

interface ImportUrlRequest {
  url: string
}

export async function POST(request: Request) {
  // Parse request
  let body: ImportUrlRequest
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400)
  }

  const { url } = body
  if (!url || typeof url !== "string") {
    return jsonResponse({ error: "URL is required" }, 400)
  }

  // Validate URL format and SSRF
  const validation = await validateUrl(url)
  if (!validation.valid || !validation.url) {
    return jsonResponse({ error: validation.error || "Invalid URL" }, 400)
  }

  const validatedUrl = validation.url

  // Auth check
  const supabase = await createClient()
  if (!supabase) {
    return jsonResponse({ error: "Database not configured" }, 503)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  // Scale plan check
  const customerData = await getCustomerData(user.id, 5000)
  const currentProductId = customerData?.products?.[0]?.id
  const planType = normalizePlanId(currentProductId)

  if (planType !== "scale") {
    return jsonResponse({ error: "Scale plan required for URL import" }, 403)
  }

  // Check for duplicate source_url
  const { data: existingDocs } = await (supabase as any)
    .from("rag_documents")
    .select("id")
    .eq("user_id", user.id)
    .eq("source_url", validatedUrl.href)
    .limit(1)

  if (existingDocs && existingDocs.length > 0) {
    return jsonResponse({ error: "This URL has already been imported. Delete the existing import first." }, 409)
  }

  // Rate limit: max 3 crawl initiations per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recentCrawls } = await (supabase as any)
    .from("rag_documents")
    .select("crawl_job_id")
    .eq("user_id", user.id)
    .not("crawl_job_id", "is", null)
    .gte("created_at", oneHourAgo)

  if (recentCrawls && Array.isArray(recentCrawls)) {
    const distinctJobs = new Set(recentCrawls.map((r: { crawl_job_id: string }) => r.crawl_job_id))
    if (distinctJobs.size >= 3) {
      return jsonResponse({ error: "Rate limit: max 3 URL imports per hour. Please try again later." }, 429)
    }
  }

  // Calculate remaining capacity
  const { count: totalDocs } = await supabase
    .from("rag_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)

  const { count: todayDocs } = await supabase
    .from("rag_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfToday.toISOString())

  const remainingDocs = RAG_DOCUMENT_LIMIT - (totalDocs || 0)
  const remainingDaily = RAG_DAILY_UPLOAD_LIMIT - (todayDocs || 0)

  if (remainingDocs <= 0) {
    return jsonResponse({ error: `Document limit reached (${RAG_DOCUMENT_LIMIT} max). Delete some documents first.` }, 400)
  }
  if (remainingDaily <= 0) {
    return jsonResponse({ error: `Daily upload limit reached (${RAG_DAILY_UPLOAD_LIMIT}/day). Try again tomorrow.` }, 400)
  }

  const maxPagesForCrawl = Math.min(CRAWL_MAX_PAGES, remainingDocs, remainingDaily)

  // Get API key for embeddings
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (!openrouterKey) {
    return jsonResponse({ error: "Embedding API not configured" }, 503)
  }

  // Generate a crawl job ID to group all pages
  const crawlJobId = crypto.randomUUID()

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

      let pagesIndexed = 0

      try {
        // Crawl the site with progress streaming
        // Pass request.signal so crawl stops if client disconnects
        // Pass resolvedIps for DNS pinning (prevents DNS rebinding TOCTOU attacks)
        const result = await crawlSite(
          validatedUrl,
          (progress) => {
            // Forward crawl progress events to SSE
            sendEvent(progress)
          },
          {
            maxPages: maxPagesForCrawl,
            signal: request.signal,
            resolvedIps: validation.resolvedIps,
          }
        )

        // Process each crawled page: chunk → embed → store
        for (const page of result.pages) {
          // Check if we've hit limits mid-crawl
          if (pagesIndexed >= maxPagesForCrawl) {
            sendEvent({
              type: "crawl_complete",
              pagesProcessed: pagesIndexed,
              pagesTotal: pagesIndexed,
              pagesSkipped: result.skippedPages,
              pagesFailed: result.failedPages,
              error: "Reached document limit",
            })
            break
          }

          try {
            await indexPage(
              page,
              user.id,
              crawlJobId,
              openrouterKey,
              supabase as any
            )

            pagesIndexed++

            sendEvent({
              type: "page_ready",
              url: page.url,
              title: page.title,
              documentId: undefined,
              pagesProcessed: pagesIndexed,
              pagesTotal: result.pages.length,
              pagesSkipped: result.skippedPages,
              pagesFailed: result.failedPages,
            })
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Indexing failed"
            console.error(`[URL Import] Failed to index ${page.url}:`, msg)

            sendEvent({
              type: "page_error",
              url: page.url,
              pagesProcessed: pagesIndexed,
              pagesTotal: result.pages.length,
              pagesSkipped: result.skippedPages,
              pagesFailed: result.failedPages + 1,
              error: msg,
            })
          }
        }

        // Final summary
        sendEvent({
          type: "crawl_complete",
          pagesProcessed: pagesIndexed,
          pagesTotal: pagesIndexed,
          pagesSkipped: result.skippedPages,
          pagesFailed: result.failedPages,
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Crawl failed"
        console.error("[URL Import] Crawl error:", msg)

        sendEvent({
          type: "crawl_error",
          pagesProcessed: pagesIndexed,
          pagesTotal: 0,
          pagesSkipped: 0,
          pagesFailed: 0,
          error: msg,
        })
      }

      // Sentinel event: explicit end-of-stream (convention from OpenAI SSE)
      try {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      } catch {
        // Controller might already be closed
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

/**
 * Index a single crawled page: create document record → chunk → embed → store chunks
 */
async function indexPage(
  page: CrawlPage,
  userId: string,
  crawlJobId: string,
  apiKey: string,
  supabase: any
): Promise<string> {
  // Derive a file name from the page title + URL
  const fileName = page.title || new URL(page.url).pathname.slice(1) || "index"
  const contentSize = Buffer.byteLength(page.content, "utf-8")

  // Create document record
  const { data: document, error: docError } = await supabase
    .from("rag_documents")
    .insert({
      user_id: userId,
      file_name: fileName,
      file_url: page.url,
      file_size: contentSize,
      file_type: "text/html",
      page_count: 1,
      word_count: page.wordCount,
      language: "en",
      tags: [],
      status: "processing",
      source_url: page.url,
      crawl_job_id: crawlJobId,
    })
    .select()
    .single()

  if (docError) {
    // Unique constraint violation = page already imported (race condition or re-crawl)
    if (docError.code === "23505") {
      throw new Error("Page already imported")
    }
    throw new Error(`Failed to create document record: ${docError.message}`)
  }

  try {
    // Chunk the Markdown content
    const chunks = chunkText(page.content, 0)

    if (chunks.length === 0) {
      await supabase
        .from("rag_documents")
        .update({ status: "failed", error_message: "No content to chunk" })
        .eq("id", document.id)
      throw new Error("No content to chunk")
    }

    // Generate embeddings in batches
    const chunkTexts = chunks.map((c) => c.content)
    const embeddings = await generateEmbeddingsInBatches(
      chunkTexts,
      apiKey,
      RAG_EMBEDDING_BATCH_SIZE
    )

    // Insert chunks with embeddings
    const chunkRecords = chunks.map((chunk, index) => {
      // Sanitize content (remove null bytes and control chars)
      const sanitizedContent = chunk.content
        .replace(/\u0000/g, "")
        .replace(/[\u0001-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "")

      return {
        document_id: document.id,
        user_id: userId,
        chunk_index: chunk.chunkIndex,
        content: sanitizedContent,
        page_number: chunk.pageNumber,
        embedding: `[${embeddings[index].join(",")}]`,
        token_count: chunk.tokenCount,
      }
    })

    const { error: chunksError } = await supabase
      .from("rag_document_chunks")
      .insert(chunkRecords)

    if (chunksError) {
      throw new Error(`Failed to save chunks: ${chunksError.message}`)
    }

    // Update document status to ready
    await supabase
      .from("rag_documents")
      .update({
        status: "ready",
        processed_at: new Date().toISOString(),
      })
      .eq("id", document.id)

    return document.id
  } catch (error) {
    // Mark document as failed but don't delete it
    await supabase
      .from("rag_documents")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Processing failed",
      })
      .eq("id", document.id)

    throw error
  }
}

function jsonResponse(data: object, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
