/**
 * Dead Letter Queue Manager
 *
 * Captures permanently failed batch items for manual review and retry.
 * Items move to DLQ after exhausting all retry attempts.
 *
 * Features:
 * - Full error context for debugging
 * - Checkpoint state preserved for resume
 * - Resolution tracking (retried, skipped, manual_fix)
 * - Metrics for failure analysis
 */

import { createClient } from "@/lib/supabase/server"
import type { CheckpointRecord } from "../checkpoints/types"

// ============================================================================
// TYPES
// ============================================================================

export type DLQResolution = "pending" | "retried" | "skipped" | "manual_fix"

export interface DeadLetterItem {
  id: string
  itemId: string
  jobId: string
  userId: string

  // Failure information
  failureReason: string
  failureCount: number
  lastError: {
    message: string
    stack?: string
    step?: string
    timestamp: string
  }

  // Context for debugging
  prospectData: Record<string, unknown>
  checkpoints: CheckpointRecord[]

  // Resolution tracking
  resolution: DLQResolution
  resolvedAt?: Date
  resolvedBy?: string
  resolutionNotes?: string

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface DLQStats {
  total: number
  pending: number
  retried: number
  skipped: number
  manualFix: number
  oldestPending: Date | null
  commonErrors: Array<{ error: string; count: number }>
}

export interface IDLQManager {
  /**
   * Add an item to the dead letter queue
   */
  add(params: {
    itemId: string
    jobId: string
    userId: string
    failureReason: string
    lastError: Error
    step?: string
    prospectData: Record<string, unknown>
    checkpoints?: CheckpointRecord[]
  }): Promise<string>

  /**
   * Get all items in the DLQ for a user
   */
  getByUser(userId: string, options?: { status?: DLQResolution; limit?: number }): Promise<DeadLetterItem[]>

  /**
   * Get all items in the DLQ for a job
   */
  getByJob(jobId: string): Promise<DeadLetterItem[]>

  /**
   * Get a single DLQ item
   */
  get(id: string): Promise<DeadLetterItem | null>

  /**
   * Mark an item for retry
   */
  markForRetry(id: string, userId: string, notes?: string): Promise<void>

  /**
   * Mark an item as skipped (won't be retried)
   */
  markAsSkipped(id: string, userId: string, notes?: string): Promise<void>

  /**
   * Mark an item as manually fixed
   */
  markAsManualFix(id: string, userId: string, notes?: string): Promise<void>

  /**
   * Get DLQ statistics
   */
  getStats(userId?: string): Promise<DLQStats>

  /**
   * Clean up old resolved items
   */
  cleanup(olderThanDays: number): Promise<number>
}

// ============================================================================
// DATABASE IMPLEMENTATION
// ============================================================================

export class DatabaseDLQManager implements IDLQManager {
  private tableName = "batch_dead_letter_queue"

