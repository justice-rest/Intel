/**
 * CourtListener Tool
 * Provides access to federal court records and judicial opinions
 *
 * Uses CourtListener API - https://www.courtlistener.com/help/api/
 * FREE API - no key required (5,000 requests/hour)
 *
 * Data includes:
 * - Federal court opinions
 * - PACER documents
 * - Docket information
 * - Judge database
 * - Oral arguments
 */

import { tool } from "ai"
import { z } from "zod"
import {
  isCourtListenerEnabled,
  getCourtListenerApiToken,
  COURTLISTENER_API_BASE_URL,
  COURTLISTENER_DEFAULTS,
} from "@/lib/courtlistener/config"

// ============================================================================
// TYPES
// ============================================================================

interface OpinionResult {
  absolute_url: string
  author_str: string | null
  case_name: string
  case_name_short: string
  citation: string[]
  cluster_id: number
  court: string
  court_id: string
  date_filed: string
  docket_id: number | null
  id: number
  joined_by_str: string | null
  per_curiam: boolean
  snippet: string
  status: string
  type: string
}

interface DocketResult {
  absolute_url: string
  case_name: string
  court: string
  court_id: string
  date_filed: string | null
  date_terminated: string | null
  docket_number: string
  id: number
  parties: Array<{
    name: string
    type: string
  }>
}

interface PersonResult {
  absolute_url: string
  id: number
  name_full: string
  name_first: string
  name_middle: string | null
  name_last: string
  name_suffix: string | null
  date_dob: string | null
  date_dod: string | null
  dob_city: string | null
  dob_state: string | null
  political_affiliations: Array<{
    political_party: string
    date_start: string | null
    date_end: string | null
  }>
  positions: Array<{
    court: {
      full_name: string
      short_name: string
    } | null
    position_type: string | null
    date_start: string | null
    date_termination: string | null
    how_selected: string | null
    appointer: {
      name_full: string
    } | null
  }>
  educations: Array<{
    school: {
      name: string
    }
    degree_level: string | null
    degree_detail: string | null
    degree_year: number | null
  }>
  aba_ratings: Array<{
    rating: string
    year_rated: number | null
  }>
}

