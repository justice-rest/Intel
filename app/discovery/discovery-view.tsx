"use client"

/**
 * Discovery View Component
 *
 * Main client component for the Prospect Discovery feature.
 * Styled to match the dark-uibank-dashboard-concept design.
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
  CaretRight,
  Check,
  X,
  Bank,
  Buildings,
  FirstAid,
  UserCircle,
  Users,
  Cpu,
  Funnel,
  Plus,
  User,
  MapPin,
  Briefcase,
  ArrowRight,
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
// TEMPLATE TILE COMPONENT (matches original dark-uibank tile design)
// ============================================================================

function TemplateTile({
  template,
  onSelect,
  variant = "olive",
}: {
  template: DiscoveryTemplate
  onSelect: (template: DiscoveryTemplate) => void
  variant?: "olive" | "green" | "gray"
}) {
  const Icon = getTemplateIcon(template.icon)

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
// PROSPECT TRANSFER ITEM (matches original transfer design)
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={cn("transfer", selected && "transfer-selected")}
      onClick={onToggle}
      style={{ cursor: "pointer" }}
    >
      <div className="transfer-logo" style={{ backgroundColor: selected ? "var(--c-green-500)" : "var(--c-gray-200)" }}>
        {selected ? (
          <CheckCircle size={24} weight="fill" color="var(--c-gray-800)" />
        ) : (
          <User size={20} weight="bold" color="var(--c-gray-600)" />
        )}
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

        <div className="faq">
          {(template.placeholders || []).map((placeholder) => (
            <div key={placeholder.key}>
              <label>
                {placeholder.label}
                {placeholder.required && <span style={{ color: "#ff6363" }}>*</span>}
              </label>
              <input
                type="text"
                placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                value={values[placeholder.key] || ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [placeholder.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div className="validation-errors">
            {errors.map((error, i) => (
              <p key={i} className="validation-error">
                <WarningCircle size={14} /> {error}
              </p>
            ))}
          </div>
        )}

        <div className="payment-section-footer">
          <button className="save-button" onClick={onClose}>
            Cancel
          </button>
          <button className="settings-button" onClick={handleSubmit}>
            <ArrowRight />
            <span>Use Template</span>
          </button>
        </div>
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
          <button className="flat-button" onClick={onConfirm} disabled={isCreating} style={{ marginLeft: "1rem" }}>
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

  // State
  const [prompt, setPrompt] = useState("")
  const [maxResults, setMaxResults] = useState(DEFAULT_DISCOVERY_CONFIG.defaultResults)
  const [selectedTemplate, setSelectedTemplate] = useState<DiscoveryTemplate | null>(null)
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isCreatingBatch, setIsCreatingBatch] = useState(false)

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

  // Mutations
  const searchMutation = useMutation({
    mutationFn: async (searchPrompt: string) => {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: searchPrompt, maxResults }),
      })
      const data: DiscoveryResult = await res.json()
      if (!res.ok) throw new Error(data.error || "Search failed")
      return data
    },
    onSuccess: (data) => {
      setResult(data)
      setSelectedProspectIds(new Set())
      if (data.prospects.length === 0) {
        toast({ title: "No prospects found", description: "Try broadening your search criteria", status: "info" })
      } else {
        toast({ title: `Found ${data.prospects.length} prospects`, description: `Search completed in ${(data.durationMs / 1000).toFixed(1)}s`, status: "success" })
      }
    },
    onError: (error) => {
      toast({ title: "Search failed", description: error.message, status: "error" })
    },
  })

  // Handlers
  const handleTemplateSelect = useCallback((template: DiscoveryTemplate) => {
    if (template.placeholders && template.placeholders.length > 0) {
      setSelectedTemplate(template)
    } else {
      setPrompt(template.prompt)
      toast({ title: "Template loaded", description: "Customize the prompt or click Search" })
    }
  }, [])

  const handleTemplateFill = useCallback((filledPrompt: string) => {
    setPrompt(filledPrompt)
    setSelectedTemplate(null)
    toast({ title: "Template applied", description: "Click Search to find matching prospects" })
  }, [])

  const handleSearch = useCallback(() => {
    if (prompt.trim().length < 10) {
      toast({ title: "Prompt too short", description: "Please enter at least 10 characters", status: "error" })
      return
    }
    searchMutation.mutate(prompt)
  }, [prompt, searchMutation])

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
      toast({ title: "Batch job created", description: `Created job with ${selectedProspects.length} prospects` })
      router.push(`/labs/${job.id}`)
    } catch (error) {
      toast({ title: "Failed to create batch", description: error instanceof Error ? error.message : "Unknown error", status: "error" })
    } finally {
      setIsCreatingBatch(false)
      setShowConfirmModal(false)
    }
  }, [result, selectedProspectIds, router])

  // Computed
  const selectedProspects = useMemo(() => {
    if (!result) return []
    return result.prospects.filter((p) => selectedProspectIds.has(p.id))
  }, [result, selectedProspectIds])

  const isSearching = searchMutation.isPending

  // Template variants
  const templateVariants: Array<"olive" | "green" | "gray"> = ["olive", "green", "gray", "olive", "green", "gray"]

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
          {/* Service Section - Templates */}
          <section className="service-section">
            <h2>Prospect Discovery</h2>
            <div className="service-section-header">
              <div className="search-field">
                <MagnifyingGlass />
                <input
                  type="text"
                  placeholder="Describe your ideal prospects..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isSearching}
                />
              </div>
              <div className="dropdown-field">
                <select value={maxResults} onChange={(e) => setMaxResults(parseInt(e.target.value, 10))}>
                  <option value="5">5 max</option>
                  <option value="10">10 max</option>
                  <option value="15">15 max</option>
                  <option value="20">20 max</option>
                  <option value="25">25 max</option>
                </select>
                <Funnel />
              </div>
              <button className="flat-button" onClick={handleSearch} disabled={isSearching || prompt.trim().length < 10}>
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>
            {!result && (
              <>
                <div className="tiles">
                  {DISCOVERY_TEMPLATES.slice(0, 3).map((template, i) => (
                    <TemplateTile
                      key={template.id}
                      template={template}
                      onSelect={handleTemplateSelect}
                      variant={templateVariants[i]}
                    />
                  ))}
                </div>
                <div className="tiles">
                  {DISCOVERY_TEMPLATES.slice(3, 6).map((template, i) => (
                    <TemplateTile
                      key={template.id}
                      template={template}
                      onSelect={handleTemplateSelect}
                      variant={templateVariants[i + 3]}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="service-section-footer">
              <p>Discovery uses AI to find real prospects from public records, news, and business databases.</p>
            </div>
          </section>

          {/* Transfer Section - Results */}
          {result && result.prospects.length > 0 && (
            <section className="transfer-section">
              <div className="transfer-section-header">
                <h2>Discovered Prospects</h2>
                <div className="filter-options">
                  <p>{selectedProspectIds.size} of {result.prospects.length} selected</p>
                  <button className="icon-button" onClick={handleSelectAll} title="Toggle all">
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
                  <span>~2¢</span>
                </div>
                <div className="payment-details">
                  <h3>Estimated</h3>
                  <div>
                    <span>Per search</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="faq">
              <p>Tips for better results</p>
              <div>
                <label>Location</label>
                <span style={{ color: "var(--c-text-tertiary)", fontSize: "0.875rem" }}>Include city & state</span>
              </div>
              <div>
                <label>Industry</label>
                <span style={{ color: "var(--c-text-tertiary)", fontSize: "0.875rem" }}>Specify sector keywords</span>
              </div>
              <div>
                <label>Wealth</label>
                <span style={{ color: "var(--c-text-tertiary)", fontSize: "0.875rem" }}>Mention indicators</span>
              </div>
            </div>

            {selectedProspectIds.size > 0 && (
              <div className="payment-section-footer">
                <button className="save-button" onClick={() => setShowConfirmModal(true)}>
                  Create Batch ({selectedProspectIds.size})
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Modals */}
      {selectedTemplate && (
        <TemplateFillModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSubmit={handleTemplateFill}
        />
      )}

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
