/**
 * State Registry Configuration Template
 *
 * Provides a standardized interface for configuring state business registry scrapers.
 * This enables adding new states with config-only changes (~50 lines per state).
 *
 * Each state config defines:
 * - API endpoints (for Tier 1 states)
 * - Scraping selectors (for Tier 2/3 states)
 * - Detail page selectors for FULL officer lists
 */

/**
 * Selector strategy for flexible element selection
 */
export interface SelectorStrategy {
  /** Primary CSS selector */
  selector: string
  /** Fallback selectors to try if primary fails */
  fallbacks?: string[]
  /** Attribute to extract (default: textContent) */
  attribute?: string
  /** Optional regex to extract data from text */
  regex?: RegExp
  /** Transform function for extracted data */
  transform?: (value: string) => string
}

/**
 * Form field configuration for search forms
 */
export interface FormField {
  name: string
  selector: string
  type: "text" | "select" | "checkbox" | "radio" | "hidden"
  value?: string | ((query: string) => string)
}

/**
 * Search results selectors
 */
export interface SearchResultSelectors {
  /** Container for all results */
  resultsContainer: string
  /** Individual result rows/items */
  resultRows: string
  /** Entity name element within row */
  entityName: SelectorStrategy
  /** Entity number/file number element */
  entityNumber?: SelectorStrategy
  /** Status element */
  status?: SelectorStrategy
  /** Filing/incorporation date element */
  filingDate?: SelectorStrategy
  /** Entity type element */
  entityType?: SelectorStrategy
  /** Link to detail page (usually from entityName) */
  detailLink?: SelectorStrategy
  /** Pagination next button (if any) */
  paginationNext?: string
  /** Total results count element */
  totalResults?: SelectorStrategy
}

/**
 * Detail page selectors for FULL officer list extraction
 */
export interface DetailPageSelectors {
  /** Entity type (LLC, Corp, LP, etc.) */
  entityType?: SelectorStrategy
  /** Full legal name */
  entityName?: SelectorStrategy
  /** Current status */
  status?: SelectorStrategy
  /** Formation/incorporation date */
  incorporationDate?: SelectorStrategy
  /** State/country of formation */
  jurisdictionOfFormation?: SelectorStrategy

  /** Registered agent name */
  registeredAgent?: SelectorStrategy
  /** Registered agent address */
  registeredAgentAddress?: SelectorStrategy

  /** Principal/business address */
  principalAddress?: SelectorStrategy
  /** Mailing address */
  mailingAddress?: SelectorStrategy

  /** Officers/directors table or container */
  officerContainer?: string
  /** Individual officer rows within container */
  officerRows?: string
  /** Officer name within row */
  officerName?: SelectorStrategy
  /** Officer title/position within row */
  officerTitle?: SelectorStrategy
  /** Officer address within row */
  officerAddress?: SelectorStrategy
  /** Officer start date within row */
  officerStartDate?: SelectorStrategy

  /** Filing history container */
  filingHistoryContainer?: string
  /** Individual filing rows */
  filingRows?: string
  /** Filing date */
  filingDate?: SelectorStrategy
  /** Filing type */
  filingType?: SelectorStrategy
}

/**
 * API configuration for Tier 1 states
 */
export interface ApiConfig {
  /** Base URL for the API */
  baseUrl: string
  /** API type (socrata, rest, graphql, custom) */
  type: "socrata" | "rest" | "graphql" | "custom"
  /** Whether authentication is required */
  authRequired: boolean
  /** App token for Socrata APIs */
  appToken?: string
  /** Resource ID for Socrata datasets */
  resourceId?: string
  /** Custom headers */
  headers?: Record<string, string>
  /** Rate limit (requests per minute) */
  rateLimit?: number
}

/**
 * Scraping configuration for Tier 2/3 states
 */
