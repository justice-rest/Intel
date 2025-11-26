/**
 * List Documents Tool
 * Allows AI to see what documents the user has uploaded
 */

import { tool } from "ai"
import { z } from "zod"

/**
 * Create a tool to list user's uploaded documents
 * @param userId - User ID to fetch documents for
 */
export const createListDocumentsTool = (userId: string) =>
  tool({
    description:
      "List all documents the user has uploaded. Use this when the user asks what documents they have, what files they've uploaded, or wants to see their document library. Returns document names, upload dates, page counts, and status.",
    parameters: z.object({
      status: z
        .enum(["ready", "processing", "failed", "all"])
        .optional()
        .describe(
          "Filter documents by status. 'ready' for processed documents, 'processing' for in-progress, 'failed' for errors, 'all' for everything. Defaults to 'ready'."
        ),
    }),
    execute: async ({ status = "ready" }) => {
      try {
        const { createClient } = await import("@/lib/supabase/server")
        const supabase = await createClient()

        if (!supabase) {
          return {
            success: false,
            error: "Database not configured",
            documents: [],
          }
        }

        // Build query
        let query = supabase
          .from("rag_documents")
          .select(
            "id, file_name, file_size, page_count, word_count, language, status, tags, created_at, processed_at"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })

        // Filter by status if not 'all'
        if (status !== "all") {
          query = query.eq("status", status)
        }

        const { data: documents, error } = await query

        if (error) {
          console.error("Error fetching documents:", error)
          return {
            success: false,
            error: "Failed to fetch documents",
            documents: [],
          }
        }

        if (!documents || documents.length === 0) {
          return {
            success: true,
            message:
              status === "ready"
                ? "You have no uploaded documents yet. Upload a PDF to get started!"
                : `No documents found with status '${status}'.`,
            documents: [],
            count: 0,
          }
        }

        // Format documents for AI
        const formattedDocuments = documents.map((doc) => ({
          id: doc.id,
          name: doc.file_name,
          sizeBytes: doc.file_size,
          sizeFormatted: formatBytes(doc.file_size),
          pageCount: doc.page_count,
          wordCount: doc.word_count,
          language: doc.language,
          status: doc.status,
          tags: doc.tags || [],
          uploadedAt: doc.created_at,
          processedAt: doc.processed_at,
        }))

        return {
          success: true,
          documents: formattedDocuments,
          count: formattedDocuments.length,
          message: `Found ${formattedDocuments.length} document${formattedDocuments.length > 1 ? "s" : ""}.`,
        }
      } catch (error) {
        console.error("List documents error:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to list documents",
          documents: [],
        }
      }
    },
  })

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}
