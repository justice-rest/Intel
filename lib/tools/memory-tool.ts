/**
 * Memory Search Tool
 * Allows AI to search user's memories for relevant context
 *
 * OPTIMIZED: Uses static imports for faster execution
 */

import { tool } from "ai"
import { z } from "zod"
import { searchMemories } from "@/lib/memory/retrieval"

/**
 * Create a memory search tool bound to a specific user
 * @param userId - User ID to search memories for
 */
export const createMemorySearchTool = (userId: string) =>
  tool({
    description:
      "PROACTIVELY search user memories for context. Execute this tool IMMEDIATELY when: " +
      "(1) user says 'do you remember', 'we discussed', 'I told you', or references past conversations, " +
      "(2) user mentions their preferences, constraints, or personal details, " +
      "(3) researching a prospect you've researched before in this session, " +
      "(4) user asks about anything they explicitly asked you to remember. " +
      "Returns facts, preferences, previous research, and personal context. " +
      "ALWAYS call this FIRST before external research to avoid duplicate work.",
    parameters: z.object({
      query: z
        .string()
        .describe(
          "What you want to recall about the user. Can be a question like 'What is the user's name?' or a topic like 'user preferences for communication'"
        ),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of memories to return (default: 5, max: 20)"),
      minImportance: z
        .number()
        .optional()
        .default(0)
        .describe(
          "Minimum importance score for memories (0-1). Higher values return only more important memories."
        ),
    }),
    execute: async ({ query, limit, minImportance }) => {
      try {
        // Get OpenRouter API key from environment
        const openrouterKey = process.env.OPENROUTER_API_KEY
        if (!openrouterKey) {
          return {
            success: false,
            error: "Memory search is not configured (missing API key)",
            memories: [],
          }
        }

        // Search memories using the bound userId
        const results = await searchMemories(
          {
            query,
            userId,
            limit: Math.min(limit, 20), // Cap at 20
            similarityThreshold: 0.5,
            minImportance: minImportance,
          },
          openrouterKey
        )

        if (results.length === 0) {
          return {
            success: true,
            message: "No relevant memories found for this query.",
            memories: [],
            query,
          }
        }

        // Format results for the AI
        const formattedMemories = results.map((result) => {
          const metadata = result.metadata as any
          return {
            content: result.content,
            importance: Math.round(result.importance_score * 100) / 100,
            category: metadata?.category || "general",
            tags: metadata?.tags || [],
            similarity: Math.round(result.similarity * 100),
            created: result.created_at,
            lastAccessed: result.last_accessed_at,
          }
        })

        return {
          success: true,
          memories: formattedMemories,
          count: results.length,
          query,
          message: `Found ${results.length} relevant ${results.length === 1 ? "memory" : "memories"}.`,
        }
      } catch (error) {
        console.error("Memory search error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to search memories",
          memories: [],
        }
      }
    },
  })

/**
 * Tool name for registration
 */
export const MEMORY_SEARCH_TOOL_NAME = "search_memory"
