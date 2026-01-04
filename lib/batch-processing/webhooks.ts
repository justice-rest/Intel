/**
 * Batch Processing Webhooks
 *
 * Sends webhook notifications when batch processing jobs complete.
 * Includes HMAC signature for verification if a secret is provided.
 */

import crypto from "crypto"
import type { BatchProspectJob, BatchProspectItem } from "./types"

// Webhook timeout in milliseconds (10 seconds)
const WEBHOOK_TIMEOUT_MS = 10_000

// Max retries for webhook delivery
const MAX_WEBHOOK_RETRIES = 3

// Retry delays in milliseconds
const RETRY_DELAYS = [1000, 3000, 5000]

export interface WebhookPayload {
  event: "batch.completed" | "batch.failed" | "batch.cancelled"
  timestamp: string
  job_id: string
  job_name: string
  status: string
  summary: {
    total_prospects: number
    completed_count: number
    failed_count: number
    skipped_count: number
    success_rate: number
  }
  // High-level results (not full reports to keep payload small)
  top_prospects?: Array<{
    name: string
    romy_score?: number
    capacity_rating?: string
    estimated_gift_capacity?: number
  }>
  // Links for the user to access full results
  links: {
    view_results: string
    export_csv: string
  }
  // Processing metadata
  processing: {
    started_at?: string
    completed_at?: string
    duration_seconds?: number
  }
}

export interface WebhookResult {
  success: boolean
  status_code?: number
  error?: string
  retries_attempted: number
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex")
}

/**
 * Send webhook notification with retry logic
 */
export async function sendWebhookNotification(
  webhookUrl: string,
  payload: WebhookPayload,
  secret?: string
): Promise<WebhookResult> {
  const payloadString = JSON.stringify(payload)

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Romy-Batch-Processor/1.0",
    "X-Romy-Event": payload.event,
    "X-Romy-Delivery": crypto.randomUUID(),
  }

  // Add signature if secret is provided
  if (secret) {
    const signature = generateSignature(payloadString, secret)
    headers["X-Romy-Signature"] = `sha256=${signature}`
  }

  // Add timestamp for replay protection
  headers["X-Romy-Timestamp"] = new Date().toISOString()

  let lastError: string | undefined
  let lastStatusCode: number | undefined

  for (let attempt = 0; attempt <= MAX_WEBHOOK_RETRIES; attempt++) {
    try {
      // Add retry delay for subsequent attempts
      if (attempt > 0) {
        const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)]
        await new Promise((resolve) => setTimeout(resolve, delay))
        console.log(`[Webhook] Retry attempt ${attempt} for ${webhookUrl}`)
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: payloadString,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      lastStatusCode = response.status

      // 2xx responses are considered successful
      if (response.ok) {
        console.log(`[Webhook] Successfully delivered to ${webhookUrl} (status: ${response.status})`)
        return {
          success: true,
          status_code: response.status,
          retries_attempted: attempt,
        }
      }

      // 4xx errors are client errors - don't retry
      if (response.status >= 400 && response.status < 500) {
        lastError = `HTTP ${response.status}: ${await response.text().catch(() => "Unknown error")}`
        console.error(`[Webhook] Client error (no retry): ${lastError}`)
        break
      }

      // 5xx errors - retry
      lastError = `HTTP ${response.status}`
      console.warn(`[Webhook] Server error, will retry: ${lastError}`)
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          lastError = "Request timed out"
        } else {
          lastError = error.message
        }
      } else {
        lastError = "Unknown error"
      }
      console.warn(`[Webhook] Request failed: ${lastError}`)
    }
  }

  console.error(`[Webhook] Failed to deliver to ${webhookUrl} after ${MAX_WEBHOOK_RETRIES} retries: ${lastError}`)

  return {
    success: false,
    status_code: lastStatusCode,
    error: lastError,
    retries_attempted: MAX_WEBHOOK_RETRIES,
  }
}

/**
 * Build webhook payload from job and items data
 */
export function buildWebhookPayload(
  job: BatchProspectJob,
  items: BatchProspectItem[],
  appUrl: string = "https://intel.getromy.app"
): WebhookPayload {
  // Determine event type based on job status
  let event: WebhookPayload["event"] = "batch.completed"
  if (job.status === "failed") {
    event = "batch.failed"
  } else if (job.status === "cancelled") {
    event = "batch.cancelled"
  }

  // Calculate success rate
  const successRate = job.total_prospects > 0
    ? Math.round((job.completed_count / job.total_prospects) * 100)
    : 0

  // Get top prospects (sorted by romy_score, limited to 5)
  const topProspects = items
    .filter((item) => item.status === "completed" && item.romy_score != null)
    .sort((a, b) => (b.romy_score || 0) - (a.romy_score || 0))
    .slice(0, 5)
    .map((item) => ({
      name: item.prospect_name || item.input_data.name,
      romy_score: item.romy_score,
      capacity_rating: item.capacity_rating,
      estimated_gift_capacity: item.estimated_gift_capacity,
    }))

  // Calculate processing duration
  let durationSeconds: number | undefined
  if (job.started_at && job.completed_at) {
    const startTime = new Date(job.started_at).getTime()
    const endTime = new Date(job.completed_at).getTime()
    durationSeconds = Math.round((endTime - startTime) / 1000)
  }

  return {
    event,
    timestamp: new Date().toISOString(),
    job_id: job.id,
    job_name: job.name,
    status: job.status,
    summary: {
      total_prospects: job.total_prospects,
      completed_count: job.completed_count,
      failed_count: job.failed_count,
      skipped_count: job.skipped_count,
      success_rate: successRate,
    },
    top_prospects: topProspects.length > 0 ? topProspects : undefined,
    links: {
      view_results: `${appUrl}/batch-research/${job.id}`,
      export_csv: `${appUrl}/api/batch-prospects/${job.id}/export?format=csv`,
    },
    processing: {
      started_at: job.started_at,
      completed_at: job.completed_at,
      duration_seconds: durationSeconds,
    },
  }
}

/**
 * Send batch completion webhook if configured
 * This is a fire-and-forget operation - errors are logged but don't affect the main flow
 */
export async function triggerBatchCompletionWebhook(
  job: BatchProspectJob,
  items: BatchProspectItem[],
  updateJobWebhookStatus: (jobId: string, success: boolean, error?: string) => Promise<void>
): Promise<void> {
  if (!job.webhook_url) {
    return // No webhook configured
  }

  // Validate webhook URL
  try {
    const url = new URL(job.webhook_url)
    if (!["http:", "https:"].includes(url.protocol)) {
      console.error(`[Webhook] Invalid protocol for webhook URL: ${url.protocol}`)
      await updateJobWebhookStatus(job.id, false, "Invalid webhook URL protocol")
      return
    }
  } catch {
    console.error(`[Webhook] Invalid webhook URL: ${job.webhook_url}`)
    await updateJobWebhookStatus(job.id, false, "Invalid webhook URL")
    return
  }

  console.log(`[Webhook] Sending completion webhook for job ${job.id} to ${job.webhook_url}`)

  const payload = buildWebhookPayload(job, items)
  const result = await sendWebhookNotification(job.webhook_url, payload, job.webhook_secret)

  await updateJobWebhookStatus(job.id, result.success, result.error)
}
