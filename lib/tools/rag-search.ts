/**
 * RAG Search Tool
 * Allows AI to search user's uploaded documents using vector similarity
 *
 * OPTIMIZED: Uses static imports for faster execution
 */

import { tool } from "ai"
import { z } from "zod"
import { generateEmbedding } from "@/lib/rag/embeddings"
import { searchDocumentChunks } from "@/lib/rag/search"
import { getCachedEmbedding, setCachedEmbedding } from "@/lib/memory/embedding-cache"

/**
 * Create a RAG search tool bound to a specific user
 * @param userId - User ID to search documents for
 */
export const createRagSearchTool = (userId: string) => tool({
  description:
    "Search the user's uploaded documents for relevant information. Use this when the user's question relates to their uploaded PDFs (annual reports, research papers, donor data, fundraising documents, etc.). This tool performs semantic search across all documents the user has uploaded.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "The search query. Can be the user's full question or specific keywords to search for in their documents."
      ),
    documentIds: z
      .array(z.string())
      .optional()
      .describe(
        "Optional: Specific document IDs to search within. If not provided, searches across all user documents."
      ),
  }),
  execute: async ({ query, documentIds }) => {
    try {
      // Get OpenRouter API key from environment
      const openrouterKey = process.env.OPENROUTER_API_KEY
      if (!openrouterKey) {
        return {
          success: false,
          error: "RAG search is not configured (missing API key)",
          results: [],
        }
      }

      // OPTIMIZATION: Check embedding cache first
      let embedding = getCachedEmbedding(query)

      if (!embedding) {
        // Generate embedding for the search query
        const embeddingResponse = await generateEmbedding(query, openrouterKey)
        embedding = embeddingResponse.embedding
        // Cache for future use
        setCachedEmbedding(query, embedding)
      }

      // Search for similar chunks using the bound userId
      const results = await searchDocumentChunks(
        embedding,
        userId, // Use the userId bound to this tool instance
        {
          maxResults: 5,
          similarityThreshold: 0.5, // Lower threshold for broader matches
          documentIds: documentIds || undefined,
        }
      )

      if (results.length === 0) {
        return {
          success: true,
          message: "No relevant information found in your documents.",
          results: [],
          query,
        }
      }

      // Format results for the AI
      const formattedResults = results.map((result) => ({
        document: result.document_name,
        page: result.page_number,
        content: result.content,
        similarity: Math.round(result.similarity * 100),
        documentId: result.document_id,
        chunkId: result.id,
      }))

      return {
        success: true,
        results: formattedResults,
        query,
        resultsCount: results.length,
        message: `Found ${results.length} relevant passage${results.length > 1 ? "s" : ""} from your documents.`,
      }
    } catch (error) {
      console.error("RAG search error:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to search documents",
        results: [],
      }
    }
  },
})
