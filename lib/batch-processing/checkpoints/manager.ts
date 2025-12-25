/**
 * Checkpoint Manager
 *
 * Manages checkpoints for batch processing steps, enabling:
 * - Resume capability after interruption
 * - Step-level result caching
 * - Progress tracking
 * - Failure debugging
 */

import { createClient } from "@/lib/supabase/server"
import type {
  CheckpointRecord,
  CheckpointStatus,
  StepMeta,
  ICheckpointManager,
} from "./types"

// ============================================================================
// CHECKPOINT MANAGER IMPLEMENTATION
// ============================================================================

/**
 * Database-backed checkpoint manager using Supabase
 */
export class CheckpointManager implements ICheckpointManager {
  private tableName = "batch_prospect_checkpoints"

  /**
   * Check if a step has already been completed successfully
   */
  async hasCompleted(itemId: string, stepName: string): Promise<boolean> {
    const supabase = await createClient()
    if (!supabase) return false

    const { data } = await (supabase as any)
      .from(this.tableName)
      .select("step_status")
      .eq("item_id", itemId)
      .eq("step_name", stepName)
      .single()

    return data?.step_status === "completed"
  }

  /**
   * Get the result of a completed step
   * Returns null if step not found or not completed
   */
  async getResult<T>(itemId: string, stepName: string): Promise<T | null> {
    const supabase = await createClient()
    if (!supabase) return null

    const { data } = await (supabase as any)
      .from(this.tableName)
      .select("result_data, step_status")
      .eq("item_id", itemId)
      .eq("step_name", stepName)
      .single()

    if (!data || data.step_status !== "completed") {
      return null
    }

    return data.result_data as T
  }

  /**
   * Get all checkpoints for an item
   */
  async getAllCheckpoints(itemId: string): Promise<CheckpointRecord[]> {
    const supabase = await createClient()
    if (!supabase) return []

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[CheckpointManager] Error fetching checkpoints:", error)
      return []
    }

    return (data || []) as CheckpointRecord[]
  }

  /**
   * Save a successful step result
   * Uses upsert to handle both new and resumed steps
   */
  async saveResult(
    itemId: string,
    stepName: string,
    result: unknown,
    meta: StepMeta
  ): Promise<void> {
    const supabase = await createClient()
    if (!supabase) {
      console.warn("[CheckpointManager] No Supabase client, skipping checkpoint save")
      return
    }

    const { error } = await (supabase as any)
      .from(this.tableName)
      .upsert(
        {
          item_id: itemId,
          step_name: stepName,
          step_status: "completed" as CheckpointStatus,
          result_data: result,
          tokens_used: meta.tokensUsed || 0,
          duration_ms: meta.durationMs || null,
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "item_id,step_name",
        }
      )

    if (error) {
      console.error("[CheckpointManager] Error saving checkpoint:", error)
      // Don't throw - checkpoint failure shouldn't stop processing
    } else {
      console.log(`[CheckpointManager] Saved checkpoint: ${stepName} for item ${itemId}`)
    }
  }

  /**
   * Mark a step as failed with error message
   */
  async markFailed(itemId: string, stepName: string, errorMessage: string): Promise<void> {
    const supabase = await createClient()
    if (!supabase) return

    const { error } = await (supabase as any)
      .from(this.tableName)
      .upsert(
        {
          item_id: itemId,
          step_name: stepName,
          step_status: "failed" as CheckpointStatus,
          result_data: null,
          error_message: errorMessage.slice(0, 1000), // Limit error message length
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "item_id,step_name",
        }
      )

    if (error) {
      console.error("[CheckpointManager] Error marking step as failed:", error)
    }
  }

  /**
   * Mark a step as skipped with reason
   */
  async markSkipped(itemId: string, stepName: string, reason: string): Promise<void> {
    const supabase = await createClient()
    if (!supabase) return

    const { error } = await (supabase as any)
      .from(this.tableName)
      .upsert(
        {
          item_id: itemId,
          step_name: stepName,
          step_status: "skipped" as CheckpointStatus,
          result_data: { reason },
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "item_id,step_name",
        }
      )

    if (error) {
      console.error("[CheckpointManager] Error marking step as skipped:", error)
    }
  }

  /**
   * Mark a step as processing (for stale detection)
   */
  async markProcessing(itemId: string, stepName: string): Promise<void> {
    const supabase = await createClient()
    if (!supabase) return

    const { error } = await (supabase as any)
      .from(this.tableName)
      .upsert(
        {
          item_id: itemId,
          step_name: stepName,
          step_status: "processing" as CheckpointStatus,
          result_data: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "item_id,step_name",
        }
      )

    if (error) {
      console.error("[CheckpointManager] Error marking step as processing:", error)
    }
  }

  /**
   * Clear all checkpoints for an item (for full retry)
   */
  async clearCheckpoints(itemId: string): Promise<void> {
    const supabase = await createClient()
    if (!supabase) return

    const { error } = await (supabase as any)
      .from(this.tableName)
      .delete()
      .eq("item_id", itemId)

    if (error) {
      console.error("[CheckpointManager] Error clearing checkpoints:", error)
    } else {
      console.log(`[CheckpointManager] Cleared all checkpoints for item ${itemId}`)
    }
  }

  /**
   * Get completion status summary for an item
   */
  async getCompletionStatus(itemId: string): Promise<{
    total: number
    completed: number
    failed: number
    skipped: number
    pending: number
    processing: number
  }> {
    const checkpoints = await this.getAllCheckpoints(itemId)

    const counts = {
      total: checkpoints.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      processing: 0,
    }

    for (const cp of checkpoints) {
      switch (cp.step_status) {
        case "completed":
          counts.completed++
          break
        case "failed":
          counts.failed++
          break
        case "skipped":
          counts.skipped++
          break
        case "pending":
          counts.pending++
          break
        case "processing":
          counts.processing++
          break
      }
    }

    return counts
  }

  /**
   * Get stale processing checkpoints (stuck for > threshold)
   */
  async getStaleCheckpoints(thresholdMs: number = 5 * 60 * 1000): Promise<CheckpointRecord[]> {
    const supabase = await createClient()
    if (!supabase) return []

    const threshold = new Date(Date.now() - thresholdMs).toISOString()

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("step_status", "processing")
      .lt("updated_at", threshold)

    if (error) {
      console.error("[CheckpointManager] Error fetching stale checkpoints:", error)
      return []
    }

    return (data || []) as CheckpointRecord[]
  }

  /**
   * Get total tokens used for an item across all steps
   */
  async getTotalTokensUsed(itemId: string): Promise<number> {
    const checkpoints = await this.getAllCheckpoints(itemId)
    return checkpoints.reduce((sum, cp) => sum + (cp.tokens_used || 0), 0)
  }

  /**
   * Get the last completed step for an item (for resume)
   */
  async getLastCompletedStep(itemId: string): Promise<string | null> {
    const supabase = await createClient()
    if (!supabase) return null

    const { data } = await (supabase as any)
      .from(this.tableName)
      .select("step_name")
      .eq("item_id", itemId)
      .eq("step_status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    return data?.step_name || null
  }
}

