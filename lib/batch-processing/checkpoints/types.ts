/**
 * Checkpoint Types
 *
 * Type definitions for the checkpoint system that enables resume capability
 * and prevents data loss during batch processing.
 */

// ============================================================================
// STATUS TYPES
// ============================================================================

export type CheckpointStatus = "pending" | "processing" | "completed" | "failed" | "skipped"

// ============================================================================
// STEP NAMES
// ============================================================================

/**
 * Predefined step names for the research pipeline
 * Using string literals for type safety
 */
export type PipelineStepName =
  | "perplexity_pass1"
  | "perplexity_pass2"
  | "perplexity_pass3"
  | "linkup_search"
  | "grok_search"
  | "direct_verification"
  | "sec_verification"
  | "fec_verification"
  | "propublica_verification"
  | "triangulation"
  | "validation"
  | "save_results"
  | string // Allow custom step names

// ============================================================================
// CHECKPOINT RECORDS
// ============================================================================

/**
 * Database checkpoint record
 */
export interface CheckpointRecord {
  id: string
  item_id: string
  step_name: string
  step_status: CheckpointStatus
  result_data: unknown | null
  tokens_used: number
  duration_ms: number | null
  error_message: string | null
  created_at: string
  updated_at?: string
}

/**
 * Metadata for a completed step
 */
export interface StepMeta {
  tokensUsed?: number
  durationMs?: number
  sourcesFound?: number
  dataQualityScore?: number
  modelUsed?: string
}

/**
 * Result of a step execution
 */
export interface StepResult<T = unknown> {
  status: "completed" | "failed" | "skipped"
  data?: T
  error?: string
  reason?: string // For skipped steps (e.g., "circuit_breaker_open", "sufficient_data")
  tokensUsed?: number
  sourcesFound?: number
}

// ============================================================================
// CHECKPOINT MANAGER INTERFACE
// ============================================================================

/**
 * Interface for checkpoint operations
 */
export interface ICheckpointManager {
  /**
   * Check if a step has already been completed
   */
  hasCompleted(itemId: string, stepName: string): Promise<boolean>

  /**
   * Get the result of a completed step
   */
  getResult<T>(itemId: string, stepName: string): Promise<T | null>

  /**
   * Get all checkpoints for an item
   */
  getAllCheckpoints(itemId: string): Promise<CheckpointRecord[]>

  /**
   * Save a successful step result
   */
  saveResult(
    itemId: string,
    stepName: string,
    result: unknown,
    meta: StepMeta
  ): Promise<void>

  /**
   * Mark a step as failed
   */
  markFailed(itemId: string, stepName: string, error: string): Promise<void>

  /**
   * Mark a step as skipped
   */
  markSkipped(itemId: string, stepName: string, reason: string): Promise<void>

  /**
   * Mark a step as processing (for stale detection)
   */
  markProcessing(itemId: string, stepName: string): Promise<void>

  /**
   * Clear all checkpoints for an item (for retry)
   */
  clearCheckpoints(itemId: string): Promise<void>

  /**
   * Get completion status summary for an item
   */
  getCompletionStatus(itemId: string): Promise<{
    total: number
    completed: number
    failed: number
    skipped: number
    pending: number
  }>
}

// ============================================================================
// PIPELINE CONTEXT
// ============================================================================

/**
 * Context passed to each step in the pipeline
 */
export interface StepContext {
  itemId: string
  jobId: string
  userId: string
  prospect: {
    name: string
    address?: string
    city?: string
    state?: string
    zip?: string
    full_address?: string
    employer?: string
    title?: string
    [key: string]: string | undefined
  }
  apiKey?: string
  /**
   * Results from previous steps (populated as pipeline progresses)
   */
  previousResults: Map<string, StepResult>
  /**
   * Checkpoint manager instance
   */
  checkpointManager: ICheckpointManager
}

// ============================================================================
// STEP DEFINITION
// ============================================================================

/**
 * Definition of a pipeline step
 */
export interface PipelineStepDefinition<T = unknown> {
  /**
   * Unique name for this step
   */
  name: string

  /**
   * Human-readable description
   */
  description?: string

  /**
   * Function to execute the step
   */
  execute: (context: StepContext) => Promise<StepResult<T>>

  /**
   * Whether this step is required for pipeline completion
   * If true, failure stops the pipeline
   */
  required: boolean

  /**
   * Timeout in milliseconds
   */
  timeout: number

  /**
   * Dependencies - names of steps that must complete first
   */
  dependsOn?: string[]

  /**
   * Whether this step can be skipped if its dependencies provide sufficient data
   */
  skippable?: boolean

  /**
   * Condition to check if step should be skipped
   */
  skipCondition?: (context: StepContext) => Promise<boolean>
}

// ============================================================================
// PIPELINE RESULT
// ============================================================================

/**
 * Result of executing the full pipeline for an item
 */
export interface PipelineResult<T = unknown> {
  success: boolean
  finalData?: T
  stepResults: Record<string, StepResult>
  totalTokensUsed: number
  totalDurationMs: number
  completedSteps: string[]
  failedSteps: string[]
  skippedSteps: string[]
  error?: string
}
