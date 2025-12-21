/**
 * Voter Registration Tool
 * Retrieves voter registration data including party affiliation and registration status
 *
 * Key Features:
 * - Party affiliation discovery
 * - Voter registration status
 * - Birth year (for age estimation)
 * - Voting history availability
 *
 * Data Sources:
 * - Socrata Open Data APIs (CO, WA, MI, NV, WI)
 * - FEC contribution patterns (party affiliation inference)
 * - Linkup web search (fallback)
 *
 * Coverage:
 * - Colorado: data.colorado.gov (voter registration)
 * - Washington: data.wa.gov (voter registration)
 * - Michigan: data.michigan.gov (voter file)
 * - Nevada: data.nv.gov (voter registration)
 * - Wisconsin: data.wi.gov (voter registration)
 *
 * Privacy Note:
 * Voter registration is PUBLIC RECORD in most US states.
 * This tool only accesses publicly available data.
 */

import { tool } from "ai"
import { z } from "zod"
import { getLinkupApiKeyOptional, isLinkupEnabled } from "@/lib/linkup/config"
import { LinkupClient } from "linkup-sdk"

// ============================================================================
// TYPES
// ============================================================================

export interface VoterRecord {
  name: string
  partyAffiliation: string | null
  registrationDate: string | null
  birthYear: number | null
  county: string | null
  status: "active" | "inactive" | "unknown"
  votingHistory?: {
    lastVoted?: string
    electionsParticipated?: number
  }
}

