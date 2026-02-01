/**
 * Source Registry
 *
 * Defines authoritative data sources and their trust levels.
 * Used for triangulation to weight conflicting data.
 */

// ============================================================================
// TYPES
// ============================================================================

export type SourceCategory =
  | "official_government"   // SEC, FEC, state registries
  | "official_nonprofit"    // ProPublica 990s
  | "property_records"      // County assessors
  | "curated_data"          // LinkedIn, Bloomberg
  | "market_estimates"      // Zillow, Redfin
  | "news_media"            // Major news outlets
  | "llm_synthesis"         // AI-generated from web

export interface SourceDefinition {
  id: string
  name: string
  category: SourceCategory
  authority: number  // 0.0 - 1.0
  urlPatterns: RegExp[]
  dataTypes: string[]  // What this source is good for
  notes?: string
}

// ============================================================================
// SOURCE AUTHORITY HIERARCHY
// ============================================================================

/**
 * Authority levels by category
 * Higher = more trustworthy
 */
export const CATEGORY_AUTHORITY: Record<SourceCategory, number> = {
  official_government: 1.0,
  official_nonprofit: 0.95,
  property_records: 0.9,
  curated_data: 0.8,
  market_estimates: 0.7,
  news_media: 0.6,
  llm_synthesis: 0.5,
}

// ============================================================================
// SOURCE DEFINITIONS
// ============================================================================

export const SOURCE_REGISTRY: SourceDefinition[] = [
  // --- Official Government Sources ---
  {
    id: "sec_edgar",
    name: "SEC EDGAR",
    category: "official_government",
    authority: 1.0,
    urlPatterns: [/sec\.gov/i, /edgar/i],
    dataTypes: ["insider_status", "stock_holdings", "company_officers", "beneficial_ownership"],
    notes: "Official SEC filings - Form 3/4/5, proxy statements",
  },
  {
    id: "fec_gov",
    name: "FEC.gov",
    category: "official_government",
    authority: 1.0,
    urlPatterns: [/fec\.gov/i],
    dataTypes: ["political_contributions", "campaign_donations", "pac_affiliations"],
    notes: "Federal Election Commission - verified contribution records",
  },
  {
    id: "state_sos",
    name: "State Secretary of State",
    category: "official_government",
    authority: 0.95,
    urlPatterns: [/sos\.[a-z]{2}\.gov/i, /business\.[a-z]{2}\.gov/i, /corp\.[a-z]{2}\.gov/i],
    dataTypes: ["business_ownership", "registered_agent", "corporate_officers"],
    notes: "State business registries",
  },

  // --- Official Nonprofit Sources ---
  {
    id: "propublica_990",
    name: "ProPublica Nonprofit Explorer",
    category: "official_nonprofit",
    authority: 0.95,
    urlPatterns: [/propublica\.org/i, /nonprofitexplorer/i],
    dataTypes: ["foundation_affiliations", "nonprofit_boards", "officer_compensation", "990_data"],
    notes: "IRS 990 data - verified nonprofit information",
  },
  {
    id: "guidestar",
    name: "GuideStar/Candid",
    category: "official_nonprofit",
    authority: 0.9,
    urlPatterns: [/guidestar/i, /candid\.org/i],
    dataTypes: ["nonprofit_data", "foundation_grants"],
  },

  // --- Property Records ---
  {
    id: "county_assessor",
    name: "County Assessor",
    category: "property_records",
    authority: 0.95,
    urlPatterns: [/assessor/i, /propertytax/i, /county\.[a-z]{2}/i],
    dataTypes: ["property_ownership", "assessed_value", "tax_value"],
    notes: "Official property tax records",
  },

  // --- Curated Data Platforms ---
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "curated_data",
    authority: 0.8,
    urlPatterns: [/linkedin\.com/i],
    dataTypes: ["career_history", "education", "current_employer", "job_title"],
    notes: "User-submitted but widely verified",
  },
  {
    id: "bloomberg",
    name: "Bloomberg",
    category: "curated_data",
    authority: 0.85,
    urlPatterns: [/bloomberg\.com/i],
    dataTypes: ["executive_profiles", "company_data", "net_worth"],
    notes: "Professional data curation",
  },
  {
    id: "crunchbase",
    name: "Crunchbase",
    category: "curated_data",
    authority: 0.75,
    urlPatterns: [/crunchbase\.com/i],
    dataTypes: ["startup_ownership", "funding_rounds", "company_roles"],
  },

  // --- Market Estimates ---
  {
    id: "zillow",
    name: "Zillow",
    category: "market_estimates",
    authority: 0.7,
    urlPatterns: [/zillow\.com/i],
    dataTypes: ["property_value", "home_estimate"],
    notes: "Zestimate - algorithmic estimate",
  },
  {
    id: "redfin",
    name: "Redfin",
    category: "market_estimates",
    authority: 0.7,
    urlPatterns: [/redfin\.com/i],
    dataTypes: ["property_value", "home_estimate"],
  },

  // --- News Media ---
  {
    id: "major_news",
    name: "Major News Outlet",
    category: "news_media",
    authority: 0.6,
    urlPatterns: [
      /nytimes\.com/i, /wsj\.com/i, /washingtonpost\.com/i,
      /bloomberg\.com\/news/i, /reuters\.com/i, /apnews\.com/i,
      /forbes\.com/i, /fortune\.com/i,
    ],
    dataTypes: ["biographical", "news_events", "philanthropy_announcements"],
  },
  {
    id: "local_news",
    name: "Local News",
    category: "news_media",
    authority: 0.55,
    urlPatterns: [],  // Catch-all for news sites
    dataTypes: ["local_events", "community_involvement"],
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    category: "news_media",
    authority: 0.5,
    urlPatterns: [/wikipedia\.org/i],
    dataTypes: ["biographical", "career_history"],
    notes: "Crowdsourced - needs verification",
  },

  // --- LLM Synthesis ---
  {
    id: "perplexity",
    name: "Perplexity AI",
    category: "llm_synthesis",
    authority: 0.5,
    urlPatterns: [],
    dataTypes: ["synthesis", "estimates"],
    notes: "AI-generated synthesis from web search",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "llm_synthesis",
    authority: 0.5,
    urlPatterns: [],
    dataTypes: ["synthesis", "estimates", "search_grounding"],
    notes: "Google Gemini with Search grounding",
  },
]

