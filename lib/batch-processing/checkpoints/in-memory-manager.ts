/**
 * In-Memory Checkpoint Manager
 *
 * Client-safe checkpoint manager for testing and local development.
 * Does not import any server-only dependencies.
 */

import type {
  CheckpointRecord,
  StepMeta,
  ICheckpointManager,
} from "./types"

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
