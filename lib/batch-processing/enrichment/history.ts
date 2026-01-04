/**
 * Research History & Change Detection System
 *
 * Instead of traditional caching that silently serves stale data,
 * this system:
 * 1. Stores research history with timestamps
 * 2. Detects changes between research runs
 * 3. Highlights what's NEW or CHANGED
 * 4. Shows "Last researched: X days ago" prominently
 * 5. Allows version comparison
 *
 * Philosophy: Never silently serve old data.
 * Always inform the user when data might be stale.
 */

import type { ProspectIntelligence, EnrichedDataPoint } from "./types"

// ============================================================================
// TYPES
// ============================================================================

export interface ResearchSnapshot {
  id: string
  prospectName: string
  prospectKey: string // Normalized key for matching (name + address hash)
  intelligence: ProspectIntelligence
  researchedAt: Date
  mode: "QUICK_SCREEN" | "STANDARD" | "DEEP_INTELLIGENCE"
  sourcesCount: number
  // For cost tracking
  estimatedCost: number
  // Metadata
  researchedBy?: string
  notes?: string
}

export interface ChangeDetectionResult {
  hasChanges: boolean
  summary: string
  changes: ChangeItem[]
  previous: ResearchSnapshot | null
  current: ResearchSnapshot
  daysSinceLastResearch: number
}

export interface ChangeItem {
  category: "wealth" | "philanthropy" | "securities" | "business" | "biography" | "timing"
  field: string
  changeType: "NEW" | "UPDATED" | "REMOVED" | "INCREASED" | "DECREASED"
  previousValue?: any
  currentValue?: any
  significance: "HIGH" | "MEDIUM" | "LOW"
  description: string
}

// ============================================================================
// CHANGE DETECTION ENGINE
// ============================================================================

/**
 * Compare two research snapshots and detect changes
 */
