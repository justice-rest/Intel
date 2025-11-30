"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { cn, formatRelativeTime } from "@/lib/utils"
import {
  UsersThree,
  CloudArrowUp,
  FileCsv,
  MagnifyingGlass,
  Download,
  Trash,
  Spinner,
  CheckCircle,
  WarningCircle,
  Clock,
  X,
  Pause,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  parseProspectFile,
  transformToProspectData,
  type BatchProspectJob,
  type ColumnMapping,
} from "@/lib/batch-processing"
import { MAX_BATCH_FILE_SIZE, ALLOWED_BATCH_EXTENSIONS } from "@/lib/batch-processing/config"
import { toast } from "@/components/ui/toast"

// Chart config
const chartConfig = {
  completed: {
    label: "Completed",
    color: "var(--chart-1)",
  },
  pending: {
    label: "Pending",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

// Status badge component (like RAG)
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
      className: "bg-[#422F10] text-yellow-600",
    },
    paused: {
      icon: Pause,
      label: "Paused",
      className: "bg-blue-500/10 text-blue-500",
    },
    completed: {
      icon: CheckCircle,
      label: "Completed",
      className: "bg-[#B183FF]/20 text-[#B183FF]",
    },
    failed: {
      icon: WarningCircle,
      label: "Failed",
      className: "bg-red-500/10 text-red-500",
    },
    cancelled: {
      icon: X,
      label: "Cancelled",
      className: "bg-muted text-muted-foreground",
    },
  }

  const { icon: Icon, label, className } = config[status]
  const isSpinner = status === "processing"

  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Icon className={cn("h-3 w-3", isSpinner && "animate-spin")} weight="fill" />
      {label}
    </Badge>
  )
}

// Upload component (like document-upload)
function BatchUploadArea({
  onUpload,
  isUploading,
  batchLimit,
  planName,
}: {
  onUpload: (file: File) => Promise<void>
  isUploading: boolean
  batchLimit: number
  planName: string
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    try {
      setError("")
      await onUpload(selectedFile)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={handleDrop}
        className={cn(
          "border-border relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "hover:border-muted-foreground/50"
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
              className="flex flex-col items-center gap-3 text-center"
            >
              <CloudArrowUp className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Drag and drop your prospect list here
                </p>
                <p className="text-muted-foreground text-xs">
                  or click to browse (CSV, Excel)
                </p>
              </div>
              <Badge variant="secondary" className="capitalize">
                {planName} Plan: Up to {batchLimit} prospects
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Choose File
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex w-full items-center gap-3"
            >
              <FileCsv className="text-primary h-10 w-10 flex-shrink-0" weight="fill" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                <p className="text-muted-foreground text-xs">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              {!isUploading && (
                <Button variant="ghost" size="icon" onClick={handleCancel} className="flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="text-destructive rounded-md bg-destructive/10 p-3 text-sm"
        >
          {error}
        </motion.div>
      )}

      {selectedFile && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex gap-2"
        >
          <Button onClick={handleUpload} disabled={isUploading} className="flex-1">
            {isUploading ? "Processing..." : "Start Batch Research"}
          </Button>
          {!isUploading && (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </motion.div>
      )}

      {isUploading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <motion.div
              className="bg-primary h-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 10, ease: "linear" }}
            />
          </div>
          <p className="text-muted-foreground text-center text-xs">
            Parsing file and creating batch job...
          </p>
        </motion.div>
      )}
    </div>
  )
}

// Chart component (like memory-chart)
function BatchChart({ jobs }: { jobs: BatchProspectJob[] }) {
  // Generate chart data from jobs (last 14 days)
  const chartData = (() => {
    const days = 14
    const data: { date: string; completed: number; pending: number }[] = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]

      const dayJobs = jobs.filter((job) => {
        const jobDate = new Date(job.created_at).toISOString().split("T")[0]
        return jobDate === dateStr
      })

      data.push({
        date: dateStr,
        completed: dayJobs.filter((j) => j.status === "completed").reduce((sum, j) => sum + j.completed_count, 0),
        pending: dayJobs.filter((j) => j.status !== "completed").reduce((sum, j) => sum + j.total_prospects - j.completed_count, 0),
      })
    }

    return data
  })()

  const hasData = chartData.some((d) => d.completed > 0 || d.pending > 0)

  return (
    <Card className="py-0">
      <CardContent className="px-2 pt-4 sm:p-6 sm:pt-6">
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No batch data available yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
            <BarChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: string) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[150px]"
                    labelFormatter={(value: string) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }}
                  />
                }
              />
              <Bar dataKey="completed" fill="var(--color-completed)" />
              <Bar dataKey="pending" fill="var(--color-pending)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Job item component (like document-list item)
