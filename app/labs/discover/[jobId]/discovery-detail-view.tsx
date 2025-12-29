"use client"

import { useState } from "react"
import Link from "next/link"
import { useTransitionRouter } from "@/lib/transitions"
import { cn } from "@/lib/utils"
import {
  Binoculars,
  Download,
  Spinner,
  CheckCircle,
  WarningCircle,
  Clock,
  X,
  Play,
  ArrowSquareOut,
  Copy,
  User,
  MapPin,
  Link as LinkIcon,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

import "@/app/labs/batch-dashboard.css"
import { ResearchPlayButton } from "@/app/components/batch-processing/research-play-button"
import {
  DiscoveryJob,
  DiscoveryCandidate,
  DiscoveryJobStatus,
  DiscoveryJobDetailResponse,
  MatchCondition,
} from "@/lib/discovery"

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status: DiscoveryJobStatus }) {
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
// STATUS CARD
// ============================================================================

function StatusCard({
  label,
  value,
  variant = "default",
}: {
  label: string
  value: number | string
  variant?: "default" | "success" | "error" | "info"
}) {
  const variantClasses = {
    default: "status-card",
    success: "status-card status-card-success",
    error: "status-card status-card-error",
    info: "status-card status-card-info",
  }

  return (
    <div className={variantClasses[variant]}>
      <span className="status-card-value">{value}</span>
      <span className="status-card-label">{label}</span>
    </div>
  )
}

// ============================================================================
// MATCH RESULT CELL - Renders dynamic condition evaluation
// ============================================================================

interface MatchResultValue {
  matched?: boolean
  value?: boolean | string | number
  reasoning?: string
  confidence?: number
  [key: string]: unknown
}

function MatchResultCell({ result }: { result: unknown }) {
  if (result === undefined || result === null) {
    return <span className="text-muted">—</span>
  }

  // Handle boolean directly
  if (typeof result === "boolean") {
    return (
      <span className={result ? "text-green-500" : "text-red-500"}>
        {result ? "✓ Yes" : "✗ No"}
      </span>
    )
  }

  // Handle string/number directly
  if (typeof result === "string" || typeof result === "number") {
    return <span>{String(result)}</span>
  }

  // Handle object with matched/value property
  if (typeof result === "object") {
    const obj = result as MatchResultValue
    const isMatched = obj.matched ?? obj.value

    if (typeof isMatched === "boolean") {
      return (
        <span
          className={isMatched ? "text-green-500" : "text-red-500"}
          title={obj.reasoning || undefined}
        >
          {isMatched ? "✓ Yes" : "✗ No"}
        </span>
      )
    }

    // Fallback: show value if present
    if (obj.value !== undefined) {
      return <span>{String(obj.value)}</span>
    }
  }

  return <span className="text-muted">—</span>
}

// ============================================================================
// CANDIDATE ROW
// ============================================================================

function CandidateRow({
  candidate,
  index,
  matchConditions,
  totalColumns,
}: {
  candidate: DiscoveryCandidate
  index: number
  matchConditions: MatchCondition[]
  totalColumns: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusColors = {
    matched: "text-green-500",
    unmatched: "text-gray-500",
    generated: "text-blue-500",
    discarded: "text-red-500",
  }

  const handleCopyName = () => {
    navigator.clipboard.writeText(candidate.name)
    toast({ title: "Name copied to clipboard" })
  }

  const handleOpenUrl = () => {
    if (candidate.url) {
      window.open(candidate.url, "_blank", "noopener,noreferrer")
    }
  }

  // Extract match results for each condition
  const matchResults = candidate.match_results as Record<string, unknown> | undefined

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "prospect-row",
          candidate.status === "matched" && "prospect-row-matched"
        )}
      >
        <td className="prospect-index">{index + 1}</td>
        <td className="prospect-name">
          <div className="prospect-name-cell">
            <User weight="fill" className="prospect-icon" />
            <span>{candidate.name}</span>
            <button
              onClick={handleCopyName}
              className="icon-button icon-button-small"
              title="Copy name"
            >
              <Copy />
            </button>
          </div>
        </td>
        <td className="prospect-description">
          {candidate.description ? (
            <span className="description-text">
              {candidate.description.length > 100
                ? `${candidate.description.substring(0, 100)}...`
                : candidate.description}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        {/* Dynamic columns for each match condition */}
        {matchConditions.map((condition) => (
          <td key={condition.name} className="prospect-condition">
            <MatchResultCell result={matchResults?.[condition.name]} />
          </td>
        ))}
        <td className="prospect-status">
          <span className={statusColors[candidate.status]}>
            {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
          </span>
        </td>
        <td className="prospect-sources">
          {candidate.sources?.length || 0} sources
        </td>
        <td className="prospect-actions">
          {candidate.url && (
            <button
              onClick={handleOpenUrl}
              className="icon-button icon-button-small"
              title="Open URL"
            >
              <ArrowSquareOut />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="icon-button icon-button-small"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <CaretUp /> : <CaretDown />}
          </button>
        </td>
      </motion.tr>
      <AnimatePresence>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="prospect-expanded-row"
          >
            <td colSpan={totalColumns}>
              <div className="prospect-expanded-content">
                {candidate.description && (
                  <div className="expanded-section">
                    <h4>Description</h4>
                    <p>{candidate.description}</p>
                  </div>
                )}
                {candidate.url && (
                  <div className="expanded-section">
                    <h4>Primary URL</h4>
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="expanded-link"
                    >
                      <LinkIcon />
                      {candidate.url}
                    </a>
                  </div>
                )}
                {/* Show detailed match results in expanded view */}
                {matchResults && Object.keys(matchResults).length > 0 && (
                  <div className="expanded-section">
                    <h4>Match Condition Results</h4>
                    <div className="match-results-grid">
                      {matchConditions.map((condition) => {
                        const result = matchResults[condition.name] as MatchResultValue | undefined
                        return (
                          <div key={condition.name} className="match-result-item">
                            <strong>{condition.name.replace(/_/g, " ")}:</strong>
                            <MatchResultCell result={result} />
                            {result?.reasoning && (
                              <p className="match-reasoning">{result.reasoning}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {candidate.sources && candidate.sources.length > 0 && (
                  <div className="expanded-section">
                    <h4>Sources ({candidate.sources.length})</h4>
                    <ul className="sources-list">
                      {candidate.sources.slice(0, 5).map((source, i) => (
                        <li key={i}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-link"
                          >
                            <LinkIcon />
                            {source.title || source.url}
                          </a>
                          {source.reasoning && (
                            <span className="source-reasoning">
                              {source.reasoning}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
}

// ============================================================================
// MAIN VIEW
// ============================================================================

export function DiscoveryDetailView({
  jobId,
  initialJob,
}: {
  jobId: string
  initialJob: DiscoveryJob
}) {
  const queryClient = useQueryClient()
  const router = useTransitionRouter()
  const [isStarting, setIsStarting] = useState(false)

  // Fetch job details with candidates
  const { data, isLoading, refetch } = useQuery<DiscoveryJobDetailResponse>({
    queryKey: ["discovery-job", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/discovery/${jobId}`)
      if (!res.ok) throw new Error("Failed to fetch job details")
      return res.json()
    },
    initialData: {
      job: initialJob,
      candidates: [],
      progress: { percentage: 0 },
    },
    refetchInterval: (query) => {
      const job = query.state.data?.job
      return job?.status === "running" || job?.status === "queued" ? 3000 : false
    },
  })

  const job = data?.job || initialJob
  const candidates = data?.candidates || []
  const matchedCandidates = candidates.filter((c) => c.status === "matched")

  // Start mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/discovery/${jobId}/start`, { method: "POST" })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to start discovery")
      }
      return res.json()
    },
    onSuccess: () => {
      refetch()
      toast({ title: "Discovery started" })
    },
    onError: (error: Error) => {
      refetch()
      toast({ title: "Discovery failed", description: error.message, status: "error" })
    },
  })

  const handleStart = async () => {
    setIsStarting(true)
    try {
      await startMutation.mutateAsync()
    } finally {
      setIsStarting(false)
    }
  }

  const handleExport = async () => {
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

  return (
    <div className="batch-app-container">
      {/* Header - matching main labs design */}
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
          <Link href="/labs" className="batch-nav-link">Labs</Link>
          <span className="batch-header-divider">/</span>
          <Link href="/labs/discover" className="batch-nav-link">Deep Research</Link>
          <span className="batch-header-divider">/</span>
          <h1>{job.name}</h1>
          <StatusBadge status={job.status} />
        </div>
        <div className="batch-header-right">
          {job.status === "completed" && matchedCandidates.length > 0 && (
            <button onClick={handleExport} className="flat-button">
              <Download />
              Export CSV
            </button>
          )}
        </div>
      </header>

      <div className="batch-app-body batch-app-body-full">
        {/* Main Content */}
        <div className="app-body-main-content">
          {/* Status Cards */}
          <section className="status-cards-section">
            <div className="status-cards-grid">
              <StatusCard
                label="Matched"
                value={job.matched_count || 0}
                variant="success"
              />
              <StatusCard
                label="Unmatched"
                value={job.unmatched_count || 0}
                variant="default"
              />
              <StatusCard
                label="Total Candidates"
                value={job.total_candidates || 0}
                variant="info"
              />
            </div>
          </section>

          {/* Job Info */}
          <section className="job-info-section">
            <div className="job-info-card">
              <h3>Objective</h3>
              <p>{job.objective}</p>
              {job.location && (
                <div className="job-location">
                  <MapPin />
                  <span>{job.location}</span>
                </div>
              )}
            </div>

            <div className="job-info-card">
              <h3>Match Conditions</h3>
              <ul className="conditions-list">
                {job.match_conditions?.map((condition, i) => (
                  <li key={i}>
                    <strong>{condition.name}:</strong> {condition.description}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Error Display */}
          {job.error_message && (
            <section className="error-section">
              <div className="error-box">
                <WarningCircle />
                <span>{job.error_message}</span>
              </div>
            </section>
          )}

          {/* Start Button for Pending Jobs */}
          {job.status === "pending" && (
            <section className="start-section">
              <div className="start-card">
                <h3>Ready to Discover</h3>
                <p>
                  Click the button below to start discovering prospects matching
                  your criteria. This may take 1-2 minutes.
                </p>
                <ResearchPlayButton
                  onClick={handleStart}
                  isProcessing={isStarting || startMutation.isPending}
                  disabled={isStarting || startMutation.isPending}
                />
              </div>
            </section>
          )}

          {/* Running State */}
          {(job.status === "running" || job.status === "queued") && (
            <section className="running-section">
              <div className="running-card">
                <Spinner className="animate-spin running-spinner" />
                <h3>Discovery in Progress</h3>
                <p>
                  AI is searching for prospects matching your criteria. This
                  typically takes 1-2 minutes.
                </p>
              </div>
            </section>
          )}

          {/* Candidates Table */}
          {candidates.length > 0 && (
            <section className="prospects-section">
              <div className="prospects-header">
                <h2>
                  Discovered Prospects ({matchedCandidates.length} matched)
                </h2>
              </div>
              <div className="prospects-table-container">
                <table className="prospects-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Description</th>
                      {/* Dynamic columns for each match condition */}
                      {(job.match_conditions || []).map((condition) => (
                        <th
                          key={condition.name}
                          className="condition-header"
                          title={condition.description}
                        >
                          {condition.name.replace(/_/g, " ")}
                        </th>
                      ))}
                      <th>Status</th>
                      <th>Sources</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate, index) => (
                      <CandidateRow
                        key={candidate.id}
                        candidate={candidate}
                        index={index}
                        matchConditions={job.match_conditions || []}
                        totalColumns={6 + (job.match_conditions?.length || 0)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Empty State for Completed with No Results */}
          {job.status === "completed" && candidates.length === 0 && (
            <section className="empty-section">
              <div className="empty-card">
                <Binoculars className="empty-icon" />
                <h3>No Prospects Found</h3>
                <p>
                  The discovery didn&apos;t find any prospects matching your criteria.
                  Try adjusting your objective or match conditions.
                </p>
                <Link href="/labs/discover" className="flat-button">
                  Create New Discovery
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
