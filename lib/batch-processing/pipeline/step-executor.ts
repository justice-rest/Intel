/**
 * Step Executor
 *
 * Executes individual pipeline steps with:
 * - Checkpoint-based resume capability
 * - Circuit breaker protection
 * - Retry policies
 * - Timeout handling
 * - Progress tracking
 */

import type {
  StepContext,
  StepResult,
  PipelineStepDefinition,
  ICheckpointManager,
  StepMeta,
} from "../checkpoints/types"
import { CircuitBreaker, isCircuitBreakerError } from "../resilience/circuit-breaker"
import { executeWithRetry, type RetryPolicy, DEFAULT_LLM_RETRY_POLICY } from "../resilience/retry-policy"

// ============================================================================
// TYPES
// ============================================================================

export interface StepExecutorConfig {
  /**
   * Checkpoint manager for saving/loading step results
   */
  checkpointManager: ICheckpointManager

  /**
   * Default timeout for steps (can be overridden per step)
   * @default 60000 (1 minute)
   */
  defaultTimeout: number

  /**
   * Default retry policy (can be overridden per step)
   */
  defaultRetryPolicy: RetryPolicy

  /**
   * Callback when a step starts
   */
  onStepStart?: (stepName: string, itemId: string) => void

  /**
   * Callback when a step completes
   */
  onStepComplete?: (stepName: string, itemId: string, result: StepResult, duration: number) => void

  /**
   * Callback when a step fails
   */
  onStepFail?: (stepName: string, itemId: string, error: Error) => void

  /**
   * Callback when a step is skipped
   */
  onStepSkip?: (stepName: string, itemId: string, reason: string) => void
}

export interface ExecuteStepOptions {
  /**
   * Optional circuit breaker for this step
   */
  circuitBreaker?: CircuitBreaker

  /**
   * Optional retry policy override
   */
  retryPolicy?: Partial<RetryPolicy>

  /**
   * Whether to skip checkpoint check (force re-execution)
   * @default false
   */
  forceExecute?: boolean
}

export interface StepExecutionResult {
  result: StepResult
  fromCache: boolean
  duration: number
  tokensUsed: number
  error?: Error
}

// ============================================================================
// STEP EXECUTOR IMPLEMENTATION
// ============================================================================

export class StepExecutor {
  private readonly config: StepExecutorConfig

  constructor(config: StepExecutorConfig) {
    this.config = {
      ...config,
      defaultTimeout: config.defaultTimeout ?? 60000,
      defaultRetryPolicy: config.defaultRetryPolicy ?? DEFAULT_LLM_RETRY_POLICY,
    }
  }

  /**
   * Execute a single pipeline step with full protection
   */
  async executeStep(
    step: PipelineStepDefinition,
    context: StepContext,
    options: ExecuteStepOptions = {}
  ): Promise<StepExecutionResult> {
    const { circuitBreaker, retryPolicy, forceExecute = false } = options
    const startTime = Date.now()

    // Step 1: Check if already completed (checkpoint)
    if (!forceExecute) {
      const cachedResult = await this.config.checkpointManager.getResult<StepResult>(
        context.itemId,
        step.name
      )

      if (cachedResult && cachedResult.status === "completed") {
        console.log(`[StepExecutor] Skipping ${step.name} - already completed (from cache)`)

        this.config.onStepSkip?.(step.name, context.itemId, "already_completed")

        return {
          result: cachedResult,
          fromCache: true,
          duration: 0,
          tokensUsed: 0,
        }
      }
    }

    // Step 2: Check skip condition
    if (step.skipCondition) {
      try {
        const shouldSkip = await step.skipCondition(context)
        if (shouldSkip) {
          const skipResult: StepResult = {
            status: "skipped",
            reason: "skip_condition_met",
          }

          await this.config.checkpointManager.markSkipped(
            context.itemId,
            step.name,
            "skip_condition_met"
          )

          this.config.onStepSkip?.(step.name, context.itemId, "skip_condition_met")

          return {
            result: skipResult,
            fromCache: false,
            duration: Date.now() - startTime,
            tokensUsed: 0,
          }
        }
      } catch (error) {
        console.warn(`[StepExecutor] Skip condition check failed for ${step.name}:`, error)
        // Continue with execution
      }
    }

    // Step 3: Check circuit breaker
    if (circuitBreaker?.isOpen()) {
      if (step.required) {
        throw new Error(
          `Circuit breaker is open for required step: ${step.name}. ` +
            `Retry after ${Math.ceil(circuitBreaker.getTimeUntilClose() / 1000)} seconds.`
        )
      }

      const skipResult: StepResult = {
        status: "skipped",
        reason: "circuit_breaker_open",
      }

      await this.config.checkpointManager.markSkipped(
        context.itemId,
        step.name,
        "circuit_breaker_open"
      )

      this.config.onStepSkip?.(step.name, context.itemId, "circuit_breaker_open")

      return {
        result: skipResult,
        fromCache: false,
        duration: Date.now() - startTime,
        tokensUsed: 0,
      }
    }

    // Step 4: Mark as processing (for stale detection)
    await this.config.checkpointManager.markProcessing(context.itemId, step.name)
    this.config.onStepStart?.(step.name, context.itemId)

    // Step 5: Execute with retry and timeout
    const timeout = step.timeout ?? this.config.defaultTimeout
    const effectiveRetryPolicy = {
      ...this.config.defaultRetryPolicy,
      ...retryPolicy,
    }

    try {
      const retryResult = await executeWithRetry(
        async () => {
          // Wrap in circuit breaker if provided
          if (circuitBreaker) {
            return circuitBreaker.execute(() =>
              this.executeWithTimeout(step.execute, context, timeout)
            )
          }
          return this.executeWithTimeout(step.execute, context, timeout)
        },
        {
          ...effectiveRetryPolicy,
          name: step.name,
        }
      )

      const duration = Date.now() - startTime

      if (retryResult.success && retryResult.data) {
        const result = retryResult.data

        // Save successful result to checkpoint
        const meta: StepMeta = {
          durationMs: duration,
          tokensUsed: result.tokensUsed ?? 0,
          sourcesFound: result.sourcesFound,
        }

        await this.config.checkpointManager.saveResult(
          context.itemId,
          step.name,
          result,
          meta
        )

        this.config.onStepComplete?.(step.name, context.itemId, result, duration)

        return {
          result,
          fromCache: false,
          duration,
          tokensUsed: result.tokensUsed ?? 0,
        }
      }

      // Retry failed
      throw retryResult.error ?? new Error(`Step ${step.name} failed after retries`)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Record circuit breaker failure if applicable
      if (circuitBreaker && !isCircuitBreakerError(error)) {
        circuitBreaker.recordFailure()
      }

      // Save failure to checkpoint
      await this.config.checkpointManager.markFailed(
        context.itemId,
        step.name,
        errorMessage
      )

      this.config.onStepFail?.(step.name, context.itemId, error as Error)

      // For required steps, throw the error
      if (step.required) {
        throw error
      }

      // For optional steps, return failed result
      const failedResult: StepResult = {
        status: "failed",
        error: errorMessage,
      }

      return {
        result: failedResult,
        fromCache: false,
        duration,
        tokensUsed: 0,
        error: error as Error,
      }
    }
  }

