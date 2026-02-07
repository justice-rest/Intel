/**
 * Memory Extraction Durable Workflow
 *
 * This workflow handles memory extraction from conversations with:
 * - Automatic retry on transient failures (embedding API, database)
 * - Durable checkpointing (resume after server restart)
 * - Step-level observability
 *
 * Unlike fire-and-forget, this ensures memories are eventually saved.
 */

import { fetch } from "workflow"
import { z } from "zod"

// ============================================================================
// INPUT VALIDATION SCHEMA
// ============================================================================

/**
 * Strict schema for memory extraction parameters
 */
export const MemoryExtractionParamsSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  chatId: z.string().uuid("chatId must be a valid UUID"),
  userMessage: z.string().min(1, "userMessage is required"),
  assistantResponse: z.string().min(1, "assistantResponse is required"),
  messageId: z.string().optional(),
  apiKey: z.string().optional(),
})

export type MemoryExtractionParams = z.infer<typeof MemoryExtractionParamsSchema>

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface MemoryExtractionResult {
  success: boolean
  extracted: number
  saved: number
  skipped: number
  durationMs: number
  error?: string
}

// ============================================================================
// STEP FUNCTIONS
// ============================================================================

/**
 * Check if an explicit memory request exists in the user message
 */
async function detectExplicitMemoryStep(userMessage: string): Promise<{
  hasExplicit: boolean
  content: string | null
}> {
  const { detectExplicitMemory } = await import("@/lib/memory/extractor")
  const content = detectExplicitMemory(userMessage)
  return {
    hasExplicit: !!content,
    content,
  }
}

/**
 * Extract memories from conversation using AI
 */
async function extractMemoriesStep(
  userId: string,
  chatId: string,
  userMessage: string,
  assistantResponse: string,
  apiKey: string
): Promise<{
  memories: Array<{
    content: string
    category: string
    importance: number
    tags?: string[]
    context?: string
  }>
}> {
  const { extractMemories } = await import("@/lib/memory/extractor")

  const memories = await extractMemories(
    {
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantResponse },
      ],
      userId,
      chatId,
    },
    apiKey
  )

  return { memories }
}

/**
 * Check if a memory already exists (deduplication)
 */
async function checkDuplicateStep(
  content: string,
  userId: string,
  apiKey: string
): Promise<{ exists: boolean }> {
  const { memoryExists } = await import("@/lib/memory/storage")
  const exists = await memoryExists(content, userId, apiKey)
  return { exists }
}

/**
 * Generate embedding for memory content
 */
async function generateEmbeddingStep(
  content: string,
  apiKey: string
): Promise<{ embedding: number[] }> {
  const { generateEmbedding } = await import("@/lib/rag/embeddings")
  const result = await generateEmbedding(content, apiKey)
  return { embedding: result.embedding }
}

/**
 * Save a memory to the database
 */
async function saveMemoryStep(params: {
  userId: string
  content: string
  memoryType: "explicit" | "auto"
  importanceScore: number
  metadata: Record<string, unknown>
  embedding: number[]
}): Promise<{ saved: boolean }> {
  const { createMemory } = await import("@/lib/memory/storage")

  const savedMemory = await createMemory({
    user_id: params.userId,
    content: params.content,
    memory_type: params.memoryType,
    importance_score: params.importanceScore,
    metadata: params.metadata,
    embedding: params.embedding,
  })

  return { saved: !!savedMemory }
}

// ============================================================================
// MAIN WORKFLOW FUNCTION
// ============================================================================

/**
 * Durable Memory Extraction Workflow
 *
 * Extracts important facts from conversations and saves them as memories.
 * Each step is checkpointed, ensuring memories are eventually saved even
 * if the server restarts mid-processing.
 *
 * @param params - Validated extraction parameters
 * @returns MemoryExtractionResult with counts and status
 *
 * @example
 * ```typescript
 * import { extractMemoriesWorkflow } from "@/lib/workflows/memory-extraction.workflow"
 * import { runDurableWorkflow } from "@/lib/workflows"
 *
 * const result = await runDurableWorkflow(extractMemoriesWorkflow, {
 *   userId: user.id,
 *   chatId: chat.id,
 *   userMessage: "Remember that my dog's name is Max",
 *   assistantResponse: "I'll remember that...",
 * })
 * ```
 */
