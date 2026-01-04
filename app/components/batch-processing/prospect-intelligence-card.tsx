"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Buildings,
  House,
  ChartLine,
  HandCoins,
  Users,
  Clock,
  Target,
  ChatCircle,
  Trophy,
  Lightbulb,
  Warning,
  CaretDown,
  CaretRight,
  CheckCircle,
  Info,
  ShieldCheck,
  Question,
  Copy,
  Check,
  Download,
  Star,
  TrendUp,
  Bank,
  Handshake,
  CalendarBlank,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import type { ProspectIntelligence, DataConfidence } from "@/lib/batch-processing/enrichment"

interface ProspectIntelligenceCardProps {
  intelligence: ProspectIntelligence
  onExport?: () => void
}

// ============================================================================
// CONFIDENCE BADGE
// ============================================================================

function ConfidenceBadge({ confidence }: { confidence: DataConfidence }) {
  const config = {
    VERIFIED: {
      icon: ShieldCheck,
      color: "text-[#45ffbc] bg-[#45ffbc]/10 border-[#45ffbc]/30",
      label: "Verified",
    },
    CORROBORATED: {
      icon: CheckCircle,
      color: "text-blue-400 bg-blue-400/10 border-blue-400/30",
      label: "Corroborated",
    },
    ESTIMATED: {
      icon: Info,
      color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
      label: "Estimated",
    },
    UNVERIFIED: {
      icon: Question,
      color: "text-gray-400 bg-gray-400/10 border-gray-400/30",
      label: "Unverified",
    },
  }

  const { icon: Icon, color, label } = config[confidence]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border", color)}>
          <Icon className="h-3 w-3" weight="fill" />
          <span className="sr-only">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {confidence === "VERIFIED" && "From official government or authoritative source"}
          {confidence === "CORROBORATED" && "Found in multiple independent sources"}
          {confidence === "ESTIMATED" && "Calculated from available indicators"}
          {confidence === "UNVERIFIED" && "Single source, not yet verified"}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

// ============================================================================
// DATA VALUE WITH CONFIDENCE
// ============================================================================

function DataValue({
  label,
  value,
  confidence,
  format = "text",
}: {
  label: string
  value: string | number | null | undefined
  confidence?: DataConfidence
  format?: "text" | "currency" | "number" | "percentage"
}) {
  const formatValue = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined || val === "") return "—"
    if (typeof val === "string") return val

    switch (format) {
      case "currency":
        if (val >= 1000000000) return `$${(val / 1000000000).toFixed(1)}B`
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`
        return `$${val.toLocaleString()}`
      case "number":
        return val.toLocaleString()
      case "percentage":
        return `${val}%`
      default:
        return String(val)
    }
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{formatValue(value)}</span>
        {confidence && <ConfidenceBadge confidence={confidence} />}
      </div>
    </div>
  )
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#45ffbc]/10">
            <Icon className="h-5 w-5 text-[#45ffbc]" weight="duotone" />
          </div>
          <span className="font-medium">{title}</span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <CaretDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 border-t border-border/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// EXECUTIVE SUMMARY CARD
// ============================================================================

function ExecutiveSummaryCard({ intelligence }: { intelligence: ProspectIntelligence }) {
  const { executiveSummary } = intelligence

  const getRomyScoreColor = (score: number) => {
    if (score >= 31) return "text-purple-500 bg-purple-500/10 border-purple-500/30"
    if (score >= 21) return "text-[#45ffbc] bg-[#45ffbc]/10 border-[#45ffbc]/30"
    if (score >= 11) return "text-amber-500 bg-amber-500/10 border-amber-500/30"
    return "text-gray-400 bg-gray-400/10 border-gray-400/30"
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-card to-card/50 p-6 space-y-4">
      {/* Header with RōmyScore */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{intelligence.prospect.name}</h2>
          <p className="text-muted-foreground">{executiveSummary.headline}</p>
        </div>
        <div className={cn("flex flex-col items-center px-4 py-2 rounded-xl border", getRomyScoreColor(executiveSummary.romyScore))}>
          <span className="text-3xl font-bold">{executiveSummary.romyScore}</span>
          <span className="text-xs font-medium opacity-80">/41 • {executiveSummary.romyTier}</span>
        </div>
      </div>

      {/* Key Insights */}
      {executiveSummary.keyInsights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Key Insights
          </h3>
          <ul className="space-y-1">
            {executiveSummary.keyInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-[#45ffbc] mt-0.5 flex-shrink-0" weight="fill" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Primary Opportunity */}
      {executiveSummary.primaryOpportunity && (
        <div className="p-3 rounded-lg bg-[#45ffbc]/10 border border-[#45ffbc]/20">
          <div className="flex items-center gap-2 text-[#45ffbc] text-sm font-medium mb-1">
            <Target className="h-4 w-4" />
            Primary Opportunity
          </div>
          <p className="text-sm">{executiveSummary.primaryOpportunity}</p>
        </div>
      )}

      {/* Risk Factors */}
      {executiveSummary.riskFactors.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-500 text-sm font-medium mb-1">
            <Warning className="h-4 w-4" />
            Risk Factors
          </div>
          <ul className="space-y-1">
            {executiveSummary.riskFactors.map((risk, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-amber-500">•</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/50">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {intelligence.metadata.processingTimeMs}ms
        </span>
        <span className="flex items-center gap-1">
          <ChartLine className="h-3 w-3" />
          {intelligence.metadata.sourcesUsed} sources
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          {intelligence.metadata.confidenceScore}% confidence
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// ASK STRATEGY CARD
// ============================================================================

function AskStrategyCard({ intelligence }: { intelligence: ProspectIntelligence }) {
  const { strategy } = intelligence
  const { ask } = strategy

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`
    return `$${val.toLocaleString()}`
  }

  return (
    <div className="rounded-xl border border-[#45ffbc]/30 bg-gradient-to-br from-[#45ffbc]/5 to-transparent p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#45ffbc]/20">
          <Target className="h-6 w-6 text-[#45ffbc]" weight="duotone" />
        </div>
        <div>
          <h3 className="font-semibold">Recommended Ask</h3>
          <p className="text-sm text-muted-foreground">AI-optimized solicitation strategy</p>
        </div>
      </div>

      {/* Ask Amount */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border">
        <div>
          <p className="text-sm text-muted-foreground">Target Amount</p>
          <p className="text-3xl font-bold text-[#45ffbc]">
            {formatCurrency(ask.askRange.target)}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground">Range</p>
          <p>{formatCurrency(ask.askRange.floor)} — {formatCurrency(ask.askRange.stretch)}</p>
        </div>
      </div>

      {/* Gift Vehicle */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Recommended Gift Vehicle</p>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#45ffbc]/20 text-[#45ffbc] border-[#45ffbc]/30">
            {ask.giftVehicle.recommended}
          </Badge>
          {ask.giftVehicle.alternatives.map((alt, i) => (
            <Badge key={i} variant="outline" className="text-muted-foreground">
              {alt}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{ask.giftVehicle.reasoning}</p>
      </div>

      {/* Approach Strategy */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Approach Strategy</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 rounded bg-background/50">
            <p className="text-xs text-muted-foreground">Best Solicitor</p>
            <p className="font-medium">{ask.approachStrategy.bestSolicitor}</p>
          </div>
          <div className="p-2 rounded bg-background/50">
            <p className="text-xs text-muted-foreground">Setting</p>
            <p className="font-medium">{ask.approachStrategy.setting}</p>
          </div>
        </div>
        {ask.approachStrategy.framing.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">Key Framing Points</p>
            <ul className="space-y-1">
              {ask.approachStrategy.framing.map((point, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <CaretRight className="h-4 w-4 text-[#45ffbc] mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProspectIntelligenceCard({ intelligence, onExport }: ProspectIntelligenceCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = JSON.stringify(intelligence, null, 2)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <ExecutiveSummaryCard intelligence={intelligence} />

      {/* Ask Strategy (prominent) */}
      <AskStrategyCard intelligence={intelligence} />

      {/* Collapsible Sections */}
      <div className="space-y-3">
        {/* Wealth Intelligence */}
        <CollapsibleSection
          title="Wealth Intelligence"
          icon={Bank}
          defaultOpen
          badge={
            <Badge variant="outline" className="ml-2">
              {intelligence.wealth.realEstate.propertyCount} properties
            </Badge>
          }
        >
          <div className="pt-4 space-y-1">
            <DataValue
              label="Estimated Net Worth"
              value={`${formatCurrency(intelligence.wealth.estimatedNetWorth.low.value)} — ${formatCurrency(intelligence.wealth.estimatedNetWorth.high.value)}`}
              confidence={intelligence.wealth.estimatedNetWorth.low.confidence}
            />
            <DataValue
              label="Real Estate Total"
              value={intelligence.wealth.realEstate.totalValue.value}
              format="currency"
              confidence={intelligence.wealth.realEstate.totalValue.confidence}
            />
            <DataValue
              label="Business Ownership"
              value={intelligence.wealth.businessOwnership.length > 0
                ? intelligence.wealth.businessOwnership.map(b => b.companyName).join(", ")
                : "None found"
              }
            />
            <DataValue
              label="SEC Insider Status"
              value={intelligence.wealth.securities.hasInsiderFilings.value ? "Yes" : "No"}
              confidence={intelligence.wealth.securities.hasInsiderFilings.confidence}
            />
            {intelligence.wealth.securities.companies.length > 0 && (
              <DataValue
                label="Insider At"
                value={intelligence.wealth.securities.companies.map(c => c.ticker).join(", ")}
              />
            )}
          </div>
        </CollapsibleSection>

        {/* Philanthropic Profile */}
        <CollapsibleSection
          title="Philanthropic Profile"
          icon={HandCoins}
          badge={
            <Badge className="ml-2 bg-[#45ffbc]/20 text-[#45ffbc] border-[#45ffbc]/30">
              {intelligence.philanthropy.givingCapacity.rating} Capacity
            </Badge>
          }
        >
          <div className="pt-4 space-y-1">
            <DataValue
              label="Giving Capacity"
              value={intelligence.philanthropy.givingCapacity.amount.value}
              format="currency"
              confidence={intelligence.philanthropy.givingCapacity.amount.confidence}
            />
            <DataValue
              label="Political Giving"
              value={intelligence.philanthropy.politicalGiving.totalContributions.value}
              format="currency"
              confidence={intelligence.philanthropy.politicalGiving.totalContributions.confidence}
            />
            <DataValue
              label="Party Affiliation"
              value={intelligence.philanthropy.politicalGiving.partyAffiliation.value}
              confidence={intelligence.philanthropy.politicalGiving.partyAffiliation.confidence}
            />
            <DataValue
              label="Foundation Affiliations"
              value={intelligence.philanthropy.foundationAffiliations.length > 0
                ? intelligence.philanthropy.foundationAffiliations.map(f => f.name).join(", ")
                : "None found"
              }
            />
            <DataValue
              label="Nonprofit Boards"
              value={intelligence.philanthropy.nonprofitBoards.length > 0
                ? intelligence.philanthropy.nonprofitBoards.map(b => b.organization).join(", ")
                : "None found"
              }
            />
          </div>
        </CollapsibleSection>

        {/* Timing Intelligence */}
        <CollapsibleSection
          title="Timing Intelligence"
          icon={CalendarBlank}
          badge={
            intelligence.timing.activeSignals.length > 0 && (
              <Badge className="ml-2 bg-amber-500/20 text-amber-500 border-amber-500/30">
                {intelligence.timing.activeSignals.length} signals
              </Badge>
            )
          }
        >
          <div className="pt-4 space-y-3">
            {intelligence.timing.optimalAskWindow.start && (
              <div className="p-3 rounded-lg bg-[#45ffbc]/10 border border-[#45ffbc]/20">
                <p className="text-sm font-medium text-[#45ffbc] mb-1">Optimal Ask Window</p>
                <p className="text-sm">
                  {intelligence.timing.optimalAskWindow.start} to {intelligence.timing.optimalAskWindow.end}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {intelligence.timing.optimalAskWindow.reasoning}
                </p>
              </div>
            )}

            {intelligence.timing.activeSignals.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Signals</p>
                {intelligence.timing.activeSignals.map((signal, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-2 rounded-lg border text-sm",
                      signal.urgency === "IMMEDIATE" && "bg-red-500/10 border-red-500/30",
                      signal.urgency === "NEAR_TERM" && "bg-amber-500/10 border-amber-500/30",
                      signal.urgency === "FUTURE" && "bg-blue-500/10 border-blue-500/30"
                    )}
                  >
                    <p className="font-medium">{signal.type.replace(/_/g, " ")}</p>
                    <p className="text-muted-foreground">{signal.description}</p>
                    <p className="text-xs mt-1">{signal.actionRecommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Cultivation Strategy */}
        <CollapsibleSection
          title="Cultivation Strategy"
          icon={Handshake}
          badge={
            <Badge className={cn(
              "ml-2",
              intelligence.strategy.cultivation.readiness === "READY" && "bg-[#45ffbc]/20 text-[#45ffbc]",
              intelligence.strategy.cultivation.readiness === "URGENT" && "bg-red-500/20 text-red-500",
              intelligence.strategy.cultivation.readiness === "WARMING" && "bg-amber-500/20 text-amber-500",
              intelligence.strategy.cultivation.readiness === "NOT_READY" && "bg-gray-500/20 text-gray-500"
            )}>
              {intelligence.strategy.cultivation.readiness.replace(/_/g, " ")}
            </Badge>
          }
        >
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Readiness Score</span>
              <Progress value={intelligence.strategy.cultivation.readinessScore} className="flex-1 h-2" />
              <span className="text-sm font-medium">{intelligence.strategy.cultivation.readinessScore}%</span>
            </div>

            {intelligence.strategy.cultivation.nextSteps.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Next Steps</p>
                {intelligence.strategy.cultivation.nextSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-medium",
                      step.priority === "HIGH" && "bg-red-500/20 text-red-500",
                      step.priority === "MEDIUM" && "bg-amber-500/20 text-amber-500",
                      step.priority === "LOW" && "bg-gray-500/20 text-gray-500"
                    )}>
                      {step.priority}
                    </div>
                    <div className="flex-1">
                      <p>{step.action}</p>
                      <p className="text-xs text-muted-foreground">{step.timeline}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Conversation Intelligence */}
        {intelligence.strategy.conversation.talkingPoints.length > 0 && (
          <CollapsibleSection
            title="Conversation Intelligence"
            icon={ChatCircle}
          >
            <div className="pt-4 space-y-3">
              {intelligence.strategy.conversation.talkingPoints.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Talking Points</p>
                  {intelligence.strategy.conversation.talkingPoints.map((point, i) => (
                    <div key={i} className="p-2 rounded-lg bg-background/50 text-sm">
                      <p className="font-medium">{point.topic}</p>
                      <p className="text-muted-foreground text-xs mt-1">Hook: {point.hook}</p>
                      <p className="text-xs text-[#45ffbc]">Why it matters: {point.connection}</p>
                    </div>
                  ))}
                </div>
              )}

              {intelligence.strategy.conversation.avoidTopics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-500">Topics to Avoid</p>
                  {intelligence.strategy.conversation.avoidTopics.map((topic, i) => (
                    <div key={i} className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                      <p className="font-medium">{topic.topic}</p>
                      <p className="text-muted-foreground text-xs">{topic.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? "Copied" : "Copy JSON"}
        </Button>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" />
            Export PDF
          </Button>
        )}
      </div>
    </div>
  )
}

// Helper function
function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—"
  if (val >= 1000000000) return `$${(val / 1000000000).toFixed(1)}B`
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`
  return `$${val.toLocaleString()}`
}

export default ProspectIntelligenceCard
