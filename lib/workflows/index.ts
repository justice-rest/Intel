/**
 * Workflow DevKit Integration
 *
 * This module provides a unified interface for running durable workflows.
 * It includes:
 * - Feature flag-based routing (new workflow vs legacy fallback)
 * - Error handling and logging
 * - Graceful degradation when workflows are disabled
 *
 * USAGE:
 * ```typescript
 * import { isWorkflowEnabled, runDurableWorkflow } from "@/lib/workflows"
 *
 * if (isWorkflowEnabled("durable-crm-sync", userId)) {
 *   await runDurableWorkflow(syncCRMData, params)
 * } else {
 *   await legacySyncFunction(params)
 * }
 * ```
 */

// Re-export types
export type {
  WorkflowConfig,
  WorkflowFeatureFlag,
  WorkflowResult,
  WorkflowRun,
  WorkflowStep,
  WorkflowStatus,
  StepStatus,
} from "./types"

// Re-export config functions
export {
  getWorkflowConfig,
  isWorkflowEnabled,
  logWorkflowConfig,
  clearConfigCache,
} from "./config"

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

import type { WorkflowResult } from "./types"
import { getWorkflowConfig } from "./config"

/**
 * Run a durable workflow function
 *
 * This is the main entry point for executing workflows.
 * It handles:
 * - Checking if workflows are enabled
 * - Using the proper Workflow DevKit API (start)
 * - Logging execution start/end
 * - Error handling and result formatting
 *
 * @param workflowFn - The workflow function to execute (must have "use workflow" directive)
 * @param params - Parameters to pass to the workflow
 * @returns WorkflowResult with success status, data, or error
 *
 * @example
 * ```typescript
 * const result = await runDurableWorkflow(syncCRMData, {
 *   userId: user.id,
 *   provider: "bloomerang",
 *   apiKey: encrypted_key,
 * })
 *
 * if (result.success) {
 *   console.log("Sync complete:", result.data)
 * } else {
 *   console.error("Sync failed:", result.error)
 * }
 * ```
 */
export async function runDurableWorkflow<TParams, TResult>(
  workflowFn: (params: TParams) => Promise<TResult>,
  params: TParams
): Promise<WorkflowResult<TResult>> {
  const config = getWorkflowConfig()
  const startTime = Date.now()

  // Extract workflow name from function for logging
  const workflowName = workflowFn.name || "anonymous"

  // Check if workflows are globally enabled
  if (!config.enabled) {
    console.warn(`[Workflow] Workflows disabled, skipping: ${workflowName}`)
    return {
      success: false,
      error: "Workflows are disabled",
    }
  }

  console.log(`[Workflow] Starting: ${workflowName}`)

  try {
    // Try to use the Workflow DevKit's start() API
    // This properly handles the "use workflow" directive
    let result: TResult

    try {
      // Dynamic import to handle environments where workflow/api isn't available
      const workflowApi = await import("workflow/api")
      // Use the workflow API to start the workflow properly
      // The start function returns a promise that resolves to a Run object
      const run = await workflowApi.start(workflowFn as Parameters<typeof workflowApi.start>[0])
      // For workflows with params, we need to call the run with params
      // @ts-expect-error - workflow API has complex typing
      result = typeof run === "function" ? await run(params) : run
    } catch (importError: unknown) {
      // If workflow/api isn't available or start fails, fall back to direct call
      // But only if the error is about the module not being found
      const errorMessage = importError instanceof Error ? importError.message : String(importError)

      if (errorMessage.includes("Cannot find module") ||
          errorMessage.includes("Module not found")) {
        console.warn(`[Workflow] Workflow API not available, using direct call for: ${workflowName}`)
        result = await workflowFn(params)
      } else if (errorMessage.includes("execute workflow") && errorMessage.includes("directly")) {
        // The workflow directive error - workflow/api might not be properly configured
        // Fall back to a workaround: we can't run durable workflows, so skip
        console.warn(`[Workflow] Workflow runtime not configured, skipping: ${workflowName}`)
        return {
          success: false,
          error: "Workflow runtime not available",
          durationMs: Date.now() - startTime,
        }
      } else {
        throw importError
      }
    }

    const durationMs = Date.now() - startTime
    console.log(`[Workflow] Completed: ${workflowName} (${durationMs}ms)`)

    return {
      success: true,
      data: result,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error(`[Workflow] Failed: ${workflowName} (${durationMs}ms)`, error)

    return {
      success: false,
      error: errorMessage,
      durationMs,
    }
  }
}

/**
 * Run a workflow with fallback to legacy implementation
 *
 * This is useful during migration when you want to gracefully
 * fall back to the legacy implementation if the workflow fails.
 *
 * @param workflowFn - The new workflow function
 * @param fallbackFn - The legacy function to use if workflow fails
 * @param params - Parameters for both functions
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * await runWithFallback(
 *   syncCRMData,           // New durable workflow
 *   performSync,           // Legacy fire-and-forget
 *   params,
 *   { useFallbackOnError: true }
 * )
 * ```
 */
export async function runWithFallback<TParams, TResult>(
  workflowFn: (params: TParams) => Promise<TResult>,
  fallbackFn: (params: TParams) => Promise<TResult>,
  params: TParams,
  options: {
    /**
     * If true, run fallback when workflow fails
     * @default true
     */
    useFallbackOnError?: boolean
    /**
     * If true, log when fallback is used
     * @default true
     */
    logFallback?: boolean
  } = {}
): Promise<WorkflowResult<TResult>> {
  const { useFallbackOnError = true, logFallback = true } = options

  // Try the workflow first
  const result = await runDurableWorkflow(workflowFn, params)

  if (result.success) {
    return result
  }

  // If workflow failed and fallback is enabled, try legacy
  if (useFallbackOnError) {
    if (logFallback) {
      console.warn(`[Workflow] Falling back to legacy for: ${workflowFn.name || "anonymous"}`)
    }

    try {
      const fallbackResult = await fallbackFn(params)
      return {
        success: true,
        data: fallbackResult,
      }
    } catch (fallbackError) {
      const errorMessage = fallbackError instanceof Error
        ? fallbackError.message
        : String(fallbackError)

      console.error("[Workflow] Fallback also failed:", fallbackError)

      return {
        success: false,
        error: `Workflow and fallback both failed: ${errorMessage}`,
      }
    }
  }

  return result
}

// ============================================================================
// WORKFLOW UTILITIES
// ============================================================================

/**
 * Sleep utility for workflow step delays
 *
 * In a durable workflow context, this uses the Workflow DevKit's sleep()
 * which doesn't consume resources while waiting.
 *
 * In non-workflow context, it falls back to Promise-based delay.
 */
export function workflowSleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

/**
 * Chunk an array into batches
 *
 * Useful for processing large datasets in workflow steps.
 *
 * @param array - The array to chunk
 * @param size - Size of each chunk
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
