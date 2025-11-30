"use client"

import { useState, useRef, useCallback } from "react"
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
  CaretRight,
  Lightning,
  Target,
  ChartBar,
  Plus,
  Gear,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import "@/app/batch/batch-dashboard.css"

// Status badge component
function StatusBadge({ status }: { status: BatchProspectJob["status"] }) {
  const config = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: "status-badge status-badge-pending",
    },
    processing: {
      icon: Spinner,
      label: "Processing",
      className: "status-badge status-badge-processing",
    },
    paused: {
      icon: Pause,
      label: "Paused",
      className: "status-badge status-badge-paused",
    },
    completed: {
      icon: CheckCircle,
      label: "Completed",
      className: "status-badge status-badge-completed",
    },
    failed: {
      icon: WarningCircle,
      label: "Failed",
      className: "status-badge status-badge-failed",
    },
    cancelled: {
      icon: X,
      label: "Cancelled",
      className: "status-badge status-badge-cancelled",
    },
  }

  const { icon: Icon, label, className } = config[status]
  const isSpinner = status === "processing"

  return (
    <span className={className}>
      <Icon className={cn("status-icon", isSpinner && "animate-spin")} weight="fill" />
      {label}
    </span>
  )
}

// Service tile component
function ServiceTile({
  icon: Icon,
  title,
  subtitle,
  href,
  variant = "olive",
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  href: string
  variant?: "olive" | "green" | "gray"
}) {
  return (
    <article className={cn("tile", `tile-${variant}`)}>
      <div className="tile-header">
        <Icon className="tile-icon" weight="light" />
        <h3>
          <span>{title}</span>
          <span>{subtitle}</span>
        </h3>
      </div>
      <a href={href}>
        <span>Start Research</span>
        <span className="icon-button">
          <CaretRight weight="bold" />
        </span>
      </a>
    </article>
  )
}

// Transfer/Job item component
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="transfer"
    >
      <div className="transfer-logo">
        <UsersThree weight="fill" />
      </div>
      <dl className="transfer-details">
        <div>
          <dt>
            <button onClick={() => onView(job.id)} className="job-name-link">
              {job.name}
            </button>
          </dt>
          <dd><StatusBadge status={job.status} /></dd>
        </div>
        <div>
          <dt>{job.completed_count}/{job.total_prospects}</dt>
          <dd>Prospects researched</dd>
        </div>
        <div>
          <dt>{formatRelativeTime(new Date(job.created_at))}</dt>
          <dd>Created</dd>
        </div>
      </dl>
      <div className="transfer-actions">
        {job.status === "completed" && (
          <button
            onClick={() => onExport(job.id)}
            className="icon-button"
            title="Export CSV"
          >
            <Download />
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="icon-button icon-button-danger"
          title="Delete"
        >
          {isDeleting ? (
            <Spinner className="animate-spin" />
          ) : (
            <Trash />
          )}
        </button>
      </div>
    </motion.div>
  )
}

