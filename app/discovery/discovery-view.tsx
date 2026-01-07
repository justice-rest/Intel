"use client"

/**
 * Discovery View Component
 *
 * Main client component for the Prospect Discovery feature.
 * Allows users to describe ideal donors and discover matching prospects.
 *
 * @module app/discovery/discovery-view
 */

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useTransitionRouter } from "@/lib/transitions"
import { cn } from "@/lib/utils"
import {
  Binoculars,
  MagnifyingGlass,
  Spinner,
  CheckCircle,
  WarningCircle,
  CaretLeft,
  CaretRight,
  Check,
  X,
  Bank,
  Buildings,
  FirstAid,
  UserCircle,
  Users,
  Cpu,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

import "@/app/labs/batch-dashboard.css"

import {
  DISCOVERY_TEMPLATES,
  DEFAULT_DISCOVERY_CONFIG,
  fillTemplatePlaceholders,
  validatePlaceholderValues,
  type DiscoveryTemplate,
  type DiscoveredProspect,
  type DiscoveryResult,
} from "@/lib/discovery"

// ============================================================================
// ICON MAPPING
// ============================================================================

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  Cpu: Cpu,
  Bank: Bank,
  Buildings: Buildings,
  FirstAid: FirstAid,
  UserCircle: UserCircle,
  Users: Users,
}

function getTemplateIcon(iconName?: string): React.ElementType {
  if (iconName && TEMPLATE_ICONS[iconName]) {
    return TEMPLATE_ICONS[iconName]
  }
  return Binoculars
}

// ============================================================================
// TEMPLATE TILE COMPONENT (matches ServiceTile from batch-view)
// ============================================================================

function TemplateTile({
  template,
  onSelect,
}: {
  template: DiscoveryTemplate
  onSelect: (template: DiscoveryTemplate) => void
}) {
  const Icon = getTemplateIcon(template.icon)
  const variantMap: Record<string, string> = {
    business: "olive",
    philanthropy: "green",
    wealth: "gray",
    demographics: "olive",
  }
  const variant = variantMap[template.category] || "olive"

  return (
    <article className={cn("tile", `tile-${variant}`)} onClick={() => onSelect(template)}>
      <div className="tile-header">
        <Icon className="tile-icon" weight="light" />
        <h3>
          <span>{template.title}</span>
          <span>{template.description}</span>
        </h3>
      </div>
      <button onClick={() => onSelect(template)}>
        <span>Use Template</span>
        <span className="icon-button">
          <CaretRight weight="bold" />
        </span>
      </button>
    </article>
  )
}

// ============================================================================
// PROSPECT CARD COMPONENT
// ============================================================================

