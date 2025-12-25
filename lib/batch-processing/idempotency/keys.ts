/**
 * Idempotency Key System
 *
 * Prevents double-processing of batch items by tracking processing state
 * with unique keys based on item ID, step name, and input hash.
 *
 * Key format: SHA256(itemId + stepName + inputHash)
 *
 * States:
 * - processing: Currently being processed
 * - completed: Successfully completed (result cached)
 * - expired: Key has expired (can be reprocessed)
 */

import { createHash } from "crypto"
import { createClient } from "@/lib/supabase/server"

// ============================================================================
// TYPES
// ============================================================================

export type IdempotencyStatus = "processing" | "completed" | "expired"

export interface IdempotencyRecord {
  key: string
  itemId: string
  stepName: string
  status: IdempotencyStatus
  result?: unknown
  createdAt: Date
  expiresAt: Date
  processingStartedAt?: Date
  processingDurationMs?: number
}

export interface IdempotencyCheckResult {
  exists: boolean
  status?: IdempotencyStatus
  result?: unknown
  canProcess: boolean
}

export interface IIdempotencyManager {
  /**
   * Generate an idempotency key
   */
  generateKey(itemId: string, stepName: string, inputHash?: string): string

  /**
   * Check if processing is allowed (no concurrent processing)
   */
  check(key: string): Promise<IdempotencyCheckResult>

  /**
   * Start processing - acquire lock
   */
  startProcessing(key: string, itemId: string, stepName: string): Promise<boolean>

  /**
   * Complete processing - store result
   */
  completeProcessing(key: string, result: unknown): Promise<void>

  /**
   * Release lock without completing (on error/abort)
   */
  releaseProcessing(key: string): Promise<void>

  /**
   * Get result of completed processing
   */
  getResult<T>(key: string): Promise<T | null>

  /**
   * Clean up expired records
   */
  cleanup(): Promise<number>
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate a deterministic idempotency key
 */
export function generateIdempotencyKey(
  itemId: string,
  stepName: string,
  inputHash: string = ""
): string {
  const data = `${itemId}:${stepName}:${inputHash}`
  return createHash("sha256").update(data).digest("hex")
}

/**
 * Hash input data for idempotency key generation
 */
export function hashInput(input: unknown): string {
  const normalized = JSON.stringify(input, Object.keys(input as object).sort())
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16)
}

// ============================================================================
// DATABASE-BACKED IDEMPOTENCY MANAGER
// ============================================================================

/**
 * TTL for processing state (prevents stuck locks)
 * If processing doesn't complete within this time, lock is released
 */
