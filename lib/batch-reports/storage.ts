/**
 * Batch Reports Embedding Storage
 *
 * Handles generating and storing embeddings for completed batch reports
 */

import { createClient } from "@/lib/supabase/server"
import { generateEmbedding } from "@/lib/rag/embeddings"
import { EMBEDDING_MODEL } from "./config"
import type {
  GenerateEmbeddingParams,
  EmbeddingGenerationResult,
  BackfillResult,
} from "./types"

/**
 * Generate and store embedding for a completed batch report
 * Called after a batch item completes processing
 *
 * @param params - Item ID, report content, and prospect name
 * @param apiKey - OpenRouter API key for embedding generation
 * @returns Success status and any error message
 */
export async function generateBatchReportEmbedding(
  params: GenerateEmbeddingParams,
  apiKey: string
): Promise<EmbeddingGenerationResult> {
  const { itemId, reportContent, prospectName } = params

  if (!reportContent || reportContent.trim().length === 0) {
    return {
      success: false,
      itemId,
      error: "Report content is empty",
    }
  }

  if (!apiKey) {
    return {
      success: false,
      itemId,
      error: "API key is required for embedding generation",
    }
  }

  try {
    const supabase = await createClient()
    if (!supabase) {
      return {
        success: false,
        itemId,
        error: "Supabase client not available",
      }
    }

    // Combine prospect name and report for better semantic search
    // The name is important for finding the right prospect
    const textToEmbed = `Prospect: ${prospectName}\n\n${reportContent}`

    // Generate embedding using the RAG embeddings module
    const embeddingResult = await generateEmbedding(textToEmbed, apiKey, EMBEDDING_MODEL)

    // Convert embedding array to JSON string for storage (same format as memory system)
    const embeddingString = JSON.stringify(embeddingResult.embedding)

    // Update the batch item with the embedding
    // Use type assertion since batch_prospect_items is not in generated types
    const { error: updateError } = await (supabase as any)
      .from("batch_prospect_items")
      .update({
        embedding: embeddingString,
        embedding_generated_at: new Date().toISOString(),
        embedding_model: EMBEDDING_MODEL,
      })
      .eq("id", itemId)

    if (updateError) {
      console.error("[BatchReports] Failed to store embedding:", updateError)
      return {
        success: false,
        itemId,
        error: `Failed to store embedding: ${updateError.message}`,
      }
    }

    return {
      success: true,
      itemId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[BatchReports] Failed to generate embedding:", errorMessage)
    return {
      success: false,
      itemId,
      error: errorMessage,
    }
  }
}

/**
 * Backfill embeddings for existing completed reports without embeddings
 * Useful for migrating existing data
 *
 * @param userId - User ID to backfill reports for
 * @param apiKey - OpenRouter API key
 * @param batchSize - Number of reports to process at a time
 * @returns Count of processed, failed, and skipped items
 */
export async function backfillBatchReportEmbeddings(
  userId: string,
  apiKey: string,
  batchSize: number = 10
): Promise<BackfillResult> {
  const result: BackfillResult = {
    processed: 0,
    failed: 0,
    skipped: 0,
  }

  if (!apiKey) {
    console.error("[BatchReports] API key required for backfill")
    return result
  }

  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("[BatchReports] Supabase client not available")
      return result
    }

    // Get completed items without embeddings
    // Use type assertion since batch_prospect_items is not in generated types
    const { data: items, error: fetchError } = await (supabase as any)
      .from("batch_prospect_items")
      .select("id, prospect_name, report_content")
      .eq("user_id", userId)
      .eq("status", "completed")
      .is("embedding", null)
      .not("report_content", "is", null)
      .order("created_at", { ascending: false })
      .limit(batchSize) as { data: Array<{ id: string; prospect_name: string | null; report_content: string | null }> | null; error: any }

    if (fetchError) {
      console.error("[BatchReports] Failed to fetch items for backfill:", fetchError)
      return result
    }

    if (!items || items.length === 0) {
      console.log("[BatchReports] No items to backfill")
      return result
    }

    console.log(`[BatchReports] Backfilling ${items.length} items...`)

    // Process each item
    for (const item of items) {
      if (!item.report_content) {
        result.skipped++
        continue
      }

      const embeddingResult = await generateBatchReportEmbedding(
        {
          itemId: item.id,
          reportContent: item.report_content,
          prospectName: item.prospect_name || "Unknown Prospect",
        },
        apiKey
      )

      if (embeddingResult.success) {
        result.processed++
      } else {
        result.failed++
        console.error(
          `[BatchReports] Failed to backfill item ${item.id}: ${embeddingResult.error}`
        )
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log(
      `[BatchReports] Backfill complete: ${result.processed} processed, ${result.failed} failed, ${result.skipped} skipped`
    )

    return result
  } catch (error) {
    console.error("[BatchReports] Backfill error:", error)
    return result
  }
}

/**
 * Check if a batch item has an embedding
 *
 * @param itemId - The item ID to check
 * @returns True if the item has an embedding
 */
export async function hasEmbedding(itemId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return false
    }

    // Use type assertion since batch_prospect_items is not in generated types
    const { data, error } = await (supabase as any)
      .from("batch_prospect_items")
      .select("embedding")
      .eq("id", itemId)
      .single() as { data: { embedding: any } | null; error: any }

    if (error || !data) {
      return false
    }

    return data.embedding !== null
  } catch {
    return false
  }
}
