/**
 * Document Analysis API Route
 *
 * Triggers AI-powered analysis of uploaded documents to extract:
 * - Voice elements (tone, terminology, style)
 * - Strategy rules (cultivation, solicitation, stewardship)
 * - Knowledge facts (mission, programs, impact)
 * - Examples (good/bad communication patterns)
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types. After running
 * the migration and regenerating types, these assertions can be removed.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/knowledge/config'
import { processPDF, isValidPDF } from '@/lib/rag/pdf-processor'
import { processOfficeDocument, isSupportedOfficeFormat } from '@/lib/rag/office-processor'
import { analyzeDocument, classifyDocumentPurpose } from '@/lib/knowledge/processors'
import type { KnowledgeDocument, ProcessorAnalysisResults } from '@/lib/knowledge/types'

// Type helper for knowledge table queries (until types are regenerated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

interface AnalyzeRequest {
  document_id: string
}

/**
 * POST /api/knowledge/documents/analyze
 * Trigger AI analysis of a document
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured' },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      )
    }

    const body = (await req.json()) as AnalyzeRequest

    if (!body.document_id) {
      return NextResponse.json(
        { success: false, error: 'document_id is required' },
        { status: 400 }
      )
    }

    // Get document with ownership check
    const { data: document, error: docError } = await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .select('*')
      .eq('id', body.document_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.DOCUMENT_NOT_FOUND },
        { status: 404 }
      )
    }

    const doc = document as KnowledgeDocument

    // Check if already processing
    if (doc.status === 'processing') {
      return NextResponse.json(
        { success: false, error: 'Document is already being processed' },
        { status: 409 }
      )
    }

    // Update status to processing
    await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .update({ status: 'processing', error_message: null })
      .eq('id', doc.id)

    try {
      // Step 1: Download file from storage
      const fileUrl = doc.file_url
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())

      // Step 2: Extract text based on file type
      let extractedText = ''
      let pageCount: number | undefined
      let wordCount: number | undefined

      if (doc.file_type === 'application/pdf') {
        if (!isValidPDF(buffer)) {
          throw new Error('Invalid PDF file')
        }
        const result = await processPDF(buffer)
        extractedText = result.text
        pageCount = result.pageCount
        wordCount = result.wordCount
      } else if (isSupportedOfficeFormat(doc.file_type)) {
        const result = await processOfficeDocument(buffer, doc.file_type, doc.file_name)
        extractedText = result.text
        wordCount = result.wordCount
      } else if (
        doc.file_type === 'text/plain' ||
        doc.file_type === 'text/markdown' ||
        doc.file_type.startsWith('text/')
      ) {
        extractedText = buffer.toString('utf-8')
        wordCount = extractedText.split(/\s+/).filter((w) => w.length > 0).length
      } else {
        throw new Error(`Unsupported file type: ${doc.file_type}`)
      }

      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error('Document contains insufficient text content')
      }

      // Step 3: Classify document purpose (optional but helpful)
      const purposes = await classifyDocumentPurpose(extractedText, doc.file_name)

      // Step 4: Analyze document with AI
      const analysisResult = await analyzeDocument({
        documentId: doc.id,
        profileId: doc.profile_id,
        text: extractedText,
        fileName: doc.file_name,
        fileType: doc.file_type,
        docPurposes: purposes,
      })

      if (!analysisResult.success || !analysisResult.analysis) {
        throw new Error(analysisResult.error || 'Analysis failed')
      }

      const analysis = analysisResult.analysis

      // Step 5: Save extracted elements to database
      const savePromises: Promise<unknown>[] = []

      // Save voice elements
      if (analysis.voice_elements.length > 0) {
        savePromises.push(
          (supabase as KnowledgeClient).from('knowledge_voice_elements').insert(
            analysis.voice_elements.map((v) => ({
              profile_id: doc.profile_id,
              element_type: v.element_type,
              value: v.value,
              description: v.description,
              confidence: v.confidence,
              source_document_id: doc.id,
              source_excerpt: v.source_excerpt,
              is_user_defined: false,
              is_active: true,
            }))
          )
        )
      }

      // Save strategy rules
      if (analysis.strategy_rules.length > 0) {
        savePromises.push(
          (supabase as KnowledgeClient).from('knowledge_strategy_rules').insert(
            analysis.strategy_rules.map((s) => ({
              profile_id: doc.profile_id,
              category: s.category,
              rule: s.rule,
              rationale: s.rationale,
              priority: s.priority,
              source_type: 'extracted',
              source_document_id: doc.id,
              is_active: true,
            }))
          )
        )
      }

      // Save facts
      if (analysis.facts.length > 0) {
        savePromises.push(
          (supabase as KnowledgeClient).from('knowledge_facts').insert(
            analysis.facts.map((f) => ({
              profile_id: doc.profile_id,
              category: f.category,
              fact: f.fact,
              importance: f.importance,
              source_document_id: doc.id,
              is_user_defined: false,
              is_active: true,
            }))
          )
        )
      }

      // Save examples
      if (analysis.examples.length > 0) {
        savePromises.push(
          (supabase as KnowledgeClient).from('knowledge_examples').insert(
            analysis.examples.map((e) => ({
              profile_id: doc.profile_id,
              example_type: e.example_type,
              category: e.category,
              title: e.title,
              context: e.context,
              input: e.input,
              output: e.output,
              explanation: e.explanation,
              source_type: 'document',
              source_document_id: doc.id,
              is_active: true,
            }))
          )
        )
      }

      await Promise.all(savePromises)

      // Step 6: Update document with results
      await (supabase as KnowledgeClient)
        .from('knowledge_documents')
        .update({
          status: 'analyzed',
          raw_text: extractedText.slice(0, 100000), // Limit stored text
          page_count: pageCount,
          word_count: wordCount,
          doc_purpose: purposes,
          analysis_results: {
            summary: analysis.summary,
            document_type: analysis.document_type,
            counts: {
              voice_elements: analysis.voice_elements.length,
              strategy_rules: analysis.strategy_rules.length,
              facts: analysis.facts.length,
              examples: analysis.examples.length,
            },
            token_usage: analysisResult.tokenUsage,
          },
          processed_at: new Date().toISOString(),
        })
        .eq('id', doc.id)

      // Log to audit
      await (supabase as KnowledgeClient).from('knowledge_audit_log').insert({
        user_id: user.id,
        profile_id: doc.profile_id,
        action: 'analyze',
        entity_type: 'document',
        entity_id: doc.id,
        new_value: {
          voice_elements: analysis.voice_elements.length,
          strategy_rules: analysis.strategy_rules.length,
          facts: analysis.facts.length,
          examples: analysis.examples.length,
        },
      })

      return NextResponse.json({
        success: true,
        message: SUCCESS_MESSAGES.DOCUMENT_ANALYZED,
        analysis: {
          summary: analysis.summary,
          document_type: analysis.document_type,
          counts: {
            voice_elements: analysis.voice_elements.length,
            strategy_rules: analysis.strategy_rules.length,
            facts: analysis.facts.length,
            examples: analysis.examples.length,
          },
        },
      })
    } catch (analysisError) {
      // Update document with error status
      const errorMessage =
        analysisError instanceof Error ? analysisError.message : 'Analysis failed'

      await (supabase as KnowledgeClient)
        .from('knowledge_documents')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', doc.id)

      console.error('Document analysis failed:', analysisError)
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('POST /api/knowledge/documents/analyze error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis request failed',
      },
      { status: 500 }
    )
  }
}
