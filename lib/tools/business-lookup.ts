/**
 * Unified Business Lookup Tool
 *
 * Consolidates business_registry_scraper, business_entities, and find_business_ownership
 * into a single intelligent tool with automatic Linkup fallback.
 *
 * Features:
 * - Search by company name OR person/officer name
 * - Auto-detects search type from query patterns
 * - Uses reliable Socrata APIs (CT, NY, CO, OR, IA, WA) + FL HTTP scraper
 * - Automatic Linkup fallback for unsupported states or no results
 * - Ownership inference for person searches
 * - Returns sources for UI + structured data
 *
 * Reliable States (Serverless-Compatible):
 * - Colorado (CO) - Socrata API, entity + agent search
 * - Connecticut (CT) - Socrata API, entity search (best-in-class)
 * - New York (NY) - Socrata API, entity + agent search
 * - Oregon (OR) - Socrata API, entity search
 * - Iowa (IA) - Socrata API, entity search
 * - Washington (WA) - Socrata API, entity search
 * - Florida (FL) - HTTP scraper (no browser needed)
 *
 * Unsupported States (Fallback to Linkup):
 * - California, Texas, Delaware, Michigan, etc.
 */

import { tool } from "ai"
import { z } from "zod"
import { LinkupClient } from "linkup-sdk"
import { getLinkupApiKey, isLinkupEnabled } from "@/lib/linkup/config"
import type { ScrapedBusinessEntity } from "@/lib/scraper/config"

// ============================================================================
// CONSTANTS
// ============================================================================

/** States with reliable FREE APIs (serverless-compatible) */
const RELIABLE_STATES = ["CO", "CT", "NY", "OR", "IA", "WA", "FL"] as const

/** State Secretary of State domains for Linkup site-specific searches */
const STATE_SOS_DOMAINS: Record<string, string> = {
  CA: "bizfileonline.sos.ca.gov",
  TX: "direct.sos.state.tx.us",
  DE: "icis.corp.delaware.gov",
  NV: "esos.nv.gov",
  WY: "wyobiz.wyo.gov",
  MT: "sosmt.gov",
  AZ: "ecorp.azcc.gov",
  NC: "sosnc.gov",
  GA: "ecorp.sos.ga.gov",
  PA: "file.dos.pa.gov",
  IL: "apps.ilsos.gov",
  OH: "businesssearch.ohiosos.gov",
  MI: "cofs.lara.state.mi.us",
  VA: "cis.scc.virginia.gov",
  NJ: "njportal.com",
  MA: "corp.sec.state.ma.us",
}

