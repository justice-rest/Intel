/**
 * Business Affiliation Search Tool
 * Enterprise-grade unified business/officer search with automatic fallbacks
 *
 * Seamlessly combines multiple FREE data sources:
 * 1. SEC EDGAR (primary) - Public company officers/directors, insider filings
 * 2. Wikidata - Employment history, positions held, board memberships
 * 3. Web Search (Linkup) - Private company info, state filings, news
 * 4. OpenCorporates (optional) - If API key configured
 *
 * Returns consolidated, deduplicated results with confidence scoring
 */

import { tool } from "ai"
import { z } from "zod"
import { LinkupClient } from "linkup-sdk"
import { isLinkupEnabled, getLinkupApiKey, PROSPECT_RESEARCH_DOMAINS } from "@/lib/linkup/config"
import { isOpenCorporatesEnabled, getOpenCorporatesApiKey, OPENCORPORATES_API_BASE_URL } from "@/lib/opencorporates/config"

// ============================================================================
// TYPES
// ============================================================================

interface BusinessAffiliation {
  companyName: string
  role: string
  roleType: "officer" | "director" | "owner" | "founder" | "executive" | "board" | "other"
  current: boolean
  startDate?: string
  endDate?: string
  companyType: "public" | "private" | "nonprofit" | "unknown"
  jurisdiction?: string
  source: string
  sourceUrl?: string
  confidence: "high" | "medium" | "low"
  isPublicCompany: boolean
}

