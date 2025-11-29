"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatRelativeTime } from "@/lib/utils"
import {
  Users,
  DotsThreeVertical,
  Trash,
  Eye,
  Play,
  Spinner,
  CheckCircle,
  WarningCircle,
  Clock,
  Pause,
  Prohibit,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { useState } from "react"
import type { BatchProspectJob } from "@/lib/batch-processing"
import { formatDuration, calculateEstimatedTimeRemaining } from "@/lib/batch-processing/config"

interface BatchJobListProps {
  jobs: BatchProspectJob[]
  onDelete: (jobId: string) => Promise<void>
  onView: (job: BatchProspectJob) => void
  onResume: (jobId: string) => void
  isLoading?: boolean
}

function StatusBadge({ status }: { status: BatchProspectJob["status"] }) {
  const config = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-muted text-muted-foreground",
    },
    processing: {
      icon: Spinner,
      label: "Processing",
      className: "bg-blue-500/10 text-blue-500",
      spin: true,
    },
    paused: {
      icon: Pause,
      label: "Paused",
      className: "bg-yellow-500/10 text-yellow-600",
    },
    completed: {
      icon: CheckCircle,
      label: "Completed",
      className: "bg-green-500/10 text-green-600",
    },
    failed: {
      icon: WarningCircle,
      label: "Failed",
      className: "bg-red-500/10 text-red-500",
    },
    cancelled: {
      icon: Prohibit,
      label: "Cancelled",
      className: "bg-muted text-muted-foreground",
    },
  }

  const { icon: Icon, label, className, spin } = config[status] as any

  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Icon className={cn("h-3 w-3", spin && "animate-spin")} weight="fill" />
      {label}
    </Badge>
  )
}

function JobItem({
  job,
  onDelete,
  onView,
  onResume,
}: {
  job: BatchProspectJob
  onDelete: (id: string) => Promise<void>
  onView: (job: BatchProspectJob) => void
  onResume: (id: string) => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this batch job? All reports will be lost.")) return

    try {
      setIsDeleting(true)
      await onDelete(job.id)
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const progress = job.total_prospects > 0
    ? Math.round((job.completed_count / job.total_prospects) * 100)
    : 0

  const remaining = job.total_prospects - job.completed_count - job.failed_count
  const estimatedMs = calculateEstimatedTimeRemaining(
    remaining,
    job.settings?.delay_between_prospects_ms || 3000
  )

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        "group flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
        "hover:bg-accent/50",
        job.status === "processing" && "border-blue-500/30 bg-blue-500/5"
      )}
      onClick={() => onView(job)}
    >
      {/* Icon */}
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0",
        job.status === "completed" ? "bg-green-500/10" :
        job.status === "processing" ? "bg-blue-500/10" :
        job.status === "failed" ? "bg-red-500/10" :
        "bg-muted"
      )}>
        <Users className={cn(
          "h-5 w-5",
          job.status === "completed" ? "text-green-600" :
          job.status === "processing" ? "text-blue-500" :
          job.status === "failed" ? "text-red-500" :
          "text-muted-foreground"
        )} weight="fill" />
      </div>

      {/* Job Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-medium">{job.name}</h4>
          <StatusBadge status={job.status} />
        </div>

        {/* Progress bar for active jobs */}
        {(job.status === "processing" || job.status === "paused") && (
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  job.status === "processing" ? "bg-blue-500" : "bg-yellow-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{job.completed_count} / {job.total_prospects} completed</span>
              {job.status === "processing" && remaining > 0 && (
                <span>~{formatDuration(estimatedMs)} remaining</span>
              )}
            </div>
          </div>
        )}

        {/* Metadata for completed/other jobs */}
        {job.status !== "processing" && job.status !== "paused" && (
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span>{job.total_prospects} prospects</span>
            {job.completed_count > 0 && (
              <>
                <span>•</span>
                <span className="text-green-600">{job.completed_count} completed</span>
              </>
            )}
            {job.failed_count > 0 && (
              <>
                <span>•</span>
                <span className="text-red-500">{job.failed_count} failed</span>
              </>
            )}
            <span>•</span>
            <span>{formatRelativeTime(new Date(job.created_at))}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {(job.status === "pending" || job.status === "paused") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResume(job.id)}
          >
            <Play className="mr-1 h-3 w-3" weight="fill" />
            {job.status === "paused" ? "Resume" : "Start"}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              disabled={isDeleting}
            >
              <DotsThreeVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(job)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isDeleting && (
        <div className="flex-shrink-0">
          <Spinner className="h-4 w-4 animate-spin" />
        </div>
      )}
    </motion.div>
  )
}

export function BatchJobList({
  jobs,
  onDelete,
  onView,
  onResume,
  isLoading,
}: BatchJobListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Users className="text-muted-foreground mb-3 h-12 w-12" />
        <p className="text-muted-foreground text-sm">
          No batch jobs yet. Upload a CSV to get started.
        </p>
      </div>
    )
  }

  return (
    <motion.div layout className="space-y-2">
      <AnimatePresence mode="popLayout">
        {jobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            onDelete={onDelete}
            onView={onView}
            onResume={onResume}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
