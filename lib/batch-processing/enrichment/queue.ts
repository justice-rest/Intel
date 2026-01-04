/**
 * Batch Enrichment Queue System
 *
 * A robust queue system for processing prospect enrichment at scale:
 * - Priority-based processing (high-value prospects first)
 * - Rate limiting per data source
 * - Automatic retry with exponential backoff
 * - Real-time progress events
 * - Graceful degradation on partial failures
 */

import { enrichProspect } from "./engine"
import type {
  EnrichmentRequest,
  EnrichmentResponse,
  EnrichmentMode,
  ProspectIntelligence,
} from "./types"

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichmentQueueItem {
  id: string
  prospect: EnrichmentRequest["prospect"]
  mode: EnrichmentMode
  priority: "HIGH" | "MEDIUM" | "LOW"
  status: "pending" | "processing" | "completed" | "failed"
  retryCount: number
  maxRetries: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  result?: ProspectIntelligence
  error?: string
  // For batch tracking
  batchId?: string
  itemIndex?: number
}

export interface BatchEnrichmentJob {
  id: string
  name: string
  status: "pending" | "processing" | "completed" | "failed" | "paused"
  mode: EnrichmentMode
  items: EnrichmentQueueItem[]
  totalItems: number
  completedCount: number
  failedCount: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  // Progress callback for real-time updates
  onProgress?: (event: EnrichmentProgressEvent) => void
}

export interface EnrichmentProgressEvent {
  type: "item_started" | "item_completed" | "item_failed" | "batch_completed" | "batch_failed"
  batchId: string
  itemId?: string
  itemIndex?: number
  prospectName?: string
  progress: {
    completed: number
    failed: number
    total: number
    percentage: number
  }
  result?: ProspectIntelligence
  error?: string
  timestamp: Date
}

export interface QueueConfig {
  maxConcurrent: number
  delayBetweenItems: number
  maxRetries: number
  retryDelayBase: number
  onProgress?: (event: EnrichmentProgressEvent) => void
}

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 1, // Process 1 prospect at a time - batch enrichment is HEAVY
  delayBetweenItems: 500, // 500ms between items
  maxRetries: 1, // Only 1 retry to avoid compounding timeouts
  retryDelayBase: 1000, // 1 second base delay
}

// ============================================================================
// QUEUE IMPLEMENTATION
// ============================================================================

export class EnrichmentQueue {
  private items: Map<string, EnrichmentQueueItem> = new Map()
  private processing: Set<string> = new Set()
  private config: QueueConfig
  private isRunning: boolean = false
  private batchId: string
  private apiKey?: string

  constructor(batchId: string, config: Partial<QueueConfig> = {}, apiKey?: string) {
    this.batchId = batchId
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.apiKey = apiKey
  }