export interface BusinessAffiliationSearchResult {
  personName: string
  totalAffiliations: number
  affiliations: BusinessAffiliation[]
  summary: {
    publicCompanyRoles: number
    privateCompanyRoles: number
    currentRoles: number
    formerRoles: number
    highestRole: string | null
    wealthIndicator: "HIGH" | "MODERATE" | "LOW" | "UNKNOWN"
  }
  dataSources: string[]
  rawContent: string
  sources: Array<{ name: string; url: string }>
  searchDetails: {
    secEdgarSearched: boolean
    secEdgarResults: number
    wikidataSearched: boolean
    wikidataResults: number
    webSearchSearched: boolean
    webSearchResults: number
    openCorporatesSearched: boolean
    openCorporatesResults: number
  }
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const businessAffiliationSearchSchema = z.object({
  personName: z
    .string()
    .describe("Full name of the person to search for business affiliations (e.g., 'John Smith', 'Jane Doe')"),
  includeFormerRoles: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include former/past positions in addition to current roles"),
  jurisdiction: z
    .string()
    .optional()
    .describe("Two-letter US state code to focus search (e.g., 'CA', 'NY', 'TX')"),
  deepSearch: z
    .boolean()
    .optional()
    .default(true)
    .describe("Run comprehensive search across all available sources (recommended)"),
})

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

// ============================================================================
// SEC EDGAR SEARCH (FREE - Primary Source)
// ============================================================================

interface SecInsiderFiling {
  companyName: string
  cik: string
  filingType: string
  filedAt: string
  position?: string
}

async function searchSecEdgar(personName: string): Promise<{
  affiliations: BusinessAffiliation[]
  sources: Array<{ name: string; url: string }>
}> {
  const affiliations: BusinessAffiliation[] = []
  const sources: Array<{ name: string; url: string }> = []

  try {
    // Search SEC EDGAR full-text for Form 3/4/5 filings (insider transactions)
    const searchUrl = `https://efts.sec.gov/LATEST/search-index?q="${encodeURIComponent(personName)}"&forms=3,4,5&from=0&size=20`

    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "RomyProspectResearch/1.0 (nonprofit research tool)",
      },
    })

    if (!response.ok) {
      console.log("[BusinessSearch] SEC EDGAR search returned", response.status)
      return { affiliations, sources }
    }

    const data = await response.json()
    const hits = data.hits?.hits || []

    // Track unique companies
    const companyMap = new Map<string, BusinessAffiliation>()

    for (const hit of hits) {
      const source = hit._source || {}
      const companyName = source.display_names?.[0] || source.entity_name || "Unknown Company"
      const cik = source.ciks?.[0] || ""
      const filingType = source.form || ""
      const filedAt = source.file_date || ""

      // Extract position from filing if available
      let role = "Insider"
      if (filingType === "3") {
        role = "Initial Insider (Officer/Director/10%+ Owner)"
      } else if (filingType === "4") {
        role = "Insider (Officer/Director/10%+ Owner)"
      } else if (filingType === "5") {
        role = "Annual Insider"
      }

      const key = companyName.toLowerCase()
      if (!companyMap.has(key)) {
        companyMap.set(key, {
          companyName,
          role,
          roleType: "officer",
          current: true, // SEC filings indicate current insider status
          companyType: "public",
          source: "SEC EDGAR",
          sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4&dateb=&owner=include&count=40`,
          confidence: "high",
          isPublicCompany: true,
        })

        sources.push({
          name: `SEC EDGAR - ${companyName}`,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4&owner=include`,
        })
      }
    }

    affiliations.push(...companyMap.values())

    // Add main search source
    sources.unshift({
      name: `SEC EDGAR - "${personName}" Insider Search`,
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&owner=only&type=4&company=${encodeURIComponent(personName)}`,
    })

    console.log("[BusinessSearch] SEC EDGAR found", affiliations.length, "affiliations")
  } catch (error) {
    console.error("[BusinessSearch] SEC EDGAR search error:", error)
  }

  return { affiliations, sources }
}

// ============================================================================
// WIKIDATA SEARCH (FREE)
// ============================================================================

async function searchWikidata(personName: string): Promise<{
  affiliations: BusinessAffiliation[]
  sources: Array<{ name: string; url: string }>
}> {
  const affiliations: BusinessAffiliation[] = []
  const sources: Array<{ name: string; url: string }> = []

  try {
    // First, search for the person
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(personName)}&language=en&type=item&limit=5&format=json&origin=*`

    const searchResponse = await fetch(searchUrl)
    if (!searchResponse.ok) {
      return { affiliations, sources }
    }

    const searchData = await searchResponse.json()
    if (!searchData.search || searchData.search.length === 0) {
      return { affiliations, sources }
    }

    // Get the first result (most likely match)
    const entityId = searchData.search[0].id

    // Get entity details with employment (P108), position held (P39), member of (P463)
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims|labels&languages=en&format=json&origin=*`

    const entityResponse = await fetch(entityUrl)
    if (!entityResponse.ok) {
      return { affiliations, sources }
    }

    const entityData = await entityResponse.json()
    const entity = entityData.entities?.[entityId]
    if (!entity) {
      return { affiliations, sources }
    }

    // Helper to resolve entity IDs to labels
    async function resolveEntityLabel(qid: string): Promise<string> {
      try {
        const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=en&format=json&origin=*`
        const res = await fetch(url)
        const data = await res.json()
        return data.entities?.[qid]?.labels?.en?.value || qid
      } catch {
        return qid
      }
    }

    // P108 - Employer
    const employerClaims = entity.claims?.P108 || []
    for (const claim of employerClaims.slice(0, 5)) {
      const employerId = claim.mainsnak?.datavalue?.value?.id
      if (!employerId) continue

      const employerName = await resolveEntityLabel(employerId)
      const startDate = claim.qualifiers?.P580?.[0]?.datavalue?.value?.time?.substring(1, 11)
      const endDate = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time?.substring(1, 11)

      affiliations.push({
        companyName: employerName,
        role: "Employee/Executive",
        roleType: "executive",
        current: !endDate,
        startDate,
        endDate,
        companyType: "unknown",
        source: "Wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${employerId}`,
        confidence: "medium",
        isPublicCompany: false,
      })
    }

    // P39 - Position held (board seats, executive roles)
    const positionClaims = entity.claims?.P39 || []
    for (const claim of positionClaims.slice(0, 5)) {
      const positionId = claim.mainsnak?.datavalue?.value?.id
      if (!positionId) continue

      const positionName = await resolveEntityLabel(positionId)

      // Get the organization from qualifier P642 (of)
      const orgId = claim.qualifiers?.P642?.[0]?.datavalue?.value?.id
      let orgName = "Unknown Organization"
      if (orgId) {
        orgName = await resolveEntityLabel(orgId)
      }

      const startDate = claim.qualifiers?.P580?.[0]?.datavalue?.value?.time?.substring(1, 11)
      const endDate = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time?.substring(1, 11)

      // Determine role type
      let roleType: BusinessAffiliation["roleType"] = "other"
      const posLower = positionName.toLowerCase()
      if (posLower.includes("director") || posLower.includes("board")) {
        roleType = "director"
      } else if (posLower.includes("ceo") || posLower.includes("president") || posLower.includes("chief")) {
        roleType = "officer"
      } else if (posLower.includes("founder")) {
        roleType = "founder"
      }

      affiliations.push({
        companyName: orgName,
        role: positionName,
        roleType,
        current: !endDate,
        startDate,
        endDate,
        companyType: "unknown",
        source: "Wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${entityId}`,
        confidence: "medium",
        isPublicCompany: false,
      })
    }

    // P463 - Member of (organizations, boards)
    const memberClaims = entity.claims?.P463 || []
    for (const claim of memberClaims.slice(0, 5)) {
      const orgId = claim.mainsnak?.datavalue?.value?.id
      if (!orgId) continue

      const orgName = await resolveEntityLabel(orgId)
      const startDate = claim.qualifiers?.P580?.[0]?.datavalue?.value?.time?.substring(1, 11)
      const endDate = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time?.substring(1, 11)

      affiliations.push({
        companyName: orgName,
        role: "Member",
        roleType: "board",
        current: !endDate,
        startDate,
        endDate,
        companyType: "unknown",
        source: "Wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${orgId}`,
        confidence: "medium",
        isPublicCompany: false,
      })
    }

    sources.push({
      name: `Wikidata - ${personName}`,
      url: `https://www.wikidata.org/wiki/${entityId}`,
    })

    console.log("[BusinessSearch] Wikidata found", affiliations.length, "affiliations")
  } catch (error) {
    console.error("[BusinessSearch] Wikidata search error:", error)
  }

  return { affiliations, sources }
}