export function detectChanges(
  previous: ResearchSnapshot | null,
  current: ResearchSnapshot
): ChangeDetectionResult {
  const changes: ChangeItem[] = []
  const daysSince = previous
    ? Math.floor((current.researchedAt.getTime() - previous.researchedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  if (!previous) {
    return {
      hasChanges: false,
      summary: "Initial research - no previous data to compare",
      changes: [],
      previous: null,
      current,
      daysSinceLastResearch: 0,
    }
  }

  const prevIntel = previous.intelligence
  const currIntel = current.intelligence

  // =========================================================================
  // WEALTH CHANGES
  // =========================================================================

  // Net worth changes
  const prevNetWorthLow = prevIntel.wealth?.estimatedNetWorth?.low?.value
  const currNetWorthLow = currIntel.wealth?.estimatedNetWorth?.low?.value
  if (prevNetWorthLow && currNetWorthLow) {
    const pctChange = ((currNetWorthLow - prevNetWorthLow) / prevNetWorthLow) * 100
    if (Math.abs(pctChange) > 10) {
      changes.push({
        category: "wealth",
        field: "estimatedNetWorth",
        changeType: pctChange > 0 ? "INCREASED" : "DECREASED",
        previousValue: prevNetWorthLow,
        currentValue: currNetWorthLow,
        significance: Math.abs(pctChange) > 25 ? "HIGH" : "MEDIUM",
        description: `Net worth ${pctChange > 0 ? "increased" : "decreased"} by ${Math.abs(pctChange).toFixed(0)}% (${formatMoney(prevNetWorthLow)} → ${formatMoney(currNetWorthLow)})`,
      })
    }
  }

  // Real estate changes
  const prevREValue = prevIntel.wealth?.realEstate?.totalValue?.value
  const currREValue = currIntel.wealth?.realEstate?.totalValue?.value
  if (prevREValue !== currREValue) {
    if (!prevREValue && currREValue) {
      changes.push({
        category: "wealth",
        field: "realEstateTotal",
        changeType: "NEW",
        currentValue: currREValue,
        significance: currREValue > 1000000 ? "HIGH" : "MEDIUM",
        description: `New real estate data found: ${formatMoney(currREValue)} total`,
      })
    } else if (prevREValue && currREValue) {
      const pctChange = ((currREValue - prevREValue) / prevREValue) * 100
      if (Math.abs(pctChange) > 5) {
        changes.push({
          category: "wealth",
          field: "realEstateTotal",
          changeType: pctChange > 0 ? "INCREASED" : "DECREASED",
          previousValue: prevREValue,
          currentValue: currREValue,
          significance: Math.abs(pctChange) > 20 ? "HIGH" : "MEDIUM",
          description: `Real estate value ${pctChange > 0 ? "increased" : "decreased"} by ${Math.abs(pctChange).toFixed(0)}%`,
        })
      }
    }
  }

  // Property count changes
  const prevPropCount = prevIntel.wealth?.realEstate?.propertyCount || 0
  const currPropCount = currIntel.wealth?.realEstate?.propertyCount || 0
  if (currPropCount > prevPropCount) {
    changes.push({
      category: "wealth",
      field: "propertyCount",
      changeType: "INCREASED",
      previousValue: prevPropCount,
      currentValue: currPropCount,
      significance: "HIGH",
      description: `New property detected! (${prevPropCount} → ${currPropCount} properties)`,
    })
  } else if (currPropCount < prevPropCount) {
    changes.push({
      category: "wealth",
      field: "propertyCount",
      changeType: "DECREASED",
      previousValue: prevPropCount,
      currentValue: currPropCount,
      significance: "MEDIUM",
      description: `Property sold or removed (${prevPropCount} → ${currPropCount} properties)`,
    })
  }

  // New businesses
  const prevBizCount = prevIntel.wealth?.businessOwnership?.length || 0
  const currBizCount = currIntel.wealth?.businessOwnership?.length || 0
  if (currBizCount > prevBizCount) {
    const newBiz = currIntel.wealth?.businessOwnership?.slice(prevBizCount) || []
    changes.push({
      category: "business",
      field: "businessOwnership",
      changeType: "NEW",
      previousValue: prevBizCount,
      currentValue: currBizCount,
      significance: "HIGH",
      description: `New business affiliation(s): ${newBiz.map((b) => b.companyName).join(", ")}`,
    })
  }

  // =========================================================================
  // SECURITIES CHANGES
  // =========================================================================

  const prevHasFilings = prevIntel.wealth?.securities?.hasInsiderFilings?.value
  const currHasFilings = currIntel.wealth?.securities?.hasInsiderFilings?.value
  if (!prevHasFilings && currHasFilings) {
    changes.push({
      category: "securities",
      field: "secFilings",
      changeType: "NEW",
      significance: "HIGH",
      description: "NEW SEC insider filings detected - verify public company affiliations",
    })
  }

  // New public company affiliations
  const prevCompanies = new Set(
    prevIntel.wealth?.securities?.companies?.map((c) => c.ticker) || []
  )
  const currCompanies = currIntel.wealth?.securities?.companies || []
  const newCompanies = currCompanies.filter((c) => !prevCompanies.has(c.ticker))
  if (newCompanies.length > 0) {
    changes.push({
      category: "securities",
      field: "publicCompanyAffiliations",
      changeType: "NEW",
      significance: "HIGH",
      description: `New public company affiliation(s): ${newCompanies.map((c) => `${c.ticker} (${c.role})`).join(", ")}`,
    })
  }

  // =========================================================================
  // PHILANTHROPY CHANGES
  // =========================================================================

  // Political giving changes
  const prevPolitical = prevIntel.philanthropy?.politicalGiving?.totalContributions?.value || 0
  const currPolitical = currIntel.philanthropy?.politicalGiving?.totalContributions?.value || 0
  if (currPolitical > prevPolitical * 1.2) {
    // 20% increase threshold
    changes.push({
      category: "philanthropy",
      field: "politicalGiving",
      changeType: "INCREASED",
      previousValue: prevPolitical,
      currentValue: currPolitical,
      significance: currPolitical - prevPolitical > 10000 ? "HIGH" : "MEDIUM",
      description: `Political giving increased: ${formatMoney(prevPolitical)} → ${formatMoney(currPolitical)}`,
    })
  }

  // New foundation affiliations
  const prevFoundations = new Set(
    prevIntel.philanthropy?.foundationAffiliations?.map((f) => f.name) || []
  )
  const currFoundations = currIntel.philanthropy?.foundationAffiliations || []
  const newFoundations = currFoundations.filter((f) => !prevFoundations.has(f.name))
  if (newFoundations.length > 0) {
    changes.push({
      category: "philanthropy",
      field: "foundationAffiliations",
      changeType: "NEW",
      significance: "HIGH",
      description: `New foundation affiliation(s): ${newFoundations.map((f) => f.name).join(", ")}`,
    })
  }

  // New nonprofit board positions
  const prevBoards = new Set(
    prevIntel.philanthropy?.nonprofitBoards?.map((b) => b.organization) || []
  )
  const currBoards = currIntel.philanthropy?.nonprofitBoards || []
  const newBoards = currBoards.filter((b) => !prevBoards.has(b.organization))
  if (newBoards.length > 0) {
    changes.push({
      category: "philanthropy",
      field: "nonprofitBoards",
      changeType: "NEW",
      significance: "MEDIUM",
      description: `New nonprofit board position(s): ${newBoards.map((b) => b.organization).join(", ")}`,
    })
  }

  // New major gifts
  const prevGifts = new Set(
    prevIntel.philanthropy?.knownMajorGifts?.map((g) => `${g.organization}-${g.year}`) || []
  )
  const currGifts = currIntel.philanthropy?.knownMajorGifts || []
  const newGifts = currGifts.filter((g) => !prevGifts.has(`${g.organization}-${g.year}`))
  if (newGifts.length > 0) {
    changes.push({
      category: "philanthropy",
      field: "majorGifts",
      changeType: "NEW",
      significance: "HIGH",
      description: `New major gift(s) detected: ${newGifts.map((g) => `${formatMoney(g.amount.value)} to ${g.organization}`).join("; ")}`,
    })
  }

  // =========================================================================
  // TIMING SIGNALS
  // =========================================================================

  const prevSignalCount = prevIntel.timing?.activeSignals?.length || 0
  const currSignalCount = currIntel.timing?.activeSignals?.length || 0
  if (currSignalCount > prevSignalCount) {
    const newSignals = currIntel.timing?.activeSignals?.slice(prevSignalCount) || []
    changes.push({
      category: "timing",
      field: "activeSignals",
      changeType: "NEW",
      significance: newSignals.some((s) => s.urgency === "IMMEDIATE") ? "HIGH" : "MEDIUM",
      description: `New timing signal(s): ${newSignals.map((s) => s.description).join("; ")}`,
    })
  }

  // =========================================================================
  // BUILD SUMMARY
  // =========================================================================

  const highPriorityChanges = changes.filter((c) => c.significance === "HIGH")
  const mediumPriorityChanges = changes.filter((c) => c.significance === "MEDIUM")

  let summary = ""
  if (changes.length === 0) {
    summary = `No significant changes detected since last research ${daysSince} days ago.`
  } else if (highPriorityChanges.length > 0) {
    summary = `${highPriorityChanges.length} important change(s) detected! ${highPriorityChanges[0].description}`
  } else {
    summary = `${changes.length} change(s) detected since last research ${daysSince} days ago.`
  }

  return {
    hasChanges: changes.length > 0,
    summary,
    changes,
    previous,
    current,
    daysSinceLastResearch: daysSince,
  }
}

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

/**
 * Generate a normalized key for prospect matching
 */
export function generateProspectKey(name: string, address?: string): string {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "")
  const normalizedAddress = address
    ? address.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
    : ""
  return `${normalizedName}_${normalizedAddress}`
}

/**
 * Create a research snapshot from intelligence data
 */
export function createResearchSnapshot(
  intelligence: ProspectIntelligence,
  mode: ResearchSnapshot["mode"],
  estimatedCost: number,
  researchedBy?: string
): ResearchSnapshot {
  return {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    prospectName: intelligence.prospect.name,
    prospectKey: generateProspectKey(
      intelligence.prospect.name,
      intelligence.prospect.address
    ),
    intelligence,
    researchedAt: new Date(),
    mode,
    sourcesCount: intelligence.allSources?.length || 0,
    estimatedCost,
    researchedBy,
  }
}

/**
 * Format staleness warning message
 */
export function getStalenessWarning(lastResearchedAt: Date): {
  level: "FRESH" | "RECENT" | "STALE" | "VERY_STALE"
  message: string
  daysSince: number
} {
  const daysSince = Math.floor(
    (Date.now() - lastResearchedAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSince === 0) {
    return { level: "FRESH", message: "Researched today", daysSince }
  } else if (daysSince <= 7) {
    return { level: "RECENT", message: `Last researched ${daysSince} day(s) ago`, daysSince }
  } else if (daysSince <= 30) {
    return {
      level: "STALE",
      message: `Last researched ${daysSince} days ago - consider refreshing`,
      daysSince,
    }
  } else {
    return {
      level: "VERY_STALE",
      message: `Last researched ${daysSince} days ago - data may be outdated`,
      daysSince,
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unknown"
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

// Types are exported inline above, no need to re-export