  /**
   * Add a prospect to the enrichment queue
   */
  add(item: Omit<EnrichmentQueueItem, "id" | "status" | "retryCount" | "createdAt" | "maxRetries" | "batchId">): string {
    const id = `enrich_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const queueItem: EnrichmentQueueItem = {
      ...item,
      id,
      status: "pending",
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date(),
      batchId: this.batchId,
    }
    this.items.set(id, queueItem)
    return id
  }

  /**
   * Add multiple prospects to the queue
   */
  addBatch(
    prospects: Array<{
      prospect: EnrichmentRequest["prospect"]
      mode?: EnrichmentMode
      priority?: "HIGH" | "MEDIUM" | "LOW"
    }>
  ): string[] {
    return prospects.map((p, index) =>
      this.add({
        prospect: p.prospect,
        mode: p.mode || "STANDARD",
        priority: p.priority || "MEDIUM",
        itemIndex: index,
      })
    )
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    console.log(`[EnrichmentQueue] Starting queue processing for batch ${this.batchId}`)

    while (this.isRunning && this.hasWork()) {
      await this.processNextBatch()

      // Delay between batches
      if (this.hasWork()) {
        await this.sleep(this.config.delayBetweenItems)
      }
    }

    this.isRunning = false
    console.log(`[EnrichmentQueue] Queue processing completed for batch ${this.batchId}`)

    // Emit batch completed event
    this.emitProgress({
      type: "batch_completed",
      batchId: this.batchId,
      progress: this.getProgress(),
      timestamp: new Date(),
    })
  }

  /**
   * Stop processing (gracefully finish current items)
   */
  stop(): void {
    this.isRunning = false
  }

  /**
   * Pause processing (can be resumed)
   */
  pause(): void {
    this.isRunning = false
  }

  /**
   * Resume processing
   */
  async resume(): Promise<void> {
    await this.start()
  }

  /**
   * Get current progress
   */
  getProgress(): EnrichmentProgressEvent["progress"] {
    const items = Array.from(this.items.values())
    const completed = items.filter((i) => i.status === "completed").length
    const failed = items.filter((i) => i.status === "failed").length
    const total = items.length

    return {
      completed,
      failed,
      total,
      percentage: total > 0 ? Math.round(((completed + failed) / total) * 100) : 0,
    }
  }

  /**
   * Get all results
   */
  getResults(): Map<string, ProspectIntelligence | undefined> {
    const results = new Map<string, ProspectIntelligence | undefined>()
    for (const [id, item] of this.items) {
      if (item.status === "completed") {
        results.set(id, item.result)
      }
    }
    return results
  }

  /**
   * Get item by ID
   */
  getItem(id: string): EnrichmentQueueItem | undefined {
    return this.items.get(id)
  }

  /**
   * Get all items
   */
  getAllItems(): EnrichmentQueueItem[] {
    return Array.from(this.items.values())
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private hasWork(): boolean {
    return Array.from(this.items.values()).some(
      (item) => item.status === "pending" || (item.status === "failed" && item.retryCount < item.maxRetries)
    )
  }

  private async processNextBatch(): Promise<void> {
    // Get items to process (respecting concurrent limit)
    const availableSlots = this.config.maxConcurrent - this.processing.size
    if (availableSlots <= 0) return

    // Get pending items, sorted by priority
    const pendingItems = Array.from(this.items.values())
      .filter(
        (item) =>
          !this.processing.has(item.id) &&
          (item.status === "pending" ||
            (item.status === "failed" && item.retryCount < item.maxRetries))
      )
      .sort((a, b) => {
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
      .slice(0, availableSlots)

    if (pendingItems.length === 0) return

    // Process items in parallel
    await Promise.all(pendingItems.map((item) => this.processItem(item)))
  }

  private async processItem(item: EnrichmentQueueItem): Promise<void> {
    this.processing.add(item.id)
    item.status = "processing"
    item.startedAt = new Date()

    // Emit progress event
    this.emitProgress({
      type: "item_started",
      batchId: this.batchId,
      itemId: item.id,
      itemIndex: item.itemIndex,
      prospectName: item.prospect.name,
      progress: this.getProgress(),
      timestamp: new Date(),
    })

    try {
      const request: EnrichmentRequest = {
        prospect: item.prospect,
        mode: item.mode,
      }

      const response = await enrichProspect(request, this.apiKey)

      if (response.success && response.intelligence) {
        item.status = "completed"
        item.completedAt = new Date()
        item.result = response.intelligence

        this.emitProgress({
          type: "item_completed",
          batchId: this.batchId,
          itemId: item.id,
          itemIndex: item.itemIndex,
          prospectName: item.prospect.name,
          progress: this.getProgress(),
          result: response.intelligence,
          timestamp: new Date(),
        })
      } else {
        throw new Error(response.error || "Enrichment failed")
      }
    } catch (error) {
      item.retryCount++
      item.error = error instanceof Error ? error.message : String(error)

      if (item.retryCount >= item.maxRetries) {
        item.status = "failed"
        item.completedAt = new Date()

        this.emitProgress({
          type: "item_failed",
          batchId: this.batchId,
          itemId: item.id,
          itemIndex: item.itemIndex,
          prospectName: item.prospect.name,
          progress: this.getProgress(),
          error: item.error,
          timestamp: new Date(),
        })
      } else {
        // Will retry
        item.status = "pending"
        console.log(
          `[EnrichmentQueue] Item ${item.id} failed, will retry (${item.retryCount}/${item.maxRetries})`
        )

        // Exponential backoff delay
        const delay = this.config.retryDelayBase * Math.pow(2, item.retryCount - 1)
        await this.sleep(delay)
      }
    } finally {
      this.processing.delete(item.id)
    }
  }

  private emitProgress(event: EnrichmentProgressEvent): void {
    if (this.config.onProgress) {
      try {
        this.config.onProgress(event)
      } catch (error) {
        console.error("[EnrichmentQueue] Progress callback error:", error)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create and start a batch enrichment job
 */
export async function createBatchEnrichmentJob(options: {
  name: string
  prospects: Array<{
    prospect: EnrichmentRequest["prospect"]
    mode?: EnrichmentMode
    priority?: "HIGH" | "MEDIUM" | "LOW"
  }>
  defaultMode?: EnrichmentMode
  maxConcurrent?: number
  onProgress?: (event: EnrichmentProgressEvent) => void
  apiKey?: string
}): Promise<{
  job: BatchEnrichmentJob
  queue: EnrichmentQueue
}> {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const queue = new EnrichmentQueue(
    batchId,
    {
      maxConcurrent: options.maxConcurrent || 3,
      onProgress: options.onProgress,
    },
    options.apiKey
  )

  // Add all prospects to queue
  const itemIds = queue.addBatch(
    options.prospects.map((p) => ({
      prospect: p.prospect,
      mode: p.mode || options.defaultMode || "STANDARD",
      priority: p.priority || "MEDIUM",
    }))
  )

  const job: BatchEnrichmentJob = {
    id: batchId,
    name: options.name,
    status: "pending",
    mode: options.defaultMode || "STANDARD",
    items: queue.getAllItems(),
    totalItems: itemIds.length,
    completedCount: 0,
    failedCount: 0,
    createdAt: new Date(),
    onProgress: options.onProgress,
  }

  return { job, queue }
}

/**
 * Run batch enrichment synchronously (waits for completion)
 */
export async function runBatchEnrichment(options: {
  name: string
  prospects: Array<{
    prospect: EnrichmentRequest["prospect"]
    mode?: EnrichmentMode
    priority?: "HIGH" | "MEDIUM" | "LOW"
  }>
  defaultMode?: EnrichmentMode
  maxConcurrent?: number
  onProgress?: (event: EnrichmentProgressEvent) => void
  apiKey?: string
}): Promise<{
  results: Map<string, ProspectIntelligence | undefined>
  progress: EnrichmentProgressEvent["progress"]
  items: EnrichmentQueueItem[]
}> {
  const { queue } = await createBatchEnrichmentJob(options)

  await queue.start()

  return {
    results: queue.getResults(),
    progress: queue.getProgress(),
    items: queue.getAllItems(),
  }
}