// ============================================================================
// WEB SEARCH (Linkup - if configured)
// ============================================================================

async function searchWeb(personName: string, jurisdiction?: string): Promise<{
  affiliations: BusinessAffiliation[]
  sources: Array<{ name: string; url: string }>
}> {
  const affiliations: BusinessAffiliation[] = []
  const sources: Array<{ name: string; url: string }> = []

  if (!isLinkupEnabled()) {
    return { affiliations, sources }
  }

  try {
    const client = new LinkupClient({ apiKey: getLinkupApiKey() })

    // Build search query
    const locationPart = jurisdiction ? ` ${jurisdiction}` : ""
    const query = `"${personName}"${locationPart} owner founder CEO president company business executive board director`

    const result = await client.search({
      query,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeDomains: [...PROSPECT_RESEARCH_DOMAINS],
    })

    const answer = result.answer || ""

    // Extract business affiliations from the answer
    // Look for patterns like "CEO of [Company]", "founded [Company]", "director at [Company]"
    const patterns = [
      /(?:CEO|Chief Executive Officer|President|Chairman|Founder|Owner|Director|Executive)\s+(?:of|at)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\.|,|;|\s+(?:and|from|since|until|where|who|which|that|in\s+\d))/gi,
      /(?:founded|co-founded|owns|leads|runs|heads|chairs)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\.|,|;|\s+(?:and|in|where|which))/gi,
      /(?:serves?|served)\s+(?:as|on)\s+(?:the\s+)?(?:board|director|executive|officer)\s+(?:of|at)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\.|,|;)/gi,
    ]

    const foundCompanies = new Set<string>()

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(answer)) !== null) {
        const companyName = match[1].trim()
        // Filter out common false positives
        if (
          companyName.length > 2 &&
          companyName.length < 100 &&
          !foundCompanies.has(companyName.toLowerCase()) &&
          !/^(the|a|an|this|that|which|where|when|what|how|why|who)$/i.test(companyName)
        ) {
          foundCompanies.add(companyName.toLowerCase())

          // Determine role from context
          const context = answer.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50).toLowerCase()
          let role = "Executive/Owner"
          let roleType: BusinessAffiliation["roleType"] = "executive"

          if (context.includes("founder") || context.includes("founded")) {
            role = "Founder"
            roleType = "founder"
          } else if (context.includes("ceo") || context.includes("chief executive")) {
            role = "CEO"
            roleType = "officer"
          } else if (context.includes("president")) {
            role = "President"
            roleType = "officer"
          } else if (context.includes("chairman") || context.includes("chair")) {
            role = "Chairman"
            roleType = "board"
          } else if (context.includes("director") || context.includes("board")) {
            role = "Director"
            roleType = "director"
          } else if (context.includes("owner") || context.includes("owns")) {
            role = "Owner"
            roleType = "owner"
          }

          affiliations.push({
            companyName,
            role,
            roleType,
            current: true, // Assume current unless stated otherwise
            companyType: "private",
            source: "Web Search",
            confidence: "low",
            isPublicCompany: false,
          })
        }
      }
    }

    // Add sources from Linkup
    for (const source of result.sources || []) {
      sources.push({
        name: source.name || "Web Source",
        url: source.url,
      })
    }

    console.log("[BusinessSearch] Web search found", affiliations.length, "affiliations")
  } catch (error) {
    console.error("[BusinessSearch] Web search error:", error)
  }

  return { affiliations, sources }
}

