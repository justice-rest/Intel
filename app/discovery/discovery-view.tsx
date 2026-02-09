"use client"

/* eslint-disable @next/next/no-img-element */

/**
 * Discovery View Component
 *
 * Main client component for the Prospect Discovery feature.
 * Styled to match the dark-uibank-dashboard-concept design.
 * Redesigned for smoother, more intuitive UX.
 *
 * @module app/discovery/discovery-view
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import { useTransitionRouter } from "@/lib/transitions"
import { cn } from "@/lib/utils"
import { generateDiceBearAvatar } from "@/lib/utils/avatar"
import {
  Binoculars,
  MagnifyingGlass,
  Spinner,
  WarningCircle,
  CaretRight,
  Check,
  X,
  Bank,
  Buildings,
  FirstAid,
  UserCircle,
  Users,
  Cpu,
  Plus,
  Lightning,
  ArrowRight,
  Flask,
  Info,
  Infinity,
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
// TEMPLATE TILE COMPONENT (Expandable inline)
// ============================================================================

function TemplateTile({
  template,
  isExpanded,
  onToggle,
  onApply,
  variant = "olive",
}: {
  template: DiscoveryTemplate
  isExpanded: boolean
  onToggle: () => void
  onApply: (filledPrompt: string) => void
  variant?: "olive" | "green" | "gray"
}) {
  const Icon = getTemplateIcon(template.icon)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const p of template.placeholders || []) {
      initial[p.key] = p.defaultValue || ""
    }
    return initial
  })
  const [errors, setErrors] = useState<string[]>([])
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Focus first input when expanded
  useEffect(() => {
    if (isExpanded && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100)
    }
  }, [isExpanded])

  const hasPlaceholders = (template.placeholders?.length ?? 0) > 0

  const handleApply = () => {
    if (!hasPlaceholders) {
      onApply(template.prompt)
      return
    }

    const validation = validatePlaceholderValues(template, values)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    try {
      const filled = fillTemplatePlaceholders(template, values)
      onApply(filled)
      setErrors([])
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Failed to fill template"])
    }
  }

  const handleClick = () => {
    if (!hasPlaceholders) {
      // No placeholders, apply immediately
      onApply(template.prompt)
    } else {
      // Has placeholders, toggle expansion
      onToggle()
    }
  }

  return (
    <article className={cn("tile", `tile-${variant}`, isExpanded && "tile-expanded")}>
      <div className="tile-header" onClick={handleClick} style={{ cursor: "pointer" }}>
        <Icon className="tile-icon" weight="light" />
        <h3>
          <span>{template.title}</span>
          <span>{template.description}</span>
        </h3>
      </div>

      <AnimatePresence>
        {isExpanded && hasPlaceholders && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="tile-expansion"
          >
            <div className="tile-form">
              {template.placeholders?.map((placeholder, idx) => (
                <div key={placeholder.key} className="tile-field">
                  <label>
                    {placeholder.label}
                    {placeholder.required && <span className="required-star">*</span>}
                  </label>
                  <input
                    ref={idx === 0 ? firstInputRef : undefined}
                    type="text"
                    placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                    value={values[placeholder.key] || ""}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, [placeholder.key]: e.target.value }))
                      setErrors([])
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleApply()
                      }
                    }}
                  />
                </div>
              ))}
              {errors.length > 0 && (
                <div className="tile-errors">
                  {errors.map((error, i) => (
                    <span key={i}><WarningCircle size={12} /> {error}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={isExpanded ? handleApply : handleClick}>
        <span>{isExpanded ? "Apply Template" : "Use Template"}</span>
        <span className="icon-button">
          {isExpanded ? <ArrowRight weight="bold" /> : <CaretRight weight="bold" />}
        </span>
      </button>
    </article>
  )
}

// ============================================================================
// PROSPECT ITEM (Transfer-style row)
// ============================================================================


function ProspectItem({
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
    medium: "var(--c-olive-500)",
    low: "var(--c-gray-400)",
  }

  // Use prospect ID or name as seed for unique avatar
  const avatarSeed = prospect.id || prospect.name
  const avatarUrl = generateDiceBearAvatar(avatarSeed)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="transfer"
      onClick={onToggle}
      style={{ cursor: "pointer" }}
    >
      <div className="transfer-logo transfer-logo-avatar">
        {/* DiceBear Avatar */}
        <img
          src={avatarUrl}
          alt={prospect.name}
          className="transfer-avatar-img"
        />
        {/* Selection overlay - only shows checkmark on the avatar */}
        <AnimatePresence>
          {selected && (
            <motion.div
              className="transfer-avatar-selected"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
            >
              <Check size={20} weight="bold" color="var(--c-gray-900)" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <dl className="transfer-details">
        <div>
          <dt>{prospect.name}</dt>
          <dd>{prospect.title || "Prospect"}</dd>
        </div>
        <div>
          <dt>{prospect.company || "—"}</dt>
          <dd>Organization</dd>
        </div>
        <div>
          <dt>{[prospect.city, prospect.state].filter(Boolean).join(", ") || "—"}</dt>
          <dd>Location</dd>
        </div>
      </dl>
      <div className="transfer-number" style={{ color: confidenceColors[prospect.confidence] }}>
        {prospect.confidence}
      </div>
    </motion.div>
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
  const estimatedCost = (
    (selectedProspects.length * DEFAULT_DISCOVERY_CONFIG.costPerEnrichmentCents) /
    100
  ).toFixed(2)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-content">
        <DialogHeader>
          <DialogTitle>Create Batch Job</DialogTitle>
          <DialogDescription>
            Start enrichment research on {selectedProspects.length} prospect
            {selectedProspects.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="payments" style={{ marginTop: "1.5rem" }}>
          <div className="payment">
            <div className="card card-green">
              <span>Count</span>
              <span>{selectedProspects.length}</span>
            </div>
            <div className="payment-details">
              <h3>Selected Prospects</h3>
              <div>
                <span>Ready to enrich</span>
              </div>
            </div>
          </div>
          <div className="payment">
            <div className="card card-olive">
              <span>Cost</span>
              <span>${estimatedCost}</span>
            </div>
            <div className="payment-details">
              <h3>Estimated</h3>
              <div>
                <span>~4¢ per prospect</span>
              </div>
            </div>
          </div>
        </div>

        <div className="payment-section-footer">
          <button className="save-button" onClick={onClose} disabled={isCreating}>
            Cancel
          </button>
          <button
            className="flat-button"
            onClick={onConfirm}
            disabled={isCreating}
            style={{ marginLeft: "1rem" }}
          >
            {isCreating ? (
              <>
                <Spinner className="animate-spin" size={16} style={{ marginRight: "0.5rem" }} />
                Creating...
              </>
            ) : (
              "Create Batch Job"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// MAIN DISCOVERY VIEW COMPONENT
// ============================================================================

export function DiscoveryView() {
  const router = useTransitionRouter()
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  // State
  const [prompt, setPrompt] = useState("")
  const [maxResults, setMaxResults] = useState(DEFAULT_DISCOVERY_CONFIG.defaultResults)
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null)
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isCreatingBatch, setIsCreatingBatch] = useState(false)
  const [deepResearch, setDeepResearch] = useState(false)

  // Queries
  const { data: discoveryStatus } = useQuery({
    queryKey: ["discovery-status"],
    queryFn: async () => {
      const res = await fetch("/api/discovery")
      if (!res.ok) throw new Error("Failed to fetch status")
      return res.json()
    },
    staleTime: 60000,
  })

  // Get user plan for Deep Research feature gating
  const { data: userPlanData } = useQuery({
    queryKey: ["user-plan"],
    queryFn: async () => {
      const res = await fetch("/api/user-plan")
      if (!res.ok) return { plan: null }
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Check if user can use Deep Research (Pro or Scale plan only)
  const canUseDeepResearch = userPlanData?.plan === "pro" || userPlanData?.plan === "scale"

  // Deep Research max is 5 prospects
  const effectiveMaxResults = deepResearch ? Math.min(maxResults, 5) : maxResults

  // Mutations
  const searchMutation = useMutation({
    mutationFn: async (searchPrompt: string) => {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: searchPrompt,
          maxResults: effectiveMaxResults,
          deepResearch: deepResearch && canUseDeepResearch,
        }),
      })
      const data: DiscoveryResult = await res.json()
      if (!res.ok) throw new Error(data.error || "Search failed")
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
      toast({ title: "Search failed", description: error.message, status: "error" })
    },
  })

  // Handlers
  const handleTemplateApply = useCallback(
    (filledPrompt: string) => {
      setPrompt(filledPrompt)
      setExpandedTemplateId(null)
      toast({ title: "Template applied", description: "Click Search or press Enter to find prospects" })
      // Focus the search button for easy execution
      setTimeout(() => searchButtonRef.current?.focus(), 100)
    },
    []
  )

  const handleSearch = useCallback(() => {
    if (prompt.trim().length < 10) {
      toast({
        title: "Prompt too short",
        description: "Please enter at least 10 characters",
        status: "error",
      })
      promptInputRef.current?.focus()
      return
    }
    searchMutation.mutate(prompt)
  }, [prompt, searchMutation])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSearch()
      }
    },
    [handleSearch]
  )

  const handleProspectToggle = useCallback((prospectId: string) => {
    setSelectedProspectIds((prev) => {
      const next = new Set(prev)
      if (next.has(prospectId)) next.delete(prospectId)
      else next.add(prospectId)
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
      const selectedProspects = result.prospects.filter((p) => selectedProspectIds.has(p.id))
      const prospects = selectedProspects.map((p) => ({
        name: p.name,
        city: p.city || undefined,
        state: p.state || undefined,
        company: p.company || undefined,
        title: p.title || undefined,
        notes: p.matchReasons.join("; "),
      }))

      const res = await fetch("/api/batch-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Discovery - ${new Date().toLocaleDateString()}`,
          prospects,
          source_file_name: "prospect-discovery",
          settings: { enable_web_search: true, generate_romy_score: true },
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

  const handleClearResults = useCallback(() => {
    setResult(null)
    setSelectedProspectIds(new Set())
    setPrompt("")
    promptInputRef.current?.focus()
  }, [])

  // Computed
  const selectedProspects = useMemo(() => {
    if (!result) return []
    return result.prospects.filter((p) => selectedProspectIds.has(p.id))
  }, [result, selectedProspectIds])

  const isSearching = searchMutation.isPending

  // Template variants cycling
  const templateVariants: Array<"olive" | "green" | "gray"> = ["olive", "green", "gray"]

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
          <Link href="/labs" className="batch-breadcrumb-link">Labs</Link>
          <span className="batch-header-divider">/</span>
          <h1>Discovery</h1>
        </div>
        <div className="batch-header-right">
          <Link href="/labs" className="flat-button">
            Back to Labs
          </Link>
        </div>
      </header>

      <div className="batch-app-body">
        {/* Main Content */}
        <div className="app-body-main-content">
          {/* Search Section */}
          <section className="service-section">
            <h2>Prospect Discovery</h2>

            {/* Search Area */}
            <div className="discovery-search-area">
              <textarea
                ref={promptInputRef}
                className="discovery-search-textarea"
                placeholder="Describe your ideal prospects...&#10;&#10;Examples:&#10;• Find tech executives in Austin, TX who support education causes&#10;• Look for foundation board members in California&#10;• Search for retired Fortune 500 executives in New York"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSearching}
                rows={4}
              />
              <div className="discovery-search-controls">
                <div className="discovery-search-options">
                  <label>
                    <span>Max results:</span>
                    <select
                      value={deepResearch ? Math.min(maxResults, 5) : maxResults}
                      onChange={(e) => setMaxResults(parseInt(e.target.value, 10))}
                      disabled={isSearching}
                    >
                      {deepResearch ? (
                        // Deep Research limited to 5 max
                        <>
                          <option value="3">3</option>
                          <option value="5">5</option>
                        </>
                      ) : (
                        <>
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="15">15</option>
                          <option value="20">20</option>
                          <option value="25">25</option>
                        </>
                      )}
                    </select>
                  </label>
                  {/* Deep Research Toggle - only for Growth/Scale plans */}
                  {canUseDeepResearch && (
                    <label className="discovery-deep-research-toggle" title="Deep Research uses LinkUp's deep mode for more thorough results. Limited to once per day, max 5 prospects. (Beta)">
                      <input
                        type="checkbox"
                        checked={deepResearch}
                        onChange={(e) => {
                          setDeepResearch(e.target.checked)
                          // Cap max results when enabling deep research
                          if (e.target.checked && maxResults > 5) {
                            setMaxResults(5)
                          }
                        }}
                        disabled={isSearching}
                      />
                      <span className="discovery-deep-research-label">
                        <Flask size={14} weight="fill" />
                        Deep Research
                        <span className="discovery-beta-badge" title="This feature is in beta. Limited to once per day with max 5 prospects.">
                          <Info size={12} weight="fill" />
                          Beta
                        </span>
                      </span>
                    </label>
                  )}
                  <span className="discovery-search-hint">⌘+Enter to search</span>
                </div>
                <button
                  ref={searchButtonRef}
                  className={cn("discovery-search-button", isSearching && "is-loading")}
                  onClick={handleSearch}
                  disabled={isSearching || prompt.trim().length < 10}
                >
                  {isSearching ? (
                    <>
                      <Spinner className="animate-spin" size={18} />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Lightning weight="fill" size={18} />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Templates - shown when no results */}
            {!result && (
              <>
                <div className="service-section-footer" style={{ marginBottom: "1rem" }}>
                  <p>Or choose a template below to get started:</p>
                </div>
                <div className="tiles">
                  {DISCOVERY_TEMPLATES.slice(0, 3).map((template, i) => (
                    <TemplateTile
                      key={template.id}
                      template={template}
                      isExpanded={expandedTemplateId === template.id}
                      onToggle={() =>
                        setExpandedTemplateId(
                          expandedTemplateId === template.id ? null : template.id
                        )
                      }
                      onApply={handleTemplateApply}
                      variant={templateVariants[i % 3]}
                    />
                  ))}
                </div>
                <div className="tiles">
                  {DISCOVERY_TEMPLATES.slice(3, 6).map((template, i) => (
                    <TemplateTile
                      key={template.id}
                      template={template}
                      isExpanded={expandedTemplateId === template.id}
                      onToggle={() =>
                        setExpandedTemplateId(
                          expandedTemplateId === template.id ? null : template.id
                        )
                      }
                      onApply={handleTemplateApply}
                      variant={templateVariants[i % 3]}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Results Section */}
          {result && result.prospects.length > 0 && (
            <section className="transfer-section">
              <div className="transfer-section-header">
                <h2>Discovered Prospects</h2>
                <div className="filter-options">
                  <p>
                    {selectedProspectIds.size} of {result.prospects.length} selected
                  </p>
                  <button
                    className="icon-button"
                    onClick={handleSelectAll}
                    title={selectedProspectIds.size === result.prospects.length ? "Deselect all" : "Select all"}
                  >
                    {selectedProspectIds.size === result.prospects.length ? <X /> : <Check />}
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => setShowConfirmModal(true)}
                    disabled={selectedProspectIds.size === 0}
                    title="Create batch job"
                  >
                    <Plus />
                  </button>
                </div>
              </div>
              <div className="transfers">
                <AnimatePresence mode="popLayout">
                  {result.prospects.map((prospect) => (
                    <ProspectItem
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

          {/* Empty state */}
          {result && result.prospects.length === 0 && (
            <section className="transfer-section">
              <div className="transfer-section-header">
                <h2>No Results</h2>
              </div>
              <div className="transfers">
                <div className="empty-state">
                  <MagnifyingGlass size={48} />
                  <span>No prospects found. Try broadening your search criteria.</span>
                  <button className="flat-button" onClick={handleClearResults}>
                    Try Again
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="app-body-sidebar">
          <section className="payment-section">
            <h2>Search Settings</h2>
            <div className="payment-section-header">
              <p>Configure your discovery search</p>
              <div>
                <span className="plan-badge">AI Search</span>
              </div>
            </div>

            <div className="payments">
              <div className="payment">
                <div className="card card-green">
                  <span>Left</span>
                  <span>{discoveryStatus?.rateLimit?.remaining ?? "..."}</span>
                </div>
                <div className="payment-details">
                  <h3>Searches</h3>
                  <div>
                    <span>{discoveryStatus?.rateLimit?.limit ?? 10}/hr</span>
                  </div>
                </div>
              </div>
              <div className="payment">
                <div className="card card-olive">
                  <span>Max</span>
                  <span>{maxResults}</span>
                </div>
                <div className="payment-details">
                  <h3>Results</h3>
                  <div>
                    <span>Per search</span>
                  </div>
                </div>
              </div>
              <div className="payment">
                <div className="card card-gray">
                  <span>Cost</span>
                  <span>
                    {userPlanData?.plan === "pro" || userPlanData?.plan === "scale" ? (
                      <Infinity size={18} weight="bold" />
                    ) : (
                      "1 credit"
                    )}
                  </span>
                </div>
                <div className="payment-details">
                  <h3>Per Search</h3>
                  <div>
                    <span>
                      {userPlanData?.plan === "pro" ? "Pro plan" :
                       userPlanData?.plan === "scale" ? "Scale plan" :
                       "Growth plan"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="faq">
              <p>Tips for better results</p>
              <div>
                <label>Location</label>
                <span style={{ color: "var(--c-text-tertiary)", fontSize: "0.875rem" }}>
                  Include city & state
                </span>
              </div>
              <div>
                <label>Industry</label>
                <span style={{ color: "var(--c-text-tertiary)", fontSize: "0.875rem" }}>
                  Specify sector keywords
                </span>
              </div>
              <div>
                <label>Wealth</label>
                <span style={{ color: "var(--c-text-tertiary)", fontSize: "0.875rem" }}>
                  Mention indicators
                </span>
              </div>
            </div>

            {/* Action button when prospects selected */}
            {selectedProspectIds.size > 0 && (
              <div className="payment-section-footer">
                <button
                  className="save-button save-button-active"
                  onClick={() => setShowConfirmModal(true)}
                >
                  Create Batch ({selectedProspectIds.size})
                </button>
              </div>
            )}

            {/* Clear results button */}
            {result && (
              <div className="payment-section-footer" style={{ marginTop: selectedProspectIds.size > 0 ? "0.75rem" : "1.5rem" }}>
                <button className="settings-button" onClick={handleClearResults}>
                  <X size={16} />
                  <span>Clear & Start Over</span>
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Confirm Modal */}
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
