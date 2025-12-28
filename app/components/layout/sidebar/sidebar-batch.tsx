"use client"

import { useState, useMemo, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Flask, CheckCircle, Spinner, Clock, CaretRight } from "@phosphor-icons/react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTransitionRouter } from "@/lib/transitions"
import { cn } from "@/lib/utils"

const BATCH_COLLAPSED_KEY = "sidebar-batch-collapsed"

type BatchJob = {
  id: string
  name: string
  status: string
  total_prospects: number
  completed_count: number
  created_at: string
}

function BatchJobItem({ job, index }: { job: BatchJob; index: number }) {
  const pathname = usePathname()
  const isActive = pathname === `/labs/${job.id}`

  const statusIcon = {
    completed: <CheckCircle className="h-3 w-3 text-green-500" weight="fill" />,
    processing: <Spinner className="h-3 w-3 text-blue-500 animate-spin" />,
    pending: <Clock className="h-3 w-3 text-muted-foreground" />,
    paused: <Clock className="h-3 w-3 text-yellow-500" />,
  }[job.status] || <Clock className="h-3 w-3 text-muted-foreground" />

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        href={`/labs/${job.id}`}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        {statusIcon}
        <span className="flex-1 truncate">{job.name}</span>
        {job.status === "processing" && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {job.completed_count}/{job.total_prospects}
          </Badge>
        )}
      </Link>
    </motion.div>
  )
}

export function SidebarBatch() {
  const router = useTransitionRouter()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(BATCH_COLLAPSED_KEY) === "true"
    }
    return false
  })

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(BATCH_COLLAPSED_KEY, String(isCollapsed))
  }, [isCollapsed])

  const { data: jobs = [], isLoading } = useQuery<BatchJob[]>({
    queryKey: ["batch-jobs-sidebar"],
    queryFn: async () => {
      const response = await fetch("/api/batch-prospects?limit=5")
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return data.jobs || []
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    // refetchOnMount: true (default) ensures data loads after RSC navigation
    // placeholderData prevents glitching by showing cached data while refetching
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: keepPreviousData, // Keep showing previous data during refetch
  })

  // Only show recent jobs (last 5)
  const recentJobs = useMemo(() => jobs.slice(0, 5), [jobs])

  // Only show loading skeleton on INITIAL load (no cached data)
  // This prevents the glitch when navigating between routes
  const showSkeleton = isLoading && jobs.length === 0

  const toggleCollapsed = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsCollapsed(!isCollapsed)
  }

  const handleLabsClick = () => {
    router.push("/labs")
  }

  return (
    <div className="mb-3">
      {/* Section Header */}
      <div className="group/section flex items-center h-9 px-2 rounded-md hover:bg-accent/50 transition-colors">
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center p-0.5"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <CaretRight
            size={12}
            weight="bold"
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              !isCollapsed && "rotate-90"
            )}
          />
        </button>
        <button
          onClick={handleLabsClick}
          className="flex items-center gap-2 flex-1 text-left ml-1.5"
        >
          <Flask size={18} weight="duotone" className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground/90">Labs</span>
        </button>
      </div>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {/* Only show skeleton on initial load, not during navigation */}
            {showSkeleton ? (
              <div className="mt-0.5 space-y-0.5 ml-[26px]">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2 py-1.5"
                  >
                    <Skeleton className="h-3 w-3 rounded" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : recentJobs.length > 0 ? (
              <div className="mt-0.5 space-y-0.5 ml-[26px]">
                {recentJobs.map((job, index) => (
                  <BatchJobItem key={job.id} job={job} index={index} />
                ))}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
