/**
 * Parallel AI Structured Research Tool
 *
 * Uses Parallel's Task API to return structured JSON output instead of raw text.
 * Eliminates parsing errors and provides typed, validated data directly.
 *
 * Benefits over standard search:
 * - Structured JSON output with defined schema
 * - No text parsing required
 * - Validated data types
 * - Direct integration with giving capacity calculations
 *
 * @see /lib/parallel/task-api.ts
 */

import { tool } from "ai"
import { z } from "zod"
import {
  executeProspectResearchTask,
  getTaskApiStatus,
  type ProspectResearchOutput,
  type TaskRunResult,
} from "@/lib/parallel/task-api"
import { shouldUseParallel } from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// TYPES
// ============================================================================

export interface StructuredResearchResult {
  prospectName: string
  data: ProspectResearchOutput | null
  sources: Array<{
    url: string
    title?: string
    excerpts?: string[]
    fieldName?: string
    reasoning?: string
  }>
  runId?: string
  durationMs: number
  error?: string
}

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * Check if structured research should be enabled for a user
 */
export function shouldEnableStructuredResearch(userId?: string): boolean {
  if (!userId) {
    return getTaskApiStatus().available
  }

  // Check if user is in Task API rollout
  return shouldUseParallel(userId, "PARALLEL_TASK_API")
}

/**
 * Get availability message for error responses
 */
export function getStructuredResearchAvailabilityMessage(): string {
  const status = getTaskApiStatus()

  if (!status.configured) {
    return "Structured research is not configured. PARALLEL_API_KEY is missing."
  }

  if (!status.enabled) {
    return "Structured research is currently disabled."
  }

  if (status.circuitOpen) {
    return "Structured research is temporarily unavailable due to high error rates."
  }

  return "Structured research is available."
}

// ============================================================================
// SCHEMA
// ============================================================================

const structuredResearchSchema = z.object({
  name: z.string().describe("Full name of the prospect to research"),
  address: z.string().optional().describe("Address for property research (optional)"),
  employer: z.string().optional().describe("Current employer (optional)"),
  title: z.string().optional().describe("Job title (optional)"),
  city: z.string().optional().describe("City for location disambiguation (optional)"),
  state: z.string().optional().describe("State for location disambiguation (optional)"),
  focus_areas: z
    .array(
      z.enum([
        "real_estate",
        "business",
        "philanthropy",
        "securities",
        "biography",
      ])
    )
    .optional()
    .describe("Specific areas to focus research on. Default: all areas"),
})

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * Parallel AI Structured Research Tool
 *
 * Returns structured JSON with typed fields instead of raw text.
 * Use when you need specific data points for calculations or analysis.
 */
