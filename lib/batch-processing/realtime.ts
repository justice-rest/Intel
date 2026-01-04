/**
 * Batch Processing Realtime Subscription
 *
 * Provides real-time updates for batch processing progress using Supabase Realtime.
 * This allows the UI to receive instant updates when items are processed without polling.
 *
 * Usage:
 * ```tsx
 * const { items, job, isConnected } = useBatchRealtimeUpdates(jobId, initialItems, initialJob)
 * ```
 */

"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { BatchProspectItem, BatchProspectJob } from "./types"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

interface UseBatchRealtimeOptions {
  /** Called when an item is updated */
  onItemUpdate?: (item: BatchProspectItem) => void
  /** Called when the job is updated */
  onJobUpdate?: (job: BatchProspectJob) => void
  /** Called when an item is completed */
  onItemCompleted?: (item: BatchProspectItem) => void
  /** Called when an item fails */
  onItemFailed?: (item: BatchProspectItem) => void
  /** Called when the job is completed */
  onJobCompleted?: (job: BatchProspectJob) => void
  /** Enable/disable the subscription */
  enabled?: boolean
}

interface UseBatchRealtimeResult {
  /** Current items with realtime updates applied */
  items: BatchProspectItem[]
  /** Current job with realtime updates applied */
  job: BatchProspectJob
  /** Whether the realtime connection is active */
  isConnected: boolean
  /** Any error that occurred */
  error: string | null
  /** Manually refresh the data */
  refresh: () => Promise<void>
}

/**
 * Hook for subscribing to realtime batch processing updates
 */
export function useBatchRealtimeUpdates(
  jobId: string,
  initialItems: BatchProspectItem[],
  initialJob: BatchProspectJob,
  options: UseBatchRealtimeOptions = {}
): UseBatchRealtimeResult {
  const {
    onItemUpdate,
    onJobUpdate,
    onItemCompleted,
    onItemFailed,
    onJobCompleted,
    enabled = true,
  } = options

  const [items, setItems] = useState<BatchProspectItem[]>(initialItems)
  const [job, setJob] = useState<BatchProspectJob>(initialJob)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())

  // Update local state when initial data changes
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    setJob(initialJob)
  }, [initialJob])

  // Refresh function to manually fetch latest data
  const refresh = useCallback(async () => {
    const supabase = supabaseRef.current
    if (!supabase) return

    try {
      // Fetch job
      const { data: jobData } = await (supabase as any)
        .from("batch_prospect_jobs")
        .select("*")
        .eq("id", jobId)
        .single()

      if (jobData) {
        setJob(jobData as BatchProspectJob)
      }

      // Fetch items
      const { data: itemsData } = await (supabase as any)
        .from("batch_prospect_items")
        .select("*")
        .eq("job_id", jobId)
        .order("item_index", { ascending: true })

      if (itemsData) {
        setItems(itemsData as BatchProspectItem[])
      }
    } catch (err) {
      console.error("[BatchRealtime] Error refreshing:", err)
    }
  }, [jobId])

  // Set up realtime subscription
  useEffect(() => {
    if (!enabled || !jobId) return

    const supabase = supabaseRef.current
    if (!supabase) {
      setError("Supabase client not available")
      return
    }

    // Create a channel for this job's updates
    const channel = supabase
      .channel(`batch-job-${jobId}`)
      // Subscribe to item updates
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "batch_prospect_items",
          filter: `job_id=eq.${jobId}`,
        },
        (payload: RealtimePostgresChangesPayload<BatchProspectItem>) => {
          const updatedItem = payload.new as BatchProspectItem
          const oldItem = payload.old as Partial<BatchProspectItem>

          console.log(`[BatchRealtime] Item update: ${updatedItem.prospect_name} -> ${updatedItem.status}`)

          setItems((prev) =>
            prev.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            )
          )

          // Call callbacks
          onItemUpdate?.(updatedItem)

          // Check for status transitions
          if (oldItem.status !== "completed" && updatedItem.status === "completed") {
            onItemCompleted?.(updatedItem)
          }
          if (oldItem.status !== "failed" && updatedItem.status === "failed") {
            onItemFailed?.(updatedItem)
          }
        }
      )
      // Subscribe to job updates
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "batch_prospect_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload: RealtimePostgresChangesPayload<BatchProspectJob>) => {
          const updatedJob = payload.new as BatchProspectJob
          const oldJob = payload.old as Partial<BatchProspectJob>

          console.log(`[BatchRealtime] Job update: ${updatedJob.name} -> ${updatedJob.status}`)

          setJob(updatedJob)
          onJobUpdate?.(updatedJob)

          // Check for completion
          if (oldJob.status !== "completed" && updatedJob.status === "completed") {
            onJobCompleted?.(updatedJob)
          }
        }
      )
      .subscribe((status) => {
        console.log(`[BatchRealtime] Subscription status: ${status}`)
        setIsConnected(status === "SUBSCRIBED")
        if (status === "CHANNEL_ERROR") {
          setError("Failed to connect to realtime updates")
        } else if (status === "SUBSCRIBED") {
          setError(null)
        }
      })

    channelRef.current = channel

    // Cleanup on unmount
    return () => {
      console.log(`[BatchRealtime] Unsubscribing from batch-job-${jobId}`)
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [
    jobId,
    enabled,
    onItemUpdate,
    onJobUpdate,
    onItemCompleted,
    onItemFailed,
    onJobCompleted,
  ])

  return {
    items,
    job,
    isConnected,
    error,
    refresh,
  }
}

/**
 * Simpler hook that just returns items with realtime updates
 */
export function useBatchItemsRealtime(
  jobId: string,
  initialItems: BatchProspectItem[]
): BatchProspectItem[] {
  const [items, setItems] = useState<BatchProspectItem[]>(initialItems)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    if (!jobId) return

    const supabase = supabaseRef.current
    if (!supabase) return

    const channel = supabase
      .channel(`batch-items-${jobId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "batch_prospect_items",
          filter: `job_id=eq.${jobId}`,
        },
        (payload: RealtimePostgresChangesPayload<BatchProspectItem>) => {
          const updatedItem = payload.new as BatchProspectItem
          setItems((prev) =>
            prev.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            )
          )
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [jobId])

  return items
}

/**
 * Hook for subscribing to job status updates only
 */
export function useBatchJobStatusRealtime(
  jobId: string,
  initialJob: BatchProspectJob,
  onStatusChange?: (newStatus: string, oldStatus: string) => void
): BatchProspectJob {
  const [job, setJob] = useState<BatchProspectJob>(initialJob)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    setJob(initialJob)
  }, [initialJob])

  useEffect(() => {
    if (!jobId) return

    const supabase = supabaseRef.current
    if (!supabase) return

    const channel = supabase
      .channel(`batch-job-status-${jobId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "batch_prospect_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload: RealtimePostgresChangesPayload<BatchProspectJob>) => {
          const updatedJob = payload.new as BatchProspectJob
          const oldJob = payload.old as Partial<BatchProspectJob>

          setJob(updatedJob)

          if (oldJob.status && oldJob.status !== updatedJob.status) {
            onStatusChange?.(updatedJob.status, oldJob.status)
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [jobId, onStatusChange])

  return job
}
