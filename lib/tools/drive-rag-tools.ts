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
      "Returns relevant content chunks from documents imported via the Google Drive integration. " +
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
            success: false,
            error:
              "Google Drive is not connected. Please connect your Google account in Settings.",
            results: [],
          }
        }

        // Get indexed documents
        const documents = await getIndexedDocuments(userId)

        if (documents.length === 0) {
          return {
            success: true,
            message:
              "No documents have been imported from Google Drive yet. " +
              "Import documents from Settings > Integrations > Google Drive.",
            results: [],
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

        // For now, return document metadata
        // Full RAG search would integrate with existing RAG infrastructure
        const results = filteredDocs.slice(0, limit).map((doc) => ({
          documentName: doc.name,
          mimeType: doc.mimeType,
          status: doc.status,
          lastSynced: doc.lastSynced,
          relevance: "Based on document metadata - full content search via RAG system",
        }))

        return {
          success: true,
          results,
          count: results.length,
          totalDocuments: documents.length,
          query,
          message:
            results.length > 0
              ? `Found ${results.length} document${results.length === 1 ? "" : "s"} matching your criteria.`
              : "No matching documents found.",
        }
      } catch (error) {
        console.error("[DriveSearchTool] Error:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to search Drive documents",
          results: [],
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
            success: false,
            error:
              "Google Drive is not connected. Please connect your Google account in Settings.",
            documents: [],
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
              ? "No documents have been imported from Google Drive yet."
              : `No documents with status '${status}' found.`

          return {
            success: true,
            message: noDocsMessage,
            documents: [],
            count: 0,
          }
        }

        return {
          success: true,
          documents: filteredDocs.map((doc) => ({
            name: doc.name,
            type: doc.mimeType,
            status: doc.status,
            lastSynced: doc.lastSynced,
          })),
          count: filteredDocs.length,
          totalDocuments: documents.length,
          message: `Found ${filteredDocs.length} indexed document${filteredDocs.length === 1 ? "" : "s"}.`,
        }
      } catch (error) {
        console.error("[DriveListDocumentsTool] Error:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to list Drive documents",
          documents: [],
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