function JobItem({
  job,
  onDelete,
  onView,
  onExport,
}: {
  job: BatchProspectJob
  onDelete: (id: string) => Promise<void>
  onView: (id: string) => void
  onExport: (id: string) => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this batch job?")) return

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="border-border group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
    >
      {/* Icon */}
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0",
        job.status === "completed" ? "bg-[#B183FF]/10" :
        job.status === "processing" ? "bg-yellow-500/10" :
        "bg-muted"
      )}>
        <UsersThree className={cn(
          "h-5 w-5",
          job.status === "completed" ? "text-[#B183FF]" :
          job.status === "processing" ? "text-yellow-600" :
          "text-muted-foreground"
        )} weight="fill" />
      </div>

      {/* Job Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* Clickable job name to view report */}
          <button
            onClick={() => onView(job.id)}
            className="truncate text-sm font-medium text-primary hover:underline text-left"
          >
            {job.name}
          </button>
          <StatusBadge status={job.status} />
        </div>

        {/* Progress bar for processing jobs */}
        {job.status === "processing" && (
          <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Metadata */}
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span>{job.total_prospects} prospects</span>
          <span>•</span>
          <span>{job.completed_count} completed</span>
          {job.failed_count > 0 && (
            <>
              <span>•</span>
              <span className="text-destructive">{job.failed_count} failed</span>
            </>
          )}
          <span>•</span>
          <span>{formatRelativeTime(new Date(job.created_at))}</span>
        </div>
      </div>

      {/* Actions - Export and Delete */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {job.status === "completed" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onExport(job.id)}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            title="Export CSV"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className="opacity-0 transition-opacity group-hover:opacity-100 text-destructive hover:text-destructive"
          title="Delete"
        >
          {isDeleting ? (
            <Spinner className="h-4 w-4 animate-spin" />
          ) : (
            <Trash className="h-4 w-4" />
          )}
        </Button>
      </div>
    </motion.div>
  )
}

// Main batch view component
export function BatchView() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [batchLimit, setBatchLimit] = useState(10)
  const [planName, setPlanName] = useState("growth")
  const [isUploading, setIsUploading] = useState(false)

  // Fetch batch limit
  useQuery({
    queryKey: ["batch-limits"],
    queryFn: async () => {
      const response = await fetch("/api/batch-prospects/limits")
      if (response.ok) {
        const data = await response.json()
        setBatchLimit(data.limit)
        setPlanName(data.plan)
        return data
      }
      return null
    },
  })

  // Fetch batch jobs
  const { data: jobs = [], isLoading } = useQuery<BatchProspectJob[]>({
    queryKey: ["batch-jobs"],
    queryFn: async () => {
      const response = await fetch("/api/batch-prospects")
      if (!response.ok) return []
      const data = await response.json()
      return data.jobs || []
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/batch-prospects/${jobId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Delete failed")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-jobs"] })
      toast({ title: "Batch job deleted", status: "success" })
    },
    onError: () => {
      toast({ title: "Failed to delete batch job", status: "error" })
    },
  })

  // Handle file upload
  const handleUpload = async (file: File) => {
    setIsUploading(true)

    try {
      // Parse file
      const result = await parseProspectFile(file)
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
          name: `${file.name.replace(/\.[^/.]+$/, "")} - ${new Date().toLocaleDateString()}`,
          prospects,
          column_mapping: columnMapping,
          source_file_name: file.name,
          source_file_size: file.size,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create batch job")
      }

      toast({ title: `Batch job created with ${prospects.length} prospects`, status: "success" })
      queryClient.invalidateQueries({ queryKey: ["batch-jobs"] })
    } catch (err) {
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  // Filtered jobs
  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return job.name.toLowerCase().includes(query)
  })

  // Stats
  const totalProspects = jobs.reduce((sum, j) => sum + j.total_prospects, 0)
  const completedProspects = jobs.reduce((sum, j) => sum + j.completed_count, 0)

  return (
    <div className="mx-auto max-w-4xl px-4 pt-20 pb-8 sm:pt-8">
      <div className="space-y-6">
        {/* Header with stats */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <UsersThree className="h-6 w-6" />
              Batch Research
            </h1>
            <div className="flex items-center gap-3">
              {jobs.length > 0 && (
                <button
                  onClick={() => document.getElementById('prospects-list')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-primary hover:underline text-xs font-medium"
                >
                  View Reports
                </button>
              )}
              <span className="text-muted-foreground text-xs">
                {jobs.length} jobs • {completedProspects}/{totalProspects} prospects
              </span>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Upload prospect lists to research multiple donors at once
          </p>
        </div>

        {/* Chart */}
        <BatchChart jobs={jobs} />

        {/* Upload area */}
        <BatchUploadArea
          onUpload={handleUpload}
          isUploading={isUploading}
          batchLimit={batchLimit}
          planName={planName}
        />

        {/* Search */}
        <div className="relative">
          <MagnifyingGlass className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search batch jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-transparent border-border"
          />
        </div>

        {/* Job list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <UsersThree className="text-muted-foreground mb-3 h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              No batch jobs yet. Upload a prospect list to get started.
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MagnifyingGlass className="text-muted-foreground mb-3 h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              No batch jobs match your search.
            </p>
          </div>
        ) : (
          <motion.div id="prospects-list" layout className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredJobs.map((job) => (
                <JobItem
                  key={job.id}
                  job={job}
                  onDelete={(id) => deleteMutation.mutateAsync(id)}
                  onView={(id) => window.location.href = `/batch/${id}`}
                  onExport={(id) => window.open(`/api/batch-prospects/${id}/export?format=csv`, "_blank")}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  )
}
