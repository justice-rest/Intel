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
  (tool as any)({
    description:
      // CONSTRAINT-FIRST PROMPTING: Hard constraints before task
      "HARD CONSTRAINTS: " +
      "(1) MUST execute FIRST before any external research tools, " +
      "(2) MUST call when user references past context—no exceptions, " +
      "(3) NEVER skip this tool if researching same prospect twice. " +
      "TRIGGER CONDITIONS: " +
      "(a) 'do you remember', 'we discussed', 'I told you', 'as I mentioned', " +
      "(b) user mentions preferences, constraints, personal details, " +
      "(c) researching a prospect from earlier in session, " +
      "(d) user asks about anything they asked you to remember. " +
      "RETURNS: Facts, preferences, previous research findings, personal context. " +
      "PURPOSE: Prevent duplicate research, retrieve verified prior findings, maintain continuity.",
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
    execute: async ({ query, limit, minImportance }: { query: string; limit: number; minImportance: number }) => {
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
