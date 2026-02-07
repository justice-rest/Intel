/**
 * Batch Research Durable Workflow
 *
 * This workflow wraps the existing batch processing pipeline with
 * workflow-level durability. It does NOT replace the existing
 * circuit breakers, retry policies, or checkpointing - it enhances them.
 *
 * Benefits over direct calls:
 * - Survives server restarts (workflow state persisted)
 * - Automatic retry at workflow level (in addition to step-level retries)
 * - Structured observability via workflow dashboard
 * - Rate limiting via sleep() without resource consumption
 *
 * The existing ResearchPipeline handles:
 * - Circuit breakers per service (LinkUp, Grok, SEC/FEC)
 * - Exponential backoff with jitter
 * - Checkpoint-based resume within a single request
 *
 * This workflow adds:
 * - Cross-request durability
 * - Workflow-level retry on infrastructure failures
 * - Sleep-based rate limiting between prospects
 */

import { fetch } from "workflow"
import { z } from "zod"

// ============================================================================
// INPUT VALIDATION SCHEMA
// ============================================================================

/**
 * Prospect input data schema - matches ProspectInputData interface
 */
export const ProspectInputSchema = z.object({
  name: z.string().min(1, "name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  full_address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
}).passthrough() // Allow additional fields

/**
 * Batch research workflow parameters
 */
export const BatchResearchParamsSchema = z.object({
  jobId: z.string().uuid("jobId must be a valid UUID"),
  itemId: z.string().uuid("itemId must be a valid UUID"),
  userId: z.string().uuid("userId must be a valid UUID"),
  prospect: ProspectInputSchema,
  apiKey: z.string().optional(),
  organizationContext: z.string().optional(),
})

export type BatchResearchParams = z.infer<typeof BatchResearchParamsSchema>

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface BatchResearchResult {
  success: boolean
  itemId: string
  jobId: string
  reportContent?: string
  romyScore?: number
  romyScoreTier?: string
  capacityRating?: string
  estimatedNetWorth?: number
  estimatedGiftCapacity?: number
  recommendedAsk?: number
  sourcesFound?: Array<{ name: string; url: string }>
  tokensUsed?: number
  errorMessage?: string
  durationMs: number
}

// ============================================================================
// STEP FUNCTIONS
// ============================================================================

/**
 * Execute research using existing pipeline
 * This wraps generateProspectReport with workflow durability
 */
async function executeResearchStep(params: BatchResearchParams): Promise<{
  success: boolean
  reportContent?: string
  structuredData?: Record<string, unknown>
  romyScore?: number
  romyScoreTier?: string
  capacityRating?: string
  estimatedNetWorth?: number
  estimatedGiftCapacity?: number
  recommendedAsk?: number
  sourcesFound?: Array<{ name: string; url: string }>
  tokensUsed?: number
  errorMessage?: string
}> {
  // Dynamic import to avoid circular dependencies
  const { generateProspectReport } = await import("@/lib/batch-processing/report-generator")

  const result = await generateProspectReport({
    prospect: params.prospect as import("@/lib/batch-processing/types").ProspectInputData,
    apiKey: params.apiKey,
    organizationContext: params.organizationContext,
  })

  return {
    success: result.success,
    reportContent: result.report_content,
    structuredData: result.structured_data as Record<string, unknown> | undefined,
    romyScore: result.romy_score,
    romyScoreTier: result.romy_score_tier,
    capacityRating: result.capacity_rating,
    estimatedNetWorth: result.estimated_net_worth,
    estimatedGiftCapacity: result.estimated_gift_capacity,
    recommendedAsk: result.recommended_ask,
    sourcesFound: result.sources_found,
    tokensUsed: result.tokens_used,
    errorMessage: result.error_message,
  }
}

/**
 * Update item status in database
 */
async function updateItemStatusStep(
  itemId: string,
  status: "completed" | "failed",
  result: Awaited<ReturnType<typeof executeResearchStep>>
): Promise<{ updated: boolean }> {
  const { createClient } = await import("@/lib/supabase/server")

  const supabase = await createClient()
  if (!supabase) {
    console.error("[Batch Workflow] Supabase not configured")
    return { updated: false }
  }

  // Use 'any' cast as batch tables aren't in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  if (status === "completed" && result.success) {
    const { error } = await db
      .from("batch_prospect_items")
      .update({
        status: "completed",
        report_content: result.reportContent,
        structured_data: result.structuredData,
        romy_score: result.romyScore,
        romy_score_tier: result.romyScoreTier,
        capacity_rating: result.capacityRating,
        estimated_net_worth: result.estimatedNetWorth,
        estimated_gift_capacity: result.estimatedGiftCapacity,
        recommended_ask: result.recommendedAsk,
        sources_found: result.sourcesFound,
        tokens_used: result.tokensUsed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", itemId)

    if (error) {
      console.error("[Batch Workflow] Failed to update item:", error)
      return { updated: false }
    }
  } else {
    const { error } = await db
      .from("batch_prospect_items")
      .update({
        status: "failed",
        error_message: result.errorMessage || "Research failed",
      })
      .eq("id", itemId)

    if (error) {
      console.error("[Batch Workflow] Failed to update item:", error)
      return { updated: false }
    }
  }

  return { updated: true }
}

/**
 * Check if job is complete and update status if needed
 */
async function checkJobCompletionStep(jobId: string): Promise<{
  isComplete: boolean
  totalItems: number
  completedItems: number
  failedItems: number
}> {
  const { createClient } = await import("@/lib/supabase/server")

  const supabase = await createClient()
  if (!supabase) {
    return { isComplete: false, totalItems: 0, completedItems: 0, failedItems: 0 }
  }

  // Use 'any' cast as batch tables aren't in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Get job stats
  const { data: job, error: jobError } = await db
    .from("batch_prospect_jobs")
    .select("total_prospects, completed_count, failed_count")
    .eq("id", jobId)
    .single()

  if (jobError || !job) {
    console.error("[Batch Workflow] Failed to get job:", jobError)
    return { isComplete: false, totalItems: 0, completedItems: 0, failedItems: 0 }
  }

  const isComplete = (job.completed_count || 0) + (job.failed_count || 0) >= (job.total_prospects || 0)

  if (isComplete) {
    // Update job status to completed
    await db
      .from("batch_prospect_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId)
  }

  return {
    isComplete,
    totalItems: job.total_prospects || 0,
    completedItems: job.completed_count || 0,
    failedItems: job.failed_count || 0,
  }
}

// ============================================================================
// MAIN WORKFLOW FUNCTION
// ============================================================================

/**
 * Durable Batch Research Workflow
 *
 * Processes a single prospect item with workflow-level durability.
 * The existing ResearchPipeline handles all the complex orchestration
 * (circuit breakers, retries, checkpoints). This workflow adds:
 * - Cross-request durability (survives server restarts)
 * - Workflow-level retry on infrastructure failures
 * - Structured observability
 *
 * @param params - Validated research parameters
 * @returns BatchResearchResult with research output and status
 *
 * @example
 * ```typescript
 * import { batchResearchWorkflow } from "@/lib/workflows/batch-research.workflow"
 * import { runDurableWorkflow } from "@/lib/workflows"
 *
 * const result = await runDurableWorkflow(batchResearchWorkflow, {
 *   jobId: job.id,
 *   itemId: item.id,
 *   userId: user.id,
 *   prospect: { name: "John Smith", city: "New York", state: "NY" },
 *   apiKey: decryptedKey,
 * })
 * ```
 */
export async function batchResearchWorkflow(
  params: BatchResearchParams
): Promise<BatchResearchResult> {
  "use workflow"

  // Polyfill global fetch with workflow-aware step function.
  // Research pipeline and AI SDK calls use fetch internally.
  globalThis.fetch = fetch

  const startTime = Date.now()

  // Validate inputs
  const validated = BatchResearchParamsSchema.safeParse(params)
  if (!validated.success) {
    const errorMessage = `Invalid params: ${validated.error.message}`
    console.error("[Batch Workflow] Validation failed:", errorMessage)
    return {
      success: false,
      itemId: params.itemId,
      jobId: params.jobId,
      errorMessage,
      durationMs: Date.now() - startTime,
    }
  }

  console.log(`[Batch Workflow] Starting research for: ${params.prospect.name}`)

  try {
    // Step 1: Execute research using existing pipeline
    // The pipeline handles circuit breakers, retries, and checkpointing
    "use step"
    console.log("[Batch Workflow] Step 1: Executing research pipeline...")
    const researchResult = await executeResearchStep(params)

    // Step 2: Update item status in database
    "use step"
    console.log("[Batch Workflow] Step 2: Updating item status...")
    const status = researchResult.success ? "completed" : "failed"
    await updateItemStatusStep(params.itemId, status, researchResult)

    // Step 3: Check if job is complete
    "use step"
    console.log("[Batch Workflow] Step 3: Checking job completion...")
    const jobStatus = await checkJobCompletionStep(params.jobId)

    if (jobStatus.isComplete) {
      console.log(`[Batch Workflow] Job ${params.jobId} completed: ${jobStatus.completedItems}/${jobStatus.totalItems} successful`)
    }

    const durationMs = Date.now() - startTime
    console.log(`[Batch Workflow] Completed for ${params.prospect.name} in ${durationMs}ms`)

    return {
      success: researchResult.success,
      itemId: params.itemId,
      jobId: params.jobId,
      reportContent: researchResult.reportContent,
      romyScore: researchResult.romyScore,
      romyScoreTier: researchResult.romyScoreTier,
      capacityRating: researchResult.capacityRating,
      estimatedNetWorth: researchResult.estimatedNetWorth,
      estimatedGiftCapacity: researchResult.estimatedGiftCapacity,
      recommendedAsk: researchResult.recommendedAsk,
      sourcesFound: researchResult.sourcesFound,
      tokensUsed: researchResult.tokensUsed,
      errorMessage: researchResult.errorMessage,
      durationMs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Batch Workflow] Failed:", errorMessage)

    // Try to update item status on failure
    try {
      await updateItemStatusStep(params.itemId, "failed", {
        success: false,
        errorMessage,
      })
    } catch (updateError) {
      console.error("[Batch Workflow] Failed to update item status:", updateError)
    }

    return {
      success: false,
      itemId: params.itemId,
      jobId: params.jobId,
      errorMessage,
      durationMs: Date.now() - startTime,
    }
  }
}
