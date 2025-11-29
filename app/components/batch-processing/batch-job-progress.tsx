"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Play,
  Pause,
  Stop,
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  Spinner,
  Clock,
  Download,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { ProspectCard } from "./prospect-card"
import {
  BatchProspectJob,
  BatchProspectItem,
  ProcessNextItemResponse,
} from "@/lib/batch-processing"
import { formatDuration, calculateEstimatedTimeRemaining } from "@/lib/batch-processing/config"

interface BatchJobProgressProps {
  job: BatchProspectJob
  items: BatchProspectItem[]
  onBack: () => void
  onRefresh: () => void
}

type ProcessingState = "idle" | "running" | "paused" | "completed" | "error"

export function BatchJobProgress({
  job,
  items: initialItems,
  onBack,
  onRefresh,
}: BatchJobProgressProps) {
  const [items, setItems] = useState<BatchProspectItem[]>(initialItems)
  const [processingState, setProcessingState] = useState<ProcessingState>(
    job.status === "completed"
      ? "completed"
      : job.status === "paused"
        ? "paused"
        : job.status === "processing"
          ? "running"
          : "idle"
  )
  const [currentItem, setCurrentItem] = useState<BatchProspectItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate progress
  const completed = items.filter((i) => i.status === "completed").length
  const failed = items.filter((i) => i.status === "failed").length
  const total = items.length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  // Calculate estimated time remaining
  const remaining = total - completed - failed
  const estimatedMs = calculateEstimatedTimeRemaining(
    remaining,
    job.settings?.delay_between_prospects_ms || 3000
  )

  // Process next item
  const processNextItem = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/batch-prospects/${job.id}/process`, {
        method: "POST",
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Processing failed")
      }

      const result: ProcessNextItemResponse = await response.json()

      // Update item in list
      if (result.item) {
        setItems((prev) =>
          prev.map((i) => (i.id === result.item!.id ? result.item! : i))
        )
        setCurrentItem(result.item)
      }

      // Check if we're done
      if (!result.has_more || result.job_status === "completed") {
        setProcessingState("completed")
        onRefresh()
        return false
      }

      return true
    } catch (err: any) {
      if (err.name === "AbortError") {
        return false
      }
      setError(err.message)
      setProcessingState("error")
      return false
    }
  }, [job.id, onRefresh])

  // Main processing loop
  const startProcessing = useCallback(async () => {
    abortControllerRef.current = new AbortController()
    setProcessingState("running")
    setError(null)

    // Update job status to processing
    await fetch(`/api/batch-prospects/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "processing" }),
    })

    while (processingState !== "paused" && processingState !== "completed") {
      const shouldContinue = await processNextItem()

      if (!shouldContinue) {
        break
      }

      // Delay between prospects
      const delay = job.settings?.delay_between_prospects_ms || 3000
      await new Promise<void>((resolve) => {
        delayTimeoutRef.current = setTimeout(resolve, delay)
      })

      // Check if we should stop
      if (abortControllerRef.current?.signal.aborted) {
        break
      }
    }
  }, [job.id, job.settings?.delay_between_prospects_ms, processNextItem, processingState])

  // Pause processing
  const pauseProcessing = useCallback(async () => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current)
    }
    abortControllerRef.current?.abort()
    setProcessingState("paused")

    await fetch(`/api/batch-prospects/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    })
  }, [job.id])

  // Cancel processing
  const cancelProcessing = useCallback(async () => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current)
    }
    abortControllerRef.current?.abort()
    setProcessingState("idle")

    await fetch(`/api/batch-prospects/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    })

    onRefresh()
  }, [job.id, onRefresh])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current)
      }
    }
  }, [])

  // Auto-start if job was in processing state
  useEffect(() => {
    if (job.status === "processing" && processingState === "running") {
      startProcessing()
    }
  }, []) // Only on mount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{job.name}</h2>
            <p className="text-sm text-muted-foreground">
              {job.source_file_name || "Batch job"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {processingState === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`/api/batch-prospects/${job.id}/export?format=csv`, "_blank")
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className="text-muted-foreground">
              {completed} of {total} completed
            </span>
          </div>
          <Progress value={percentage} className="h-3" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-600">{completed}</div>
            <div className="text-xs text-green-600/80">Completed</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10">
            <div className="text-2xl font-bold text-red-500">{failed}</div>
            <div className="text-xs text-red-500/80">Failed</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/10">
            <div className="text-2xl font-bold text-blue-500">{remaining}</div>
            <div className="text-xs text-blue-500/80">Remaining</div>
          </div>
        </div>

        {/* Time estimate */}
        {processingState === "running" && remaining > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Estimated time remaining: {formatDuration(estimatedMs)}</span>
          </div>
        )}

        {/* Current item */}
        {currentItem && processingState === "running" && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2">
              <Spinner className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium">
                Processing: {currentItem.input_data.name}
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <WarningCircle className="h-4 w-4 text-red-500 mt-0.5" weight="fill" />
              <div>
                <p className="text-sm font-medium text-red-500">Error</p>
                <p className="text-sm text-red-500/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex items-center gap-2 pt-2">
          {(processingState === "idle" || processingState === "paused") && remaining > 0 && (
            <Button onClick={startProcessing} className="gap-2">
              <Play className="h-4 w-4" weight="fill" />
              {processingState === "paused" ? "Resume" : "Start"} Processing
            </Button>
          )}

          {processingState === "running" && (
            <Button variant="secondary" onClick={pauseProcessing} className="gap-2">
              <Pause className="h-4 w-4" weight="fill" />
              Pause
            </Button>
          )}

          {(processingState === "running" || processingState === "paused") && (
            <Button variant="outline" onClick={cancelProcessing} className="gap-2">
              <Stop className="h-4 w-4" weight="fill" />
              Cancel
            </Button>
          )}

          {processingState === "completed" && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 gap-1">
              <CheckCircle className="h-4 w-4" weight="fill" />
              Completed
            </Badge>
          )}

          {processingState === "error" && (
            <Button onClick={startProcessing} className="gap-2">
              <Play className="h-4 w-4" weight="fill" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Prospects</h3>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-4">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <ProspectCard key={item.id} item={item} compact />
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
