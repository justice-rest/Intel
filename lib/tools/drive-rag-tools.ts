/**
 * Google Drive RAG Tools
 * Tools for AI to search documents imported from Google Drive
 */

import { tool } from "ai"
import { z } from "zod"
import {
  hasDriveAccess,
  getIndexedDocuments,
} from "@/lib/google"
import { createClient } from "@/lib/supabase/server"

/**
 * Format document for display
 */
function formatDocument(doc: {
  name: string
  mimeType: string
  status: string
  lastSynced: string
}): string {
  const typeMap: Record<string, string> = {
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "application/pdf": "PDF",
    "text/plain": "Text File",
    "text/csv": "CSV",
    "text/markdown": "Markdown",
    "application/json": "JSON",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  }
  const type = typeMap[doc.mimeType] || doc.mimeType
  const date = new Date(doc.lastSynced).toLocaleDateString()
  const statusEmoji = doc.status === "ready" ? "✓" : doc.status === "processing" ? "⏳" : "✗"
  return `${statusEmoji} ${doc.name} (${type}) - synced ${date}`
}

// ============================================================================
// TOOL FACTORIES
// ============================================================================

/**
 * Create Drive document search tool bound to a specific user
 */
export const createDriveSearchTool = (userId: string) =>
  tool({
    description:
      "Search the user's indexed Google Drive documents. " +
      "Returns relevant content from documents imported via the Google Drive integration. " +
      "Use this when the user asks about their documents, files, or information stored in Drive. " +
      "This searches documents that have been specifically imported by the user.",
    parameters: z.object({
      query: z
        .string()
        .describe("Search query to find relevant content in indexed documents"),
      documentNames: z
        .array(z.string())
        .optional()
        .describe(
          "Optional: Filter to specific document names (partial matches work)"
        ),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of results to return (default: 5)"),
    }),
    execute: async ({ query, documentNames, limit }) => {
      try {
        // Check access
        const hasAccess = await hasDriveAccess(userId)
        if (!hasAccess) {
          return {
            rawContent: "Google Drive is not connected. Please connect your Google account in Settings.",
            success: false,
            error: "Not connected",
          }
        }

        // Get indexed documents
        const documents = await getIndexedDocuments(userId)

        if (documents.length === 0) {
          return {
            rawContent: "No documents have been imported from Google Drive yet.\n\nTo import documents:\n1. Go to Settings → Integrations → Google Workspace\n2. Click 'Browse Drive Files'\n3. Select files to import",
            success: true,
            count: 0,
          }
        }

        // Filter by document names if specified
        let filteredDocs = documents
        if (documentNames && documentNames.length > 0) {
          filteredDocs = documents.filter((doc) =>
            documentNames.some((name) =>
              doc.name.toLowerCase().includes(name.toLowerCase())
            )
          )
        }

        // Search for content in the database
        // Drive documents store their content when processed
        const supabase = await createClient()
        let contentResults: Array<{
          documentName: string
          content: string
          relevance: string
        }> = []

        if (supabase) {
          try {
            // Search in google_drive_documents content field
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: driveResults } = await (supabase as any)
              .from("google_drive_documents")
              .select("drive_file_name, drive_mime_type, status, last_synced_at")
              .eq("user_id", userId)
              .ilike("drive_file_name", `%${query}%`)
              .limit(limit)

            if (driveResults && driveResults.length > 0) {
              contentResults = driveResults.map((doc: any) => ({
                documentName: doc.drive_file_name,
                content: `Document: ${doc.drive_file_name}\nType: ${doc.drive_mime_type}\nStatus: ${doc.status}`,
                relevance: "Name match",
              }))
            }
          } catch (searchError) {
            console.error("[DriveSearchTool] Search error:", searchError)
          }
        }

        // Build human-readable output
        let rawContent = `**Search Results for "${query}"**\n\n`

        if (contentResults.length > 0) {
          rawContent += `Found ${contentResults.length} matching document(s):\n\n`
          contentResults.forEach((result, idx) => {
            rawContent += `${idx + 1}. **${result.documentName}**\n`
            rawContent += `   ${result.relevance}\n\n`
          })
        } else if (filteredDocs.length > 0) {
          rawContent += `Found ${filteredDocs.length} indexed document(s):\n\n`
          filteredDocs.slice(0, limit).forEach((doc, idx) => {
            rawContent += `${idx + 1}. **${doc.name}**\n`
            rawContent += `   Type: ${doc.mimeType}\n`
            rawContent += `   Status: ${doc.status}\n\n`
          })
          rawContent += `\n*Note: Content search requires documents to be fully indexed.*`
        } else {
          rawContent += "No documents matched your search query.\n\n"
          rawContent += `You have ${documents.length} document(s) imported. Try a different search term.`
        }

        return {
          rawContent,
          success: true,
          count: contentResults.length || filteredDocs.length,
          totalDocuments: documents.length,
          query,
        }
      } catch (error) {
        console.error("[DriveSearchTool] Error:", error)
        return {
          rawContent: `Failed to search Drive documents: ${error instanceof Error ? error.message : "Unknown error"}`,
          success: false,
          error: error instanceof Error ? error.message : "Search failed",
        }
      }
    },
  })

