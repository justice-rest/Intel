/**
 * OpenSanctions Tool
 * Provides PEP (Politically Exposed Persons) and sanctions screening
 *
 * Uses OpenSanctions API - https://www.opensanctions.org/api/
 * COMPLETELY FREE - open source sanctions and PEP data
 *
 * Data includes:
 * - Sanctions lists (OFAC, EU, UN, etc.)
 * - Politically Exposed Persons (PEPs)
 * - Criminals and wanted persons
 * - Debarred entities
 */

import { tool } from "ai"
import { z } from "zod"
import {
  isOpenSanctionsEnabled,
  getOpenSanctionsApiKey,
  OPENSANCTIONS_API_BASE_URL,
  OPENSANCTIONS_DEFAULTS,
  RISK_LEVELS,
} from "@/lib/opensanctions/config"

// ============================================================================
// TYPES
// ============================================================================

interface OpenSanctionsEntity {
  id: string
  caption: string
  schema: string
  properties: {
    name?: string[]
    alias?: string[]
    birthDate?: string[]
    birthPlace?: string[]
    nationality?: string[]
    country?: string[]
    position?: string[]
    topics?: string[]
    description?: string[]
    notes?: string[]
    sanctions?: string[]
    sourceUrl?: string[]
    wikidataId?: string[]
    gender?: string[]
    address?: string[]
    keywords?: string[]
  }
  datasets: string[]
  referents: string[]
  first_seen: string
  last_seen: string
  last_change: string
  target: boolean
}

interface OpenSanctionsSearchResponse {
  limit: number
  offset: number
  total: {
    value: number
    relation: string
  }
  results: Array<{
    id: string
    caption: string
    schema: string
    properties: OpenSanctionsEntity["properties"]
    datasets: string[]
    referents: string[]
    first_seen: string
    last_seen: string
    last_change: string
    target: boolean
    score: number
    match: boolean
    features: Record<string, number>
  }>
}