  /**
   * Execute a step function with timeout
   */
  private async executeWithTimeout<T>(
    fn: (context: StepContext) => Promise<T>,
    context: StepContext,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(context),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Step execution timed out after ${timeout}ms`))
        }, timeout)
      }),
    ])
  }

  /**
   * Execute multiple steps in sequence
   */
  async executeSteps(
    steps: PipelineStepDefinition[],
    context: StepContext,
    circuitBreakers: Record<string, CircuitBreaker> = {}
  ): Promise<Map<string, StepExecutionResult>> {
    const results = new Map<string, StepExecutionResult>()

    for (const step of steps) {
      // Check dependencies
      if (step.dependsOn?.length) {
        const unmetDeps = step.dependsOn.filter((dep) => {
          const depResult = results.get(dep)
          return !depResult || depResult.result.status !== "completed"
        })

        if (unmetDeps.length > 0) {
          console.log(
            `[StepExecutor] Skipping ${step.name} - unmet dependencies: ${unmetDeps.join(", ")}`
          )

          const skipResult: StepResult = {
            status: "skipped",
            reason: `unmet_dependencies: ${unmetDeps.join(", ")}`,
          }

          results.set(step.name, {
            result: skipResult,
            fromCache: false,
            duration: 0,
            tokensUsed: 0,
          })

          continue
        }
      }

      // Execute step
      const result = await this.executeStep(step, context, {
        circuitBreaker: circuitBreakers[step.name],
      })

      results.set(step.name, result)

      // Update context with result for next steps
      context.previousResults.set(step.name, result.result)

      // Stop pipeline if required step failed
      if (step.required && result.result.status === "failed") {
        console.error(
          `[StepExecutor] Required step ${step.name} failed - stopping pipeline`
        )
        break
      }
    }

    return results
  }

  /**
   * Execute multiple independent steps in parallel
   */
  async executeStepsParallel(
    steps: PipelineStepDefinition[],
    context: StepContext,
    circuitBreakers: Record<string, CircuitBreaker> = {}
  ): Promise<Map<string, StepExecutionResult>> {
    const results = new Map<string, StepExecutionResult>()

    const promises = steps.map(async (step) => {
      const result = await this.executeStep(step, context, {
        circuitBreaker: circuitBreakers[step.name],
      })
      return { name: step.name, result }
    })

    const settled = await Promise.allSettled(promises)

    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        results.set(outcome.value.name, outcome.value.result)
        context.previousResults.set(outcome.value.name, outcome.value.result.result)
      } else {
        // Find which step failed by looking at the error
        console.error("[StepExecutor] Parallel step failed:", outcome.reason)
      }
    }

    return results
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a step executor with default configuration
 */
export function createStepExecutor(
  checkpointManager: ICheckpointManager,
  options: Partial<Omit<StepExecutorConfig, "checkpointManager">> = {}
): StepExecutor {
  return new StepExecutor({
    checkpointManager,
    defaultTimeout: options.defaultTimeout ?? 60000,
    defaultRetryPolicy: options.defaultRetryPolicy ?? DEFAULT_LLM_RETRY_POLICY,
    onStepStart: options.onStepStart,
    onStepComplete: options.onStepComplete,
    onStepFail: options.onStepFail,
    onStepSkip: options.onStepSkip,
  })
}