export async function extractMemoriesWorkflow(
  params: MemoryExtractionParams
): Promise<MemoryExtractionResult> {
  "use workflow"

  // Polyfill global fetch with workflow-aware step function.
  // The Workflow DevKit sandboxes global fetch; AI SDK and embedding
  // calls need it available via globalThis.
  globalThis.fetch = fetch

  const startTime = Date.now()

  // Validate inputs
  const validated = MemoryExtractionParamsSchema.safeParse(params)
  if (!validated.success) {
    const errorMessage = `Invalid params: ${validated.error.message}`
    console.error("[Memory Workflow] Validation failed:", errorMessage)
    return {
      success: false,
      extracted: 0,
      saved: 0,
      skipped: 0,
      durationMs: Date.now() - startTime,
      error: errorMessage,
    }
  }

  // Check if memory system is enabled
  const { isMemoryEnabled } = await import("@/lib/memory/config")
  if (!isMemoryEnabled()) {
    console.log("[Memory Workflow] Memory system is disabled")
    return {
      success: true,
      extracted: 0,
      saved: 0,
      skipped: 0,
      durationMs: Date.now() - startTime,
    }
  }

  const apiKey = params.apiKey || process.env.OPENROUTER_API_KEY || ""
  if (!apiKey) {
    console.warn("[Memory Workflow] No API key available")
    return {
      success: false,
      extracted: 0,
      saved: 0,
      skipped: 0,
      durationMs: Date.now() - startTime,
      error: "No API key available for embedding generation",
    }
  }

  let extracted = 0
  let saved = 0
  let skipped = 0

  try {
    // Step 1: Check for explicit memory request
    "use step"
    console.log("[Memory Workflow] Step 1: Detecting explicit memory...")
    const explicitResult = await detectExplicitMemoryStep(params.userMessage)

    if (explicitResult.hasExplicit && explicitResult.content) {
      // Handle explicit memory (high priority, always save)
      "use step"
      console.log("[Memory Workflow] Step 2a: Generating embedding for explicit memory...")
      const embeddingResult = await generateEmbeddingStep(explicitResult.content, apiKey)

      "use step"
      console.log("[Memory Workflow] Step 3a: Saving explicit memory...")
      const saveResult = await saveMemoryStep({
        userId: params.userId,
        content: explicitResult.content,
        memoryType: "explicit",
        importanceScore: 0.9, // Explicit memories are high importance
        metadata: {
          source_chat_id: params.chatId,
          source_message_id: params.messageId,
        },
        embedding: embeddingResult.embedding,
      })

      if (saveResult.saved) {
        console.log("[Memory Workflow] Explicit memory saved successfully")
        return {
          success: true,
          extracted: 1,
          saved: 1,
          skipped: 0,
          durationMs: Date.now() - startTime,
        }
      }
    }

    // Step 2: Auto-extract memories from conversation
    "use step"
    console.log("[Memory Workflow] Step 2: Extracting memories from conversation...")
    const extractionResult = await extractMemoriesStep(
      params.userId,
      params.chatId,
      params.userMessage,
      params.assistantResponse,
      apiKey
    )

    extracted = extractionResult.memories.length
    console.log(`[Memory Workflow] Found ${extracted} potential memories`)

    if (extracted === 0) {
      return {
        success: true,
        extracted: 0,
        saved: 0,
        skipped: 0,
        durationMs: Date.now() - startTime,
      }
    }

    // Step 3: Process each memory
    for (let i = 0; i < extractionResult.memories.length; i++) {
      const memory = extractionResult.memories[i]

      try {
        // Step 3a: Check for duplicates
        "use step"
        console.log(`[Memory Workflow] Checking duplicate for memory ${i + 1}/${extracted}...`)
        const duplicateResult = await checkDuplicateStep(memory.content, params.userId, apiKey)

        if (duplicateResult.exists) {
          console.log(`[Memory Workflow] Skipping duplicate memory ${i + 1}`)
          skipped++
          continue
        }

        // Step 3b: Generate embedding
        "use step"
        console.log(`[Memory Workflow] Generating embedding for memory ${i + 1}...`)
        const embeddingResult = await generateEmbeddingStep(memory.content, apiKey)

        // Step 3c: Save memory
        "use step"
        console.log(`[Memory Workflow] Saving memory ${i + 1}...`)
        const saveResult = await saveMemoryStep({
          userId: params.userId,
          content: memory.content,
          memoryType: "auto",
          importanceScore: memory.importance,
          metadata: {
            source_chat_id: params.chatId,
            source_message_id: params.messageId,
            category: memory.category,
            tags: memory.tags,
            context: memory.context,
          },
          embedding: embeddingResult.embedding,
        })

        if (saveResult.saved) {
          saved++
          console.log(`[Memory Workflow] Memory ${i + 1} saved successfully`)
        }
      } catch (memoryError) {
        console.error(`[Memory Workflow] Error processing memory ${i + 1}:`, memoryError)
        // Continue with next memory, don't fail the whole workflow
      }
    }

    const durationMs = Date.now() - startTime
    console.log(`[Memory Workflow] Completed in ${durationMs}ms: extracted=${extracted}, saved=${saved}, skipped=${skipped}`)

    return {
      success: true,
      extracted,
      saved,
      skipped,
      durationMs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Memory Workflow] Failed:", errorMessage)

    return {
      success: false,
      extracted,
      saved,
      skipped,
      durationMs: Date.now() - startTime,
      error: errorMessage,
    }
  }
}