interface SearchResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CourtSearchResult {
  query: string
  searchType: string
  totalResults: number
  results: Array<{
    id: number
    caseName: string
    court: string
    dateFiled: string | null
    url: string
    snippet?: string
    citation?: string[]
    docketNumber?: string
    parties?: Array<{ name: string; type: string }>
    author?: string
    status?: string
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

export interface JudgeSearchResult {
  query: string
  totalResults: number
  judges: Array<{
    id: number
    name: string
    birthDate: string | null
    birthPlace: string | null
    positions: Array<{
      court: string
      positionType: string | null
      startDate: string | null
      endDate: string | null
      appointer: string | null
    }>
    education: Array<{
      school: string
      degree: string | null
      year: number | null
    }>
    politicalAffiliations: Array<{
      party: string
      startDate: string | null
    }>
    abaRatings: Array<{
      rating: string
      year: number | null
    }>
    url: string
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const courtSearchSchema = z.object({
  query: z
    .string()
    .describe("Search term - can be party name, case name, legal issue, or keywords"),
  searchType: z
    .enum(["opinions", "dockets", "recap"])
    .optional()
    .default("opinions")
    .describe("Type of search: 'opinions' (court decisions), 'dockets' (case filings), 'recap' (PACER documents)"),
  court: z
    .string()
    .optional()
    .describe("Filter by court (e.g., 'scotus', 'ca9', 'nysd')"),
  dateFiled_after: z
    .string()
    .optional()
    .describe("Only results after this date (YYYY-MM-DD)"),
  limit: z
    .number()
    .optional()
    .default(15)
    .describe("Maximum results to return (default: 15, max: 50)"),
})

const judgeSearchSchema = z.object({
  name: z
    .string()
    .describe("Name of the judge to search for (e.g., 'John Roberts', 'Ruth Bader Ginsburg')"),
  court: z
    .string()
    .optional()
    .describe("Filter by court (e.g., 'scotus', 'ca9')"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum results to return (default: 10, max: 25)"),
})

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCourtSearchForAI(
  results: CourtSearchResult["results"],
  query: string,
  searchType: string
): string {
  if (results.length === 0) {
    return `No ${searchType} found for "${query}" in CourtListener database.`
  }

  const lines: string[] = [
    `# Federal Court Records: "${query}"`,
    "",
    `**Search Type:** ${searchType}`,
    `**Total Results:** ${results.length}`,
    "",
    "---",
    "",
  ]

  results.forEach((result, idx) => {
    lines.push(`## ${idx + 1}. ${result.caseName}`)
    lines.push("")
    lines.push(`- **Court:** ${result.court}`)
    if (result.dateFiled) {
      lines.push(`- **Date Filed:** ${result.dateFiled}`)
    }
    if (result.docketNumber) {
      lines.push(`- **Docket Number:** ${result.docketNumber}`)
    }
    if (result.citation && result.citation.length > 0) {
      lines.push(`- **Citation:** ${result.citation.join(", ")}`)
    }
    if (result.author) {
      lines.push(`- **Author:** ${result.author}`)
    }
    if (result.status) {
      lines.push(`- **Status:** ${result.status}`)
    }
    if (result.parties && result.parties.length > 0) {
      lines.push("")
      lines.push("**Parties:**")
      result.parties.slice(0, 5).forEach((party) => {
        lines.push(`- ${party.name} (${party.type})`)
      })
    }
    if (result.snippet) {
      lines.push("")
      lines.push(`**Excerpt:** ${result.snippet.replace(/<[^>]*>/g, "")}`)
    }
    lines.push("")
    lines.push(`[View Full Record](${result.url})`)
    lines.push("")
    lines.push("---")
    lines.push("")
  })

  // Prospect research context
  lines.push("## Prospect Research Insights")
  lines.push("")
  lines.push("Court records can reveal:")
  lines.push("- Business disputes and outcomes")
  lines.push("- Bankruptcy filings")
  lines.push("- Patent/IP litigation (indicates innovation/assets)")
  lines.push("- Employment disputes")
  lines.push("- Real estate litigation")
  lines.push("- Criminal matters (if applicable)")
  lines.push("")
  lines.push("Review cases carefully to understand context and outcomes.")

  return lines.join("\n")
}

function formatJudgeSearchForAI(
  judges: JudgeSearchResult["judges"],
  query: string
): string {
  if (judges.length === 0) {
    return `No judges found matching "${query}" in CourtListener database.`
  }

  const lines: string[] = [
    `# Judge Search: "${query}"`,
    "",
    `**Total Results:** ${judges.length}`,
    "",
    "---",
    "",
  ]

  judges.forEach((judge, idx) => {
    lines.push(`## ${idx + 1}. ${judge.name}`)
    lines.push("")

    if (judge.birthDate) {
      lines.push(`- **Born:** ${judge.birthDate}${judge.birthPlace ? ` in ${judge.birthPlace}` : ""}`)
    }

    if (judge.positions.length > 0) {
      lines.push("")
      lines.push("**Judicial Positions:**")
      judge.positions.forEach((pos) => {
        const dates = []
        if (pos.startDate) dates.push(`from ${pos.startDate}`)
        if (pos.endDate) dates.push(`to ${pos.endDate}`)
        const dateStr = dates.length > 0 ? ` (${dates.join(" ")})` : ""
        const appointer = pos.appointer ? ` - Appointed by ${pos.appointer}` : ""
        lines.push(`- ${pos.court}${pos.positionType ? ` - ${pos.positionType}` : ""}${dateStr}${appointer}`)
      })
    }

    if (judge.education.length > 0) {
      lines.push("")
      lines.push("**Education:**")
      judge.education.forEach((edu) => {
        const degree = edu.degree ? ` - ${edu.degree}` : ""
        const year = edu.year ? ` (${edu.year})` : ""
        lines.push(`- ${edu.school}${degree}${year}`)
      })
    }

    if (judge.politicalAffiliations.length > 0) {
      lines.push("")
      lines.push("**Political Affiliation:**")
      judge.politicalAffiliations.forEach((aff) => {
        lines.push(`- ${aff.party}${aff.startDate ? ` (since ${aff.startDate})` : ""}`)
      })
    }

    if (judge.abaRatings.length > 0) {
      lines.push("")
      lines.push("**ABA Ratings:**")
      judge.abaRatings.forEach((rating) => {
        lines.push(`- ${rating.rating}${rating.year ? ` (${rating.year})` : ""}`)
      })
    }

    lines.push("")
    lines.push(`[View Profile](${judge.url})`)
    lines.push("")
    lines.push("---")
    lines.push("")
  })

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search federal court records
 */
export const courtSearchTool = tool({
  description:
    "Search federal court records including opinions, dockets, and PACER documents. " +
    "Useful for due diligence, finding litigation history, bankruptcy cases, and legal disputes. " +
    "Search by party name, case name, or legal issues. Covers Supreme Court, Circuit Courts, " +
    "District Courts, and Bankruptcy Courts. FREE API - no key required.",
  inputSchema: courtSearchSchema,
  execute: async ({
    query,
    searchType = "opinions",
    court,
    dateFiled_after,
    limit = 15,
  }): Promise<CourtSearchResult> => {
    console.log("[CourtListener] Searching", searchType, "for:", query)
    const startTime = Date.now()

    if (!isCourtListenerEnabled()) {
      return {
        query,
        searchType,
        totalResults: 0,
        results: [],
        rawContent: "CourtListener API is not available.",
        sources: [],
        error: "CourtListener not enabled",
      }
    }

    try {
      const token = getCourtListenerApiToken()

      // Build query parameters
      const params = new URLSearchParams({
        q: query,
        page_size: Math.min(limit, 50).toString(),
      })

      if (court) {
        params.append("court", court)
      }
      if (dateFiled_after) {
        params.append("date_filed__gte", dateFiled_after)
      }

      // Determine endpoint based on search type
      const endpoint = searchType === "dockets" ? "dockets" : searchType === "recap" ? "recap" : "opinions"
      const url = `${COURTLISTENER_API_BASE_URL}/search/?type=${endpoint === "opinions" ? "o" : "r"}&${params.toString()}`

      const headers: Record<string, string> = { Accept: "application/json" }
      if (token) {
        headers["Authorization"] = `Token ${token}`
      }

      const response = await withTimeout(
        fetch(url, { headers }),
        COURTLISTENER_DEFAULTS.timeout,
        `CourtListener request timed out after ${COURTLISTENER_DEFAULTS.timeout / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`CourtListener API error: ${response.status} - ${errorText}`)
      }

      const data: SearchResponse<OpinionResult | DocketResult> = await response.json()

      const duration = Date.now() - startTime
      console.log("[CourtListener] Found", data.results?.length || 0, "results in", duration, "ms")

      // Format results based on type
      const results: CourtSearchResult["results"] = (data.results || []).map((item) => {
        if ("snippet" in item) {
          // Opinion result
          const opinion = item as OpinionResult
          return {
            id: opinion.id,
            caseName: opinion.case_name,
            court: opinion.court,
            dateFiled: opinion.date_filed,
            url: `https://www.courtlistener.com${opinion.absolute_url}`,
            snippet: opinion.snippet,
            citation: opinion.citation,
            author: opinion.author_str || undefined,
            status: opinion.status,
          }
        } else {
          // Docket result
          const docket = item as DocketResult
          return {
            id: docket.id,
            caseName: docket.case_name,
            court: docket.court,
            dateFiled: docket.date_filed,
            url: `https://www.courtlistener.com${docket.absolute_url}`,
            docketNumber: docket.docket_number,
            parties: docket.parties,
          }
        }
      })

      // Generate sources
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `CourtListener - "${query}" Search`,
          url: `https://www.courtlistener.com/?q=${encodeURIComponent(query)}&type=${searchType === "opinions" ? "o" : "r"}`,
        },
      ]

      results.slice(0, 5).forEach((result) => {
        sources.push({
          name: result.caseName.substring(0, 50) + (result.caseName.length > 50 ? "..." : ""),
          url: result.url,
        })
      })

      const rawContent = formatCourtSearchForAI(results, query, searchType)

      return {
        query,
        searchType,
        totalResults: data.count || 0,
        results,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[CourtListener] Search failed:", errorMessage)
      return {
        query,
        searchType,
        totalResults: 0,
        results: [],
        rawContent: `Failed to search CourtListener for "${query}": ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Search for judges
 */
export const judgeSearchTool = tool({
  description:
    "Search the judicial database for information about federal judges. Returns biographical data, " +
    "judicial positions, education, political affiliations, and ABA ratings. Useful for understanding " +
    "judicial appointments and connections. FREE API - no key required.",
  inputSchema: judgeSearchSchema,
  execute: async ({
    name,
    court,
    limit = 10,
  }): Promise<JudgeSearchResult> => {
    console.log("[CourtListener] Searching judges:", name)
    const startTime = Date.now()

    if (!isCourtListenerEnabled()) {
      return {
        query: name,
        totalResults: 0,
        judges: [],
        rawContent: "CourtListener API is not available.",
        sources: [],
        error: "CourtListener not enabled",
      }
    }

    try {
      const token = getCourtListenerApiToken()

      // Build query parameters
      const params = new URLSearchParams({
        name: name,
        page_size: Math.min(limit, 25).toString(),
      })

      if (court) {
        params.append("court", court)
      }

      const url = `${COURTLISTENER_API_BASE_URL}/people/?${params.toString()}`

      const headers: Record<string, string> = { Accept: "application/json" }
      if (token) {
        headers["Authorization"] = `Token ${token}`
      }

      const response = await withTimeout(
        fetch(url, { headers }),
        COURTLISTENER_DEFAULTS.timeout,
        `CourtListener request timed out after ${COURTLISTENER_DEFAULTS.timeout / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`CourtListener API error: ${response.status} - ${errorText}`)
      }

      const data: SearchResponse<PersonResult> = await response.json()

      const duration = Date.now() - startTime
      console.log("[CourtListener] Found", data.results?.length || 0, "judges in", duration, "ms")

      // Format results
      const judges: JudgeSearchResult["judges"] = (data.results || []).map((person) => ({
        id: person.id,
        name: person.name_full,
        birthDate: person.date_dob,
        birthPlace: person.dob_city && person.dob_state ? `${person.dob_city}, ${person.dob_state}` : null,
        positions: person.positions.map((pos) => ({
          court: pos.court?.full_name || pos.court?.short_name || "Unknown Court",
          positionType: pos.position_type,
          startDate: pos.date_start,
          endDate: pos.date_termination,
          appointer: pos.appointer?.name_full || null,
        })),
        education: person.educations.map((edu) => ({
          school: edu.school.name,
          degree: edu.degree_level
            ? `${edu.degree_level}${edu.degree_detail ? ` in ${edu.degree_detail}` : ""}`
            : null,
          year: edu.degree_year,
        })),
        politicalAffiliations: person.political_affiliations.map((aff) => ({
          party: aff.political_party,
          startDate: aff.date_start,
        })),
        abaRatings: person.aba_ratings.map((rating) => ({
          rating: rating.rating,
          year: rating.year_rated,
        })),
        url: `https://www.courtlistener.com${person.absolute_url}`,
      }))

      // Generate sources
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `CourtListener - "${name}" Judge Search`,
          url: `https://www.courtlistener.com/person/?name=${encodeURIComponent(name)}`,
        },
      ]

      judges.slice(0, 5).forEach((judge) => {
        sources.push({
          name: `Judge ${judge.name}`,
          url: judge.url,
        })
      })

      const rawContent = formatJudgeSearchForAI(judges, name)

      return {
        query: name,
        totalResults: data.count || 0,
        judges,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[CourtListener] Judge search failed:", errorMessage)
      return {
        query: name,
        totalResults: 0,
        judges: [],
        rawContent: `Failed to search judges for "${name}": ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if CourtListener tools should be enabled
 */
export function shouldEnableCourtListenerTools(): boolean {
  return isCourtListenerEnabled()
}