// ============================================================================
// OPENCORPORATES (Optional - if API key configured)
// ============================================================================

async function searchOpenCorporates(personName: string, jurisdiction?: string): Promise<{
  affiliations: BusinessAffiliation[]
  sources: Array<{ name: string; url: string }>
}> {
  const affiliations: BusinessAffiliation[] = []
  const sources: Array<{ name: string; url: string }> = []

  if (!isOpenCorporatesEnabled()) {
    return { affiliations, sources }
  }

  try {
    const apiKey = getOpenCorporatesApiKey()
    const params = new URLSearchParams({
      q: personName,
      per_page: "20",
      order: "score",
    })

    if (jurisdiction) {
      params.append("jurisdiction_code", `us_${jurisdiction.toLowerCase()}`)
    }
    if (apiKey) {
      params.append("api_token", apiKey)
    }

    const url = `${OPENCORPORATES_API_BASE_URL}/officers/search?${params.toString()}`

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      console.log("[BusinessSearch] OpenCorporates returned", response.status)
      return { affiliations, sources }
    }

    const data = await response.json()
    const officers = data.results?.officers || []

    for (const { officer } of officers) {
      affiliations.push({
        companyName: officer.company?.name || "Unknown",
        role: officer.position || "Officer",
        roleType: officer.position?.toLowerCase().includes("director") ? "director" : "officer",
        current: !officer.inactive && !officer.end_date,
        startDate: officer.start_date || undefined,
        endDate: officer.end_date || undefined,
        companyType: "private",
        jurisdiction: officer.company?.jurisdiction_code,
        source: "OpenCorporates",
        sourceUrl: officer.company?.opencorporates_url,
        confidence: "high",
        isPublicCompany: false,
      })

      if (officer.company?.opencorporates_url) {
        sources.push({
          name: `${officer.company.name} - OpenCorporates`,
          url: officer.company.opencorporates_url,
        })
      }
    }

    sources.unshift({
      name: `OpenCorporates - "${personName}" Officer Search`,
      url: `https://opencorporates.com/officers?q=${encodeURIComponent(personName)}`,
    })

    console.log("[BusinessSearch] OpenCorporates found", affiliations.length, "affiliations")
  } catch (error) {
    console.error("[BusinessSearch] OpenCorporates error:", error)
  }

  return { affiliations, sources }
}

// ============================================================================
// DEDUPLICATE AND MERGE RESULTS
// ============================================================================

function deduplicateAffiliations(affiliations: BusinessAffiliation[]): BusinessAffiliation[] {
  const merged = new Map<string, BusinessAffiliation>()

  for (const aff of affiliations) {
    const key = `${aff.companyName.toLowerCase()}_${aff.role.toLowerCase()}`

    if (!merged.has(key)) {
      merged.set(key, aff)
    } else {
      const existing = merged.get(key)!
      // Prefer higher confidence sources
      const confidenceOrder = { high: 3, medium: 2, low: 1 }
      if (confidenceOrder[aff.confidence] > confidenceOrder[existing.confidence]) {
        merged.set(key, { ...aff, isPublicCompany: existing.isPublicCompany || aff.isPublicCompany })
      } else {
        // Merge public company status
        existing.isPublicCompany = existing.isPublicCompany || aff.isPublicCompany
      }
    }
  }

  return Array.from(merged.values())
}

