"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import { useTransitionRouter } from "@/lib/transitions"
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
  GoogleDriveLogo,
  HardDrive,
  Binoculars,
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

import "@/app/labs/batch-dashboard.css"
import { ResearchPlayButton, ResearchStopButton } from "@/app/components/batch-processing/research-play-button"
import { DriveFilePicker } from "@/app/components/batch-processing/drive-file-picker"

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
      <Link href={href}>
        <span>Start Research</span>
        <span className="icon-button">
          <CaretRight weight="bold" />
        </span>
      </Link>
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

// Upload mode type
type UploadMode = "local" | "drive"

// Upload component in sidebar style
function BatchUploadSidebar({
  onUpload,
  onDriveUpload,
  isUploading,
  batchLimit,
  planName,
  stats,
}: {
  onUpload: (file: File) => Promise<void>
  onDriveUpload: (file: { name: string; content: ArrayBuffer; mimeType: string }) => Promise<void>
  isUploading: boolean
  batchLimit: number
  planName: string
  stats: { totalJobs: number; totalProspects: number; completedProspects: number }
}) {
  const [uploadMode, setUploadMode] = useState<UploadMode>("local")
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

      {/* Upload mode tabs */}
      <div className="upload-mode-tabs">
        <button
          onClick={() => setUploadMode("local")}
          className={cn(
            "upload-mode-tab",
            uploadMode === "local" && "upload-mode-tab-active"
          )}
        >
          <HardDrive className="h-4 w-4" />
          Local File
        </button>
        <button
          onClick={() => setUploadMode("drive")}
          className={cn(
            "upload-mode-tab",
            uploadMode === "drive" && "upload-mode-tab-active"
          )}
        >
          <GoogleDriveLogo className="h-4 w-4" />
          Google Drive
        </button>
      </div>

      {/* Upload area - local file */}
      {uploadMode === "local" && (
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
      )}

      {/* Upload area - Google Drive */}
      {uploadMode === "drive" && (
        <div className="faq">
          <DriveFilePicker
            onFileSelect={onDriveUpload}
            isLoading={isUploading}
          />
        </div>
      )}

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
        <ResearchPlayButton
          onClick={handleUpload}
          isProcessing={isUploading}
          disabled={!selectedFile || isUploading}
          className="w-full"
        />
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
          <ResearchPlayButton
            onClick={handleUpload}
            isProcessing={isUploading}
            disabled={!selectedFile || isUploading}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Column Mapping Dialog Component
interface ParsedFileData {
  file: File
  rows: Record<string, string>[]
  columns: string[]
  suggested_mapping: Partial<ColumnMapping>
}

function ColumnMappingDialog({
  isOpen,
  onClose,
  parsedData,
  onConfirm,
  isUploading,
  batchLimit,
  planName,
}: {
  isOpen: boolean
  onClose: () => void
  parsedData: ParsedFileData | null
  onConfirm: (mapping: ColumnMapping) => Promise<void>
  isUploading: boolean
  batchLimit: number
  planName: string
}) {
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    full_address: null,
    email: null,
    phone: null,
    company: null,
    title: null,
    notes: null,
  })
  const [error, setError] = useState<string>("")

  // Initialize mapping from suggested_mapping when parsedData changes
  useEffect(() => {
    if (parsedData?.suggested_mapping) {
      setMapping({
        name: parsedData.suggested_mapping.name || null,
        address: parsedData.suggested_mapping.address || null,
        city: parsedData.suggested_mapping.city || null,
        state: parsedData.suggested_mapping.state || null,
        zip: parsedData.suggested_mapping.zip || null,
        full_address: parsedData.suggested_mapping.full_address || null,
        email: parsedData.suggested_mapping.email || null,
        phone: parsedData.suggested_mapping.phone || null,
        company: parsedData.suggested_mapping.company || null,
        title: parsedData.suggested_mapping.title || null,
        notes: parsedData.suggested_mapping.notes || null,
      })
    }
  }, [parsedData])

  const handleConfirm = async () => {
    if (!mapping.name) {
      setError("Name column is required. Please select which column contains the prospect names.")
      return
    }
    if (!mapping.address && !mapping.full_address && !(mapping.city && mapping.state)) {
      setError("Address information is required. Please select address, full_address, or both city and state.")
      return
    }
    setError("")
    try {
      await onConfirm(mapping)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    }
  }

  const requiredFields = ["name"] as const
  const addressFields = ["address", "full_address", "city", "state", "zip"] as const
  const optionalFields = ["email", "phone", "company", "title", "notes"] as const

  const renderSelect = (field: keyof ColumnMapping, label: string, required?: boolean) => (
    <div key={field} className="mapping-row">
      <label className="mapping-label">
        {label}
        {required && <span className="mapping-required">*</span>}
      </label>
      <div className="dropdown-field mapping-select">
        <select
          value={mapping[field] || ""}
          onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || null })}
        >
          <option value="">-- Not mapped --</option>
          {parsedData?.columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  if (!parsedData) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="batch-upload-modal mapping-dialog">
        <DialogHeader>
          <DialogTitle>Map Your Columns</DialogTitle>
        </DialogHeader>

        <div className="mapping-content">
          <p className="mapping-description">
            Found <strong>{parsedData.rows.length}</strong> rows in <strong>{parsedData.file.name}</strong>.
            Please map your CSV columns to the required fields below.
          </p>

          {parsedData.rows.length > batchLimit && (
            <div className="mapping-warning">
              Your {planName} plan allows up to {batchLimit} prospects per batch. Only the first {batchLimit} will be processed.
            </div>
          )}

          <div className="mapping-section">
            <h4 className="mapping-section-title">Required</h4>
            {requiredFields.map((field) => renderSelect(field, field.charAt(0).toUpperCase() + field.slice(1), true))}
          </div>

          <div className="mapping-section">
            <h4 className="mapping-section-title">Address (at least one required)</h4>
            {addressFields.map((field) => renderSelect(field, field.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())))}
          </div>

          <div className="mapping-section">
            <h4 className="mapping-section-title">Optional</h4>
            {optionalFields.map((field) => renderSelect(field, field.charAt(0).toUpperCase() + field.slice(1)))}
          </div>

          {/* Preview */}
          <div className="mapping-preview">
            <h4 className="mapping-section-title">Preview (first 3 rows)</h4>
            <div className="mapping-preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>City</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.rows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      <td>{mapping.name ? row[mapping.name] || "—" : "—"}</td>
                      <td>{mapping.address ? row[mapping.address] || (mapping.full_address ? row[mapping.full_address] : "—") : "—"}</td>
                      <td>{mapping.city ? row[mapping.city] || "—" : "—"}</td>
                      <td>{mapping.state ? row[mapping.state] || "—" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="payment-section-footer flex gap-2">
            <ResearchStopButton
              onClick={onClose}
              disabled={isUploading}
            />
            <ResearchPlayButton
              onClick={handleConfirm}
              isProcessing={isUploading}
              disabled={isUploading}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Main batch view component
export function BatchView() {
  const queryClient = useQueryClient()
  const router = useTransitionRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [batchLimit, setBatchLimit] = useState(10)
  const [planName, setPlanName] = useState("Growth")
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false)
  const [parsedFileData, setParsedFileData] = useState<ParsedFileData | null>(null)

  // Fetch batch limit
  useQuery({
    queryKey: ["batch-limits"],
    queryFn: async () => {
      const response = await fetch("/api/batch-prospects/limits")
      if (response.ok) {
        const data = await response.json()
        setBatchLimit(data.limit)
        // Capitalize plan name for display (API returns lowercase like "pro", "scale")
        const displayName = data.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : "Growth"
        setPlanName(displayName)
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

  // Handle file upload - parse and show mapping dialog
  const handleUpload = async (file: File) => {
    setIsUploading(true)

    try {
      const result = await parseProspectFile(file)
      if (!result.success && result.rows.length === 0) {
        throw new Error(result.errors.join(". "))
      }

      // Store parsed data and show mapping dialog
      setParsedFileData({
        file,
        rows: result.rows,
        columns: result.columns,
        suggested_mapping: result.suggested_mapping,
      })
      setIsUploadModalOpen(false)
      setIsMappingDialogOpen(true)
    } catch (err) {
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  // Handle Google Drive file upload
  const handleDriveUpload = async (driveFile: { name: string; content: ArrayBuffer; mimeType: string }) => {
    setIsUploading(true)

    try {
      // Convert ArrayBuffer to File object for unified processing
      const blob = new Blob([driveFile.content], { type: driveFile.mimeType })
      const file = new File([blob], driveFile.name, { type: driveFile.mimeType })

      const result = await parseProspectFile(file)
      if (!result.success && result.rows.length === 0) {
        throw new Error(result.errors.join(". "))
      }

      // Store parsed data and show mapping dialog
      setParsedFileData({
        file,
        rows: result.rows,
        columns: result.columns,
        suggested_mapping: result.suggested_mapping,
      })
      setIsMappingDialogOpen(true)
    } catch (err) {
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  // Handle mapping confirmation - create the batch job
  const handleMappingConfirm = async (columnMapping: ColumnMapping) => {
    if (!parsedFileData) return

    setIsUploading(true)
    try {
      const { prospects } = transformToProspectData(parsedFileData.rows, columnMapping)

      if (prospects.length === 0) {
        throw new Error("No valid prospects found. Please check your column mappings.")
      }

      // Limit to batch limit
      const limitedProspects = prospects.slice(0, batchLimit)

      const response = await fetch("/api/batch-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${parsedFileData.file.name.replace(/\.[^/.]+$/, "")} - ${new Date().toLocaleDateString()}`,
          prospects: limitedProspects,
          column_mapping: columnMapping,
          source_file_name: parsedFileData.file.name,
          source_file_size: parsedFileData.file.size,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create batch job")
      }

      const data = await response.json()
      toast({ title: `Batch job created with ${limitedProspects.length} prospects`, status: "success" })
      queryClient.invalidateQueries({ queryKey: ["batch-jobs"] })
      setIsMappingDialogOpen(false)
      setParsedFileData(null)

      // Navigate to the job detail page with smooth transition
      if (data.job?.id) {
        router.push(`/labs/${data.job.id}`)
      }
    } catch (err) {
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  // Close mapping dialog
  const handleMappingClose = () => {
    setIsMappingDialogOpen(false)
    setParsedFileData(null)
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
          <Link href="/" className="batch-logo-link group/logo">
            <span className="batch-logo-wrapper">
              <img src="/PFPs/1.png" alt="Rōmy" className="batch-logo batch-logo-default" />
              <img src="/PFPs/2.png" alt="Rōmy" className="batch-logo batch-logo-hover" />
            </span>
            <span className="batch-logo-text">Rōmy</span>
          </Link>
          <span className="batch-header-divider">/</span>
          <h1>Labs</h1>
        </div>
        <div className="batch-header-right">
          <Link href="/" className="flat-button">
            Back to Chat
          </Link>
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
                subtitle="1 or 2 prospects"
                href="/"
                variant="olive"
              />
              <ServiceTile
                icon={Target}
                title="Deep Analysis"
                subtitle="Comprehensive profiles"
                href="/labs"
                variant="green"
              />
              <ServiceTile
                icon={ChartBar}
                title="View Reports"
                subtitle="All past research"
                href="/labs#jobs-list"
                variant="gray"
              />
            </div>
            <div className="service-section-footer">
              <p>Research is performed using AI to analyze public data and build donor profiles.</p>
            </div>
          </section>

          {/* Discovery Section - FindAll Prospect Discovery */}
          <section className="service-section">
            <h2>Discovery</h2>
            <div className="tiles">
              <ServiceTile
                icon={Binoculars}
                title="Find Prospects"
                subtitle="AI-powered discovery"
                href="/labs/discover"
                variant="green"
              />
            </div>
            <div className="service-section-footer">
              <p>Discover new prospects matching your criteria without needing a list of names.</p>
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
                      onView={(id) => router.push(`/labs/${id}`)}
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
            onDriveUpload={handleDriveUpload}
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

      {/* Column Mapping Dialog */}
      <ColumnMappingDialog
        isOpen={isMappingDialogOpen}
        onClose={handleMappingClose}
        parsedData={parsedFileData}
        onConfirm={handleMappingConfirm}
        isUploading={isUploading}
        batchLimit={batchLimit}
        planName={planName}
      />
    </div>
  )
}
