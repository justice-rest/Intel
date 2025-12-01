/**
 * Linkup Search Configuration
 * Centralized configuration for Linkup search integration
 */

/**
 * Check if Linkup API key is configured
 */
export function isLinkupEnabled(): boolean {
  return !!process.env.LINKUP_API_KEY
}

/**
 * Get Linkup API key from environment
 * @throws Error if LINKUP_API_KEY is not configured
 */
export function getLinkupApiKey(): string {
  const apiKey = process.env.LINKUP_API_KEY

  if (!apiKey) {
    throw new Error(
      "LINKUP_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Linkup API key if available, otherwise return null
 */
export function getLinkupApiKeyOptional(): string | null {
  return process.env.LINKUP_API_KEY || null
}

/**
 * Default configuration for Linkup search
 * Using "deep" mode for comprehensive prospect research results
 */
export const LINKUP_DEFAULTS = {
  depth: "deep" as const, // Deep search for better prospect research coverage
  outputType: "sourcedAnswer" as const, // Pre-synthesized answer with sources
  maxResults: 10, // Number of sources to return
} as const

/**
 * Linkup search depth options
 * - standard: Fast, basic search
 * - deep: Default. More comprehensive results for prospect research
 */
export type LinkupDepth = "standard" | "deep"

/**
 * Linkup output type options
 * - sourcedAnswer: Synthesized answer with citations
 * - searchResults: Raw search results
 * - structured: Custom schema response
 */
export type LinkupOutputType = "sourcedAnswer" | "searchResults" | "structured"

/**
 * Curated domains for prospect research
 * These sources align with standard wealth screening and prospect research methodology:
 * - SEC filings, FEC political contributions, foundation 990s
 * - Property records, business ownership, news archives
 * - Professional backgrounds, philanthropic recognition
 */
export const PROSPECT_RESEARCH_DOMAINS = [
  // SEC & Securities Data
  "sec.gov",                    // EDGAR filings, insider transactions, Form 3/4/5
  "finance.yahoo.com",          // Stock data, insider ownership
  "marketwatch.com",            // Financial news, executive profiles

  // Political Contributions (FEC & State)
  "fec.gov",                    // Federal Election Commission
  "opensecrets.org",            // Political donations, donor lookup
  "followthemoney.org",         // State political contributions

  // Foundation & Philanthropy (990s, Board Memberships)
  "guidestar.org",              // Candid nonprofit/foundation data
  "candid.org",                 // Foundation 990s, grants data
  "app.candid.org",             // 990 Finder - board members, grants
  "projects.propublica.org",    // ProPublica Nonprofit Explorer
  "philanthropy.com",           // Chronicle of Philanthropy
  "insidephilanthropy.com",     // Major gifts, foundation news
  "givingpledge.org",           // Billionaire philanthropy commitments
  "cof.org",                    // Council on Foundations
  "boardsource.org",            // Nonprofit board governance
  "instrumentl.com",            // Foundation directory, 990 finder

  // Real Estate, Property Records & Home Valuations
  "zillow.com",                 // Property values, Zestimates, home valuations
  "redfin.com",                 // Real estate data, home values, estimates
  "realtor.com",                // Property listings, valuations
  "trulia.com",                 // Home valuations, neighborhood data
  "homes.com",                  // Property values, home estimates
  "homelight.com",              // Home value estimator
  "eppraisal.com",              // Free home valuations
  "chase.com",                  // Chase Home Value Estimator
  "bankofamerica.com",          // Home value tools
  "publicrecords.netronline.com", // County property records directory
  "propertyshark.com",          // Property data, ownership records
  "blockshopper.com",           // Recent home sales, property transfers

  // Business & Corporate Data
  "linkedin.com",               // Professional backgrounds, career history
  "crunchbase.com",             // Business ownership, founders, investors
  "opencorporates.com",         // Corporate registry, company data (140+ jurisdictions)
  "bloomberg.com",              // Business news, billionaires index
  "forbes.com",                 // Forbes 400, rich lists, executive profiles
  "pitchbook.com",              // Private company data, investors
  "dnb.com",                    // Dun & Bradstreet business directory
  "zoominfo.com",               // Business contacts, company info

  // State Business Registries (All 50 States + DC)
  // Source: https://www.llcuniversity.com/50-secretary-of-state-sos-business-entity-search/
  "sos.alabama.gov",            // Alabama
  "commerce.alaska.gov",        // Alaska
  "azsos.gov",                  // Arizona
  "sos.arkansas.gov",           // Arkansas
  "sos.ca.gov",                 // California
  "sos.state.co.us",            // Colorado
  "portal.ct.gov",              // Connecticut
  "delaware.gov",               // Delaware (most business-friendly state)
  "os.dc.gov",                  // District of Columbia
  "dos.myflorida.com",          // Florida (SunBiz)
  "sos.ga.gov",                 // Georgia
  "portal.ehawaii.gov",         // Hawaii
  "sos.idaho.gov",              // Idaho
  "ilsos.gov",                  // Illinois
  "in.gov",                     // Indiana
  "sos.iowa.gov",               // Iowa
  "sos.kansas.gov",             // Kansas
  "sos.ky.gov",                 // Kentucky
  "sos.la.gov",                 // Louisiana
  "maine.gov",                  // Maine
  "sos.maryland.gov",           // Maryland
  "sec.state.ma.us",            // Massachusetts
  "michigan.gov",               // Michigan
  "sos.state.mn.us",            // Minnesota
  "sos.ms.gov",                 // Mississippi
  "sos.mo.gov",                 // Missouri
  "sosmt.gov",                  // Montana
  "sos.ne.gov",                 // Nebraska
  "nvsos.gov",                  // Nevada (popular for LLCs)
  "sos.nh.gov",                 // New Hampshire
  "state.nj.us",                // New Jersey
  "sos.state.nm.us",            // New Mexico
  "dos.ny.gov",                 // New York
  "sosnc.gov",                  // North Carolina
  "sos.nd.gov",                 // North Dakota
  "sos.state.oh.us",            // Ohio
  "sos.ok.gov",                 // Oklahoma
  "sos.oregon.gov",             // Oregon
  "dos.pa.gov",                 // Pennsylvania
  "sos.ri.gov",                 // Rhode Island
  "sos.sc.gov",                 // South Carolina
  "sdsos.gov",                  // South Dakota
  "sos.tn.gov",                 // Tennessee
  "sos.state.tx.us",            // Texas
  "corporations.utah.gov",      // Utah
  "sos.vermont.gov",            // Vermont
  "virginia.gov",               // Virginia
  "sos.wa.gov",                 // Washington
  "sos.wv.gov",                 // West Virginia
  "sos.wi.gov",                 // Wisconsin
  "sos.wyo.gov",                // Wyoming

  // News & Media Archives
  "wsj.com",                    // Wall Street Journal
  "nytimes.com",                // New York Times
  "bizjournals.com",            // Regional business journals, 40 Under 40
  "wikipedia.org",              // Biographical information
  "reuters.com",                // Business news
  "apnews.com",                 // Associated Press
  "cnbc.com",                   // Business & financial news
  "fortune.com",                // Fortune 500, executive profiles

  // Court Records
  "pacer.uscourts.gov",         // Federal court records, civil cases
  "courtlistener.com",          // RECAP archive, court documents
] as const