export interface VoterRegistrationResult {
  personName: string
  state: string
  voterRecord: VoterRecord | null
  confidence: "high" | "medium" | "low" | "inferred"
  methodology: string
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SOCRATA VOTER ENDPOINTS
// ============================================================================

interface VoterEndpoint {
  name: string
  state: string
  portal: string
  datasetId: string
  fields: {
    name?: string
    firstName?: string
    lastName?: string
    party?: string
    registrationDate?: string
    birthYear?: string
    county?: string
    status?: string
    lastVoted?: string
  }
}

const VOTER_ENDPOINTS: VoterEndpoint[] = [
  // Colorado
  {
    name: "Colorado Secretary of State",
    state: "CO",
    portal: "https://data.colorado.gov/resource",
    datasetId: "xnvj-n6qh", // Voter registration
    fields: {
      firstName: "first_name",
      lastName: "last_name",
      party: "party",
      registrationDate: "registration_date",
      birthYear: "birth_year",
      county: "county",
      status: "status",
    },
  },
  // Washington
  {
    name: "Washington Secretary of State",
    state: "WA",
    portal: "https://data.wa.gov/resource",
    datasetId: "voter-registration",
    fields: {
      firstName: "first_name",
      lastName: "last_name",
      registrationDate: "registration_date",
      county: "county",
      status: "status_code",
    },
  },
  // Michigan
  {
    name: "Michigan Secretary of State",
    state: "MI",
    portal: "https://data.michigan.gov/resource",
    datasetId: "voter-file",
    fields: {
      firstName: "first_name",
      lastName: "last_name",
      birthYear: "year_of_birth",
      county: "county",
      status: "voter_status",
      lastVoted: "last_voted",
    },
  },
  // Nevada
  {
    name: "Nevada Secretary of State",
    state: "NV",
    portal: "https://data.nv.gov/resource",
    datasetId: "voter-registration",
    fields: {
      firstName: "first_name",
      lastName: "last_name",
      party: "party_affiliation",
      registrationDate: "registration_date",
      county: "county",
      status: "status",
    },
  },
  // Wisconsin
  {
    name: "Wisconsin Elections Commission",
    state: "WI",
    portal: "https://data.wi.gov/resource",
    datasetId: "voter-registration",
    fields: {
      firstName: "first_name",
      lastName: "last_name",
      registrationDate: "registration_date",
      county: "county",
      status: "voter_status",
    },
  },
]

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * State voter file availability
 * Each state has different policies on public access to voter data
 */
const STATE_VOTER_FILE_INFO: Record<
  string,
  {
    accessible: boolean
    method: "api" | "download" | "request" | "restricted"
    notes: string
  }
> = {
  CO: {
    accessible: true,
    method: "api",
    notes: "Colorado voter data available via data.colorado.gov Socrata API",
  },
  WA: {
    accessible: true,
    method: "api",
    notes: "Washington voter data available via data.wa.gov Socrata API",
  },
  MI: {
    accessible: true,
    method: "api",
    notes: "Michigan voter data available via data.michigan.gov Socrata API",
  },
  NV: {
    accessible: true,
    method: "api",
    notes: "Nevada voter data available via data.nv.gov Socrata API",
  },
  WI: {
    accessible: true,
    method: "api",
    notes: "Wisconsin voter data available via data.wi.gov Socrata API",
  },
  FL: {
    accessible: true,
    method: "download",
    notes: "Florida voter file is publicly downloadable from Division of Elections",
  },
  NC: {
    accessible: true,
    method: "download",
    notes: "North Carolina provides voter file downloads via State Board of Elections",
  },
  OH: {
    accessible: true,
    method: "download",
    notes: "Ohio voter file available through Secretary of State",
  },
  PA: {
    accessible: true,
    method: "request",
    notes: "Pennsylvania voter file available upon request",
  },
  TX: {
    accessible: false,
    method: "restricted",
    notes: "Texas restricts voter file access",
  },
  CA: {
    accessible: false,
    method: "restricted",
    notes: "California restricts commercial use of voter data",
  },
  NY: {
    accessible: true,
    method: "request",
    notes: "New York voter file available upon request from county boards",
  },
}

// ============================================================================
// SCHEMAS
// ============================================================================

const voterRegistrationSchema = z.object({
  personName: z
    .string()
    .describe("Full name of the person to search for (e.g., 'John Smith')"),
  state: z
    .string()
    .describe("Two-letter state code (e.g., 'FL', 'CA', 'NY')"),
  county: z
    .string()
    .optional()
    .describe("County name to narrow search (e.g., 'St. Johns', 'Miami-Dade')"),
  city: z.string().optional().describe("City to help disambiguate"),
  address: z.string().optional().describe("Street address for disambiguation"),
  birthYear: z
    .number()
    .optional()
    .describe("Birth year if known, helps match the right person"),
})

export type VoterRegistrationParams = z.infer<typeof voterRegistrationSchema>

// ============================================================================
// SOCRATA VOTER SEARCH
// ============================================================================

/**
 * Normalize party affiliation to standard names
 */
function normalizeParty(party: string | null | undefined): string | null {
  if (!party) return null
  const p = party.toUpperCase().trim()
  if (p.includes("DEM") || p === "D") return "Democratic"
  if (p.includes("REP") || p === "R") return "Republican"
  if (p.includes("LIB") || p === "L") return "Libertarian"
  if (p.includes("GRE") || p === "G") return "Green"
  if (p.includes("IND") || p.includes("UAF") || p === "I" || p === "U") return "Independent"
  if (p.includes("NPA") || p.includes("NONE") || p.includes("UNAFFILIATED")) return "No Party Affiliation"
  return party
}

/**
 * Normalize voter status
 */
function normalizeVoterStatus(status: string | null | undefined): "active" | "inactive" | "unknown" {
  if (!status) return "unknown"
  const s = status.toUpperCase()
  if (s.includes("ACTIVE") || s.includes("A") || s === "1") return "active"
  if (s.includes("INACTIVE") || s.includes("I") || s === "0") return "inactive"
  return "unknown"
}

/**
 * Search Socrata voter endpoint for a person
 */
async function querySocrataVoter(
  endpoint: VoterEndpoint,
  firstName: string,
  lastName: string
): Promise<VoterRecord | null> {
  try {
    // Build SoQL query - search by last name with first name filter
    const whereClause = endpoint.fields.lastName
      ? `upper(${endpoint.fields.lastName}) = '${lastName.toUpperCase()}'`
      : `upper(${endpoint.fields.name || "name"}) like '%${lastName.toUpperCase()}%'`

    const url = `${endpoint.portal}/${endpoint.datasetId}.json?$where=${encodeURIComponent(whereClause)}&$limit=50`

    console.log(`[VoterRegistration] Querying ${endpoint.name}: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[VoterRegistration] ${endpoint.name} API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`[VoterRegistration] No results from ${endpoint.name}`)
      return null
    }

    // Filter by first name
    const matches = data.filter((record) => {
      const recordFirstName = endpoint.fields.firstName
        ? String(record[endpoint.fields.firstName] || "").toUpperCase()
        : ""
      return recordFirstName.includes(firstName.toUpperCase()) || firstName.toUpperCase().includes(recordFirstName)
    })

    if (matches.length === 0) {
      console.log(`[VoterRegistration] No first name matches in ${endpoint.name}`)
      return null
    }

    // Use the first match
    const match = matches[0]
    const fullName = endpoint.fields.firstName && endpoint.fields.lastName
      ? `${match[endpoint.fields.firstName]} ${match[endpoint.fields.lastName]}`
      : String(match[endpoint.fields.name || "name"] || "")

    const record: VoterRecord = {
      name: fullName,
      partyAffiliation: normalizeParty(
        endpoint.fields.party ? String(match[endpoint.fields.party] || "") : null
      ),
      registrationDate: endpoint.fields.registrationDate
        ? String(match[endpoint.fields.registrationDate] || null)
        : null,
      birthYear: endpoint.fields.birthYear
        ? parseInt(String(match[endpoint.fields.birthYear] || "0"), 10) || null
        : null,
      county: endpoint.fields.county
        ? String(match[endpoint.fields.county] || null)
        : null,
      status: normalizeVoterStatus(
        endpoint.fields.status ? String(match[endpoint.fields.status] || "") : null
      ),
    }

    // Add voting history if available
    if (endpoint.fields.lastVoted && match[endpoint.fields.lastVoted]) {
      record.votingHistory = {
        lastVoted: String(match[endpoint.fields.lastVoted]),
      }
    }

    console.log(`[VoterRegistration] Found voter record in ${endpoint.name}: ${fullName}`)
    return record
  } catch (error) {
    console.error(`[VoterRegistration] Error querying ${endpoint.name}:`, error)
    return null
  }
}

// ============================================================================
// PARTY AFFILIATION FROM FEC
// ============================================================================

/**
 * Infer party affiliation from FEC contributions
 * Uses the FEC API to find political contributions and determine likely party
 */
async function inferPartyFromFEC(
  personName: string,
  state: string
): Promise<{ party: string | null; confidence: string; sources: Array<{ name: string; url: string }> }> {
  const FEC_API = "https://api.open.fec.gov/v1"
  const FEC_API_KEY = process.env.FEC_API_KEY || "DEMO_KEY"

  try {
    // Split name and search
    const nameParts = personName.split(/\s+/)
    const lastName = nameParts[nameParts.length - 1]
    const firstName = nameParts[0]

    const url = new URL(`${FEC_API}/schedules/schedule_a/`)
    url.searchParams.set("api_key", FEC_API_KEY)
    url.searchParams.set("contributor_name", `${lastName}, ${firstName}`)
    url.searchParams.set("contributor_state", state)
    url.searchParams.set("sort", "-contribution_receipt_date")
    url.searchParams.set("per_page", "20")

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return { party: null, confidence: "none", sources: [] }
    }

    const data = await response.json()
    const contributions = data.results || []

    if (contributions.length === 0) {
      return { party: null, confidence: "none", sources: [] }
    }

    // Count contributions by party
    const partyCount: Record<string, number> = {}
    for (const contrib of contributions) {
      const party = contrib.committee?.party || "unknown"
      partyCount[party] = (partyCount[party] || 0) + 1
    }

    // Find dominant party
    let dominantParty: string | null = null
    let maxCount = 0
    for (const [party, count] of Object.entries(partyCount)) {
      if (count > maxCount && party !== "unknown") {
        maxCount = count
        dominantParty = party
      }
    }

    // Map FEC party codes to readable names
    const partyMap: Record<string, string> = {
      DEM: "Democratic",
      REP: "Republican",
      LIB: "Libertarian",
      GRE: "Green",
      IND: "Independent",
    }

    const partyName = dominantParty
      ? partyMap[dominantParty] || dominantParty
      : null

    return {
      party: partyName,
      confidence: maxCount >= 3 ? "medium" : "low",
      sources: [
        {
          name: "FEC Political Contributions",
          url: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(personName)}&contributor_state=${state}`,
        },
      ],
    }
  } catch (error) {
    console.error("[Voter Registration] FEC lookup failed:", error)
    return { party: null, confidence: "none", sources: [] }
  }
}