export interface SanctionsScreeningResult {
  query: string
  totalMatches: number
  riskLevel: string
  matches: Array<{
    id: string
    name: string
    matchScore: number
    entityType: string
    topics: string[]
    sanctions: string[]
    nationality: string[]
    birthDate: string | null
    position: string | null
    description: string | null
    datasets: string[]
    firstSeen: string
    lastUpdated: string
    isTarget: boolean
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const sanctionsScreeningSchema = z.object({
  name: z
    .string()
    .describe("Name of the person or organization to screen (e.g., 'Vladimir Putin', 'Huawei')"),
  birthDate: z
    .string()
    .optional()
    .describe("Birth date to improve matching (YYYY-MM-DD format)"),
  nationality: z
    .string()
    .optional()
    .describe("Two-letter country code to filter results (e.g., 'RU', 'CN', 'IR')"),
  entityType: z
    .enum(["Person", "Organization", "Company", "any"])
    .optional()
    .default("any")
    .describe("Type of entity to search for"),
  includeWeakMatches: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include lower-confidence matches (may include false positives)"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of matches to return (default: 10, max: 50)"),
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

function determineRiskLevel(matches: SanctionsScreeningResult["matches"]): string {
  if (matches.length === 0) return RISK_LEVELS.CLEAR

  // Check for high-risk indicators
  const hasHighRisk = matches.some((match) => {
    const isSanctioned = match.sanctions.length > 0
    const isPEP = match.topics.includes("role.pep")
    const isTarget = match.isTarget
    const highScore = match.matchScore >= 0.8

    return (isSanctioned || isTarget) && highScore
  })

  if (hasHighRisk) return RISK_LEVELS.HIGH

  // Check for medium risk (PEP without sanctions)
  const hasMediumRisk = matches.some((match) => {
    const isPEP = match.topics.includes("role.pep") || match.topics.includes("role.oligarch")
    const isPublicFigure = match.topics.includes("role.rca") // Relative/close associate
    const goodScore = match.matchScore >= 0.6

    return (isPEP || isPublicFigure) && goodScore
  })

  if (hasMediumRisk) return RISK_LEVELS.MEDIUM

  // Low risk - potential matches but need review
  return RISK_LEVELS.LOW
}

function formatScreeningForAI(
  matches: SanctionsScreeningResult["matches"],
  query: string,
  riskLevel: string
): string {
  const lines: string[] = [
    `# OpenSanctions Screening: "${query}"`,
    "",
    `## Risk Assessment: ${riskLevel}`,
    "",
  ]

  // Risk level explanation
  switch (riskLevel) {
    case RISK_LEVELS.HIGH:
      lines.push("**WARNING:** High-risk match found. Person/entity appears on sanctions lists or is a confirmed target.")
      break
    case RISK_LEVELS.MEDIUM:
      lines.push("**CAUTION:** Medium-risk match found. Person may be a Politically Exposed Person (PEP) or close associate.")
      break
    case RISK_LEVELS.LOW:
      lines.push("**NOTE:** Low-confidence matches found. Manual review recommended to confirm identity.")
      break
    case RISK_LEVELS.CLEAR:
      lines.push("**CLEAR:** No matches found in sanctions, PEP, or watchlist databases.")
      break
  }

  lines.push("")
  lines.push("---")
  lines.push("")

  if (matches.length === 0) {
    lines.push("No matches found in OpenSanctions database (100+ global sources).")
    lines.push("")
    lines.push("This search covered:")
    lines.push("- OFAC SDN List (US Treasury)")
    lines.push("- EU Consolidated Sanctions")
    lines.push("- UN Security Council Sanctions")
    lines.push("- Interpol Notices")
    lines.push("- PEP databases (politicians, government officials)")
    lines.push("- Debarment lists")
    return lines.join("\n")
  }

  lines.push(`**Total Matches:** ${matches.length}`)
  lines.push("")

  matches.forEach((match, idx) => {
    const riskIndicators: string[] = []
    if (match.sanctions.length > 0) riskIndicators.push("SANCTIONED")
    if (match.topics.includes("role.pep")) riskIndicators.push("PEP")
    if (match.topics.includes("role.oligarch")) riskIndicators.push("OLIGARCH")
    if (match.isTarget) riskIndicators.push("TARGET")

    const riskBadge = riskIndicators.length > 0 ? ` [${riskIndicators.join(", ")}]` : ""

    lines.push(`## ${idx + 1}. ${match.name}${riskBadge}`)
    lines.push("")
    lines.push(`- **Match Score:** ${Math.round(match.matchScore * 100)}%`)
    lines.push(`- **Entity Type:** ${match.entityType}`)

    if (match.nationality.length > 0) {
      lines.push(`- **Nationality:** ${match.nationality.join(", ")}`)
    }
    if (match.birthDate) {
      lines.push(`- **Birth Date:** ${match.birthDate}`)
    }
    if (match.position) {
      lines.push(`- **Position:** ${match.position}`)
    }
    if (match.description) {
      lines.push(`- **Description:** ${match.description}`)
    }
    if (match.sanctions.length > 0) {
      lines.push(`- **Sanctions:** ${match.sanctions.join(", ")}`)
    }
    if (match.topics.length > 0) {
      lines.push(`- **Categories:** ${match.topics.join(", ")}`)
    }
    lines.push(`- **Data Sources:** ${match.datasets.join(", ")}`)
    lines.push(`- **First Seen:** ${match.firstSeen}`)
    lines.push(`- **Last Updated:** ${match.lastUpdated}`)
    lines.push("")
    lines.push("---")
    lines.push("")
  })

  // Prospect research context
  lines.push("## Implications for Prospect Research")
  lines.push("")

  if (riskLevel === RISK_LEVELS.HIGH) {
    lines.push("**DO NOT SOLICIT:** This individual/entity appears on sanctions lists.")
    lines.push("Accepting donations may violate OFAC regulations and other sanctions laws.")
  } else if (riskLevel === RISK_LEVELS.MEDIUM) {
    lines.push("**ENHANCED DUE DILIGENCE REQUIRED:** PEP status indicates political exposure.")
    lines.push("Consider additional background checks and source of funds verification.")
  } else if (riskLevel === RISK_LEVELS.LOW) {
    lines.push("**MANUAL REVIEW:** Low-confidence matches may be false positives.")
    lines.push("Verify identity matches before making solicitation decisions.")
  } else {
    lines.push("**CLEARED:** No sanctions or PEP concerns identified.")
    lines.push("Standard prospect cultivation procedures may proceed.")
  }

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Screen a person or organization against sanctions and PEP databases
 */
export const opensanctionsScreeningTool = tool({
  description:
    "Screen a person or organization against global sanctions lists and PEP (Politically Exposed Persons) databases. " +
    "Uses OpenSanctions - an open-source database aggregating 100+ sources including OFAC, EU Sanctions, " +
    "UN Security Council, Interpol, and national PEP lists. Essential for compliance and due diligence " +
    "in prospect research. Returns risk level (HIGH/MEDIUM/LOW/CLEAR) and detailed match information. " +
    "COMPLETELY FREE - no API key required.",
  parameters: sanctionsScreeningSchema,
  execute: async ({
    name,
    birthDate,
    nationality,
    entityType = "any",
    includeWeakMatches = false,
    limit = 10,
  }): Promise<SanctionsScreeningResult> => {
    console.log("[OpenSanctions] Screening:", name)
    const startTime = Date.now()

    if (!isOpenSanctionsEnabled()) {
      return {
        query: name,
        totalMatches: 0,
        riskLevel: RISK_LEVELS.CLEAR,
        matches: [],
        rawContent: "OpenSanctions API is not available.",
        sources: [],
        error: "OpenSanctions not enabled",
      }
    }

    try {
      const apiKey = getOpenSanctionsApiKey()

      // Build request body for matching
      const requestBody: Record<string, unknown> = {
        queries: {
          main: {
            schema: entityType !== "any" ? entityType : "Thing",
            properties: {
              name: [name],
            },
          },
        },
      }

      // Add optional properties
      if (birthDate) {
        (requestBody.queries as Record<string, Record<string, Record<string, string[]>>>).main.properties.birthDate = [birthDate]
      }
      if (nationality) {
        (requestBody.queries as Record<string, Record<string, Record<string, string[]>>>).main.properties.nationality = [nationality]
      }

      // Build URL with parameters
      const params = new URLSearchParams({
        limit: Math.min(limit, 50).toString(),
        threshold: includeWeakMatches ? "0.3" : String(OPENSANCTIONS_DEFAULTS.threshold),
        fuzzy: String(OPENSANCTIONS_DEFAULTS.fuzzy),
      })

      if (apiKey) {
        params.append("api_key", apiKey)
      }

      // Use the search endpoint with simpler query
      const searchUrl = `${OPENSANCTIONS_API_BASE_URL}/search/default?q=${encodeURIComponent(name)}&${params.toString()}`

      const response = await withTimeout(
        fetch(searchUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }),
        OPENSANCTIONS_DEFAULTS.timeout,
        `OpenSanctions request timed out after ${OPENSANCTIONS_DEFAULTS.timeout / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenSanctions API error: ${response.status} - ${errorText}`)
      }

      const data: OpenSanctionsSearchResponse = await response.json()

      const duration = Date.now() - startTime
      console.log("[OpenSanctions] Found", data.results?.length || 0, "matches in", duration, "ms")

      // Filter and format matches
      const matches: SanctionsScreeningResult["matches"] = (data.results || [])
        .filter((result) => includeWeakMatches || result.score >= OPENSANCTIONS_DEFAULTS.threshold)
        .slice(0, limit)
        .map((result) => ({
          id: result.id,
          name: result.caption || result.properties.name?.[0] || "Unknown",
          matchScore: result.score,
          entityType: result.schema,
          topics: result.properties.topics || [],
          sanctions: result.properties.sanctions || [],
          nationality: result.properties.nationality || result.properties.country || [],
          birthDate: result.properties.birthDate?.[0] || null,
          position: result.properties.position?.[0] || null,
          description: result.properties.description?.[0] || result.properties.notes?.[0] || null,
          datasets: result.datasets,
          firstSeen: result.first_seen,
          lastUpdated: result.last_change,
          isTarget: result.target,
        }))

      // Determine risk level
      const riskLevel = determineRiskLevel(matches)

      // Generate sources
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `OpenSanctions - "${name}" Screening`,
          url: `https://www.opensanctions.org/search/?q=${encodeURIComponent(name)}`,
        },
      ]

      matches.slice(0, 5).forEach((match) => {
        sources.push({
          name: `${match.name} - OpenSanctions Entity`,
          url: `https://www.opensanctions.org/entities/${match.id}/`,
        })
      })

      const rawContent = formatScreeningForAI(matches, name, riskLevel)

      return {
        query: name,
        totalMatches: data.total?.value || 0,
        riskLevel,
        matches,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[OpenSanctions] Screening failed:", errorMessage)

      // Format error nicely for UI display
      const errorContent = [
        `# OpenSanctions Screening: "${name}"`,
        "",
        "## ⚠️ Screening Unavailable",
        "",
        "The OpenSanctions screening could not be completed.",
        "",
        `**Error:** ${errorMessage}`,
        "",
        "---",
        "",
        "### How to Enable OpenSanctions",
        "",
        "OpenSanctions provides **FREE** access with an API key:",
        "",
        "1. **Get a FREE API key** at [opensanctions.org/api](https://www.opensanctions.org/api/)",
        "2. Add to your `.env.local` file:",
        "   ```",
        "   OPENSANCTIONS_API_KEY=your_api_key_here",
        "   ```",
        "3. Restart the application",
        "",
        "### What OpenSanctions Screens",
        "",
        "- **OFAC SDN List** (US Treasury sanctions)",
        "- **EU Consolidated Sanctions**",
        "- **UN Security Council Sanctions**",
        "- **Interpol Notices**",
        "- **PEP Databases** (Politically Exposed Persons)",
        "- **100+ global watchlist sources**",
        "",
        "### Manual Search",
        "",
        `You can manually search at: [OpenSanctions Search](https://www.opensanctions.org/search/?q=${encodeURIComponent(name)})`,
      ].join("\n")

      return {
        query: name,
        totalMatches: 0,
        riskLevel: RISK_LEVELS.CLEAR,
        matches: [],
        rawContent: errorContent,
        sources: [
          {
            name: "OpenSanctions - Manual Search",
            url: `https://www.opensanctions.org/search/?q=${encodeURIComponent(name)}`,
          },
          {
            name: "OpenSanctions - Get API Key",
            url: "https://www.opensanctions.org/api/",
          },
        ],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if OpenSanctions tools should be enabled
 */
export function shouldEnableOpenSanctionsTools(): boolean {
  return isOpenSanctionsEnabled()
}
