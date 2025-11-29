"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { UsersThree, Plus, CheckCircle, Spinner, Clock } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

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
  const isActive = pathname === `/batch/${job.id}`

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
        href={`/batch/${job.id}`}
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
  const pathname = usePathname()
  const isBatchActive = pathname === "/batch" || pathname.startsWith("/batch/")

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
  })

  // Only show recent jobs (last 5)
  const recentJobs = jobs.slice(0, 5)

  return (
    <div className="mb-5">
      <Link
        href="/batch"
        className={cn(
          "group/batch relative inline-flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors",
          isBatchActive
            ? "bg-accent text-foreground"
            : "hover:bg-accent/80 hover:text-foreground text-primary bg-transparent"
        )}
      >
        <div className="flex items-center gap-2">
          <UsersThree size={20} />
          Batch Research
        </div>
        {!isBatchActive && (
          <div className="text-muted-foreground ml-auto text-xs opacity-0 duration-150 group-hover/batch:opacity-100">
            <Plus size={16} />
          </div>
        )}
      </Link>

      <AnimatePresence mode="popLayout">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-1 space-y-1 pl-2"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 px-2 py-1.5"
              >
                <Skeleton className="h-3 w-3 rounded" />
                <Skeleton className="h-4 flex-1" />
              </motion.div>
            ))}
          </motion.div>
        ) : recentJobs.length > 0 ? (
          <motion.div
            key="jobs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1 space-y-0.5 pl-2"
          >
            {recentJobs.map((job, index) => (
              <BatchJobItem key={job.id} job={job} index={index} />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