// ============================================================================
// LINKUP WEB SEARCH
// ============================================================================

/**
 * Search for voter registration info via Linkup
 */
async function searchViaLinkup(
  params: VoterRegistrationParams
): Promise<{
  record: VoterRecord | null
  sources: Array<{ name: string; url: string }>
}> {
  const apiKey = getLinkupApiKeyOptional()
  if (!apiKey || !isLinkupEnabled()) {
    return { record: null, sources: [] }
  }

  const client = new LinkupClient({ apiKey })

  // Build search query for voter registration
  const queryParts = [
    `"${params.personName}"`,
    "voter registration",
    params.state,
  ]
  if (params.county) queryParts.push(`${params.county} County`)
  if (params.city) queryParts.push(params.city)
  queryParts.push("party affiliation")

  const query = queryParts.join(" ")

  console.log(`[Voter Registration] Linkup search: ${query}`)

  try {
    const result = await client.search({
      query,
      depth: "standard",
      outputType: "sourcedAnswer",
    })

    if (!result.answer) {
      return { record: null, sources: [] }
    }

    // Parse party affiliation from answer
    let partyAffiliation: string | null = null
    const partyPatterns = [
      /(?:party|affiliation)[:\s]+(\w+)/i,
      /registered\s+(?:as\s+(?:a|an)\s+)?(\w+)/i,
      /(democrat|republican|independent|libertarian|green)/i,
    ]

    for (const pattern of partyPatterns) {
      const match = result.answer.match(pattern)
      if (match) {
        const party = match[1].toLowerCase()
        if (party.includes("democrat")) {
          partyAffiliation = "Democratic"
        } else if (party.includes("republican")) {
          partyAffiliation = "Republican"
        } else if (party.includes("independent")) {
          partyAffiliation = "Independent"
        } else if (party.includes("libertarian")) {
          partyAffiliation = "Libertarian"
        } else if (party.includes("green")) {
          partyAffiliation = "Green"
        }
        if (partyAffiliation) break
      }
    }

    // Parse birth year if mentioned
    let birthYear: number | null = null
    const birthMatch = result.answer.match(/born\s+(?:in\s+)?(\d{4})/i)
    if (birthMatch) {
      birthYear = parseInt(birthMatch[1], 10)
    }

    const record: VoterRecord = {
      name: params.personName,
      partyAffiliation,
      registrationDate: null,
      birthYear,
      county: params.county || null,
      status: "unknown",
    }

    const sources = (result.sources || []).map(
      (s: { name?: string; url: string }) => ({
        name: s.name || "Voter Registration",
        url: s.url,
      })
    )

    return { record, sources }
  } catch (error) {
    console.error("[Voter Registration] Linkup search failed:", error)
    return { record: null, sources: [] }
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const voterRegistrationTool = tool({
  description:
    "Look up voter registration information including party affiliation. " +
    "Uses Socrata state APIs (CO, WA, MI, NV, WI) + FEC contribution patterns. " +
    "Returns: party affiliation, registration status, birth year, county, voting history. " +
    "Note: Voter registration is PUBLIC RECORD in most US states. " +
    "Socrata API coverage: CO, WA, MI, NV, WI. Falls back to FEC analysis for other states.",

  parameters: voterRegistrationSchema,

  execute: async (
    params: VoterRegistrationParams
  ): Promise<VoterRegistrationResult> => {
    console.log("[Voter Registration] Starting search:", params)

    const stateInfo = STATE_VOTER_FILE_INFO[params.state.toUpperCase()] || {
      accessible: false,
      method: "restricted",
      notes: "No information available for this state",
    }

    const sources: Array<{ name: string; url: string }> = []
    let voterRecord: VoterRecord | null = null
    let confidence: "high" | "medium" | "low" | "inferred" = "low"
    let methodology = ""

    // Parse name for searching
    const nameParts = params.personName.trim().split(/\s+/)
    const firstName = nameParts[0] || ""
    const lastName = nameParts[nameParts.length - 1] || ""

    // Step 1: Try Socrata state voter API (most reliable for supported states)
    const endpoint = VOTER_ENDPOINTS.find((e) => e.state === params.state.toUpperCase())
    if (endpoint) {
      console.log(`[VoterRegistration] Found Socrata endpoint for ${params.state}`)
      const socrataRecord = await querySocrataVoter(endpoint, firstName, lastName)

      if (socrataRecord) {
        voterRecord = socrataRecord
        sources.push({
          name: endpoint.name,
          url: endpoint.portal.replace("/resource", ""),
        })
        confidence = "high"
        methodology = `Direct query to ${endpoint.name} Socrata API`
      }
    }

    // Step 2: Try Linkup web search if no Socrata endpoint or no results
    if (!voterRecord && isLinkupEnabled()) {
      const linkupResult = await searchViaLinkup(params)
      if (linkupResult.record && linkupResult.record.partyAffiliation) {
        voterRecord = linkupResult.record
        sources.push(...linkupResult.sources)
        confidence = "medium"
        methodology = "Web search of public voter records"
      }
    }

    // Step 3: Supplement/fallback with FEC contribution analysis
    if (!voterRecord || !voterRecord.partyAffiliation) {
      const fecResult = await inferPartyFromFEC(
        params.personName,
        params.state.toUpperCase()
      )

      if (fecResult.party) {
        if (!voterRecord) {
          voterRecord = {
            name: params.personName,
            partyAffiliation: fecResult.party,
            registrationDate: null,
            birthYear: null,
            county: params.county || null,
            status: "unknown",
          }
        } else {
          voterRecord.partyAffiliation = fecResult.party
        }

        sources.push(...fecResult.sources)
        confidence = fecResult.confidence === "medium" ? "medium" : "inferred"
        methodology = methodology
          ? `${methodology}; supplemented with FEC contribution pattern analysis`
          : "Inferred from FEC political contribution patterns"
      }
    }

    // Build raw content
    const rawLines: string[] = []
    rawLines.push("# Voter Registration Lookup")
    rawLines.push("")
    rawLines.push("## Query")
    rawLines.push(`- **Name:** ${params.personName}`)
    rawLines.push(`- **State:** ${params.state}`)
    if (params.county) rawLines.push(`- **County:** ${params.county}`)
    if (params.city) rawLines.push(`- **City:** ${params.city}`)
    rawLines.push("")

    rawLines.push("## State Voter File Information")
    rawLines.push(`- **Accessible:** ${stateInfo.accessible ? "Yes" : "No"}`)
    rawLines.push(`- **Access Method:** ${stateInfo.method}`)
    rawLines.push(`- **Notes:** ${stateInfo.notes}`)
    rawLines.push("")

    if (voterRecord) {
      rawLines.push("## Voter Record")
      rawLines.push(`- **Name:** ${voterRecord.name}`)
      rawLines.push(
        `- **Party Affiliation:** ${voterRecord.partyAffiliation || "Not found"}`
      )
      if (voterRecord.registrationDate) {
        rawLines.push(`- **Registration Date:** ${voterRecord.registrationDate}`)
      }
      if (voterRecord.birthYear) {
        rawLines.push(`- **Birth Year:** ${voterRecord.birthYear}`)
        const age = new Date().getFullYear() - voterRecord.birthYear
        rawLines.push(`- **Estimated Age:** ${age}`)
      }
      if (voterRecord.county) {
        rawLines.push(`- **County:** ${voterRecord.county}`)
      }
      rawLines.push(`- **Status:** ${voterRecord.status}`)
      rawLines.push("")
      rawLines.push(`**Confidence:** ${confidence.toUpperCase()}`)
      rawLines.push(`**Methodology:** ${methodology}`)
    } else {
      rawLines.push("## Results")
      rawLines.push("No voter registration information found.")
      rawLines.push("")
      rawLines.push("**Possible reasons:**")
      rawLines.push("- Name variation (try middle name or maiden name)")
      rawLines.push("- Recent move to a different state")
      rawLines.push("- Not registered to vote")
      rawLines.push("- State restricts public access to voter data")
    }

    rawLines.push("")
    if (sources.length > 0) {
      rawLines.push("## Sources")
      for (const source of sources) {
        rawLines.push(`- [${source.name}](${source.url})`)
      }
    }

    const result: VoterRegistrationResult = {
      personName: params.personName,
      state: params.state,
      voterRecord,
      confidence,
      methodology: methodology || "No data found",
      rawContent: rawLines.join("\n"),
      sources,
    }

    return result
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Check if voter registration tool should be enabled
 */
export function shouldEnableVoterRegistrationTool(): boolean {
  // FEC API is always available (uses DEMO_KEY)
  // Linkup adds additional coverage but is optional
  return true
}

/**
 * Get state voter file availability
 */
export function getStateVoterFileInfo(state: string): {
  accessible: boolean
  method: string
  notes: string
} {
  return (
    STATE_VOTER_FILE_INFO[state.toUpperCase()] || {
      accessible: false,
      method: "unknown",
      notes: "No information available",
    }
  )
}
