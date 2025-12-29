/**
 * Research Pipeline v3.0 - Parallel AI Only
 *
 * Defines the complete research workflow as a series of steps.
 * Each step is checkpointed, protected by circuit breakers, and retryable.
 *
 * Pipeline Flow (Parallel AI-first):
 * 1. parallel_search     - Primary search using Parallel AI ($0.005/search)
 * 2. grok_search         - X/Twitter search via Grok (optional)
 * 3. direct_verification - SEC, FEC, ProPublica verification (optional)
 * 4. triangulation       - Merge and score data from all sources
 * 5. validation          - Zod schema validation with retry
 * 6. save_results        - Persist to database
 *
 * REMOVED in v3.0:
 * - perplexity_pass1/2/3 (replaced by Parallel AI)
 * - linkup_search (removed entirely)
 */

import type { PipelineStepDefinition, StepContext, StepResult, PipelineResult, ICheckpointManager } from "../checkpoints/types"
import type { ProspectResearchOutput, ProspectInputData } from "../types"
import { StepExecutor, createStepExecutor, type StepExecutionResult } from "./step-executor"
import { createCheckpointManager } from "../checkpoints/manager"
import {
  getBatchProcessingCircuitBreakers,
  circuitBreakerRegistry,
} from "../resilience/circuit-breaker"
import { extractProspectResearchOutput, hasMinimalData, calculateDataQualityScore } from "../extraction/validated-parser"
import { parseLenientProspectOutput, type LenientProspectResearchOutput } from "../schemas/prospect-output"
import { isParallelAvailable } from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// TYPES
// ============================================================================

export interface ResearchPipelineConfig {
  /**
   * API key for OpenRouter
   */
  apiKey?: string

  /**
   * Whether to run optional steps (deep research)
   * @default true
   */
  runOptionalSteps?: boolean

  /**
   * Skip verification steps (faster but less accurate)
   * @default false
   */
  skipVerification?: boolean

  /**
   * Callback for progress updates
   */
  onProgress?: (step: string, status: "started" | "completed" | "failed" | "skipped") => void
}

export interface ResearchPipelineResult extends PipelineResult<ProspectResearchOutput> {
  dataQualityScore: number
  sourcesCount: number
  verificationStatus: "verified" | "partial" | "unverified"
  hallucinationsCount: number
  verifiedClaimsCount: number
  overallConfidence: number
  verificationRecommendations: string[]
}

// ============================================================================
// STEP IMPLEMENTATIONS
// ============================================================================

/**
 * Step 1: Primary search using Parallel AI
 *
 * Parallel AI provides comprehensive web research at $0.005 per search.
 * This replaces the previous Perplexity multi-pass approach.
 */