export interface ScrapingConfig {
  /** Search URL */
  searchUrl: string
  /** Alternative search URLs (e.g., officer search) */
  alternateSearchUrls?: {
    officer?: string
    agent?: string
    address?: string
  }
  /** URL pattern for detail pages (use {id} placeholder) */
  detailUrlTemplate?: string
  /** Search results selectors */
  searchSelectors: SearchResultSelectors
  /** Detail page selectors */
  detailSelectors?: DetailPageSelectors
  /** Form fields for search */
  formFields?: FormField[]
  /** Whether JavaScript rendering is required (Tier 3) */
  jsRequired: boolean
  /** Wait for specific element after search submit */
  waitForSelector?: string
  /** Delay after search submit (ms) */
  postSearchDelay?: number
  /** Custom search submit handler */
  searchSubmitMethod?: "click" | "enter" | "form"
}

/**
 * State-specific notes and metadata
 */
export interface StateNotes {
  /** Whether the state has CAPTCHA */
  hasCaptcha: boolean
  /** Whether a paid account is required */
  requiresAccount: boolean
  /** Fee per search (if any) */
  feePerSearch?: number
  /** Additional notes for developers */
  notes?: string
  /** Last verified date */
  lastVerified?: string
  /** Known issues */
  knownIssues?: string[]
  /** URL for manual search if automated scraping not available */
  manualSearchUrl?: string
  /** Free alternative (e.g., phone number) */
  freeAlternative?: string
}

/**
 * Complete state registry configuration
 */
export interface StateRegistryConfig {
  /** Two-letter state code (lowercase) */
  stateCode: string
  /** Full state name */
  stateName: string
  /** Registry name (e.g., "Secretary of State") */
  registryName: string
  /** Accessibility tier */
  tier: 1 | 2 | 3 | 4

  /** Base URL of the registry */
  baseUrl: string

  /** API configuration (Tier 1 only) */
  api?: ApiConfig

  /** Scraping configuration (Tier 2/3/4) */
  scraping?: ScrapingConfig

  /** State-specific notes */
  notes: StateNotes

  /** Supported search types */
  searchTypes: {
    byName: boolean
    byOfficer: boolean
    byAgent: boolean
    byAddress: boolean
  }
}

/**
 * US State codes (all 50 states + DC)
 */
export const US_STATES = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "dc", "fl",
  "ga", "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me",
  "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh",
  "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri",
  "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy"
] as const

export type USStateCode = typeof US_STATES[number]

/**
 * Tier descriptions
 */
export const TIER_DESCRIPTIONS = {
  1: "FREE API/Open Data - Use APIs directly, no scraping needed",
  2: "Easy HTTP Scrape - Standard HTML, no JavaScript required",
  3: "JS-Heavy - Requires Playwright for JavaScript rendering",
  4: "CAPTCHA Protected - Requires AI vision CAPTCHA solving",
} as const

/**
 * Validate a state configuration
 */
export function validateStateConfig(config: StateRegistryConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Basic validation
  if (!config.stateCode || config.stateCode.length !== 2) {
    errors.push("Invalid stateCode: must be 2 characters")
  }

  if (!config.stateName) {
    errors.push("Missing stateName")
  }

  if (![1, 2, 3, 4].includes(config.tier)) {
    errors.push("Invalid tier: must be 1, 2, 3, or 4")
  }

  // Tier-specific validation
  if (config.tier === 1 && !config.api) {
    errors.push("Tier 1 states must have API configuration")
  }

  if (config.tier >= 2 && !config.scraping) {
    errors.push("Tier 2/3/4 states must have scraping configuration")
  }

  if (config.scraping) {
    if (!config.scraping.searchUrl) {
      errors.push("Scraping config missing searchUrl")
    }
    if (!config.scraping.searchSelectors) {
      errors.push("Scraping config missing searchSelectors")
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Helper to create a selector strategy
 */
export function selector(
  primary: string,
  options?: {
    fallbacks?: string[]
    attribute?: string
    regex?: RegExp
    transform?: (value: string) => string
  }
): SelectorStrategy {
  return {
    selector: primary,
    ...options,
  }
}

/**
 * Helper to build detail URL from template
 */
export function buildDetailUrl(template: string, id: string, baseUrl?: string): string {
  let url = template.replace("{id}", encodeURIComponent(id))
  if (baseUrl && !url.startsWith("http")) {
    url = baseUrl + url
  }
  return url
}
