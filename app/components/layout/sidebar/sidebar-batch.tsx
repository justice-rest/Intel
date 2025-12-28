"use client"

import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Flask, Plus, CheckCircle, Spinner, Clock, CloudArrowUp, FileCsv, X, CaretRight } from "@phosphor-icons/react"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTransitionRouter } from "@/lib/transitions"
import { cn } from "@/lib/utils"
import {
  parseProspectFile,
  transformToProspectData,
  type ColumnMapping,
} from "@/lib/batch-processing"
import { MAX_BATCH_FILE_SIZE, ALLOWED_BATCH_EXTENSIONS } from "@/lib/batch-processing/config"
import { toast } from "@/components/ui/toast"

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

// Drag and Drop Upload Dialog
function BatchUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useTransitionRouter()
  const queryClient = useQueryClient()
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch batch limit
  const { data: limitData } = useQuery({
    queryKey: ["batch-limits"],
    queryFn: async () => {
      const response = await fetch("/api/batch-prospects/limits")
      if (response.ok) {
        return await response.json()
      }
      return { limit: 10, plan: "growth" }
    },
  })

  const batchLimit = limitData?.limit || 10
  const planName = limitData?.plan || "growth"

  const validateFile = (file: File): string | null => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    if (!ALLOWED_BATCH_EXTENSIONS.includes(ext)) {
      return `Only ${ALLOWED_BATCH_EXTENSIONS.join(", ")} files are supported`
    }
    if (file.size > MAX_BATCH_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_BATCH_FILE_SIZE / (1024 * 1024)}MB`
    }
    return null
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setError("")

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
      } else {
        setSelectedFile(file)
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
      } else {
        setSelectedFile(file)
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError("")

    try {
      // Parse file
      const result = await parseProspectFile(selectedFile)
      if (!result.success) {
        throw new Error(result.errors.join(". "))
      }

      // Auto-map columns
      const columnMapping: ColumnMapping = {
        name: result.suggested_mapping.name || null,
        address: result.suggested_mapping.address || null,
        city: result.suggested_mapping.city || null,
        state: result.suggested_mapping.state || null,
        zip: result.suggested_mapping.zip || null,
        full_address: result.suggested_mapping.full_address || null,
        email: result.suggested_mapping.email || null,
        phone: result.suggested_mapping.phone || null,
        company: result.suggested_mapping.company || null,
        title: result.suggested_mapping.title || null,
        notes: result.suggested_mapping.notes || null,
      }

      // Transform to prospect data
      const { prospects } = transformToProspectData(result.rows, columnMapping)

      if (prospects.length === 0) {
        throw new Error("No valid prospects found. Please ensure your file has a name column.")
      }

      if (prospects.length > batchLimit) {
        throw new Error(`Your ${planName} plan allows up to ${batchLimit} prospects per batch.`)
      }

      // Create batch job
      const response = await fetch("/api/batch-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${selectedFile.name.replace(/\.[^/.]+$/, "")} - ${new Date().toLocaleDateString()}`,
          prospects,
          column_mapping: columnMapping,
          source_file_name: selectedFile.name,
          source_file_size: selectedFile.size,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create batch job")
      }

      const jobData = await response.json()

      toast({ title: `Batch job created with ${prospects.length} prospects`, status: "success" })
      queryClient.invalidateQueries({ queryKey: ["batch-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["batch-jobs-sidebar"] })

      // Close dialog and navigate to the new job
      onOpenChange(false)
      setSelectedFile(null)
      router.push(`/batch/${jobData.job.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClose = () => {
    handleCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <Flask size={20} weight="fill" className="text-muted-foreground" />
            New Research Batch
          </DialogTitle>
          <p className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
            Upload a CSV or Excel file with your prospect list.
          </p>
        </DialogHeader>

        <div className="px-5 pb-4 space-y-4">
          <div
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all cursor-pointer",
              isDragging && "border-primary bg-primary/5",
              !isDragging && !selectedFile && "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-accent/30",
              selectedFile && "border-primary/30 bg-primary/5 cursor-default"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />

            <AnimatePresence mode="wait">
              {!selectedFile ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <CloudArrowUp className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="mt-1">
                    <p className="text-sm font-medium">
                      Drop your file here
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      or click to browse
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize mt-2 text-xs">
                    {planName}: up to {batchLimit} prospects
                  </Badge>
                </motion.div>
              ) : (
                <motion.div
                  key="selected"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex w-full items-center gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileCsv className="text-primary h-5 w-5" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-shrink-0 p-1.5 rounded-md hover:bg-accent transition-colors"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-destructive rounded-lg bg-destructive/10 px-3 py-2.5 text-sm"
            >
              {error}
            </motion.div>
          )}

          {isUploading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <motion.div
                  className="bg-primary h-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 10, ease: "linear" as const }}
                />
              </div>
              <p className="text-muted-foreground text-center text-xs">
                Processing your file...
              </p>
            </motion.div>
          )}
        </div>

        <div className="px-5 py-4 border-t bg-muted/30">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              className="flex-1 h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="flex-1 h-9"
            >
              {isUploading ? "Processing..." : "Start Research"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SidebarBatch() {
  const pathname = usePathname()
  const isBatchActive = pathname === "/batch" || pathname.startsWith("/batch/")
  const [showUploadDialog, setShowUploadDialog] = useState(false)
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

  return (
    <div className="mb-3">
      {/* Section Header */}
      <div className="group/section flex items-center h-9 px-2 rounded-md hover:bg-accent/50 transition-colors">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <CaretRight
            size={12}
            weight="bold"
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              !isCollapsed && "rotate-90"
            )}
          />
          <Flask size={18} weight="duotone" className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground/90">Labs</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowUploadDialog(true)
          }}
          className="opacity-0 group-hover/section:opacity-100 text-muted-foreground hover:text-foreground p-1 rounded transition-all"
          title="New Research"
        >
          <Plus size={14} weight="bold" />
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

      {/* Upload Dialog */}
      <BatchUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
      />
    </div>
  )
}