/** Patterns that indicate a person name (vs company) */
const PERSON_NAME_PATTERNS = [
  /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,  // "John Smith"
  /^[A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+$/,  // "John D. Smith" or "John D Smith"
  /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+$/,  // "John David Smith"
]

/** Patterns that indicate a company name */
const COMPANY_NAME_PATTERNS = [
  /\b(inc|llc|llp|corp|ltd|co|company|corporation|incorporated|limited|partners|lp|pllc)\b/i,
  /\b(holdings|ventures|capital|group|associates|consulting|solutions|services|enterprises)\b/i,
]

// ============================================================================
// TYPES
// ============================================================================

export interface BusinessResult {
  name: string
  entityId: string
  type: string
  status: string
  state: string
  formationDate?: string
  address?: string
  agentName?: string
  officers?: Array<{ name: string; role: string }>
  sourceUrl: string
  sourceName: string
  confidence: "high" | "medium" | "low"
  // For person searches
  ownershipLikelihood?: "confirmed" | "high" | "medium" | "low"
  ownershipReason?: string
  roles?: string[]
}

export interface BusinessLookupResult {
  query: string
  searchType: "company" | "person" | "auto"
  detectedType: "company" | "person"
  results: BusinessResult[]
  summary: {
    total: number
    byState: Record<string, number>
    byConfidence: Record<string, number>
    activeCount: number
  }
  statesSearched: {
    registry: string[]
    linkup: string[]
  }
  rawContent: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  linkupUsed: boolean
  warnings?: string[]
  error?: string
}

// ============================================================================
// SOCRATA API ENDPOINTS
// ============================================================================

interface SocrataEndpoint {
  name: string
  state: string
  portal: string
  datasetId: string
  fields: {
    entityName: string
    entityId: string
    entityType: string
    status?: string
    formationDate?: string
    agentName?: string
    agentFirstName?: string
    agentLastName?: string
    address?: string
    city?: string
    stateField?: string
  }
  supportsAgentSearch: boolean
}

const SOCRATA_ENDPOINTS: SocrataEndpoint[] = [
  {
    name: "Connecticut Secretary of State",
    state: "CT",
    portal: "https://data.ct.gov/resource",
    datasetId: "n7gp-d28j",
    fields: {
      entityName: "business_name",
      entityId: "business_id",
      entityType: "business_type",
      status: "status",
      formationDate: "formation_date",
      address: "principal_office_address",
    },
    supportsAgentSearch: false,
  },
  {
    name: "New York Department of State",
    state: "NY",
    portal: "https://data.ny.gov/resource",
    datasetId: "n9v6-gdp6",
    fields: {
      entityName: "current_entity_name",
      entityId: "dos_id",
      entityType: "entity_type",
      formationDate: "initial_dos_filing_date",
      agentName: "dos_process_name",
      address: "dos_process_address_1",
      city: "dos_process_city",
      stateField: "dos_process_state",
    },
    supportsAgentSearch: true,
  },
  {
    name: "Colorado Secretary of State",
    state: "CO",
    portal: "https://data.colorado.gov/resource",
    datasetId: "4ykn-tg5h",
    fields: {
      entityName: "entityname",
      entityId: "entityid",
      entityType: "entitytype",
      status: "entitystatus",
      formationDate: "entityformdate",
      agentFirstName: "agentfirstname",
      agentLastName: "agentlastname",
      address: "principaladdress1",
      city: "principalcity",
      stateField: "principalstate",
    },
    supportsAgentSearch: true,
  },
  {
    name: "Oregon Secretary of State",
    state: "OR",
    portal: "https://data.oregon.gov/resource",
    datasetId: "tckn-sxa6",
    fields: {
      entityName: "business_name",
      entityId: "registry_number",
      entityType: "entity_type",
      formationDate: "registry_date",
      address: "address",
      city: "city",
      stateField: "state",
    },
    supportsAgentSearch: false,
  },
  {
    name: "Iowa Secretary of State",
    state: "IA",
    portal: "https://mydata.iowa.gov/resource",
    datasetId: "ez5t-3qay",
    fields: {
      entityName: "legal_name",
      entityId: "corp_number",
      entityType: "corporation_type",
      formationDate: "effective_date",
    },
    supportsAgentSearch: false,
  },
  {
    name: "Washington Secretary of State",
    state: "WA",
    portal: "https://data.wa.gov/resource",
    datasetId: "f9jk-mm39",
    fields: {
      entityName: "ubi_name",
      entityId: "ubi",
      entityType: "business_type",
      status: "ubi_status",
      formationDate: "ubi_create_date",
      city: "ubi_city",
      stateField: "ubi_state",
    },
    supportsAgentSearch: false,
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect if query is a person name or company name
 */
function detectSearchType(query: string): "company" | "person" {
  // Check for company patterns first
  if (COMPANY_NAME_PATTERNS.some((p) => p.test(query))) {
    return "company"
  }

  // Check for person name patterns
  if (PERSON_NAME_PATTERNS.some((p) => p.test(query))) {
    return "person"
  }

  // Default to company for ambiguous cases
  return "company"
}

/**
 * Normalize status string
 */
function normalizeStatus(status: string | undefined): string {
  if (!status) return "Unknown"
  const s = status.toUpperCase()
  if (s.includes("ACTIVE") || s.includes("GOOD")) return "Active"
  if (s.includes("INACTIVE") || s.includes("DISSOLVED")) return "Inactive"
  if (s.includes("DELINQUENT")) return "Delinquent"
  return status
}

/**
 * Infer ownership likelihood from role
 */
function inferOwnership(roles: string[]): { likelihood: "high" | "medium" | "low"; reason: string } {
  const rolesLower = roles.map((r) => r.toLowerCase())

  // High likelihood - executive/owner roles
  const highRoles = ["president", "ceo", "chief executive", "owner", "managing member", "sole proprietor", "principal"]
  if (rolesLower.some((r) => highRoles.some((h) => r.includes(h)))) {
    return { likelihood: "high", reason: "Executive/owner role indicates likely ownership" }
  }

  // Medium likelihood - director/agent roles
  const mediumRoles = ["director", "registered agent", "secretary", "treasurer", "manager", "member"]
  if (rolesLower.some((r) => mediumRoles.some((m) => r.includes(m)))) {
    return { likelihood: "medium", reason: "Director/agent role - may or may not be owner" }
  }

  // Low likelihood
  return { likelihood: "low", reason: "Minor role - unlikely to be owner" }
}

/**
 * Query a Socrata endpoint
 */
async function querySocrataEndpoint(
  endpoint: SocrataEndpoint,
  query: string,
  searchType: "company" | "person"
): Promise<BusinessResult[]> {
  const results: BusinessResult[] = []

  try {
    let whereClause: string

    if (searchType === "person" && endpoint.supportsAgentSearch) {
      // Search by agent name
      if (endpoint.fields.agentFirstName && endpoint.fields.agentLastName) {
        const nameParts = query.trim().split(/\s+/)
        const lastName = nameParts[nameParts.length - 1]
        whereClause = `upper(${endpoint.fields.agentLastName}) like '%${lastName.toUpperCase()}%'`
      } else if (endpoint.fields.agentName) {
        whereClause = `upper(${endpoint.fields.agentName}) like '%${query.toUpperCase()}%'`
      } else {
        return [] // No agent search support
      }
    } else {
      // Search by entity name
      whereClause = `upper(${endpoint.fields.entityName}) like '%${query.toUpperCase()}%'`
    }

    const url = `${endpoint.portal}/${endpoint.datasetId}.json?$where=${encodeURIComponent(whereClause)}&$limit=30`

    console.log(`[BusinessLookup] Querying ${endpoint.name}`)

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Romy/1.0" },
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) {
      console.error(`[BusinessLookup] ${endpoint.name} error: ${response.status}`)
      return []
    }

    const data = await response.json()
    if (!Array.isArray(data)) return []

    for (const record of data) {
      // Build agent name
      let agentName = endpoint.fields.agentName ? record[endpoint.fields.agentName] : undefined
      if (endpoint.fields.agentFirstName && endpoint.fields.agentLastName) {
        const first = record[endpoint.fields.agentFirstName] || ""
        const last = record[endpoint.fields.agentLastName] || ""
        agentName = `${first} ${last}`.trim() || undefined
      }

      // Build address
      let address = endpoint.fields.address ? record[endpoint.fields.address] : undefined
      if (endpoint.fields.city) {
        const city = record[endpoint.fields.city] || ""
        const state = endpoint.fields.stateField ? record[endpoint.fields.stateField] || "" : ""
        if (city || state) {
          address = address ? `${address}, ${city}, ${state}` : `${city}, ${state}`
        }
      }

      const result: BusinessResult = {
        name: String(record[endpoint.fields.entityName] || ""),
        entityId: String(record[endpoint.fields.entityId] || ""),
        type: String(record[endpoint.fields.entityType] || "Unknown"),
        status: normalizeStatus(endpoint.fields.status ? record[endpoint.fields.status] : undefined),
        state: endpoint.state,
        sourceName: endpoint.name,
        sourceUrl: endpoint.portal.replace("/resource", ""),
        confidence: "high",
      }

      if (endpoint.fields.formationDate && record[endpoint.fields.formationDate]) {
        result.formationDate = String(record[endpoint.fields.formationDate])
      }
      if (address) result.address = address
      if (agentName) {
        result.agentName = agentName
        // For person searches, add ownership inference
        if (searchType === "person") {
          result.roles = ["Registered Agent"]
          const { likelihood, reason } = inferOwnership(["Registered Agent"])
          result.ownershipLikelihood = likelihood
          result.ownershipReason = reason
        }
      }

      results.push(result)
    }

    console.log(`[BusinessLookup] Found ${results.length} results in ${endpoint.name}`)
  } catch (error) {
    console.error(`[BusinessLookup] Error querying ${endpoint.name}:`, error)
  }

  return results
}

/**
 * Query Florida via HTTP scraper
 */
async function queryFlorida(query: string, searchType: "company" | "person"): Promise<BusinessResult[]> {
  try {
    // Import Florida scraper
    const { scrapeFloridaBusinesses } = await import("@/lib/scraper/scrapers/states/florida")

    console.log(`[BusinessLookup] Querying Florida Sunbiz`)

    const result = await scrapeFloridaBusinesses(query, { limit: 30 })

    if (!result.success || !result.data) {
      return []
    }

    const results: BusinessResult[] = result.data.map((entity: ScrapedBusinessEntity) => ({
      name: entity.name,
      entityId: entity.entityNumber || "",
      type: entity.entityType || "Unknown",
      status: entity.status || "Unknown",
      state: "FL",
      formationDate: entity.incorporationDate || undefined,
      address: entity.registeredAddress || undefined,
      agentName: entity.registeredAgent || undefined,
      officers: entity.officers?.map((o: { name: string; position: string }) => ({ name: o.name, role: o.position })),
      sourceName: "Florida Division of Corporations",
      sourceUrl: entity.sourceUrl,
      confidence: "high" as const,
    }))

    // Add ownership inference for person searches
    if (searchType === "person") {
      for (const r of results) {
        if (r.officers && r.officers.length > 0) {
          const matchingOfficer = r.officers.find((o) =>
            o.name.toLowerCase().includes(query.toLowerCase().split(" ")[0])
          )
          if (matchingOfficer) {
            r.roles = [matchingOfficer.role]
            const { likelihood, reason } = inferOwnership([matchingOfficer.role])
            r.ownershipLikelihood = likelihood
            r.ownershipReason = reason
          }
        }
      }
    }

    console.log(`[BusinessLookup] Found ${results.length} results in Florida`)
    return results
  } catch (error) {
    console.error("[BusinessLookup] Error querying Florida:", error)
    return []
  }
}

/**
 * Search via Linkup for unsupported states
 */
async function searchViaLinkup(
  query: string,
  searchType: "company" | "person",
  states: string[]
): Promise<{ results: BusinessResult[]; success: boolean }> {
  if (!isLinkupEnabled()) {
    console.log("[BusinessLookup] Linkup not enabled, skipping fallback")
    return { results: [], success: false }
  }

  try {
    const apiKey = getLinkupApiKey()
    if (!apiKey) {
      return { results: [], success: false }
    }

    const client = new LinkupClient({ apiKey })

    // Build site-specific search query
    const siteClauses = states
      .filter((s) => STATE_SOS_DOMAINS[s])
      .map((s) => `site:${STATE_SOS_DOMAINS[s]}`)
      .join(" OR ")

    const searchQuery =
      searchType === "company"
        ? `"${query}" business corporation LLC ${siteClauses}`
        : `"${query}" officer director registered agent business ${siteClauses}`

    console.log(`[BusinessLookup] Searching Linkup for: ${states.join(", ")}`)

    const response = await client.search({
      query: searchQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
    })

    // Parse Linkup response into BusinessResults
    const results: BusinessResult[] = []

    if (response.sources && Array.isArray(response.sources)) {
      for (const source of response.sources.slice(0, 10)) {
        // Try to extract state from URL
        let state = "Unknown"
        for (const [stateCode, domain] of Object.entries(STATE_SOS_DOMAINS)) {
          if (source.url?.includes(domain)) {
            state = stateCode
            break
          }
        }

        results.push({
          name: source.name || query,
          entityId: "",
          type: "Unknown",
          status: "Unknown",
          state,
          sourceName: `${state} Secretary of State (via Linkup)`,
          sourceUrl: source.url || "",
          confidence: "medium",
        })
      }
    }

    console.log(`[BusinessLookup] Found ${results.length} results via Linkup`)
    return { results, success: true }
  } catch (error) {
    console.error("[BusinessLookup] Linkup search error:", error)
    return { results: [], success: false }
  }
}

/**
 * Format results into readable content
 */
function formatRawContent(
  query: string,
  searchType: "company" | "person",
  results: BusinessResult[],
  linkupUsed: boolean
): string {
  const lines: string[] = []

  lines.push(`# Business Lookup: ${query}`)
  lines.push(`**Search Type:** ${searchType === "person" ? "Person/Officer" : "Company"}`)
  lines.push(`**Total Results:** ${results.length}`)
  lines.push("")

  if (results.length === 0) {
    lines.push("## No Results Found")
    lines.push("")
    lines.push("**Suggestions:**")
    lines.push("- Try different spelling or name variations")
    lines.push("- For companies: include legal suffix (Inc, LLC, Corp)")
    lines.push("- For people: try with/without middle name")
    return lines.join("\n")
  }

  // Group by state
  const byState: Record<string, BusinessResult[]> = {}
  for (const r of results) {
    byState[r.state] = byState[r.state] || []
    byState[r.state].push(r)
  }

  for (const [state, stateResults] of Object.entries(byState)) {
    lines.push(`## ${state} (${stateResults.length} results)`)
    lines.push("")

    for (const r of stateResults.slice(0, 10)) {
      lines.push(`### ${r.name}`)
      lines.push(`- **ID:** ${r.entityId || "N/A"}`)
      lines.push(`- **Type:** ${r.type}`)
      lines.push(`- **Status:** ${r.status}`)
      if (r.formationDate) lines.push(`- **Formed:** ${r.formationDate}`)
      if (r.address) lines.push(`- **Address:** ${r.address}`)
      if (r.agentName) lines.push(`- **Agent:** ${r.agentName}`)
      if (r.ownershipLikelihood) {
        const emoji = { confirmed: "CONFIRMED", high: "HIGH", medium: "MEDIUM", low: "LOW" }[r.ownershipLikelihood]
        lines.push(`- **Ownership:** ${emoji} - ${r.ownershipReason}`)
      }
      lines.push(`- **Source:** ${r.sourceName} (${r.confidence} confidence)`)
      lines.push("")
    }

    if (stateResults.length > 10) {
      lines.push(`*... and ${stateResults.length - 10} more results from ${state}*`)
      lines.push("")
    }
  }

  if (linkupUsed) {
    lines.push("---")
    lines.push("*Note: Some results retrieved via web search (Linkup) - verify with official registry*")
  }

  return lines.join("\n")
}

// ============================================================================
// SCHEMA
// ============================================================================

const businessLookupSchema = z.object({
  query: z
    .string()
    .describe(
      "Company name OR person name to search. " +
        "Examples: 'Apple Inc', 'Tim Cook', 'Blackstone Group', 'John Smith'. " +
        "The tool auto-detects if this is a company or person name."
    ),
  searchType: z
    .enum(["company", "person", "auto"])
    .optional()
    .default("auto")
    .describe(
      "Search type: 'company' finds businesses, 'person' finds officer/ownership positions, 'auto' detects from query."
    ),
  states: z
    .array(z.string())
    .optional()
    .describe(
      "Specific states to search (2-letter codes). " +
        "Reliable: CO, CT, NY, OR, IA, WA, FL (free APIs). " +
        "Other states (CA, TX, DE, etc.) use Linkup web search fallback. " +
        "Leave empty to search all reliable states."
    ),
  limit: z.number().optional().default(25).describe("Maximum results per state (default: 25)"),
})

// ============================================================================
// TOOL
// ============================================================================

export const businessLookupTool = tool({
  description:
    "**Unified business and ownership search.** Search company registries by business name OR find what businesses a person owns/controls.\n\n" +
    "**USE FOR:**\n" +
    "- 'What businesses does [person] own?' -> Finds officer/ownership positions\n" +
    "- 'Find info about [company]' -> Finds business registration details\n" +
    "- 'Is [person] affiliated with any companies?' -> Searches for corporate roles\n\n" +
    "**RELIABLE STATES (Free APIs):** CO, CT, NY, OR, IA, WA, FL\n" +
    "**OTHER STATES:** Automatic Linkup web search fallback (CA, TX, DE, etc.)\n\n" +
    "**AUTO-DETECTION:** Tool automatically detects if query is a person name (e.g., 'John Smith') or company name (e.g., 'Apple Inc') unless searchType is specified.\n\n" +
    "**FOR PERSON SEARCHES:** Returns ownership likelihood (high/medium/low) based on role analysis.",

  parameters: businessLookupSchema,

  execute: async ({ query, searchType = "auto", states, limit = 25 }): Promise<BusinessLookupResult> => {
    console.log("[BusinessLookup] Starting search:", { query, searchType, states })
    const startTime = Date.now()

    // Validate input
    if (!query || query.trim().length < 2) {
      return {
        query,
        searchType,
        detectedType: "company",
        results: [],
        summary: { total: 0, byState: {}, byConfidence: {}, activeCount: 0 },
        statesSearched: { registry: [], linkup: [] },
        rawContent: "Please provide a valid search query (at least 2 characters).",
        sources: [],
        linkupUsed: false,
        error: "Invalid query",
      }
    }

    // Detect search type if auto
    const detectedType = searchType === "auto" ? detectSearchType(query) : searchType
    console.log(`[BusinessLookup] Detected search type: ${detectedType}`)

    // Determine which states to search
    const requestedStates = states?.map((s) => s.toUpperCase()) || [...RELIABLE_STATES]
    const reliableToSearch = requestedStates.filter((s) => RELIABLE_STATES.includes(s as (typeof RELIABLE_STATES)[number]))
    const unreliableToSearch = requestedStates.filter((s) => !RELIABLE_STATES.includes(s as (typeof RELIABLE_STATES)[number]))

    const allResults: BusinessResult[] = []
    const warnings: string[] = []

    // Search reliable states via APIs
    const socrataPromises = SOCRATA_ENDPOINTS.filter((e) => reliableToSearch.includes(e.state)).map((endpoint) =>
      querySocrataEndpoint(endpoint, query, detectedType)
    )

    // Add Florida if requested
    const floridaPromise = reliableToSearch.includes("FL") ? queryFlorida(query, detectedType) : Promise.resolve([])

    // Execute all reliable searches in parallel
    const [socrataResults, floridaResults] = await Promise.all([
      Promise.all(socrataPromises),
      floridaPromise,
    ])

    // Collect results
    for (const results of socrataResults) {
      allResults.push(...results)
    }
    allResults.push(...floridaResults)

    // Search unreliable states via Linkup
    let linkupUsed = false
    if (unreliableToSearch.length > 0) {
      const linkupResult = await searchViaLinkup(query, detectedType, unreliableToSearch)
      if (linkupResult.success) {
        allResults.push(...linkupResult.results)
        linkupUsed = true
      } else {
        warnings.push(`Linkup fallback unavailable for: ${unreliableToSearch.join(", ")}`)
      }
    }

    // Also try Linkup if no results from registries
    if (allResults.length === 0 && !linkupUsed && isLinkupEnabled()) {
      console.log("[BusinessLookup] No registry results, trying Linkup for all requested states")
      const linkupResult = await searchViaLinkup(query, detectedType, requestedStates)
      if (linkupResult.success) {
        allResults.push(...linkupResult.results)
        linkupUsed = true
      }
    }

    // Deduplicate by name + state
    const seen = new Set<string>()
    const dedupedResults = allResults.filter((r) => {
      const key = `${r.name.toLowerCase()}-${r.state}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Limit results
    const limitedResults = dedupedResults.slice(0, limit * requestedStates.length)

    // Calculate summary
    const byState: Record<string, number> = {}
    const byConfidence: Record<string, number> = {}
    let activeCount = 0

    for (const r of limitedResults) {
      byState[r.state] = (byState[r.state] || 0) + 1
      byConfidence[r.confidence] = (byConfidence[r.confidence] || 0) + 1
      if (r.status === "Active") activeCount++
    }

    // Build sources for UI
    const sources = limitedResults.slice(0, 20).map((r) => ({
      name: `${r.name} (${r.state})`,
      url: r.sourceUrl,
      snippet: `${r.type} - ${r.status}${r.ownershipLikelihood ? ` | Ownership: ${r.ownershipLikelihood}` : ""}`,
    }))

    // Add manual search links if no results
    if (sources.length === 0) {
      sources.push(
        { name: "Florida Sunbiz", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName", snippet: "Search Florida businesses" },
        { name: "Colorado SOS", url: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do", snippet: "Search Colorado businesses" },
        { name: "New York DOS", url: "https://apps.dos.ny.gov/publicInquiry/", snippet: "Search New York businesses" }
      )
    }

    const rawContent = formatRawContent(query, detectedType, limitedResults, linkupUsed)

    const duration = Date.now() - startTime
    console.log(`[BusinessLookup] Completed in ${duration}ms. Found ${limitedResults.length} results.`)

    return {
      query,
      searchType,
      detectedType,
      results: limitedResults,
      summary: {
        total: limitedResults.length,
        byState,
        byConfidence,
        activeCount,
      },
      statesSearched: {
        registry: reliableToSearch,
        linkup: unreliableToSearch,
      },
      rawContent,
      sources,
      linkupUsed,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableBusinessLookupTool(): boolean {
  return true // Always enabled - uses free APIs
}

export { RELIABLE_STATES }