// ============================================================================
// IN-MEMORY CHECKPOINT MANAGER (for testing)
// ============================================================================

/**
 * In-memory checkpoint manager for testing and local development
 */
export class InMemoryCheckpointManager implements ICheckpointManager {
  private checkpoints: Map<string, Map<string, CheckpointRecord>> = new Map()

  private getKey(itemId: string): Map<string, CheckpointRecord> {
    if (!this.checkpoints.has(itemId)) {
      this.checkpoints.set(itemId, new Map())
    }
    return this.checkpoints.get(itemId)!
  }

  async hasCompleted(itemId: string, stepName: string): Promise<boolean> {
    const itemCheckpoints = this.getKey(itemId)
    const checkpoint = itemCheckpoints.get(stepName)
    return checkpoint?.step_status === "completed"
  }

  async getResult<T>(itemId: string, stepName: string): Promise<T | null> {
    const itemCheckpoints = this.getKey(itemId)
    const checkpoint = itemCheckpoints.get(stepName)
    if (checkpoint?.step_status === "completed") {
      return checkpoint.result_data as T
    }
    return null
  }

  async getAllCheckpoints(itemId: string): Promise<CheckpointRecord[]> {
    const itemCheckpoints = this.getKey(itemId)
    return Array.from(itemCheckpoints.values())
  }

  async saveResult(
    itemId: string,
    stepName: string,
    result: unknown,
    meta: StepMeta
  ): Promise<void> {
    const itemCheckpoints = this.getKey(itemId)
    itemCheckpoints.set(stepName, {
      id: `${itemId}-${stepName}`,
      item_id: itemId,
      step_name: stepName,
      step_status: "completed",
      result_data: result,
      tokens_used: meta.tokensUsed || 0,
      duration_ms: meta.durationMs || null,
      error_message: null,
      created_at: new Date().toISOString(),
    })
  }

  async markFailed(itemId: string, stepName: string, error: string): Promise<void> {
    const itemCheckpoints = this.getKey(itemId)
    itemCheckpoints.set(stepName, {
      id: `${itemId}-${stepName}`,
      item_id: itemId,
      step_name: stepName,
      step_status: "failed",
      result_data: null,
      tokens_used: 0,
      duration_ms: null,
      error_message: error,
      created_at: new Date().toISOString(),
    })
  }

  async markSkipped(itemId: string, stepName: string, reason: string): Promise<void> {
    const itemCheckpoints = this.getKey(itemId)
    itemCheckpoints.set(stepName, {
      id: `${itemId}-${stepName}`,
      item_id: itemId,
      step_name: stepName,
      step_status: "skipped",
      result_data: { reason },
      tokens_used: 0,
      duration_ms: null,
      error_message: null,
      created_at: new Date().toISOString(),
    })
  }

  async markProcessing(itemId: string, stepName: string): Promise<void> {
    const itemCheckpoints = this.getKey(itemId)
    itemCheckpoints.set(stepName, {
      id: `${itemId}-${stepName}`,
      item_id: itemId,
      step_name: stepName,
      step_status: "processing",
      result_data: null,
      tokens_used: 0,
      duration_ms: null,
      error_message: null,
      created_at: new Date().toISOString(),
    })
  }

  async clearCheckpoints(itemId: string): Promise<void> {
    this.checkpoints.delete(itemId)
  }

  async getCompletionStatus(itemId: string): Promise<{
    total: number
    completed: number
    failed: number
    skipped: number
    pending: number
    processing: number
  }> {
    const itemCheckpoints = this.getKey(itemId)
    const counts = {
      total: itemCheckpoints.size,
      completed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      processing: 0,
    }

    for (const cp of itemCheckpoints.values()) {
      switch (cp.step_status) {
        case "completed":
          counts.completed++
          break
        case "failed":
          counts.failed++
          break
        case "skipped":
          counts.skipped++
          break
        case "pending":
          counts.pending++
          break
        case "processing":
          counts.processing++
          break
      }
    }

    return counts
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create appropriate checkpoint manager based on environment
 */
export function createCheckpointManager(): ICheckpointManager {
  // In production, use database-backed manager
  // In development without Supabase, fall back to in-memory
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new CheckpointManager()
  }
  console.warn("[CheckpointManager] No Supabase configured, using in-memory manager")
  return new InMemoryCheckpointManager()
}

// Default export for convenience
export const checkpointManager = new CheckpointManager()