const PROCESSING_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * TTL for completed records
 * Completed processing can be reused within this time
 */
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export class DatabaseIdempotencyManager implements IIdempotencyManager {
  private tableName = "batch_processing_idempotency"

  generateKey(itemId: string, stepName: string, inputHash: string = ""): string {
    return generateIdempotencyKey(itemId, stepName, inputHash)
  }

  async check(key: string): Promise<IdempotencyCheckResult> {
    const supabase = await createClient()
    if (!supabase) {
      // If no database, allow processing (no idempotency protection)
      return { exists: false, canProcess: true }
    }

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("idempotency_key", key)
      .single()

    if (error || !data) {
      // No record found - can process
      return { exists: false, canProcess: true }
    }

    const now = new Date()
    const expiresAt = new Date(data.expires_at)

    // Check if record has expired
    if (expiresAt < now) {
      return { exists: true, status: "expired", canProcess: true }
    }

    // Check if processing has stalled
    if (data.status === "processing") {
      const processingStarted = new Date(data.created_at)
      const processingAge = now.getTime() - processingStarted.getTime()

      if (processingAge > PROCESSING_TTL_MS) {
        // Processing has stalled - allow reprocessing
        console.log(`[Idempotency] Processing stalled for key ${key.slice(0, 16)}..., allowing reprocessing`)
        return { exists: true, status: "expired", canProcess: true }
      }

      // Currently being processed by another worker
      return { exists: true, status: "processing", canProcess: false }
    }

    // Completed - return cached result
    if (data.status === "completed") {
      return {
        exists: true,
        status: "completed",
        result: data.result,
        canProcess: false,
      }
    }

    return { exists: true, canProcess: true }
  }

  async startProcessing(key: string, itemId: string, stepName: string): Promise<boolean> {
    const supabase = await createClient()
    if (!supabase) {
      return true // Allow processing without database
    }

    const now = new Date()
    const processingExpiry = new Date(now.getTime() + PROCESSING_TTL_MS)

    // Try to insert or update if expired/stalled
    const { error } = await (supabase as any)
      .from(this.tableName)
      .upsert(
        {
          idempotency_key: key,
          item_id: itemId,
          step_name: stepName,
          status: "processing",
          created_at: now.toISOString(),
          expires_at: processingExpiry.toISOString(),
        },
        {
          onConflict: "idempotency_key",
          // Only update if status is not 'processing' or if processing has expired
          // This is handled by checking first
        }
      )

    if (error) {
      // Conflict - another process is handling this
      console.log(`[Idempotency] Failed to acquire lock for key ${key.slice(0, 16)}...: ${error.message}`)
      return false
    }

    console.log(`[Idempotency] Acquired lock for key ${key.slice(0, 16)}... (item: ${itemId}, step: ${stepName})`)
    return true
  }

  async completeProcessing(key: string, result: unknown): Promise<void> {
    const supabase = await createClient()
    if (!supabase) return

    const now = new Date()
    const completedExpiry = new Date(now.getTime() + COMPLETED_TTL_MS)

    const { error } = await (supabase as any)
      .from(this.tableName)
      .update({
        status: "completed",
        result: result,
        expires_at: completedExpiry.toISOString(),
      })
      .eq("idempotency_key", key)

    if (error) {
      console.error(`[Idempotency] Failed to complete processing for key ${key.slice(0, 16)}...: ${error.message}`)
    } else {
      console.log(`[Idempotency] Completed processing for key ${key.slice(0, 16)}...`)
    }
  }

  async releaseProcessing(key: string): Promise<void> {
    const supabase = await createClient()
    if (!supabase) return

    // Delete the processing record so it can be retried
    const { error } = await (supabase as any)
      .from(this.tableName)
      .delete()
      .eq("idempotency_key", key)
      .eq("status", "processing")

    if (error) {
      console.error(`[Idempotency] Failed to release lock for key ${key.slice(0, 16)}...: ${error.message}`)
    } else {
      console.log(`[Idempotency] Released lock for key ${key.slice(0, 16)}...`)
    }
  }

  async getResult<T>(key: string): Promise<T | null> {
    const checkResult = await this.check(key)

    if (checkResult.status === "completed" && checkResult.result !== undefined) {
      return checkResult.result as T
    }

    return null
  }

  async cleanup(): Promise<number> {
    const supabase = await createClient()
    if (!supabase) return 0

    const now = new Date()

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .delete()
      .lt("expires_at", now.toISOString())
      .select("idempotency_key")

    if (error) {
      console.error(`[Idempotency] Cleanup failed: ${error.message}`)
      return 0
    }

    const count = data?.length || 0
    if (count > 0) {
      console.log(`[Idempotency] Cleaned up ${count} expired records`)
    }

    return count
  }
}

// ============================================================================
// IN-MEMORY IDEMPOTENCY MANAGER (for testing)
// ============================================================================

export class InMemoryIdempotencyManager implements IIdempotencyManager {
  private records: Map<string, IdempotencyRecord> = new Map()

  generateKey(itemId: string, stepName: string, inputHash: string = ""): string {
    return generateIdempotencyKey(itemId, stepName, inputHash)
  }

