"use client"

import { useState, useRef, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UsersThree, Plus, CheckCircle, Spinner, Clock, CloudArrowUp, FileCsv, X } from "@phosphor-icons/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  parseProspectFile,
  transformToProspectData,
  type ColumnMapping,
} from "@/lib/batch-processing"
import { MAX_BATCH_FILE_SIZE, ALLOWED_BATCH_EXTENSIONS } from "@/lib/batch-processing/config"
import { toast } from "@/components/ui/toast"

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
  const router = useRouter()
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersThree className="h-5 w-5" />
            Batch Research
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
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
                      Drag and drop your prospect list
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
                  transition={{ duration: 10, ease: "linear" as const }}
                />
              </div>
              <p className="text-muted-foreground text-center text-xs">
                Parsing file and creating batch job...
              </p>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SidebarBatch() {
  const pathname = usePathname()
  const isBatchActive = pathname === "/batch" || pathname.startsWith("/batch/")
  const [showUploadDialog, setShowUploadDialog] = useState(false)

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
      <div className="flex items-center">
        <Link
          href="/batch"
          className={cn(
            "group/batch relative inline-flex flex-1 items-center rounded-md px-2 py-2 text-sm transition-colors",
            isBatchActive
              ? "bg-accent text-foreground"
              : "hover:bg-accent/80 hover:text-foreground text-primary bg-transparent"
          )}
        >
          <div className="flex items-center gap-2">
            <UsersThree size={20} />
            Batch Research
          </div>
        </Link>
        {/* Plus button to open upload dialog */}
        <button
          onClick={() => setShowUploadDialog(true)}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/50 p-1.5 rounded-md transition-colors"
          title="New Batch Research"
        >
          <Plus size={16} />
        </button>
      </div>

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

      {/* Upload Dialog */}
      <BatchUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
      />
    </div>
  )
}