function ProspectCard({
  prospect,
  selected,
  onToggle,
}: {
  prospect: DiscoveredProspect
  selected: boolean
  onToggle: () => void
}) {
  const confidenceColors = {
    high: "var(--c-green-500)",
    medium: "var(--c-yellow-500)",
    low: "var(--c-gray-400)",
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn("prospect-card", selected && "prospect-card-selected")}
      onClick={onToggle}
    >
      <div className="prospect-card-checkbox">
        {selected ? (
          <CheckCircle size={20} weight="fill" className="text-green-500" />
        ) : (
          <div className="prospect-card-checkbox-empty" />
        )}
      </div>
      <div className="prospect-card-content">
        <div className="prospect-card-header">
          <h4 className="prospect-card-name">{prospect.name}</h4>
          <span
            className="prospect-card-confidence"
            style={{ color: confidenceColors[prospect.confidence] }}
          >
            {prospect.confidence}
          </span>
        </div>
        {(prospect.title || prospect.company) && (
          <p className="prospect-card-details">
            {prospect.title}
            {prospect.title && prospect.company && " at "}
            {prospect.company}
          </p>
        )}
        {(prospect.city || prospect.state) && (
          <p className="prospect-card-location">
            {[prospect.city, prospect.state].filter(Boolean).join(", ")}
          </p>
        )}
        {prospect.matchReasons.length > 0 && (
          <p className="prospect-card-reason">{prospect.matchReasons[0]}</p>
        )}
      </div>
      {prospect.sources.length > 0 && (
        <div className="prospect-card-sources">
          <span className="source-count">{prospect.sources.length} source{prospect.sources.length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </motion.div>
  )
}

// ============================================================================
// TEMPLATE FILL MODAL
// ============================================================================

function TemplateFillModal({
  template,
  onClose,
  onSubmit,
}: {
  template: DiscoveryTemplate
  onClose: () => void
  onSubmit: (filledPrompt: string) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const p of template.placeholders || []) {
      initial[p.key] = p.defaultValue || ""
    }
    return initial
  })
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = () => {
    const validation = validatePlaceholderValues(template, values)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    try {
      const filled = fillTemplatePlaceholders(template, values)
      onSubmit(filled)
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Failed to fill template"])
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-content">
        <DialogHeader>
          <DialogTitle>{template.title}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="mapping-form">
          {(template.placeholders || []).map((placeholder) => (
            <div key={placeholder.key} className="mapping-row">
              <label className="mapping-label">
                {placeholder.label}
                {placeholder.required && <span className="required-star">*</span>}
              </label>
              <input
                type="text"
                className="mapping-input"
                placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                value={values[placeholder.key] || ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [placeholder.key]: e.target.value }))
                }
              />
            </div>
          ))}

          {errors.length > 0 && (
            <div className="validation-errors">
              {errors.map((error, i) => (
                <p key={i} className="validation-error">
                  <WarningCircle size={14} /> {error}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <button className="flat-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={handleSubmit}>
            Use Template
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// CONFIRM BATCH MODAL
// ============================================================================

function ConfirmBatchModal({
  selectedProspects,
  onClose,
  onConfirm,
  isCreating,
}: {
  selectedProspects: DiscoveredProspect[]
  onClose: () => void
  onConfirm: () => void
  isCreating: boolean
}) {
  const estimatedCost = (selectedProspects.length * DEFAULT_DISCOVERY_CONFIG.costPerEnrichmentCents / 100).toFixed(2)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-content">
        <DialogHeader>
          <DialogTitle>Create Batch Job</DialogTitle>
          <DialogDescription>
            Start enrichment research on {selectedProspects.length} prospect{selectedProspects.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="confirm-batch-content">
          <div className="confirm-batch-summary">
            <div className="summary-row">
              <span>Prospects selected</span>
              <span className="summary-value">{selectedProspects.length}</span>
            </div>
            <div className="summary-row">
              <span>Estimated enrichment cost</span>
              <span className="summary-value">~${estimatedCost}</span>
            </div>
          </div>

          <div className="confirm-batch-prospects">
            <h4>Selected Prospects:</h4>
            <ul>
              {selectedProspects.slice(0, 5).map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
              {selectedProspects.length > 5 && (
                <li className="more-prospects">+{selectedProspects.length - 5} more</li>
              )}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <button className="flat-button" onClick={onClose} disabled={isCreating}>
            Cancel
          </button>
          <button className="primary-button" onClick={onConfirm} disabled={isCreating}>
            {isCreating ? (
              <>
                <Spinner className="animate-spin" size={16} />
                Creating...
              </>
            ) : (
              <>Create Batch Job</>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// MAIN DISCOVERY VIEW COMPONENT
// ============================================================================

export function DiscoveryView() {
  const router = useTransitionRouter()

  // ========================================================================
  // STATE
  // ========================================================================

  const [prompt, setPrompt] = useState("")
  const [maxResults, setMaxResults] = useState(DEFAULT_DISCOVERY_CONFIG.defaultResults)
  const [selectedTemplate, setSelectedTemplate] = useState<DiscoveryTemplate | null>(null)
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isCreatingBatch, setIsCreatingBatch] = useState(false)

  // ========================================================================
  // QUERIES
  // ========================================================================

  // Fetch discovery status and limits
  const { data: discoveryStatus } = useQuery({
    queryKey: ["discovery-status"],
    queryFn: async () => {
      const res = await fetch("/api/discovery")
      if (!res.ok) throw new Error("Failed to fetch status")
      return res.json()
    },
    staleTime: 60000,
  })

  // ========================================================================
  // MUTATIONS
  // ========================================================================

  // Discovery search mutation
  const searchMutation = useMutation({
    mutationFn: async (searchPrompt: string) => {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: searchPrompt,
          maxResults,
        }),
      })

      const data: DiscoveryResult = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Search failed")
      }

      return data
    },
    onSuccess: (data) => {
      setResult(data)
      setSelectedProspectIds(new Set())

      if (data.prospects.length === 0) {
        toast({
          title: "No prospects found",
          description: "Try broadening your search criteria",
          status: "info",
        })
      } else {
        toast({
          title: `Found ${data.prospects.length} prospects`,
          description: `Search completed in ${(data.durationMs / 1000).toFixed(1)}s`,
          status: "success",
        })
      }
    },
    onError: (error) => {
      toast({
        title: "Search failed",
        description: error.message,
        status: "error",
      })
    },
  })

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleTemplateSelect = useCallback((template: DiscoveryTemplate) => {
    if (template.placeholders && template.placeholders.length > 0) {
      setSelectedTemplate(template)
    } else {
      setPrompt(template.prompt)
      toast({
        title: "Template loaded",
        description: "Customize the prompt or click Discover to search",
      })
    }
  }, [])

  const handleTemplateFill = useCallback((filledPrompt: string) => {
    setPrompt(filledPrompt)
    setSelectedTemplate(null)
    toast({
      title: "Template applied",
      description: "Click Discover to find matching prospects",
    })
  }, [])

  const handleSearch = useCallback(() => {
    if (prompt.trim().length < 10) {
      toast({
        title: "Prompt too short",
        description: "Please enter at least 10 characters",
        status: "error",
      })
      return
    }

    searchMutation.mutate(prompt)
  }, [prompt, searchMutation])

  const handleProspectToggle = useCallback((prospectId: string) => {
    setSelectedProspectIds((prev) => {
      const next = new Set(prev)
      if (next.has(prospectId)) {
        next.delete(prospectId)
      } else {
        next.add(prospectId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (!result) return
    if (selectedProspectIds.size === result.prospects.length) {
      setSelectedProspectIds(new Set())
    } else {
      setSelectedProspectIds(new Set(result.prospects.map((p) => p.id)))
    }
  }, [result, selectedProspectIds.size])

  const handleCreateBatch = useCallback(async () => {
    if (!result || selectedProspectIds.size === 0) return

    setIsCreatingBatch(true)

    try {
      const selectedProspects = result.prospects.filter((p) =>
        selectedProspectIds.has(p.id)
      )

      // Transform to batch format
      const prospects = selectedProspects.map((p) => ({
        name: p.name,
        city: p.city || undefined,
        state: p.state || undefined,
        company: p.company || undefined,
        title: p.title || undefined,
        notes: p.matchReasons.join("; "),
      }))

      // Create batch job
      const res = await fetch("/api/batch-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Discovery - ${new Date().toLocaleDateString()}`,
          prospects,
          source_file_name: "prospect-discovery",
          settings: {
            enable_web_search: true,
            generate_romy_score: true,
          },
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create batch job")
      }

      const { job } = await res.json()

      toast({
        title: "Batch job created",
        description: `Created job with ${selectedProspects.length} prospects`,
      })

      // Navigate to job detail
      router.push(`/labs/${job.id}`)
    } catch (error) {
      toast({
        title: "Failed to create batch",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
      })
    } finally {
      setIsCreatingBatch(false)
      setShowConfirmModal(false)
    }
  }, [result, selectedProspectIds, router])

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const selectedProspects = useMemo(() => {
    if (!result) return []
    return result.prospects.filter((p) => selectedProspectIds.has(p.id))
  }, [result, selectedProspectIds])

  const estimatedSearchCost = useMemo(() => {
    return (DEFAULT_DISCOVERY_CONFIG.costPerSearchCents / 100).toFixed(2)
  }, [])

  const isSearching = searchMutation.isPending

  // ========================================================================
  // RENDER
  // ========================================================================

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
          <h1>Prospect Discovery</h1>
        </div>
        <div className="batch-header-right">
          <Link href="/labs" className="flat-button">
            <CaretLeft size={16} />
            Back to Labs
          </Link>
        </div>
      </header>

      <div className="batch-app-body">
        {/* Main Content */}
        <div className="app-body-main-content">
          {/* Templates Section */}
          {!result && (
            <section className="service-section">
              <h2>Quick Templates</h2>
              <div className="tiles">
                {DISCOVERY_TEMPLATES.slice(0, 3).map((template) => (
                  <TemplateTile
                    key={template.id}
                    template={template}
                    onSelect={handleTemplateSelect}
                  />
                ))}
              </div>
              <div className="tiles" style={{ marginTop: "1rem" }}>
                {DISCOVERY_TEMPLATES.slice(3, 6).map((template) => (
                  <TemplateTile
                    key={template.id}
                    template={template}
                    onSelect={handleTemplateSelect}
                  />
                ))}
              </div>
              <div className="service-section-footer">
                <p>Or write your own custom prompt below to find matching prospects.</p>
              </div>
            </section>
          )}

          {/* Search Section */}
          <section className="transfer-section">
            <div className="transfer-section-header">
              <h2>{result ? "Refine Search" : "Custom Search"}</h2>
              <div className="filter-options">
                <p>Up to {maxResults} prospects • ~${estimatedSearchCost} per search</p>
              </div>
            </div>
            <div className="transfer-section-controls">
              <div className="match-limit-slider">
                <label>Max results:</label>
                <input
                  type="range"
                  className="slider"
                  min={DEFAULT_DISCOVERY_CONFIG.minResultsLimit}
                  max={DEFAULT_DISCOVERY_CONFIG.maxResultsLimit}
                  value={maxResults}
                  onChange={(e) => setMaxResults(parseInt(e.target.value, 10))}
                  disabled={isSearching}
                />
                <span className="match-limit-value">{maxResults}</span>
              </div>
              <button
                className="flat-button"
                onClick={handleSearch}
                disabled={isSearching || prompt.trim().length < 10}
              >
                {isSearching ? (
                  <>
                    <Spinner className="animate-spin" size={16} />
                    Searching...
                  </>
                ) : (
                  <>
                    <MagnifyingGlass size={16} />
                    Discover
                  </>
                )}
              </button>
            </div>
            <div className="transfers">
              <textarea
                className="discovery-prompt-input"
                placeholder="Describe the type of donors you're looking for. For example: 'Technology executives in San Francisco who have donated to education causes and serve on nonprofit boards.'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                disabled={isSearching}
              />
            </div>
          </section>

          {/* Results Section */}
          {result && result.prospects.length > 0 && (
            <section className="transfer-section">
              <div className="transfer-section-header">
                <h2>Discovered Prospects</h2>
                <div className="filter-options">
                  <p>{result.prospects.length} found • {selectedProspectIds.size} selected</p>
                  <button className="icon-button" onClick={handleSelectAll} title={selectedProspectIds.size === result.prospects.length ? "Deselect all" : "Select all"}>
                    {selectedProspectIds.size === result.prospects.length ? <X /> : <Check />}
                  </button>
                </div>
              </div>
              <div className="transfer-section-controls">
                {result.warnings && result.warnings.length > 0 && (
                  <p className="warning-message">
                    <WarningCircle size={14} /> {result.warnings[0]}
                  </p>
                )}
                <button
                  className="flat-button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={selectedProspectIds.size === 0}
                >
                  Create Batch Job
                </button>
              </div>
              <div className="transfers">
                <AnimatePresence mode="popLayout">
                  {result.prospects.map((prospect) => (
                    <ProspectCard
                      key={prospect.id}
                      prospect={prospect}
                      selected={selectedProspectIds.has(prospect.id)}
                      onToggle={() => handleProspectToggle(prospect.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Empty Results */}
          {result && result.prospects.length === 0 && (
            <section className="service-section">
              <div className="empty-state">
                <MagnifyingGlass size={48} />
                <h3>No prospects found</h3>
                <p>Try broadening your search criteria or using different keywords.</p>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="app-body-sidebar">
          <section className="payment-section">
            <div className="payment-section-header">
              <h2>Discovery Tips</h2>
              <div>
                <span className="plan-badge">AI Search</span>
              </div>
            </div>

            <div className="faq">
              <p>Write a detailed prompt describing your ideal prospects</p>
              <ul className="discovery-tips-list">
                <li>Be specific about location (city and state)</li>
                <li>Include industry or sector keywords</li>
                <li>Mention philanthropic interests or board types</li>
                <li>Reference wealth indicators</li>
              </ul>
            </div>

            {/* Stats cards */}
            <div className="payments">
              <div className="payment">
                <div className="card card-green">
                  <span>Left</span>
                  <span>{discoveryStatus?.rateLimit?.remaining ?? "..."}</span>
                </div>
                <div className="payment-details">
                  <h3>Searches</h3>
                  <div>
                    <span>per hour</span>
                  </div>
                </div>
              </div>
              <div className="payment">
                <div className="card card-olive">
                  <span>Max</span>
                  <span>{DEFAULT_DISCOVERY_CONFIG.maxResultsLimit}</span>
                </div>
                <div className="payment-details">
                  <h3>Prospects</h3>
                  <div>
                    <span>per search</span>
                  </div>
                </div>
              </div>
              <div className="payment">
                <div className="card card-gray">
                  <span>Cost</span>
                  <span>~2¢</span>
                </div>
                <div className="payment-details">
                  <h3>Per Search</h3>
                  <div>
                    <span>estimate</span>
                  </div>
                </div>
              </div>
            </div>

            {result && (
              <div className="payment-section-footer">
                <p className="discovery-stats-summary">
                  Found {result.prospects.length} prospects in {(result.durationMs / 1000).toFixed(1)}s
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Template Fill Modal */}
      {selectedTemplate && (
        <TemplateFillModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSubmit={handleTemplateFill}
        />
      )}

      {/* Confirm Batch Modal */}
      {showConfirmModal && (
        <ConfirmBatchModal
          selectedProspects={selectedProspects}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleCreateBatch}
          isCreating={isCreatingBatch}
        />
      )}
    </div>
  )
}
