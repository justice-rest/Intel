/**
 * Response Verification Configuration
 *
 * Enterprise-grade Perplexity Sonar verification for Grok responses
 * Optimized for nonprofit prospect research with domain-specific validation
 */

// Feature flag - set to "false" to disable verification
export function isVerificationEnabled(): boolean {
  return process.env.ENABLE_RESPONSE_VERIFICATION !== "false"
}

// Model ID for verification (OpenRouter format)
export const VERIFICATION_MODEL_ID = "perplexity/sonar"

// Minimum response length to trigger verification (characters)
// Shorter responses don't benefit much from verification
export const MIN_RESPONSE_LENGTH_FOR_VERIFICATION = 200

// Maximum response length to send to verification (characters)
// Prevents excessive token costs for very long responses
export const MAX_RESPONSE_LENGTH_FOR_VERIFICATION = 15000

// Models that should trigger verification
export const MODELS_REQUIRING_VERIFICATION = ["openrouter:x-ai/grok-4.1-fast"]

// Max tokens for verification response
export const VERIFICATION_MAX_TOKENS = 8000

// Timeout for verification request (ms)
export const VERIFICATION_TIMEOUT = 60000

/**
 * Source Authority Scoring
 * Higher scores = more authoritative sources for prospect research
 */
export const SOURCE_AUTHORITY: Record<string, number> = {
  // Government sources - HIGHEST authority
  "sec.gov": 1.0,
  "fec.gov": 1.0,
  "irs.gov": 1.0,
  "edgar.sec.gov": 1.0,
  "efts.sec.gov": 1.0,
  "api.open.fec.gov": 1.0,
  "usaspending.gov": 0.95,

  // Nonprofit data - HIGH authority
  "projects.propublica.org": 0.95,  // IRS 990 data
  "propublica.org": 0.9,
  "guidestar.org": 0.9,
  "candid.org": 0.9,

  // Knowledge bases - MEDIUM authority
  "wikidata.org": 0.7,
  "wikipedia.org": 0.65,

  // Professional networks - MEDIUM authority
  "linkedin.com": 0.55,
  "bloomberg.com": 0.7,
  "forbes.com": 0.65,

  // News sources - LOWER authority (context only)
  "nytimes.com": 0.6,
  "wsj.com": 0.6,
  "reuters.com": 0.6,

  // Business registries - HIGH authority
  "sunbiz.org": 0.9,           // Florida
  "sos.ca.gov": 0.9,           // California
  "icis.corp.delaware.gov": 0.9, // Delaware
  "appext20.dos.ny.gov": 0.9,  // New York
  "opencorporates.com": 0.8,
}

/**
 * Get authority score for a URL
 */
export function getSourceAuthority(url: string): number {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "")
    // Check for exact match first
    if (SOURCE_AUTHORITY[hostname]) return SOURCE_AUTHORITY[hostname]
    // Check for subdomain matches
    for (const [domain, score] of Object.entries(SOURCE_AUTHORITY)) {
      if (hostname.endsWith(domain) || hostname.includes(domain.split(".")[0])) {
        return score
      }
    }
    return 0.3 // Unknown sources get low score
  } catch {
    return 0.3
  }
}

/**
 * Confidence thresholds for UI badges
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,     // Green "Verified" badge
  MEDIUM: 0.6,    // Yellow "Partially Verified" badge
  LOW: 0.4,       // Orange "Unverified" badge
  // Below LOW = Red "Low Confidence" badge
}

/**
 * Claim types for structured extraction
 */
export type ClaimType = "financial" | "employment" | "philanthropic" | "biographical" | "political" | "legal"

/**
 * Claim verification status
 */
export type ClaimStatus = "verified" | "unverified" | "incorrect" | "outdated"