  async check(key: string): Promise<IdempotencyCheckResult> {
    const record = this.records.get(key)

    if (!record) {
      return { exists: false, canProcess: true }
    }

    const now = new Date()

    // Check expiry
    if (record.expiresAt < now) {
      return { exists: true, status: "expired", canProcess: true }
    }

    // Check stalled processing
    if (record.status === "processing" && record.processingStartedAt) {
      const age = now.getTime() - record.processingStartedAt.getTime()
      if (age > PROCESSING_TTL_MS) {
        return { exists: true, status: "expired", canProcess: true }
      }
      return { exists: true, status: "processing", canProcess: false }
    }

    if (record.status === "completed") {
      return {
        exists: true,
        status: "completed",
        result: record.result,
        canProcess: false,
      }
    }

    return { exists: true, canProcess: true }
  }

  async startProcessing(key: string, itemId: string, stepName: string): Promise<boolean> {
    const checkResult = await this.check(key)

    if (!checkResult.canProcess) {
      return false
    }

    const now = new Date()
    this.records.set(key, {
      key,
      itemId,
      stepName,
      status: "processing",
      createdAt: now,
      expiresAt: new Date(now.getTime() + PROCESSING_TTL_MS),
      processingStartedAt: now,
    })

    return true
  }

  async completeProcessing(key: string, result: unknown): Promise<void> {
    const record = this.records.get(key)
    if (!record) return

    record.status = "completed"
    record.result = result
    record.expiresAt = new Date(Date.now() + COMPLETED_TTL_MS)
    record.processingDurationMs = Date.now() - (record.processingStartedAt?.getTime() || Date.now())
  }

  async releaseProcessing(key: string): Promise<void> {
    const record = this.records.get(key)
    if (record?.status === "processing") {
      this.records.delete(key)
    }
  }

  async getResult<T>(key: string): Promise<T | null> {
    const record = this.records.get(key)
    if (record?.status === "completed") {
      return record.result as T
    }
    return null
  }

  async cleanup(): Promise<number> {
    const now = new Date()
    let count = 0

    for (const [key, record] of this.records) {
      if (record.expiresAt < now) {
        this.records.delete(key)
        count++
      }
    }

    return count
  }

  // For testing
  clear(): void {
    this.records.clear()
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create appropriate idempotency manager based on environment
 */
export function createIdempotencyManager(): IIdempotencyManager {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new DatabaseIdempotencyManager()
  }
  console.warn("[Idempotency] No Supabase configured, using in-memory manager")
  return new InMemoryIdempotencyManager()
}

// Default export for convenience
export const idempotencyManager = new DatabaseIdempotencyManager()

// ============================================================================
// WRAPPER FUNCTION
// ============================================================================

/**
 * Execute a function with idempotency protection
 *
 * @example
 * ```ts
 * const result = await withIdempotency(
 *   itemId,
 *   "perplexity_pass1",
 *   { prospect },
 *   async () => {
 *     return await runPerplexitySearch(prospect)
 *   }
 * )
 * ```
 */
export async function withIdempotency<T>(
  itemId: string,
  stepName: string,
  input: unknown,
  fn: () => Promise<T>,
  manager: IIdempotencyManager = idempotencyManager
): Promise<T> {
  const inputHash = hashInput(input)
  const key = manager.generateKey(itemId, stepName, inputHash)

  // Check if already processed
  const checkResult = await manager.check(key)

  if (checkResult.status === "completed" && checkResult.result !== undefined) {
    console.log(`[Idempotency] Returning cached result for ${stepName} (item: ${itemId})`)
    return checkResult.result as T
  }

  if (!checkResult.canProcess) {
    throw new Error(
      `Step ${stepName} is currently being processed for item ${itemId}. ` +
        `Please wait or retry later.`
    )
  }

  // Acquire lock
  const acquired = await manager.startProcessing(key, itemId, stepName)
  if (!acquired) {
    throw new Error(
      `Failed to acquire lock for step ${stepName} (item: ${itemId}). ` +
        `Another process may be handling this.`
    )
  }

  try {
    const result = await fn()
    await manager.completeProcessing(key, result)
    return result
  } catch (error) {
    await manager.releaseProcessing(key)
    throw error
  }
}