export const parallelStructuredResearchTool = tool({
  description:
    "STRUCTURED RESEARCH: Returns typed JSON data instead of text. " +
    "Use when you need specific data points like age, property values, " +
    "business revenue, or giving capacity ratings. " +
    "Output is already parsed - no text extraction needed. " +
    "Returns: name, age, spouse, education, realEstate (with values), " +
    "businesses (with revenue), securities, philanthropy, politicalGiving, " +
    "netWorthEstimate, givingCapacityRating (A/B/C/D), and summary. " +
    "COST: ~$0.02/research (uses Task API with Pro processor).",
  parameters: structuredResearchSchema,
  execute: async (params): Promise<StructuredResearchResult> => {
    const { name, address, employer, title, city, state, focus_areas } = params
    console.log(`[Parallel Structured] Starting research for: ${name}`)

    // Check availability
    const status = getTaskApiStatus()
    if (!status.available) {
      const errorMessage = getStructuredResearchAvailabilityMessage()
      return {
        prospectName: name,
        data: null,
        sources: [],
        durationMs: 0,
        error: errorMessage,
      }
    }

    try {
      const result = await executeProspectResearchTask(
        { name, address, employer, title, city, state },
        { focusAreas: focus_areas, processor: "pro" }
      )

      console.log(
        `[Parallel Structured] Completed in ${result.durationMs}ms, ` +
          `${result.sources.length} sources`
      )

      if (result.outputType === "json" && result.output) {
        return {
          prospectName: name,
          data: result.output,
          sources: result.sources,
          runId: result.runId,
          durationMs: result.durationMs,
        }
      } else {
        // Fallback - shouldn't happen with schema
        return {
          prospectName: name,
          data: null,
          sources: result.sources,
          runId: result.runId,
          durationMs: result.durationMs,
          error: "Unexpected text output instead of structured JSON",
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      console.error(`[Parallel Structured] Research failed:`, errorMessage)

      return {
        prospectName: name,
        data: null,
        sources: [],
        durationMs: 0,
        error: `Research failed: ${errorMessage}`,
      }
    }
  },
})

// ============================================================================
// BATCH PROCESSING EXPORT
// ============================================================================

/**
 * Execute structured research for batch processing
 *
 * @param prospect - Prospect information
 * @returns Structured research result
 */
export async function executeStructuredResearch(
  prospect: {
    name: string
    address?: string
    employer?: string
    title?: string
    city?: string
    state?: string
  },
  focusAreas?: Array<
    "real_estate" | "business" | "philanthropy" | "securities" | "biography"
  >
): Promise<TaskRunResult<ProspectResearchOutput>> {
  return executeProspectResearchTask(prospect, { focusAreas, processor: "pro" })
}

/**
 * Format structured output for display
 */
export function formatStructuredOutput(
  data: ProspectResearchOutput
): string {
  const sections: string[] = []

  sections.push(`## ${data.name}\n`)
  sections.push(data.summary + "\n")

  // Basic info
  if (data.age || data.spouse) {
    const basicInfo: string[] = []
    if (data.age) basicInfo.push(`**Age:** ${data.age}`)
    if (data.spouse) basicInfo.push(`**Spouse:** ${data.spouse}`)
    sections.push("### Basic Information\n" + basicInfo.join(" | ") + "\n")
  }

  // Education
  if (data.education && data.education.length > 0) {
    sections.push("### Education\n")
    for (const edu of data.education) {
      sections.push(
        `- ${edu.degree ? `${edu.degree}, ` : ""}${edu.institution}${edu.year ? ` (${edu.year})` : ""}`
      )
    }
    sections.push("")
  }

  // Real Estate
  if (data.realEstate && data.realEstate.length > 0) {
    sections.push("### Real Estate\n")
    for (const prop of data.realEstate) {
      const value = prop.estimatedValue
        ? `$${(prop.estimatedValue / 1000000).toFixed(2)}M`
        : prop.valueLow && prop.valueHigh
          ? `$${(prop.valueLow / 1000000).toFixed(2)}M - $${(prop.valueHigh / 1000000).toFixed(2)}M`
          : "Value unknown"
      const verified = prop.isVerified ? "[Verified]" : "[Estimated]"
      sections.push(`- ${prop.address}: ${value} ${verified}`)
    }
    if (data.totalRealEstateValue) {
      sections.push(
        `\n**Total Real Estate:** $${(data.totalRealEstateValue / 1000000).toFixed(2)}M`
      )
    }
    sections.push("")
  }

  // Businesses
  if (data.businesses && data.businesses.length > 0) {
    sections.push("### Business & Professional\n")
    for (const biz of data.businesses) {
      const revenue = biz.estimatedRevenue
        ? ` (~$${(biz.estimatedRevenue / 1000000).toFixed(1)}M revenue)`
        : ""
      const owner = biz.isOwner ? " (Owner)" : ""
      sections.push(`- **${biz.role}**, ${biz.name}${owner}${revenue}`)
    }
    sections.push("")
  }

  // Securities
  if (data.securities?.hasSecFilings && data.securities.companies?.length) {
    sections.push("### SEC Filings\n")
    for (const company of data.securities.companies) {
      sections.push(
        `- ${company.companyName} (${company.ticker})${company.role ? ` - ${company.role}` : ""}`
      )
    }
    sections.push("")
  }

  // Philanthropy
  if (data.philanthropy) {
    const hasFoundations = data.philanthropy.foundations?.length
    const hasBoards = data.philanthropy.boardMemberships?.length
    const hasGifts = data.philanthropy.majorGifts?.length

    if (hasFoundations || hasBoards || hasGifts) {
      sections.push("### Philanthropy\n")

      if (data.philanthropy.foundations?.length) {
        sections.push("**Foundations:**")
        for (const f of data.philanthropy.foundations) {
          sections.push(`- ${f.name}${f.role ? ` (${f.role})` : ""}`)
        }
      }

      if (data.philanthropy.boardMemberships?.length) {
        sections.push("**Board Memberships:**")
        for (const b of data.philanthropy.boardMemberships) {
          sections.push(`- ${b.organization}${b.role ? ` (${b.role})` : ""}`)
        }
      }

      if (data.philanthropy.majorGifts?.length) {
        sections.push("**Major Gifts:**")
        for (const g of data.philanthropy.majorGifts) {
          const amount = g.amount
            ? `$${g.amount >= 1000000 ? (g.amount / 1000000).toFixed(1) + "M" : (g.amount / 1000).toFixed(0) + "K"}`
            : ""
          sections.push(
            `- ${g.recipient}${amount ? `: ${amount}` : ""}${g.year ? ` (${g.year})` : ""}`
          )
        }
      }
      sections.push("")
    }
  }

  // Political Giving
  if (data.politicalGiving?.totalAmount) {
    sections.push("### Political Giving\n")
    sections.push(
      `**Total:** $${data.politicalGiving.totalAmount.toLocaleString()}` +
        (data.politicalGiving.partyLean
          ? ` (${data.politicalGiving.partyLean})`
          : "")
    )
    sections.push("")
  }

  // Giving Capacity
  if (data.givingCapacityRating || data.netWorthEstimate) {
    sections.push("### Giving Capacity\n")
    if (data.givingCapacityRating) {
      const ratingDescriptions: Record<string, string> = {
        A: "$1M+ capacity (major gift prospect)",
        B: "$100K-$1M capacity (leadership gift)",
        C: "$25K-$100K capacity (mid-level)",
        D: "Under $25K capacity (annual fund)",
      }
      sections.push(
        `**Rating:** ${data.givingCapacityRating} - ${ratingDescriptions[data.givingCapacityRating]}`
      )
    }
    if (data.netWorthEstimate) {
      const low = data.netWorthEstimate.low
        ? `$${(data.netWorthEstimate.low / 1000000).toFixed(1)}M`
        : "?"
      const high = data.netWorthEstimate.high
        ? `$${(data.netWorthEstimate.high / 1000000).toFixed(1)}M`
        : "?"
      sections.push(
        `**Estimated Net Worth:** ${low} - ${high}` +
          (data.netWorthEstimate.confidence
            ? ` (${data.netWorthEstimate.confidence} confidence)`
            : "")
      )
    }
  }

  return sections.join("\n")
}
