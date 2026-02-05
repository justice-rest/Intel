/**
 * USPTO Patent and Trademark Search Tool
 *
 * Searches the U.S. Patent and Trademark Office databases.
 * Patents and trademarks indicate innovation, intellectual property wealth.
 *
 * Data Sources:
 * - USPTO PatentsView API (patents)
 * - USPTO Trademark Electronic Search System (TESS)
 *
 * Use Cases:
 * - Find inventors and patent holders
 * - Discover trademark owners
 * - Wealth indicator (patent holders often have significant IP value)
 * - Due diligence on entrepreneurs and inventors
 *
 * FREE - No API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface Patent {
  patentNumber: string
  title: string
  abstract?: string
  inventors: string[]
  assignee?: string
  filingDate: string
  grantDate?: string
  patentType: string
  citations?: number
  claims?: number
  estimatedValue?: string
}

export interface Trademark {
  serialNumber: string
  registrationNumber?: string
  markText: string
  owner: string
  filingDate: string
  registrationDate?: string
  status: "live" | "dead" | "pending" | "unknown"
  goodsServices?: string
  classes?: string[]
}

export interface USPTOSearchResult {
  searchTerm: string
  searchType: "inventor" | "assignee" | "trademark_owner" | "any"
  patents: Patent[]
  trademarks: Trademark[]
  summary: {
    totalPatents: number
    totalTrademarks: number
    patentTypes: string[]
    estimatedIPValue: string
    wealthIndicator: "ultra_high" | "very_high" | "high" | "medium" | "unknown"
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// PATENT VALUE ESTIMATES
// ============================================================================

function estimatePatentValue(patentType: string, citations: number = 0): { min: number; max: number } {
  // Base value by patent type
  let base = { min: 10000, max: 50000 }

  const type = patentType.toUpperCase()
  if (type.includes("UTILITY")) {
    base = { min: 50000, max: 500000 }
  } else if (type.includes("DESIGN")) {
    base = { min: 10000, max: 100000 }
  } else if (type.includes("PLANT")) {
    base = { min: 25000, max: 200000 }
  }

  // Increase value based on citations (highly cited patents are more valuable)
  if (citations > 100) {
    base.min *= 10
    base.max *= 10
  } else if (citations > 50) {
    base.min *= 5
    base.max *= 5
  } else if (citations > 20) {
    base.min *= 2
    base.max *= 2
  }

  return base
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  return `$${(amount / 1000).toFixed(0)}K`
}

function getWealthIndicator(totalValue: number, patentCount: number): "ultra_high" | "very_high" | "high" | "medium" | "unknown" {
  if (totalValue >= 10000000 || patentCount >= 50) return "ultra_high"
  if (totalValue >= 1000000 || patentCount >= 20) return "very_high"
  if (totalValue >= 100000 || patentCount >= 5) return "high"
  if (patentCount >= 1) return "medium"
  return "unknown"
}

// ============================================================================
// USPTO PATENTSVIEW API SEARCH
// ============================================================================

async function searchPatentsView(
  searchTerm: string,
  searchType: "inventor" | "assignee"
): Promise<Patent[]> {
  const patents: Patent[] = []

  try {
    // Build PatentsView API query
    // API docs: https://patentsview.org/apis/api-query-language
    let query: Record<string, unknown>

    if (searchType === "inventor") {
      // Search by inventor name
      const nameParts = searchTerm.trim().split(/\s+/)
      const lastName = nameParts[nameParts.length - 1]
      const firstName = nameParts[0] || ""

      query = {
        _and: [
          { _contains: { inventor_last_name: lastName } },
          ...(firstName ? [{ _contains: { inventor_first_name: firstName } }] : []),
        ],
      }
    } else {
      // Search by assignee (company/organization)
      query = { _contains: { assignee_organization: searchTerm } }
    }

    const requestBody = {
      q: query,
      f: [
        "patent_number",
        "patent_title",
        "patent_abstract",
        "patent_date",
        "patent_type",
        "patent_num_claims",
        "inventor_first_name",
        "inventor_last_name",
        "assignee_organization",
      ],
      o: {
        per_page: 50,
        page: 1,
      },
      s: [{ patent_date: "desc" }],
    }

    const url = "https://api.patentsview.org/patents/query"

    console.log(`[USPTO] Querying PatentsView: ${url}`)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[USPTO] PatentsView API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (data.patents && Array.isArray(data.patents)) {
      for (const p of data.patents) {
        // Extract inventors
        const inventors: string[] = []
        if (p.inventors && Array.isArray(p.inventors)) {
          for (const inv of p.inventors) {
            const name = `${inv.inventor_first_name || ""} ${inv.inventor_last_name || ""}`.trim()
            if (name) inventors.push(name)
          }
        }

        // Extract assignee
        let assignee = ""
        if (p.assignees && Array.isArray(p.assignees) && p.assignees[0]) {
          assignee = p.assignees[0].assignee_organization || ""
        }

        const patent: Patent = {
          patentNumber: p.patent_number || "",
          title: p.patent_title || "",
          abstract: p.patent_abstract || undefined,
          inventors,
          assignee: assignee || undefined,
          filingDate: p.patent_date || "",
          grantDate: p.patent_date || undefined,
          patentType: p.patent_type || "utility",
          claims: p.patent_num_claims ? parseInt(p.patent_num_claims, 10) : undefined,
        }

        // Estimate value
        const value = estimatePatentValue(patent.patentType, patent.citations || 0)
        patent.estimatedValue = `${formatCurrency(value.min)} - ${formatCurrency(value.max)}`

        patents.push(patent)
      }
    }

    console.log(`[USPTO] Found ${patents.length} patents`)
  } catch (error) {
    console.error(`[USPTO] PatentsView error:`, error)
  }

  return patents
}

// ============================================================================
// USPTO TRADEMARK SEARCH (via Bulk Data API)
// ============================================================================

async function searchTrademarks(searchTerm: string): Promise<Trademark[]> {
  const trademarks: Trademark[] = []

  try {
    // USPTO TSDR API for trademark lookup
    // Note: Full trademark search requires TESS which has no public API
    // We'll use a simplified approach via the Trademark Status & Document Retrieval system

    // For now, use a web-based approach to note trademark search is available
    console.log(`[USPTO] Trademark search for: ${searchTerm}`)
    console.log(`[USPTO] Note: Full trademark search available at https://tmsearch.uspto.gov/`)

    // Trademark searches require TESS which has no public API
    // We document this as a limitation and provide guidance
  } catch (error) {
    console.error(`[USPTO] Trademark search error:`, error)
  }

  return trademarks
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchUSPTO(
  searchTerm: string,
  searchType: "inventor" | "assignee" | "trademark_owner" | "any" = "any"
): Promise<USPTOSearchResult> {
  console.log(`[USPTO] Searching for "${searchTerm}" (${searchType})`)

  const allPatents: Patent[] = []
  const allTrademarks: Trademark[] = []
  const sources: Array<{ name: string; url: string }> = [
    {
      name: "USPTO PatentsView",
      url: "https://patentsview.org/",
    },
    {
      name: "USPTO TESS (Trademark Search)",
      url: "https://tmsearch.uspto.gov/",
    },
  ]

  // Search patents
  if (searchType === "inventor" || searchType === "any") {
    const inventorPatents = await searchPatentsView(searchTerm, "inventor")
    allPatents.push(...inventorPatents)
  }

  if (searchType === "assignee" || searchType === "any") {
    const assigneePatents = await searchPatentsView(searchTerm, "assignee")
    // Deduplicate by patent number
    for (const p of assigneePatents) {
      if (!allPatents.find((existing) => existing.patentNumber === p.patentNumber)) {
        allPatents.push(p)
      }
    }
  }

  // Search trademarks (if owner search or any)
  if (searchType === "trademark_owner" || searchType === "any") {
    const trademarks = await searchTrademarks(searchTerm)
    allTrademarks.push(...trademarks)
  }

  // Calculate total estimated IP value
  let totalMinValue = 0
  let totalMaxValue = 0
  const patentTypes: string[] = []

  for (const patent of allPatents) {
    const value = estimatePatentValue(patent.patentType, patent.citations || 0)
    totalMinValue += value.min
    totalMaxValue += value.max

    if (patent.patentType && !patentTypes.includes(patent.patentType)) {
      patentTypes.push(patent.patentType)
    }
  }

  const avgValue = (totalMinValue + totalMaxValue) / 2

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# USPTO Patent & Trademark Search: ${searchTerm}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Patents Found:** ${allPatents.length}`)
  rawLines.push(`- **Total Trademarks Found:** ${allTrademarks.length}`)

  if (allPatents.length > 0) {
    rawLines.push(`- **Estimated IP Value:** ${formatCurrency(totalMinValue)} - ${formatCurrency(totalMaxValue)}`)
    rawLines.push(`- **Patent Types:** ${patentTypes.join(", ")}`)
    rawLines.push(`- **Wealth Indicator:** ${getWealthIndicator(avgValue, allPatents.length).toUpperCase().replace("_", " ")}`)
    rawLines.push("")
    rawLines.push(`## Patents`)
    rawLines.push("")

    for (const patent of allPatents.slice(0, 20)) {
      rawLines.push(`### Patent ${patent.patentNumber}`)
      rawLines.push(`- **Title:** ${patent.title}`)
      rawLines.push(`- **Type:** ${patent.patentType}`)
      rawLines.push(`- **Inventors:** ${patent.inventors.join(", ")}`)
      if (patent.assignee) {
        rawLines.push(`- **Assignee:** ${patent.assignee}`)
      }
      rawLines.push(`- **Date:** ${patent.grantDate || patent.filingDate}`)
      if (patent.claims) {
        rawLines.push(`- **Claims:** ${patent.claims}`)
      }
      if (patent.estimatedValue) {
        rawLines.push(`- **Est. Value:** ${patent.estimatedValue}`)
      }
      rawLines.push("")
    }

    if (allPatents.length > 20) {
      rawLines.push(`*... and ${allPatents.length - 20} more patents*`)
    }
  } else {
    rawLines.push("")
    rawLines.push(`## Results`)
    rawLines.push(`No patents found for "${searchTerm}".`)
    rawLines.push("")
    rawLines.push(`**Note:** Patent search covers USPTO PatentsView database (US patents only).`)
  }

  if (allTrademarks.length > 0) {
    rawLines.push("")
    rawLines.push(`## Trademarks`)
    rawLines.push("")
    for (const tm of allTrademarks.slice(0, 10)) {
      rawLines.push(`### ${tm.markText}`)
      rawLines.push(`- **Serial #:** ${tm.serialNumber}`)
      rawLines.push(`- **Owner:** ${tm.owner}`)
      rawLines.push(`- **Status:** ${tm.status.toUpperCase()}`)
      if (tm.goodsServices) {
        rawLines.push(`- **Goods/Services:** ${tm.goodsServices}`)
      }
      rawLines.push("")
    }
  } else {
    rawLines.push("")
    rawLines.push(`## Trademarks`)
    rawLines.push(`For trademark searches, use USPTO TESS: https://tmsearch.uspto.gov/`)
    rawLines.push("")
    rawLines.push(`**Wealth Indicator:** Patent holders often have significant IP portfolios.`)
    rawLines.push(`- 1-5 patents: High net worth, likely entrepreneur/inventor`)
    rawLines.push(`- 5-20 patents: Very high net worth, serial inventor`)
    rawLines.push(`- 20+ patents: Ultra high net worth, major IP holder`)
  }

  return {
    searchTerm,
    searchType,
    patents: allPatents,
    trademarks: allTrademarks,
    summary: {
      totalPatents: allPatents.length,
      totalTrademarks: allTrademarks.length,
      patentTypes,
      estimatedIPValue:
        allPatents.length > 0
          ? `${formatCurrency(totalMinValue)} - ${formatCurrency(totalMaxValue)}`
          : "$0",
      wealthIndicator: getWealthIndicator(avgValue, allPatents.length),
    },
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const usptoSearchSchema = z.object({
  searchTerm: z
    .string()
    .describe("Name of person (inventor) or company (assignee) to search for"),
  searchType: z
    .enum(["inventor", "assignee", "trademark_owner", "any"])
    .optional()
    .default("any")
    .describe("Search type: inventor (person), assignee (company), trademark_owner, or any"),
})

export const usptoSearchTool = tool({
  description:
    "Search USPTO for patents and trademarks. " +
    "Patents indicate innovation and intellectual property wealth. " +
    "Search by INVENTOR (person) or ASSIGNEE (company). " +
    "Returns: patent numbers, titles, inventors, assignees, grant dates. " +
    "WEALTH INDICATOR: Patent holders often have significant IP value. " +
    "1-5 patents: High net worth, 20+ patents: Ultra high net worth. " +
    "Estimated patent values range from $10K to $5M+ for highly-cited patents.",

  inputSchema: usptoSearchSchema,

  execute: async ({ searchTerm, searchType }): Promise<USPTOSearchResult> => {
    return searchUSPTO(searchTerm, searchType)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableUSPTOSearchTool(): boolean {
  return true
}

export { searchUSPTO }
