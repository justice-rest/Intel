/**
 * Data Source Registry
 *
 * Defines all data sources used for prospect enrichment with their
 * authority levels, rate limits, and cost profiles.
 */

import type { SourceCategory, DataConfidence } from "./types"

export interface DataSourceConfig {
  id: string
  name: string
  category: SourceCategory
  authorityLevel: number  // 1-10, higher = more authoritative
  defaultConfidence: DataConfidence
  costPerQuery: number    // USD
  rateLimitPerMinute: number
  dataTypes: string[]     // What data this source provides
  requiresApiKey: boolean
  envKey?: string
}

/**
 * Registry of all data sources with their authority levels
 */
export const DATA_SOURCES: Record<string, DataSourceConfig> = {
  // Government sources (highest authority)
  SEC_EDGAR: {
    id: "SEC_EDGAR",
    name: "SEC EDGAR",
    category: "GOVERNMENT",
    authorityLevel: 10,
    defaultConfidence: "VERIFIED",
    costPerQuery: 0,
    rateLimitPerMinute: 10,
    dataTypes: ["securities", "insider_filings", "board_positions", "compensation"],
    requiresApiKey: false,
  },
  FEC: {
    id: "FEC",
    name: "Federal Election Commission",
    category: "GOVERNMENT",
    authorityLevel: 10,
    defaultConfidence: "VERIFIED",
    costPerQuery: 0,
    rateLimitPerMinute: 60,
    dataTypes: ["political_contributions"],
    requiresApiKey: false,
  },
  COUNTY_ASSESSOR: {
    id: "COUNTY_ASSESSOR",
    name: "County Property Records",
    category: "GOVERNMENT",
    authorityLevel: 10,
    defaultConfidence: "VERIFIED",
    costPerQuery: 0,
    rateLimitPerMinute: 30,
    dataTypes: ["real_estate", "property_ownership", "assessed_value"],
    requiresApiKey: false,
  },

  // Nonprofit data (high authority)
  PROPUBLICA_990: {
    id: "PROPUBLICA_990",
    name: "ProPublica Nonprofit Explorer",
    category: "NONPROFIT_990",
    authorityLevel: 9,
    defaultConfidence: "VERIFIED",
    costPerQuery: 0,
    rateLimitPerMinute: 60,
    dataTypes: ["foundation_assets", "nonprofit_boards", "compensation", "grants"],
    requiresApiKey: false,
  },
  OPEN990: {
    id: "OPEN990",
    name: "Open990",
    category: "NONPROFIT_990",
    authorityLevel: 9,
    defaultConfidence: "VERIFIED",
    costPerQuery: 0,
    rateLimitPerMinute: 30,
    dataTypes: ["foundation_details", "officer_compensation", "grant_making"],
    requiresApiKey: false,
  },

  // Financial data
  YAHOO_FINANCE: {
    id: "YAHOO_FINANCE",
    name: "Yahoo Finance",
    category: "FINANCIAL",
    authorityLevel: 7,
    defaultConfidence: "CORROBORATED",
    costPerQuery: 0,
    rateLimitPerMinute: 30,
    dataTypes: ["stock_prices", "market_data", "company_profiles"],
    requiresApiKey: false,
  },

  // Web search (medium authority)
  LINKUP_STANDARD: {
    id: "LINKUP_STANDARD",
    name: "LinkUp Standard Search",
    category: "WEB",
    authorityLevel: 6,
    defaultConfidence: "UNVERIFIED",
    costPerQuery: 0.005,
    rateLimitPerMinute: 60,
    dataTypes: ["biography", "news", "general_web"],
    requiresApiKey: true,
    envKey: "LINKUP_API_KEY",
  },
  LINKUP_DEEP: {
    id: "LINKUP_DEEP",
    name: "LinkUp Deep Search",
    category: "WEB",
    authorityLevel: 7,
    defaultConfidence: "CORROBORATED",
    costPerQuery: 0.02,
    rateLimitPerMinute: 20,
    dataTypes: ["comprehensive_research", "multi_source_synthesis"],
    requiresApiKey: true,
    envKey: "LINKUP_API_KEY",
  },

  // Social/Professional
  LINKEDIN: {
    id: "LINKEDIN",
    name: "LinkedIn (via web search)",
    category: "SOCIAL",
    authorityLevel: 6,
    defaultConfidence: "UNVERIFIED",
    costPerQuery: 0,
    rateLimitPerMinute: 10,
    dataTypes: ["career_history", "education", "connections"],
    requiresApiKey: false,
  },

  // News
  NEWS_API: {
    id: "NEWS_API",
    name: "News Sources",
    category: "NEWS",
    authorityLevel: 5,
    defaultConfidence: "UNVERIFIED",
    costPerQuery: 0.005,
    rateLimitPerMinute: 30,
    dataTypes: ["news", "press_releases", "announcements"],
    requiresApiKey: true,
  },

  // User's CRM
  USER_CRM: {
    id: "USER_CRM",
    name: "User CRM Data",
    category: "CRM",
    authorityLevel: 8,  // High authority - user's own data
    defaultConfidence: "VERIFIED",
    costPerQuery: 0,
    rateLimitPerMinute: 100,
    dataTypes: ["giving_history", "engagement", "contact_info"],
    requiresApiKey: false,
  },
}

/**
 * Get data sources by data type
 */
export function getSourcesForDataType(dataType: string): DataSourceConfig[] {
  return Object.values(DATA_SOURCES).filter(source =>
    source.dataTypes.includes(dataType)
  ).sort((a, b) => b.authorityLevel - a.authorityLevel)
}

/**
 * Get the most authoritative source for a data type
 */
export function getBestSourceForDataType(dataType: string): DataSourceConfig | null {
  const sources = getSourcesForDataType(dataType)
  return sources[0] || null
}

/**
 * Calculate confidence when multiple sources agree
 */
export function calculateTriangulatedConfidence(
  sources: DataSourceConfig[],
  valuesMatch: boolean
): DataConfidence {
  if (sources.length === 0) return "UNVERIFIED"

  // If any source is VERIFIED and values match, result is VERIFIED
  const hasVerifiedSource = sources.some(s => s.defaultConfidence === "VERIFIED")
  if (hasVerifiedSource && valuesMatch) return "VERIFIED"

  // If 2+ sources agree, it's CORROBORATED
  if (sources.length >= 2 && valuesMatch) return "CORROBORATED"

  // If single high-authority source
  const maxAuthority = Math.max(...sources.map(s => s.authorityLevel))
  if (maxAuthority >= 8) return "CORROBORATED"
  if (maxAuthority >= 6) return "ESTIMATED"

  return "UNVERIFIED"
}

/**
 * Estimate cost for an enrichment request
 */
export function estimateEnrichmentCost(
  mode: "QUICK_SCREEN" | "STANDARD" | "DEEP_INTELLIGENCE"
): number {
  switch (mode) {
    case "QUICK_SCREEN":
      // 2 LinkUp Standard queries
      return 0.01
    case "STANDARD":
      // 5 LinkUp Standard queries + AI synthesis
      return 0.03
    case "DEEP_INTELLIGENCE":
      // 5 LinkUp Deep queries + AI synthesis + relationship mapping
      return 0.15
    default:
      return 0.03
  }
}