// ============================================================================
// FORMAT RESULTS FOR AI
// ============================================================================

function formatResultsForAI(result: BusinessAffiliationSearchResult): string {
  const lines: string[] = [
    `# Business Affiliation Search: "${result.personName}"`,
    "",
  ]

  if (result.affiliations.length === 0) {
    lines.push("## No Business Affiliations Found")
    lines.push("")
    lines.push("No business or corporate affiliations were found in available databases.")
    lines.push("")
    lines.push("### Data Sources Searched")
    lines.push("")
    if (result.searchDetails.secEdgarSearched) {
      lines.push(`- **SEC EDGAR:** ${result.searchDetails.secEdgarResults} results (public company insiders)`)
    }
    if (result.searchDetails.wikidataSearched) {
      lines.push(`- **Wikidata:** ${result.searchDetails.wikidataResults} results (employment, positions)`)
    }
    if (result.searchDetails.webSearchSearched) {
      lines.push(`- **Web Search:** ${result.searchDetails.webSearchResults} results (news, profiles)`)
    }
    if (result.searchDetails.openCorporatesSearched) {
      lines.push(`- **OpenCorporates:** ${result.searchDetails.openCorporatesResults} results (corporate registry)`)
    }
    lines.push("")
    lines.push("### Possible Reasons")
    lines.push("- Person may not hold corporate officer/director positions")
    lines.push("- Business affiliations may be under a different name variation")
    lines.push("- Private company roles may not be in public databases")
    lines.push("")
    lines.push("### Recommendations")
    lines.push("- Try searching with name variations (middle initial, maiden name)")
    lines.push("- Use `searchWeb` with specific company names if known")
    lines.push("- Check LinkedIn or other professional profiles manually")
    return lines.join("\n")
  }

  // Summary section
  lines.push(`## Summary`)
  lines.push("")
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| **Total Affiliations** | ${result.totalAffiliations} |`)
  lines.push(`| **Public Company Roles** | ${result.summary.publicCompanyRoles} |`)
  lines.push(`| **Private Company Roles** | ${result.summary.privateCompanyRoles} |`)
  lines.push(`| **Current Roles** | ${result.summary.currentRoles} |`)
  lines.push(`| **Former Roles** | ${result.summary.formerRoles} |`)
  lines.push(`| **Wealth Indicator** | ${result.summary.wealthIndicator} |`)
  if (result.summary.highestRole) {
    lines.push(`| **Highest Role** | ${result.summary.highestRole} |`)
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Public company roles (most important for prospect research)
  const publicRoles = result.affiliations.filter((a) => a.isPublicCompany)
  if (publicRoles.length > 0) {
    lines.push("## Public Company Affiliations")
    lines.push("")
    lines.push("*SEC-verified insider status (officers, directors, 10%+ owners)*")
    lines.push("")
    publicRoles.forEach((aff, idx) => {
      const status = aff.current ? "✓ Current" : "○ Former"
      lines.push(`### ${idx + 1}. ${aff.companyName}`)
      lines.push("")
      lines.push(`- **Role:** ${aff.role}`)
      lines.push(`- **Status:** ${status}`)
      lines.push(`- **Source:** ${aff.source} (${aff.confidence} confidence)`)
      if (aff.sourceUrl) {
        lines.push(`- **Verify:** [View Filing](${aff.sourceUrl})`)
      }
      lines.push("")
    })
    lines.push("---")
    lines.push("")
  }

  // Private company roles
  const privateRoles = result.affiliations.filter((a) => !a.isPublicCompany)
  if (privateRoles.length > 0) {
    lines.push("## Private Company & Other Affiliations")
    lines.push("")
    privateRoles.forEach((aff, idx) => {
      const status = aff.current ? "✓ Current" : "○ Former"
      const dates = []
      if (aff.startDate) dates.push(`from ${aff.startDate}`)
      if (aff.endDate) dates.push(`to ${aff.endDate}`)
      const dateStr = dates.length > 0 ? ` (${dates.join(" ")})` : ""

      lines.push(`### ${idx + 1}. ${aff.companyName}`)
      lines.push("")
      lines.push(`- **Role:** ${aff.role}${dateStr}`)
      lines.push(`- **Status:** ${status}`)
      lines.push(`- **Source:** ${aff.source} (${aff.confidence} confidence)`)
      if (aff.jurisdiction) {
        lines.push(`- **Jurisdiction:** ${aff.jurisdiction}`)
      }
      if (aff.sourceUrl) {
        lines.push(`- **Details:** [View Source](${aff.sourceUrl})`)
      }
      lines.push("")
    })
    lines.push("---")
    lines.push("")
  }

  // Prospect research insights
  lines.push("## Prospect Research Insights")
  lines.push("")

  if (result.summary.wealthIndicator === "HIGH") {
    lines.push("**WEALTH INDICATOR: HIGH**")
    lines.push("")
    lines.push("Multiple corporate leadership roles suggest significant business involvement and wealth.")
    if (result.summary.publicCompanyRoles > 0) {
      lines.push(`- ${result.summary.publicCompanyRoles} public company insider position(s) (SEC-verified)`)
    }
  } else if (result.summary.wealthIndicator === "MODERATE") {
    lines.push("**WEALTH INDICATOR: MODERATE**")
    lines.push("")
    lines.push("Business affiliations indicate professional success and potential giving capacity.")
  } else {
    lines.push("**WEALTH INDICATOR: LOW/UNKNOWN**")
    lines.push("")
    lines.push("Limited business affiliations found. Consider additional research sources.")
  }

  lines.push("")
  lines.push("### Data Sources Used")
  lines.push("")
  result.dataSources.forEach((source) => {
    lines.push(`- ${source}`)
  })

  return lines.join("\n")
}

