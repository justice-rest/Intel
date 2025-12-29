"use client"

import { useState } from "react"
import Link from "next/link"
import { useTransitionRouter } from "@/lib/transitions"
import { cn, formatRelativeTime } from "@/lib/utils"
import {
  Binoculars,
  ArrowLeft,
  MagnifyingGlass,
  Trash,
  Spinner,
  CheckCircle,
  WarningCircle,
  Clock,
  X,
  CaretRight,
  Plus,
  Play,
  Download,
  MapPin,
  Target,
  Buildings,
  Heart,
  CurrencyDollar,
  FirstAidKit,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import "@/app/labs/batch-dashboard.css"
import { ResearchPlayButton, ResearchStopButton } from "@/app/components/batch-processing/research-play-button"
import {
  DiscoveryJob,
  DiscoveryJobStatus,
  MatchCondition,
  DISCOVERY_TEMPLATES,
  DiscoveryTemplate,
} from "@/lib/discovery"

// ============================================================================
// STATUS BADGE
// ============================================================================

function DiscoveryStatusBadge({ status }: { status: DiscoveryJobStatus }) {
  const config = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: "status-badge status-badge-pending",
    },
    queued: {
      icon: Clock,
      label: "Queued",
      className: "status-badge status-badge-pending",
    },
    running: {
      icon: Spinner,
      label: "Running",
      className: "status-badge status-badge-processing",
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
  const isSpinner = status === "running"

  return (
    <span className={className}>
      <Icon className={cn("status-icon", isSpinner && "animate-spin")} weight="fill" />
      {label}
    </span>
  )
}

// ============================================================================
// TEMPLATE CARD
// ============================================================================

function TemplateCard({
  template,
  onClick,
}: {
  template: DiscoveryTemplate
  onClick: () => void
}) {
  const iconMap = {
    tech: Buildings,
    realestate: MapPin,
    healthcare: FirstAidKit,
    finance: CurrencyDollar,
  }
  const Icon = iconMap[template.icon]

  return (
    <button onClick={onClick} className="tile tile-green template-card">
      <div className="tile-header">
        <Icon className="tile-icon" weight="light" />
        <h3>
          <span>{template.name}</span>
          <span>{template.description}</span>
        </h3>
      </div>
      <div className="template-footer">
        <span>Use Template</span>
        <span className="icon-button">
          <CaretRight weight="bold" />
        </span>
      </div>
    </button>
  )
}

// ============================================================================
// JOB ITEM
// ============================================================================

function DiscoveryJobItem({
  job,
  onDelete,
  onView,
  onExport,
  onStart,
}: {
  job: DiscoveryJob
  onDelete: (id: string) => Promise<void>
  onView: (id: string) => void
  onExport: (id: string) => void
  onStart: (id: string) => Promise<void>
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this discovery job?")) return

    try {
      setIsDeleting(true)
      await onDelete(job.id)
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStart = async () => {
    try {
      setIsStarting(true)
      await onStart(job.id)
    } catch (error) {
      console.error("Start failed:", error)
    } finally {
      setIsStarting(false)
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
        <Binoculars weight="fill" />
      </div>
      <dl className="transfer-details">
        <div>
          <dt>
            <button onClick={() => onView(job.id)} className="job-name-link">
              {job.name}
            </button>
          </dt>
          <dd><DiscoveryStatusBadge status={job.status} /></dd>
        </div>
        <div>
          <dt>{job.matched_count}/{job.settings?.match_limit || 10}</dt>
          <dd>Prospects found</dd>
        </div>
        <div>
          <dt>{formatRelativeTime(new Date(job.created_at))}</dt>
          <dd>Created</dd>
        </div>
      </dl>
      <div className="transfer-actions">
        {job.status === "pending" && (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="icon-button icon-button-success"
            title="Start Discovery"
          >
            {isStarting ? (
              <Spinner className="animate-spin" />
            ) : (
              <Play weight="fill" />
            )}
          </button>
        )}
        {job.status === "completed" && job.matched_count > 0 && (
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

// ============================================================================
// CREATE DISCOVERY DIALOG
// ============================================================================

function CreateDiscoveryDialog({
  isOpen,
  onClose,
  onCreate,
  isCreating,
  initialTemplate,
}: {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: {
    name: string
    objective: string
    match_conditions: MatchCondition[]
    location?: string
    match_limit: number
  }) => Promise<void>
  isCreating: boolean
  initialTemplate?: DiscoveryTemplate | null
}) {
  const [name, setName] = useState("")
  const [objective, setObjective] = useState("")
  const [location, setLocation] = useState("")
  const [matchLimit, setMatchLimit] = useState(10)
  const [conditions, setConditions] = useState<MatchCondition[]>([
    { name: "", description: "" },
  ])
  const [error, setError] = useState("")

  // Apply template when it changes
  useState(() => {
    if (initialTemplate) {
      setName(initialTemplate.name)
      setObjective(initialTemplate.objective)
      setConditions([...initialTemplate.match_conditions])
    }
  })

  const handleAddCondition = () => {
    if (conditions.length < 5) {
      setConditions([...conditions, { name: "", description: "" }])
    }
  }

  const handleRemoveCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index))
    }
  }

  const handleConditionChange = (
    index: number,
    field: "name" | "description",
    value: string
  ) => {
    const updated = [...conditions]
    updated[index][field] = value
    setConditions(updated)
  }

  const handleSubmit = async () => {
    setError("")

    if (!name.trim()) {
      setError("Please enter a name for this discovery")
      return
    }

    if (!objective.trim()) {
      setError("Please describe who you want to find")
      return
    }

    const validConditions = conditions.filter(
      (c) => c.name.trim() && c.description.trim()
    )

    if (validConditions.length === 0) {
      setError("Please add at least one match condition")
      return
    }

    try {
      await onCreate({
        name: name.trim(),
        objective: objective.trim(),
        match_conditions: validConditions,
        location: location.trim() || undefined,
        match_limit: matchLimit,
      })
      // Reset form
      setName("")
      setObjective("")
      setLocation("")
      setMatchLimit(10)
      setConditions([{ name: "", description: "" }])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create discovery")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="batch-upload-modal mapping-dialog">
        <DialogHeader>
          <DialogTitle>New Discovery</DialogTitle>
        </DialogHeader>

        <div className="mapping-content">
          <p className="mapping-description">
            Describe who you&apos;re looking for and the AI will find matching prospects.
          </p>

          {/* Name */}
          <div className="mapping-section">
            <div className="mapping-row">
              <label className="mapping-label">
                Discovery Name
                <span className="mapping-required">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 Tech Philanthropists"
                className="mapping-input"
              />
            </div>
          </div>

          {/* Objective */}
          <div className="mapping-section">
            <div className="mapping-row">
              <label className="mapping-label">
                Who are you looking for?
                <span className="mapping-required">*</span>
              </label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g., Find technology entrepreneurs who have demonstrated significant philanthropic activity"
                className="mapping-textarea"
                rows={3}
              />
            </div>
          </div>

          {/* Location */}
          <div className="mapping-section">
            <div className="mapping-row">
              <label className="mapping-label">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., San Francisco Bay Area"
                className="mapping-input"
              />
            </div>
          </div>

          {/* Match Conditions */}
          <div className="mapping-section">
            <h4 className="mapping-section-title">
              Match Conditions
              <span className="mapping-required">*</span>
            </h4>
            <p className="mapping-hint">
              Define criteria that prospects must match. More specific = better results.
            </p>

            {conditions.map((condition, index) => (
              <div key={index} className="condition-row">
                <div className="condition-inputs">
                  <input
                    type="text"
                    value={condition.name}
                    onChange={(e) =>
                      handleConditionChange(index, "name", e.target.value)
                    }
                    placeholder="Condition name (e.g., tech_background)"
                    className="mapping-input condition-name"
                  />
                  <input
                    type="text"
                    value={condition.description}
                    onChange={(e) =>
                      handleConditionChange(index, "description", e.target.value)
                    }
                    placeholder="Description (e.g., Must have founded a tech company)"
                    className="mapping-input condition-desc"
                  />
                </div>
                {conditions.length > 1 && (
                  <button
                    onClick={() => handleRemoveCondition(index)}
                    className="icon-button icon-button-small icon-button-danger"
                  >
                    <X />
                  </button>
                )}
              </div>
            ))}

            {conditions.length < 5 && (
              <button
                onClick={handleAddCondition}
                className="flat-button add-condition-btn"
              >
                <Plus /> Add Condition
              </button>
            )}
          </div>

          {/* Match Limit */}
          <div className="mapping-section">
            <div className="mapping-row">
              <label className="mapping-label">
                Maximum Prospects to Find
              </label>
              <div className="match-limit-slider">
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={matchLimit}
                  onChange={(e) => setMatchLimit(parseInt(e.target.value))}
                  className="slider"
                />
                <span className="match-limit-value">{matchLimit}</span>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="payment-section-footer flex gap-2">
            <ResearchStopButton onClick={onClose} disabled={isCreating} />
            <ResearchPlayButton
              onClick={handleSubmit}
              isProcessing={isCreating}
              disabled={isCreating}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// MAIN VIEW
// ============================================================================

export function DiscoverView({ planName }: { planName: string }) {
  const queryClient = useQueryClient()
  const router = useTransitionRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DiscoveryTemplate | null>(null)

  // Fetch discovery jobs
  const { data: jobs = [], isLoading } = useQuery<DiscoveryJob[]>({
    queryKey: ["discovery-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/discovery")
      if (!res.ok) throw new Error("Failed to fetch discovery jobs")
      const data = await res.json()
      return data.jobs
    },
    refetchInterval: 10000,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string
      objective: string
      match_conditions: MatchCondition[]
      location?: string
      match_limit: number
    }) => {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          objective: data.objective,
          match_conditions: data.match_conditions,
          location: data.location,
          settings: {
            match_limit: data.match_limit,
            generator: "pro",
            entity_type: "philanthropist",
          },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create discovery")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["discovery-jobs"] })
      toast({ title: "Discovery job created", description: data.message })
      // Navigate to job detail
      router.push(`/labs/discover/${data.job.id}`)
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, status: "error" })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/discovery/${jobId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete job")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discovery-jobs"] })
      toast({ title: "Discovery job deleted" })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, status: "error" })
    },
  })

  // Start mutation
  const startMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/discovery/${jobId}/start`, { method: "POST" })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to start discovery")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["discovery-jobs"] })
      toast({
        title: "Discovery completed",
        description: `Found ${data.job.matched_count} prospects`,
      })
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["discovery-jobs"] })
      toast({ title: "Discovery failed", description: error.message, status: "error" })
    },
  })

  // Handlers
  const handleDelete = async (jobId: string) => {
    await deleteMutation.mutateAsync(jobId)
  }

  const handleView = (jobId: string) => {
    router.push(`/labs/discover/${jobId}`)
  }

  const handleExport = async (jobId: string) => {
    try {
      const res = await fetch(`/api/discovery/${jobId}/export`)
      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `discovery_${jobId}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({ title: "Export downloaded" })
    } catch (error) {
      toast({ title: "Export failed", status: "error" })
    }
  }

  const handleStart = async (jobId: string) => {
    await startMutation.mutateAsync(jobId)
  }

  const handleTemplateClick = (template: DiscoveryTemplate) => {
    setSelectedTemplate(template)
    setIsCreateDialogOpen(true)
  }

  const handleCreate = async (data: {
    name: string
    objective: string
    match_conditions: MatchCondition[]
    location?: string
    match_limit: number
  }) => {
    await createMutation.mutateAsync(data)
    setSelectedTemplate(null)
  }

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      job.name.toLowerCase().includes(query) ||
      job.objective?.toLowerCase().includes(query)
    )
  })

  // Stats
  const totalMatched = jobs.reduce((sum, job) => sum + (job.matched_count || 0), 0)
  const completedJobs = jobs.filter((job) => job.status === "completed").length

  return (
    <div className="batch-app-container">
      {/* Header */}
      <header className="batch-app-header">
        <div className="app-header-title">
          <Binoculars weight="fill" className="app-logo" />
          <span>Discovery</span>
        </div>
        <div className="app-header-actions">
          <Link href="/labs" className="flat-button">
            <ArrowLeft />
            Back to Labs
          </Link>
        </div>
      </header>

      <div className="batch-app-body">
        {/* Main Content */}
        <div className="app-body-main-content">
          {/* Templates Section */}
          <section className="service-section">
            <h2>Quick Start Templates</h2>
            <div className="tiles discovery-templates">
              {DISCOVERY_TEMPLATES.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => handleTemplateClick(template)}
                />
              ))}
            </div>
            <div className="service-section-footer">
              <p>
                Select a template or create a custom discovery to find prospects
                matching your criteria.
              </p>
            </div>
          </section>

          {/* Jobs Section */}
          <section className="transfer-section" id="discovery-jobs">
            <div className="transfer-section-header">
              <h2>Discovery Jobs</h2>
              <div className="filter-options">
                <p>
                  {jobs.length} jobs &bull; {totalMatched} prospects found
                </p>
                <button
                  className="icon-button"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus />
                </button>
              </div>
            </div>
            <div className="transfer-section-controls">
              <div className="search-field">
                <MagnifyingGlass />
                <input
                  type="text"
                  placeholder="Search discovery jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                className="flat-button"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                New Discovery
              </button>
            </div>
            <div className="transfers">
              {isLoading ? (
                <div className="loading-state">
                  <Spinner className="animate-spin" />
                  <span>Loading discoveries...</span>
                </div>
              ) : jobs.length === 0 ? (
                <div className="empty-state">
                  <Binoculars />
                  <span>
                    No discovery jobs yet. Use a template or create a custom
                    discovery to get started.
                  </span>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="empty-state">
                  <MagnifyingGlass />
                  <span>No jobs match your search.</span>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredJobs.map((job) => (
                    <DiscoveryJobItem
                      key={job.id}
                      job={job}
                      onDelete={handleDelete}
                      onView={handleView}
                      onExport={handleExport}
                      onStart={handleStart}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="app-body-sidebar">
          <section className="payment-section">
            <div className="payment-section-header">
              <h2>Discovery Info</h2>
              <span className="plan-badge">{planName}</span>
            </div>

            <div className="stats-grid">
              <div className="card">
                <span className="card-value">{jobs.length}</span>
                <span className="card-label">Total Jobs</span>
              </div>
              <div className="card">
                <span className="card-value">{completedJobs}</span>
                <span className="card-label">Completed</span>
              </div>
              <div className="card">
                <span className="card-value">{totalMatched}</span>
                <span className="card-label">Prospects Found</span>
              </div>
            </div>

            <div className="faq">
              <h3>How it works</h3>
              <ul className="discovery-faq">
                <li>1. Describe who you&apos;re looking for</li>
                <li>2. Set match conditions</li>
                <li>3. AI discovers matching prospects</li>
                <li>4. Review and export results</li>
              </ul>
            </div>
          </section>
        </aside>
      </div>

      {/* Create Dialog */}
      <CreateDiscoveryDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false)
          setSelectedTemplate(null)
        }}
        onCreate={handleCreate}
        isCreating={createMutation.isPending}
        initialTemplate={selectedTemplate}
      />
    </div>
  )
}