// ============================================================================
// SOURCE IDENTIFICATION
// ============================================================================

/**
 * Identify source from URL
 */
export function identifySource(url: string): SourceDefinition | null {
  if (!url) return null

  const normalizedUrl = url.toLowerCase()

  for (const source of SOURCE_REGISTRY) {
    for (const pattern of source.urlPatterns) {
      if (pattern.test(normalizedUrl)) {
        return source
      }
    }
  }

  // Default to LLM synthesis if unknown
  return null
}

/**
 * Get source authority for a URL
 */
export function getSourceAuthority(url: string): number {
  const source = identifySource(url)
  return source?.authority ?? 0.5
}

/**
 * Get sources by category
 */
export function getSourcesByCategory(category: SourceCategory): SourceDefinition[] {
  return SOURCE_REGISTRY.filter(s => s.category === category)
}

/**
 * Get sources best for a data type
 */
export function getSourcesForDataType(dataType: string): SourceDefinition[] {
  return SOURCE_REGISTRY
    .filter(s => s.dataTypes.includes(dataType))
    .sort((a, b) => b.authority - a.authority)
}

// ============================================================================
// SOURCE CLASSIFICATION
// ============================================================================

/**
 * Classify a source URL into a category
 */
export function classifySource(url: string): {
  source: SourceDefinition | null
  category: SourceCategory
  authority: number
} {
  const source = identifySource(url)

  if (source) {
    return {
      source,
      category: source.category,
      authority: source.authority,
    }
  }

  // Unknown sources default to low authority
  return {
    source: null,
    category: "llm_synthesis",
    authority: 0.4,
  }
}

/**
 * Check if a source is authoritative for a specific data type
 */
export function isAuthoritativeFor(url: string, dataType: string): boolean {
  const source = identifySource(url)
  if (!source) return false

  return source.dataTypes.includes(dataType) && source.authority >= 0.8
}