// ============================================================================
// MAIN TOOL
// ============================================================================

export const businessAffiliationSearchTool = tool({
  description:
    "Search for a person's business affiliations, corporate roles, and board positions. " +
    "Automatically searches multiple FREE sources: SEC EDGAR (public company insiders), " +
    "Wikidata (employment history), and web search (private companies). " +
    "Returns consolidated, deduplicated results with confidence scoring and wealth indicators. " +
    "ENTERPRISE-GRADE: Combines 3-4 data sources for comprehensive coverage. " +
    "Use this instead of opencorporates_officer_search for seamless results.",
  parameters: businessAffiliationSearchSchema,
  execute: async ({
    personName,
    includeFormerRoles = true,
    jurisdiction,
    deepSearch = true,
  }): Promise<BusinessAffiliationSearchResult> => {
    console.log("[BusinessSearch] Starting comprehensive search for:", personName)
    const startTime = Date.now()

    const allAffiliations: BusinessAffiliation[] = []
    const allSources: Array<{ name: string; url: string }> = []
    const dataSources: string[] = []
    const searchDetails = {
      secEdgarSearched: false,
      secEdgarResults: 0,
      wikidataSearched: false,
      wikidataResults: 0,
      webSearchSearched: false,
      webSearchResults: 0,
      openCorporatesSearched: false,
      openCorporatesResults: 0,
    }

    // Run all searches in parallel for speed
    const searchPromises: Promise<{ affiliations: BusinessAffiliation[]; sources: Array<{ name: string; url: string }>; source: string }>[] = []

    // SEC EDGAR (always - free)
    searchPromises.push(
      withTimeout(searchSecEdgar(personName), 15000, { affiliations: [], sources: [] })
        .then((r) => ({ ...r, source: "SEC EDGAR" }))
    )

    // Wikidata (always - free)
    searchPromises.push(
      withTimeout(searchWikidata(personName), 15000, { affiliations: [], sources: [] })
        .then((r) => ({ ...r, source: "Wikidata" }))
    )

    // Web search (if Linkup configured and deep search enabled)
    if (deepSearch && isLinkupEnabled()) {
      searchPromises.push(
        withTimeout(searchWeb(personName, jurisdiction), 20000, { affiliations: [], sources: [] })
          .then((r) => ({ ...r, source: "Web Search (Linkup)" }))
      )
    }

    // OpenCorporates (if configured)
    if (isOpenCorporatesEnabled()) {
      searchPromises.push(
        withTimeout(searchOpenCorporates(personName, jurisdiction), 15000, { affiliations: [], sources: [] })
          .then((r) => ({ ...r, source: "OpenCorporates" }))
      )
    }

    // Wait for all searches
    const results = await Promise.all(searchPromises)

    // Aggregate results
    for (const result of results) {
      if (result.source === "SEC EDGAR") {
        searchDetails.secEdgarSearched = true
        searchDetails.secEdgarResults = result.affiliations.length
      } else if (result.source === "Wikidata") {
        searchDetails.wikidataSearched = true
        searchDetails.wikidataResults = result.affiliations.length
      } else if (result.source === "Web Search (Linkup)") {
        searchDetails.webSearchSearched = true
        searchDetails.webSearchResults = result.affiliations.length
      } else if (result.source === "OpenCorporates") {
        searchDetails.openCorporatesSearched = true
        searchDetails.openCorporatesResults = result.affiliations.length
      }

      if (result.affiliations.length > 0) {
        dataSources.push(`${result.source} (${result.affiliations.length} results)`)
      }

      allAffiliations.push(...result.affiliations)
      allSources.push(...result.sources)
    }

    // Deduplicate
    let affiliations = deduplicateAffiliations(allAffiliations)

    // Filter former roles if requested
    if (!includeFormerRoles) {
      affiliations = affiliations.filter((a) => a.current)
    }

    // Sort by importance (public companies first, then by confidence)
    affiliations.sort((a, b) => {
      if (a.isPublicCompany !== b.isPublicCompany) {
        return a.isPublicCompany ? -1 : 1
      }
      const confOrder = { high: 0, medium: 1, low: 2 }
      return confOrder[a.confidence] - confOrder[b.confidence]
    })

    // Calculate summary
    const publicCompanyRoles = affiliations.filter((a) => a.isPublicCompany).length
    const privateCompanyRoles = affiliations.filter((a) => !a.isPublicCompany).length
    const currentRoles = affiliations.filter((a) => a.current).length
    const formerRoles = affiliations.filter((a) => !a.current).length

    // Determine highest role
    const roleHierarchy = ["CEO", "President", "Chairman", "Founder", "Chief", "Director", "Officer", "Owner", "Executive"]
    let highestRole: string | null = null
    for (const role of roleHierarchy) {
      const match = affiliations.find((a) => a.role.toLowerCase().includes(role.toLowerCase()))
      if (match) {
        highestRole = match.role
        break
      }
    }

    // Determine wealth indicator
    let wealthIndicator: "HIGH" | "MODERATE" | "LOW" | "UNKNOWN" = "UNKNOWN"
    if (publicCompanyRoles >= 2 || (publicCompanyRoles >= 1 && currentRoles >= 3)) {
      wealthIndicator = "HIGH"
    } else if (publicCompanyRoles >= 1 || currentRoles >= 2) {
      wealthIndicator = "MODERATE"
    } else if (affiliations.length > 0) {
      wealthIndicator = "LOW"
    }

    // Deduplicate sources
    const uniqueSources = allSources.filter(
      (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i
    ).slice(0, 20)

    const finalResult: BusinessAffiliationSearchResult = {
      personName,
      totalAffiliations: affiliations.length,
      affiliations,
      summary: {
        publicCompanyRoles,
        privateCompanyRoles,
        currentRoles,
        formerRoles,
        highestRole,
        wealthIndicator,
      },
      dataSources,
      rawContent: "",
      sources: uniqueSources,
      searchDetails,
    }

    // Generate formatted content
    finalResult.rawContent = formatResultsForAI(finalResult)

    const duration = Date.now() - startTime
    console.log(
      `[BusinessSearch] Completed in ${duration}ms:`,
      `${affiliations.length} affiliations from ${dataSources.length} sources,`,
      `wealth indicator: ${wealthIndicator}`
    )

    return finalResult
  },
})

/**
 * Check if business affiliation search tool should be enabled
 * Always enabled - uses free sources
 */
export function shouldEnableBusinessAffiliationSearchTool(): boolean {
  return true
}