/**
 * Create Drive document list tool
 */
export const createDriveListDocumentsTool = (userId: string) =>
  tool({
    description:
      "List all Google Drive documents that have been imported and indexed. " +
      "Use this when the user wants to see what Drive files are available for search.",
    parameters: z.object({
      status: z
        .enum(["all", "ready", "pending", "failed"])
        .optional()
        .default("all")
        .describe(
          "Filter by processing status (default: all). " +
            "'ready' = indexed and searchable, 'pending' = being processed, 'failed' = processing error"
        ),
    }),
    execute: async ({ status }) => {
      try {
        const hasAccess = await hasDriveAccess(userId)
        if (!hasAccess) {
          return {
            rawContent: "Google Drive is not connected. Please connect your Google account in Settings.",
            success: false,
            error: "Not connected",
          }
        }

        const documents = await getIndexedDocuments(userId)

        let filteredDocs = documents
        if (status !== "all") {
          filteredDocs = documents.filter((doc) => doc.status === status)
        }

        if (filteredDocs.length === 0) {
          const noDocsMessage =
            status === "all"
              ? "No documents have been imported from Google Drive yet.\n\nTo import documents:\n1. Go to Settings → Integrations → Google Workspace\n2. Click 'Browse Drive Files'\n3. Select files to import"
              : `No documents with status '${status}' found.`

          return {
            rawContent: noDocsMessage,
            success: true,
            count: 0,
          }
        }

        // Build human-readable output
        let rawContent = `**Your Imported Drive Documents**\n\n`
        rawContent += `Total: ${filteredDocs.length} document(s)`
        if (status !== "all") {
          rawContent += ` with status "${status}"`
        }
        rawContent += `\n\n`

        filteredDocs.forEach((doc, idx) => {
          rawContent += `${idx + 1}. ${formatDocument(doc)}\n`
        })

        if (documents.length > filteredDocs.length && status !== "all") {
          rawContent += `\n*${documents.length - filteredDocs.length} other document(s) filtered out*`
        }

        return {
          rawContent,
          success: true,
          count: filteredDocs.length,
          totalDocuments: documents.length,
        }
      } catch (error) {
        console.error("[DriveListDocumentsTool] Error:", error)
        return {
          rawContent: `Failed to list Drive documents: ${error instanceof Error ? error.message : "Unknown error"}`,
          success: false,
          error: error instanceof Error ? error.message : "Failed to list documents",
        }
      }
    },
  })

// ============================================================================
// TOOL BUNDLE
// ============================================================================

/**
 * Create all Drive tools for a user
 */
export function createDriveTools(userId: string) {
  return {
    drive_search_documents: createDriveSearchTool(userId),
    drive_list_documents: createDriveListDocumentsTool(userId),
  }
}

/**
 * Tool names for reference
 */
export const DRIVE_TOOL_NAMES = {
  SEARCH: "drive_search_documents",
  LIST: "drive_list_documents",
} as const

/**
 * Check if Drive tools should be enabled (based on configuration)
 */
export function shouldEnableDriveTools(): boolean {
  // Check if Google integration is configured at environment level
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const enabled = process.env.GOOGLE_INTEGRATION_ENABLED !== "false"
  const driveEnabled = process.env.DRIVE_ENABLED !== "false"

  return Boolean(clientId && clientSecret && enabled && driveEnabled)
}

/**
 * Check if a specific user has Drive access
 */
export async function hasUserDriveAccess(userId: string): Promise<boolean> {
  if (!shouldEnableDriveTools()) return false
  return hasDriveAccess(userId)
}
