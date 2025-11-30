"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Lightning,
  Fire,
  File,
  CaretRight,
  CaretDown,
  Eye,
  Globe,
  Link,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import {
  BatchProspectJob,
  BatchProspectItem,
  ProcessNextItemResponse,
} from "@/lib/batch-processing"
import { formatDuration, calculateEstimatedTimeRemaining } from "@/lib/batch-processing/config"
import { Markdown } from "@/components/prompt-kit/markdown"
import Image from "next/image"

interface BatchJobProgressProps {
  job: BatchProspectJob
  items: BatchProspectItem[]
  onBack: () => void
  onRefresh: () => void
}

type ProcessingState = "idle" | "running" | "paused" | "completed" | "error"

// Helper functions for sources display
function getFavicon(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
  } catch {
    return null
  }
}

function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace("www.", "")
  } catch {
    return url
  }
}

// Report Sources List Component (chat-style collapsible)
function ReportSourcesList({ sources }: { sources: { url: string; name?: string }[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set())

  const handleFaviconError = (url: string) => {
    setFailedFavicons((prev) => new Set(prev).add(url))
  }

  return (
    <div className="my-4">
      <div className="border-border flex flex-col gap-0 overflow-hidden rounded-md border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="hover:bg-accent flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors"
        >
          <div className="flex flex-1 flex-row items-center gap-2 text-left text-sm">
            Sources
            <div className="flex -space-x-1">
              {sources?.slice(0, 5).map((source, index) => {
                const faviconUrl = getFavicon(source.url)
                const showFallback = !faviconUrl || failedFavicons.has(source.url)

                return showFallback ? (
                  <div
                    key={`${source.url}-${index}`}
                    className="bg-muted border-background h-4 w-4 rounded-full border"
                  />
                ) : (
                  <Image
                    key={`${source.url}-${index}`}
                    src={faviconUrl}
                    alt=""
                    width={16}
                    height={16}
                    className="border-background h-4 w-4 rounded-sm border"
                    onError={() => handleFaviconError(source.url)}
                  />
                )
              })}
              {sources.length > 5 && (
                <span className="text-muted-foreground ml-1 text-xs">
                  +{sources.length - 5}
                </span>
              )}
            </div>
          </div>
          <CaretDown
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded ? "rotate-180 transform" : ""
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", duration: 0.2, bounce: 0 }}
              className="overflow-hidden"
            >
              <ul className="space-y-2 px-3 pt-3 pb-3">
                {sources.map((source, index) => {
                  const faviconUrl = getFavicon(source.url)
                  const showFallback = !faviconUrl || failedFavicons.has(source.url)

                  return (
                    <li key={`${source.url}-${index}`} className="flex items-center text-sm">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary group line-clamp-1 flex items-center gap-1 hover:underline"
                        >
                          {showFallback ? (
                            <div className="bg-muted h-4 w-4 flex-shrink-0 rounded-full" />
                          ) : (
                            <Image
                              src={faviconUrl}
                              alt=""
                              width={16}
                              height={16}
                              className="h-4 w-4 flex-shrink-0 rounded-sm"
                              onError={() => handleFaviconError(source.url)}
                            />
                          )}
                          <span className="truncate">{source.name || formatUrl(source.url)}</span>
                          <Link className="inline h-3 w-3 flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                        </a>
                        <div className="text-muted-foreground line-clamp-1 text-xs">
                          {formatUrl(source.url)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Status Card Component (dark-uibank-dashboard-concept style)
function StatusCard({
  icon: Icon,
  title,
  subtitle,
  count,
  variant,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  count: number
  variant: "green" | "red" | "gray"
}) {
  const variantStyles = {
    green: "bg-[#45ffbc] text-[#1f1f1f]",
    red: "bg-red-400 text-[#1f1f1f]",
    gray: "bg-[#bdbbb7] text-[#1f1f1f]",
  }

  return (
    <div
      className={cn(
        "rounded-lg p-4 min-h-[100px] sm:min-h-[140px] flex flex-col justify-between transition-transform hover:-translate-y-1",
        variantStyles[variant]
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-6 w-6 sm:h-8 sm:w-8 opacity-80" weight="light" />
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-xs opacity-70">{subtitle}</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 sm:mt-4">
        <span className="text-2xl sm:text-3xl font-bold">{count}</span>
        <span className="flex items-center gap-1 text-xs font-semibold opacity-80">
          View details
          <CaretRight className="h-4 w-4" weight="bold" />
        </span>
      </div>
    </div>
  )
}

// Prospect Table Row Component (models.dev style)
function ProspectTableRow({
  item,
  onViewReport,
}: {
  item: BatchProspectItem
  onViewReport: (item: BatchProspectItem) => void
}) {
  const formatCurrency = (value?: number) => {
    if (!value) return "—"
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toLocaleString()}`
  }

  const address = [
    item.input_data.address,
    item.input_data.city,
    item.input_data.state,
    item.input_data.zip,
  ]
    .filter(Boolean)
    .join(", ") || item.input_data.full_address || "—"

  const getStatusIcon = () => {
    switch (item.status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
      case "processing":
        return <Spinner className="h-4 w-4 text-blue-500 animate-spin" />
      case "failed":
        return <WarningCircle className="h-4 w-4 text-red-500" weight="fill" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="py-3 px-3 text-sm text-muted-foreground font-mono">
        {item.item_index + 1}
      </td>
      <td className="py-3 px-3">
        <button
          onClick={() => item.status === "completed" && item.report_content && onViewReport(item)}
          className={cn(
            "text-sm font-medium text-left",
            item.status === "completed" && item.report_content
              ? "text-primary hover:underline cursor-pointer"
              : "text-foreground cursor-default"
          )}
          disabled={item.status !== "completed" || !item.report_content}
        >
          {item.input_data.name}
        </button>
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground max-w-[200px] truncate">
        {address}
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground">
        {item.input_data.city || "—"}
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground font-mono">
        {item.input_data.state || "—"}
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground font-mono">
        {item.input_data.zip || "—"}
      </td>
      <td className="py-3 px-3">
        <span className={cn(
          "text-sm font-mono font-medium",
          item.romy_score !== undefined && item.romy_score >= 31
            ? "text-purple-500"
            : item.romy_score !== undefined && item.romy_score >= 21
              ? "text-green-600"
              : item.romy_score !== undefined && item.romy_score >= 11
                ? "text-amber-500"
                : "text-muted-foreground"
        )}>
          {item.romy_score !== undefined ? `${item.romy_score}/41` : "—"}
        </span>
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground">
        {item.romy_score_tier || "—"}
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground">
        {item.capacity_rating || "—"}
      </td>
      <td className="py-3 px-3 text-sm font-mono">
        {formatCurrency(item.estimated_net_worth)}
      </td>
      <td className="py-3 px-3 text-sm font-mono">
        {formatCurrency(item.estimated_gift_capacity)}
      </td>
      <td className="py-3 px-3 text-sm font-mono text-green-600 font-medium">
        {formatCurrency(item.recommended_ask)}
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1">
          {getStatusIcon()}
        </div>
      </td>
      <td className="py-3 px-3">
        {item.status === "completed" && item.report_content && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewReport(item)}
            className="h-7 px-2"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  )
}

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
  const [selectedItem, setSelectedItem] = useState<BatchProspectItem | null>(null)
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
              size="sm"
              onClick={() => {
                window.open(`/api/batch-prospects/${job.id}/export?format=csv`, "_blank")
              }}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards (dark-uibank-dashboard-concept style) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard
          icon={Lightning}
          title="Completed"
          subtitle="Successfully processed"
          count={completed}
          variant="green"
        />
        <StatusCard
          icon={Fire}
          title="Failed"
          subtitle="Processing errors"
          count={failed}
          variant="red"
        />
        <StatusCard
          icon={File}
          title="Total"
          subtitle={`${remaining} remaining`}
          count={total}
          variant="gray"
        />
      </div>

      {/* Progress Card */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className="text-muted-foreground">
              {completed} of {total} completed ({percentage}%)
            </span>
          </div>
          <Progress value={percentage} className="h-3" />
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

      {/* Prospects Table (models.dev style) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Prospects
          </h3>
          {processingState === "completed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.open(`/api/batch-prospects/${job.id}/export?format=csv`, "_blank")
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>

        <div className="overflow-hidden" style={{ borderRadius: '0.5rem' }}>
          <div
            className="overflow-auto border border-border"
            style={{
              maxHeight: '500px',
              borderRadius: '0.5rem'
            }}
          >
            <table className="w-full text-sm" style={{ minWidth: '1200px' }}>
              <thead className="sticky top-0 bg-background border-b z-10">
                <tr className="text-left">
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">#</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Name</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Address</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">City</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">State</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">ZIP</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Score</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tier</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Capacity</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Net Worth</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Gift Cap.</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Ask</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 text-xs font-normal uppercase tracking-wider text-muted-foreground whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <ProspectTableRow
                    key={item.id}
                    item={item}
                    onViewReport={setSelectedItem}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Report Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedItem?.input_data.name}</span>
              {selectedItem?.romy_score !== undefined && (
                <Badge className="bg-[#B183FF]/20 text-[#B183FF] border-[#B183FF]/30">
                  RōmyScore: {selectedItem.romy_score}/41
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {/* Report Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden break-words">
              <Markdown>{selectedItem?.report_content || ""}</Markdown>
            </div>

            {/* Sources Section - Chat Style */}
            {selectedItem?.sources_found && selectedItem.sources_found.length > 0 && (
              <ReportSourcesList sources={selectedItem.sources_found} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