  async add(params: {
    itemId: string
    jobId: string
    userId: string
    failureReason: string
    lastError: Error
    step?: string
    prospectData: Record<string, unknown>
    checkpoints?: CheckpointRecord[]
  }): Promise<string> {
    const supabase = await createClient()
    if (!supabase) {
      console.error("[DLQ] No Supabase client, cannot add to DLQ")
      throw new Error("Database unavailable")
    }

    // Check if item already in DLQ
    const { data: existing } = await (supabase as any)
      .from(this.tableName)
      .select("id, failure_count")
      .eq("item_id", params.itemId)
      .eq("resolution", "pending")
      .single()

    if (existing) {
      // Update existing DLQ entry
      const { error } = await (supabase as any)
        .from(this.tableName)
        .update({
          failure_count: existing.failure_count + 1,
          failure_reason: params.failureReason,
          last_error: {
            message: params.lastError.message,
            stack: params.lastError.stack,
            step: params.step,
            timestamp: new Date().toISOString(),
          },
          checkpoints: params.checkpoints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (error) {
        console.error("[DLQ] Failed to update DLQ entry:", error)
        throw error
      }

      console.log(`[DLQ] Updated existing entry for item ${params.itemId} (failures: ${existing.failure_count + 1})`)
      return existing.id
    }

    // Create new DLQ entry
    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .insert({
        item_id: params.itemId,
        job_id: params.jobId,
        user_id: params.userId,
        failure_reason: params.failureReason,
        failure_count: 1,
        last_error: {
          message: params.lastError.message,
          stack: params.lastError.stack,
          step: params.step,
          timestamp: new Date().toISOString(),
        },
        prospect_data: params.prospectData,
        checkpoints: params.checkpoints || [],
        resolution: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error) {
      console.error("[DLQ] Failed to add to DLQ:", error)
      throw error
    }

    console.log(`[DLQ] Added item ${params.itemId} to dead letter queue (id: ${data.id})`)
    return data.id
  }

  async getByUser(
    userId: string,
    options: { status?: DLQResolution; limit?: number } = {}
  ): Promise<DeadLetterItem[]> {
    const supabase = await createClient()
    if (!supabase) return []

    let query = (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (options.status) {
      query = query.eq("resolution", options.status)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) {
      console.error("[DLQ] Failed to fetch DLQ items:", error)
      return []
    }

    return (data || []).map(this.mapToDeadLetterItem)
  }

  async getByJob(jobId: string): Promise<DeadLetterItem[]> {
    const supabase = await createClient()
    if (!supabase) return []

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[DLQ] Failed to fetch DLQ items for job:", error)
      return []
    }

    return (data || []).map(this.mapToDeadLetterItem)
  }

  async get(id: string): Promise<DeadLetterItem | null> {
    const supabase = await createClient()
    if (!supabase) return null

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapToDeadLetterItem(data)
  }

  async markForRetry(id: string, userId: string, notes?: string): Promise<void> {
    await this.updateResolution(id, "retried", userId, notes)
    console.log(`[DLQ] Marked item ${id} for retry`)
  }

  async markAsSkipped(id: string, userId: string, notes?: string): Promise<void> {
    await this.updateResolution(id, "skipped", userId, notes)
    console.log(`[DLQ] Marked item ${id} as skipped`)
  }

  async markAsManualFix(id: string, userId: string, notes?: string): Promise<void> {
    await this.updateResolution(id, "manual_fix", userId, notes)
    console.log(`[DLQ] Marked item ${id} as manually fixed`)
  }

  async getStats(userId?: string): Promise<DLQStats> {
    const supabase = await createClient()
    if (!supabase) {
      return {
        total: 0,
        pending: 0,
        retried: 0,
        skipped: 0,
        manualFix: 0,
        oldestPending: null,
        commonErrors: [],
      }
    }

    let query = (supabase as any).from(this.tableName).select("resolution, failure_reason, created_at")

    if (userId) {
      query = query.eq("user_id", userId)
    }

    const { data, error } = await query

    if (error || !data) {
      return {
        total: 0,
        pending: 0,
        retried: 0,
        skipped: 0,
        manualFix: 0,
        oldestPending: null,
        commonErrors: [],
      }
    }

    // Count by resolution
    const counts = { pending: 0, retried: 0, skipped: 0, manual_fix: 0 }
    const errorCounts = new Map<string, number>()
    let oldestPending: Date | null = null

    for (const item of data) {
      counts[item.resolution as keyof typeof counts]++

      if (item.resolution === "pending") {
        const createdAt = new Date(item.created_at)
        if (!oldestPending || createdAt < oldestPending) {
          oldestPending = createdAt
        }
      }

      // Count error types
      const errorKey = item.failure_reason?.slice(0, 100) || "Unknown"
      errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1)
    }

    // Sort errors by count
    const commonErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }))

    return {
      total: data.length,
      pending: counts.pending,
      retried: counts.retried,
      skipped: counts.skipped,
      manualFix: counts.manual_fix,
      oldestPending,
      commonErrors,
    }
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const supabase = await createClient()
    if (!supabase) return 0

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .delete()
      .neq("resolution", "pending")
      .lt("resolved_at", cutoff.toISOString())
      .select("id")

    if (error) {
      console.error("[DLQ] Cleanup failed:", error)
      return 0
    }

    const count = data?.length || 0
    if (count > 0) {
      console.log(`[DLQ] Cleaned up ${count} resolved items older than ${olderThanDays} days`)
    }

    return count
  }

  private async updateResolution(
    id: string,
    resolution: DLQResolution,
    userId: string,
    notes?: string
  ): Promise<void> {
    const supabase = await createClient()
    if (!supabase) throw new Error("Database unavailable")

    const { error } = await (supabase as any)
      .from(this.tableName)
      .update({
        resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error(`[DLQ] Failed to update resolution:`, error)
      throw error
    }
  }

  private mapToDeadLetterItem(data: Record<string, unknown>): DeadLetterItem {
    return {
      id: data.id as string,
      itemId: data.item_id as string,
      jobId: data.job_id as string,
      userId: data.user_id as string,
      failureReason: data.failure_reason as string,
      failureCount: data.failure_count as number,
      lastError: data.last_error as DeadLetterItem["lastError"],
      prospectData: data.prospect_data as Record<string, unknown>,
      checkpoints: (data.checkpoints as CheckpointRecord[]) || [],
      resolution: data.resolution as DLQResolution,
      resolvedAt: data.resolved_at ? new Date(data.resolved_at as string) : undefined,
      resolvedBy: data.resolved_by as string | undefined,
      resolutionNotes: data.resolution_notes as string | undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    }
  }
}

// ============================================================================
// IN-MEMORY IMPLEMENTATION (for testing)
// ============================================================================

export class InMemoryDLQManager implements IDLQManager {
  private items: Map<string, DeadLetterItem> = new Map()
  private nextId = 1