// Upload component in sidebar style
function BatchUploadSidebar({
  onUpload,
  isUploading,
  batchLimit,
  planName,
  stats,
}: {
  onUpload: (file: File) => Promise<void>
  isUploading: boolean
  batchLimit: number
  planName: string
  stats: { totalJobs: number; totalProspects: number; completedProspects: number }
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
    <section className="payment-section">
      <div className="payment-section-header">
        <h2>New Research</h2>
        <div>
          <span className="plan-badge">{planName}</span>
        </div>
      </div>

      {/* Upload area */}
      <div className="faq">
        <p>Drop or select a file to start</p>
        <div
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
          onDrop={handleDrop}
          className={cn("upload-zone", isDragging && "upload-zone-active")}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {!selectedFile ? (
            <>
              <CloudArrowUp className="upload-icon" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flat-button"
              >
                Choose File
              </button>
              <span className="upload-hint">CSV or Excel</span>
            </>
          ) : (
            <div className="selected-file">
              <FileCsv className="file-icon" weight="fill" />
              <div className="file-info">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
              {!isUploading && (
                <button onClick={handleCancel} className="icon-button icon-button-small">
                  <X />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="payments">
        <div className="payment">
          <div className="card card-green">
            <span>Jobs</span>
            <span>{stats.totalJobs}</span>
          </div>
          <div className="payment-details">
            <h3>Total Batches</h3>
            <div>
              <span>{stats.totalJobs}</span>
            </div>
          </div>
        </div>
        <div className="payment">
          <div className="card card-olive">
            <span>Done</span>
            <span>{stats.completedProspects}</span>
          </div>
          <div className="payment-details">
            <h3>Researched</h3>
            <div>
              <span>{stats.completedProspects}/{stats.totalProspects}</span>
            </div>
          </div>
        </div>
        <div className="payment">
          <div className="card card-gray">
            <span>Limit</span>
            <span>{batchLimit}</span>
          </div>
          <div className="payment-details">
            <h3>Per Batch</h3>
            <div>
              <span>{batchLimit} max</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="payment-section-footer">
        <button
          className={cn("save-button", selectedFile && !isUploading && "save-button-active")}
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? "Processing..." : "Start Research"}
        </button>
        <button className="settings-button" onClick={() => window.location.href = '/settings'}>
          <Gear />
          <span>Settings</span>
        </button>
      </div>
    </section>
  )
}

// Upload Modal Component
function UploadModal({
  isOpen,
  onClose,
  onUpload,
  isUploading,
}: {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File) => Promise<void>
  isUploading: boolean
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
      onClose()
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="batch-upload-modal">
        <DialogHeader>
          <DialogTitle>New Batch Research</DialogTitle>
        </DialogHeader>
        <div className="faq">
          <p>Drop or select a file to start</p>
          <div
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={handleDrop}
            className={cn("upload-zone", isDragging && "upload-zone-active")}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />

            {!selectedFile ? (
              <>
                <CloudArrowUp className="upload-icon" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flat-button"
                >
                  Choose File
                </button>
                <span className="upload-hint">CSV or Excel</span>
              </>
            ) : (
              <div className="selected-file">
                <FileCsv className="file-icon" weight="fill" />
                <div className="file-info">
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
                {!isUploading && (
                  <button onClick={handleCancel} className="icon-button icon-button-small">
                    <X />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <div className="payment-section-footer">
          <button
            className={cn("save-button", selectedFile && !isUploading && "save-button-active")}
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? "Processing..." : "Start Research"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Main batch view component
export function BatchView() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [batchLimit, setBatchLimit] = useState(10)
  const [planName, setPlanName] = useState("Growth")
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

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
    refetchInterval: 10000,
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
      const result = await parseProspectFile(file)
      if (!result.success) {
        throw new Error(result.errors.join(". "))
      }

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

      const { prospects } = transformToProspectData(result.rows, columnMapping)

      if (prospects.length === 0) {
        throw new Error("No valid prospects found. Please ensure your file has a name column.")
      }

      if (prospects.length > batchLimit) {
        throw new Error(`Your ${planName} plan allows up to ${batchLimit} prospects per batch.`)
      }

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
    <div className="batch-app-container">
      {/* Header */}
      <header className="batch-header">
        <div className="batch-header-left">
          <a href="/" className="batch-logo-link group/logo">
            <span className="batch-logo-wrapper">
              <img src="/PFPs/1.png" alt="Rōmy" className="batch-logo batch-logo-default" />
              <img src="/PFPs/2.png" alt="Rōmy" className="batch-logo batch-logo-hover" />
            </span>
            <span className="batch-logo-text">Rōmy</span>
          </a>
          <span className="batch-header-divider">/</span>
          <h1>Batch Research</h1>
        </div>
        <div className="batch-header-right">
          <a href="/" className="flat-button">
            Back to Chat
          </a>
        </div>
      </header>

      <div className="batch-app-body">
        {/* Main Content */}
        <div className="app-body-main-content">
          {/* Service Section - Quick Actions */}
          <section className="service-section">
            <h2>Research</h2>
            <div className="tiles">
              <ServiceTile
                icon={Lightning}
                title="Quick Research"
                subtitle="Up to 10 prospects"
                href="/batch"
                variant="olive"
              />
              <ServiceTile
                icon={Target}
                title="Deep Analysis"
                subtitle="Comprehensive profiles"
                href="/batch"
                variant="green"
              />
              <ServiceTile
                icon={ChartBar}
                title="View Reports"
                subtitle="All past research"
                href="/batch#jobs-list"
                variant="gray"
              />
            </div>
            <div className="service-section-footer">
              <p>Research is performed using AI to analyze public data and build donor profiles.</p>
            </div>
          </section>

          {/* Transfer Section - Recent Jobs */}
          <section className="transfer-section" id="jobs-list">
            <div className="transfer-section-header">
              <h2>Recent Batches</h2>
              <div className="filter-options">
                <p>{jobs.length} total jobs • {completedProspects}/{totalProspects} prospects</p>
                <button className="icon-button" onClick={() => setIsUploadModalOpen(true)}>
                  <Plus />
                </button>
              </div>
            </div>
            <div className="transfer-section-controls">
              <div className="search-field">
                <MagnifyingGlass />
                <input
                  type="text"
                  placeholder="Search batch jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="flat-button" onClick={() => setIsUploadModalOpen(true)}>
                New Batch
              </button>
            </div>
            <div className="transfers">
              {isLoading ? (
                <div className="loading-state">
                  <Spinner className="animate-spin" />
                  <span>Loading batches...</span>
                </div>
              ) : jobs.length === 0 ? (
                <div className="empty-state">
                  <UsersThree />
                  <span>No batch jobs yet. Upload a prospect list to get started.</span>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="empty-state">
                  <MagnifyingGlass />
                  <span>No batch jobs match your search.</span>
                </div>
              ) : (
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
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="app-body-sidebar" id="upload-section">
          <BatchUploadSidebar
            onUpload={handleUpload}
            isUploading={isUploading}
            batchLimit={batchLimit}
            planName={planName}
            stats={{
              totalJobs: jobs.length,
              totalProspects,
              completedProspects,
            }}
          />
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
        isUploading={isUploading}
      />
    </div>
  )
}