async function executeParallelPrimary(context: StepContext): Promise<StepResult<ProspectResearchOutput>> {
  const { generateProspectReport } = await import("../report-generator")

  try {
    const result = await generateProspectReport({
      prospect: {
        name: context.prospect.name,
        address: context.prospect.address,
        city: context.prospect.city,
        state: context.prospect.state,
        zip: context.prospect.zip,
        full_address: context.prospect.full_address,
        employer: context.prospect.employer,
        title: context.prospect.title,
      },
      apiKey: context.apiKey,
    })

    if (result.success && result.structured_data) {
      return {
        status: "completed",
        data: result.structured_data,
        tokensUsed: result.tokens_used || 0,
        sourcesFound: result.sources_found?.length || 0,
      }
    }

    return {
      status: "failed",
      error: result.error_message || "Parallel AI search returned no results",
      tokensUsed: result.tokens_used || 0,
    }
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * @deprecated - Perplexity removed in v3.0, use executeParallelPrimary
 */
async function executePerplexityPass1(context: StepContext): Promise<StepResult<ProspectResearchOutput>> {
  // Redirect to Parallel AI
  return executeParallelPrimary(context)
}

/**
 * @deprecated - Removed in v3.0
 */
async function executePerplexityPass2(_context: StepContext): Promise<StepResult<ProspectResearchOutput>> {
  return { status: "skipped", reason: "deprecated_in_v3" }
}

/**
 * @deprecated - Removed in v3.0
 */
async function executePerplexityPass3(_context: StepContext): Promise<StepResult<ProspectResearchOutput>> {
  return { status: "skipped", reason: "deprecated_in_v3" }
}

/**
 * @deprecated - LinkUp removed in v3.0
 */
async function executeLinkupSearch(_context: StepContext): Promise<StepResult> {
  return { status: "skipped", reason: "deprecated_linkup_removed" }
}

/**
 * Step 5: Grok AI search
 */
async function executeGrokSearch(context: StepContext): Promise<StepResult> {
  const { grokBatchSearch, isGrokSearchAvailable } = await import("../grok-search")

  if (!isGrokSearchAvailable()) {
    return { status: "skipped", reason: "grok_not_configured" }
  }

  try {
    const result = await grokBatchSearch(
      {
        name: context.prospect.name,
        address: context.prospect.address || context.prospect.full_address,
        city: context.prospect.city,
        state: context.prospect.state,
      },
      context.apiKey
    )

    // GrokSearchResult has: answer, sources, query, tokensUsed, durationMs, error
    if (!result.error && result.answer) {
      return {
        status: "completed",
        data: result,
        tokensUsed: result.tokensUsed,
        sourcesFound: result.sources?.length || 0,
      }
    }

    return { status: "skipped", reason: result.error || "no_grok_results" }
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Step 5b: Parallel AI search (replaces LinkUp when enabled)
 * 95% cost savings: $0.005/search vs $0.095 (LinkUp + Perplexity)
 */
async function executeParallelSearch(context: StepContext): Promise<StepResult> {
  // Skip if Parallel is not available
  if (!isParallelAvailable()) {
    return { status: "skipped", reason: "parallel_not_available" }
  }

  const { parallelBatchSearch, isParallelBatchAvailable } = await import("../parallel-search")

  if (!isParallelBatchAvailable()) {
    return { status: "skipped", reason: "parallel_circuit_open" }
  }

  try {
    const result = await parallelBatchSearch({
      name: context.prospect.name,
      address: context.prospect.address || context.prospect.full_address,
      city: context.prospect.city,
      state: context.prospect.state,
    })

    // ParallelBatchResult has: research, sources, query, searchId, tokensUsed, durationMs, error
    if (!result.error && result.research) {
      return {
        status: "completed",
        data: result,
        tokensUsed: result.tokensUsed,
        sourcesFound: result.sources?.length || 0,
      }
    }

    return { status: "skipped", reason: result.error || "no_parallel_results" }
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Step 6: Direct API verification (SEC, FEC, ProPublica)
 *
 * Uses the cross-reference verification layer to validate LLM claims
 * against authoritative API sources and detect hallucinations.
 */
async function executeDirectVerification(context: StepContext): Promise<StepResult> {
  // Get Perplexity output to verify
  const pass1Result = context.previousResults.get("perplexity_pass1")

  if (!pass1Result || pass1Result.status !== "completed" || !pass1Result.data) {
    return { status: "skipped", reason: "no_data_to_verify" }
  }

  const llmOutput = pass1Result.data as ProspectResearchOutput

  try {
    // Use the cross-reference verification layer
    const { crossReferenceVerify, quickHallucinationCheck } = await import("../verification/cross-reference")

    // Run full verification for comprehensive reports
    const verificationReport = await crossReferenceVerify(
      context.prospect.name,
      context.prospect.state,
      llmOutput
    )

    console.log(
      `[Pipeline] Verification complete: ${verificationReport.verifiedClaims} verified, ` +
        `${verificationReport.contradictedClaims} contradicted, ` +
        `confidence: ${(verificationReport.overallConfidence * 100).toFixed(1)}%`
    )

    // Flag hallucinations for review
    if (verificationReport.hallucinations.length > 0) {
      console.warn(
        `[Pipeline] ⚠️ Found ${verificationReport.hallucinations.length} potential hallucinations:`,
        verificationReport.hallucinations.map((h) => h.claim)
      )
    }

    return {
      status: "completed",
      data: verificationReport,
    }
  } catch (error) {
    console.error("[Pipeline] Verification failed:", error)
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Step 4: Triangulation - merge data from all sources
 *
 * v3.0: Simplified to only merge Parallel AI and Grok data
 * (LinkUp and Perplexity removed)
 */
async function executeTriangulation(context: StepContext): Promise<StepResult<ProspectResearchOutput>> {
  type GrokSearchResult = Awaited<ReturnType<typeof import("../grok-search").grokBatchSearch>>

  // Start with Parallel AI data (from perplexity_pass1 which now redirects to Parallel)
  const pass1 = context.previousResults.get("perplexity_pass1")
  const grok = context.previousResults.get("grok_search")

  let merged: ProspectResearchOutput | undefined = undefined

  // Get Parallel AI output (from perplexity_pass1 redirect)
  if (pass1?.status === "completed" && pass1.data) {
    merged = pass1.data as ProspectResearchOutput
  }

  if (!merged) {
    return {
      status: "failed",
      error: "No data from any source to triangulate",
    }
  }

  // Merge Grok data (sources only, Grok doesn't provide structured extraction)
  if (grok?.status === "completed" && grok.data) {
    try {
      const grokResult = grok.data as GrokSearchResult
      // Add Grok sources that aren't already present
      const existingUrls = new Set(merged.sources.map(s => s.url.toLowerCase()))
      for (const source of grokResult.sources) {
        if (!existingUrls.has(source.url.toLowerCase())) {
          merged.sources.push({
            title: source.name,
            url: source.url,
            data_provided: source.snippet || "Additional source from Grok",
          })
        }
      }

      console.log(`[Pipeline] Merged ${grokResult.sources.length} Grok sources`)
    } catch (e) {
      console.warn("[Pipeline] Failed to merge Grok data:", e)
    }
  }

  // Calculate total sources
  const sourcesFound = merged.sources?.length || 0

  return {
    status: "completed",
    data: merged,
    sourcesFound,
  }
}

/**
 * Step 8: Validation - ensure output matches schema
 */
async function executeValidation(context: StepContext): Promise<StepResult<ProspectResearchOutput>> {
  const triangulated = context.previousResults.get("triangulation")

  if (!triangulated || triangulated.status !== "completed" || !triangulated.data) {
    return {
      status: "failed",
      error: "No triangulated data to validate",
    }
  }

  try {
    // Use the validated parser with retry
    const validationResult = await extractProspectResearchOutput(
      JSON.stringify(triangulated.data),
      { apiKey: context.apiKey, maxRetries: 2 }
    )

    if (validationResult.success) {
      return {
        status: "completed",
        data: validationResult.data as ProspectResearchOutput,
        tokensUsed: validationResult.tokensUsed,
      }
    }

    // Return partial data even if validation failed
    return {
      status: "completed",
      data: validationResult.data as ProspectResearchOutput,
      tokensUsed: validationResult.tokensUsed,
    }
  } catch (error) {
    // Fall back to lenient parse
    const lenient = parseLenientProspectOutput(triangulated.data)
    return {
      status: "completed",
      data: lenient as unknown as ProspectResearchOutput,
    }
  }
}

/**
 * Step 9: Save results to database
 */
async function executeSaveResults(context: StepContext): Promise<StepResult> {
  const validated = context.previousResults.get("validation")

  if (!validated || validated.status !== "completed" || !validated.data) {
    return {
      status: "failed",
      error: "No validated data to save",
    }
  }

  // The actual save happens in the API route, we just return the data
  return {
    status: "completed",
    data: validated.data,
  }
}

// ============================================================================
// PIPELINE DEFINITION
// ============================================================================

/**
 * Create the research pipeline step definitions
 */
export function createResearchPipelineSteps(): PipelineStepDefinition[] {
  return [
    {
      name: "perplexity_pass1",
      description: "Initial comprehensive Perplexity search",
      execute: executePerplexityPass1,
      required: true,
      timeout: 60000,
    },
    {
      name: "perplexity_pass2",
      description: "Targeted follow-up search for missing data",
      execute: executePerplexityPass2,
      required: false,
      timeout: 45000,
      dependsOn: ["perplexity_pass1"],
      skippable: true,
    },
    {
      name: "perplexity_pass3",
      description: "Name variation search",
      execute: executePerplexityPass3,
      required: false,
      timeout: 45000,
      dependsOn: ["perplexity_pass1"],
      skippable: true,
    },
    {
      name: "linkup_search",
      description: "LinkUp curated domain search",
      execute: executeLinkupSearch,
      required: false,
      timeout: 30000,
    },
    {
      name: "grok_search",
      description: "Grok AI search",
      execute: executeGrokSearch,
      required: false,
      timeout: 30000,
    },
    {
      name: "parallel_search",
      description: "Parallel AI search (replaces LinkUp when enabled)",
      execute: executeParallelSearch,
      required: false,
      timeout: 35000,
    },
    {
      name: "direct_verification",
      description: "Direct API verification (SEC, FEC, ProPublica)",
      execute: executeDirectVerification,
      required: false,
      timeout: 45000,
      dependsOn: ["perplexity_pass1"],
    },
    {
      name: "triangulation",
      description: "Merge and score data from all sources",
      execute: executeTriangulation,
      required: true,
      timeout: 10000,
      dependsOn: ["perplexity_pass1"],
    },
    {
      name: "validation",
      description: "Schema validation with retry",
      execute: executeValidation,
      required: true,
      timeout: 30000,
      dependsOn: ["triangulation"],
    },
    {
      name: "save_results",
      description: "Prepare results for database save",
      execute: executeSaveResults,
      required: true,
      timeout: 5000,
      dependsOn: ["validation"],
    },
  ]
}

// ============================================================================
// RESEARCH PIPELINE CLASS
// ============================================================================

export class ResearchPipeline {
  private steps: PipelineStepDefinition[]
  private executor: StepExecutor
  private checkpointManager: ICheckpointManager
  private circuitBreakers: ReturnType<typeof getBatchProcessingCircuitBreakers>

  constructor(checkpointManager?: ICheckpointManager) {
    this.steps = createResearchPipelineSteps()
    this.checkpointManager = checkpointManager || createCheckpointManager()
    this.circuitBreakers = getBatchProcessingCircuitBreakers()

    this.executor = createStepExecutor(this.checkpointManager, {
      defaultTimeout: 60000,
      onStepStart: (step, itemId) => {
        console.log(`[Pipeline] Starting step: ${step} for item: ${itemId}`)
      },
      onStepComplete: (step, itemId, result, duration) => {
        console.log(
          `[Pipeline] Completed step: ${step} for item: ${itemId} ` +
            `(${duration}ms, ${result.tokensUsed || 0} tokens)`
        )
      },
      onStepFail: (step, itemId, error) => {
        console.error(`[Pipeline] Failed step: ${step} for item: ${itemId}:`, error.message)
      },
      onStepSkip: (step, itemId, reason) => {
        console.log(`[Pipeline] Skipped step: ${step} for item: ${itemId}: ${reason}`)
      },
    })
  }

  /**
   * Execute the full research pipeline for a prospect
   */
  async executeForItem(
    itemId: string,
    prospect: StepContext["prospect"],
    config: ResearchPipelineConfig = {}
  ): Promise<ResearchPipelineResult> {
    const startTime = Date.now()

    const context: StepContext = {
      itemId,
      jobId: "", // Set by caller
      userId: "", // Set by caller
      prospect,
      apiKey: config.apiKey,
      previousResults: new Map(),
      checkpointManager: this.checkpointManager,
    }

    // Filter steps based on config
    let stepsToRun = [...this.steps]
    if (!config.runOptionalSteps) {
      stepsToRun = stepsToRun.filter((s) => s.required)
    }
    if (config.skipVerification) {
      stepsToRun = stepsToRun.filter((s) => s.name !== "direct_verification")
    }

    // Execute steps with circuit breaker mapping
    const circuitBreakerMap: Record<string, typeof this.circuitBreakers.perplexity> = {
      perplexity_pass1: this.circuitBreakers.perplexity,
      perplexity_pass2: this.circuitBreakers.perplexity,
      perplexity_pass3: this.circuitBreakers.perplexity,
      linkup_search: this.circuitBreakers.linkup,
      grok_search: this.circuitBreakers.grok,
      parallel_search: this.circuitBreakers.parallel,
      direct_verification: this.circuitBreakers.sec, // Uses multiple, but SEC is primary
    }

    const stepResults = await this.executor.executeSteps(stepsToRun, context, circuitBreakerMap)

    // Collect results
    const completedSteps: string[] = []
    const failedSteps: string[] = []
    const skippedSteps: string[] = []
    let totalTokensUsed = 0

    for (const [name, result] of stepResults) {
      totalTokensUsed += result.tokensUsed
      if (result.result.status === "completed") {
        completedSteps.push(name)
      } else if (result.result.status === "failed") {
        failedSteps.push(name)
      } else {
        skippedSteps.push(name)
      }
    }

    // Get final output
    const saveResult = stepResults.get("save_results")
    const finalData = saveResult?.result.data as ProspectResearchOutput | undefined

    // Calculate quality score
    const dataQualityScore = finalData
      ? calculateDataQualityScore(parseLenientProspectOutput(finalData))
      : 0

    // Determine verification status from cross-reference report
    const verificationResult = stepResults.get("direct_verification")
    let verificationStatus: "verified" | "partial" | "unverified" = "unverified"
    let verificationReport = null

    if (verificationResult?.result.status === "completed" && verificationResult.result.data) {
      verificationReport = verificationResult.result.data as import("../verification/cross-reference").VerificationReport

      // Determine status based on verification report
      if (verificationReport.hallucinations.length > 0) {
        verificationStatus = "partial" // Has hallucinations - needs review
      } else if (verificationReport.verifiedClaims > 0) {
        verificationStatus = verificationReport.overallConfidence >= 0.7 ? "verified" : "partial"
      }
    }

    const success =
      completedSteps.includes("validation") && completedSteps.includes("save_results")

    return {
      success,
      finalData,
      stepResults: Object.fromEntries(
        Array.from(stepResults.entries()).map(([k, v]) => [k, v.result])
      ),
      totalTokensUsed,
      totalDurationMs: Date.now() - startTime,
      completedSteps,
      failedSteps,
      skippedSteps,
      dataQualityScore,
      sourcesCount: finalData?.sources?.length || 0,
      verificationStatus,
      hallucinationsCount: verificationReport?.hallucinations?.length || 0,
      verifiedClaimsCount: verificationReport?.verifiedClaims || 0,
      overallConfidence: verificationReport?.overallConfidence || 0,
      verificationRecommendations: verificationReport?.recommendations || [],
      error: failedSteps.length > 0 ? `Failed steps: ${failedSteps.join(", ")}` : undefined,
    }
  }

  /**
   * Get circuit breaker stats for monitoring
   */
  getCircuitBreakerStats() {
    return circuitBreakerRegistry.getAllStats()
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers() {
    circuitBreakerRegistry.resetAll()
  }

  /**
   * Get the checkpoint manager
   */
  getCheckpointManager(): ICheckpointManager {
    return this.checkpointManager
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a research pipeline instance
 */
export function createResearchPipeline(
  checkpointManager?: ICheckpointManager
): ResearchPipeline {
  return new ResearchPipeline(checkpointManager)
}