  async add(params: {
    itemId: string
    jobId: string
    userId: string
    failureReason: string
    lastError: Error
    step?: string
    prospectData: Record<string, unknown>
    checkpoints?: CheckpointRecord[]
  }): Promise<string> {
    // Check for existing
    for (const item of this.items.values()) {
      if (item.itemId === params.itemId && item.resolution === "pending") {
        item.failureCount++
        item.lastError = {
          message: params.lastError.message,
          stack: params.lastError.stack,
          step: params.step,
          timestamp: new Date().toISOString(),
        }
        item.updatedAt = new Date()
        return item.id
      }
    }

    const id = `dlq-${this.nextId++}`
    const now = new Date()

    this.items.set(id, {
      id,
      itemId: params.itemId,
      jobId: params.jobId,
      userId: params.userId,
      failureReason: params.failureReason,
      failureCount: 1,
      lastError: {
        message: params.lastError.message,
        stack: params.lastError.stack,
        step: params.step,
        timestamp: now.toISOString(),
      },
      prospectData: params.prospectData,
      checkpoints: params.checkpoints || [],
      resolution: "pending",
      createdAt: now,
      updatedAt: now,
    })

    return id
  }

  async getByUser(
    userId: string,
    options: { status?: DLQResolution; limit?: number } = {}
  ): Promise<DeadLetterItem[]> {
    let items = Array.from(this.items.values()).filter((i) => i.userId === userId)

    if (options.status) {
      items = items.filter((i) => i.resolution === options.status)
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    if (options.limit) {
      items = items.slice(0, options.limit)
    }

    return items
  }

  async getByJob(jobId: string): Promise<DeadLetterItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.jobId === jobId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async get(id: string): Promise<DeadLetterItem | null> {
    return this.items.get(id) || null
  }

  async markForRetry(id: string, userId: string, notes?: string): Promise<void> {
    const item = this.items.get(id)
    if (item) {
      item.resolution = "retried"
      item.resolvedAt = new Date()
      item.resolvedBy = userId
      item.resolutionNotes = notes
      item.updatedAt = new Date()
    }
  }

  async markAsSkipped(id: string, userId: string, notes?: string): Promise<void> {
    const item = this.items.get(id)
    if (item) {
      item.resolution = "skipped"
      item.resolvedAt = new Date()
      item.resolvedBy = userId
      item.resolutionNotes = notes
      item.updatedAt = new Date()
    }
  }

  async markAsManualFix(id: string, userId: string, notes?: string): Promise<void> {
    const item = this.items.get(id)
    if (item) {
      item.resolution = "manual_fix"
      item.resolvedAt = new Date()
      item.resolvedBy = userId
      item.resolutionNotes = notes
      item.updatedAt = new Date()
    }
  }

  async getStats(userId?: string): Promise<DLQStats> {
    let items = Array.from(this.items.values())

    if (userId) {
      items = items.filter((i) => i.userId === userId)
    }

    const stats: DLQStats = {
      total: items.length,
      pending: 0,
      retried: 0,
      skipped: 0,
      manualFix: 0,
      oldestPending: null,
      commonErrors: [],
    }

    const errorCounts = new Map<string, number>()

    for (const item of items) {
      switch (item.resolution) {
        case "pending":
          stats.pending++
          if (!stats.oldestPending || item.createdAt < stats.oldestPending) {
            stats.oldestPending = item.createdAt
          }
          break
        case "retried":
          stats.retried++
          break
        case "skipped":
          stats.skipped++
          break
        case "manual_fix":
          stats.manualFix++
          break
      }

      const errorKey = item.failureReason.slice(0, 100)
      errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1)
    }

    stats.commonErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }))

    return stats
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)

    let count = 0
    for (const [id, item] of this.items) {
      if (item.resolution !== "pending" && item.resolvedAt && item.resolvedAt < cutoff) {
        this.items.delete(id)
        count++
      }
    }

    return count
  }

  // For testing
  clear(): void {
    this.items.clear()
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create appropriate DLQ manager based on environment
 */
export function createDLQManager(): IDLQManager {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new DatabaseDLQManager()
  }
  console.warn("[DLQ] No Supabase configured, using in-memory manager")
  return new InMemoryDLQManager()
}

// Default export for convenience
export const dlqManager = new DatabaseDLQManager()
