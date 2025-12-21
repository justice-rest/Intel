/**
 * Foundation Grants Tool
 * Retrieves grants made by private foundations from Form 990-PF Schedule I
 *
 * Key Features:
 * - Search foundations by name or EIN
 * - Get grants disbursed by the foundation
 * - Identify grant recipients and amounts
 * - Understand foundation giving patterns
 *
 * Data Sources:
 * - ProPublica Nonprofit Explorer API (FREE, no key required)
 * - 990-PF filings (Schedule I contains grants made)
 * - Linkup web search for additional grant details
 *
 * Use Cases:
 * - Discover foundation giving history
 * - Find grants to specific recipients
 * - Analyze foundation funding patterns
 * - Research family foundation philanthropy
 */

import { tool } from "ai"
import { z } from "zod"
import { getLinkupApiKeyOptional, isLinkupEnabled } from "@/lib/linkup/config"
import { LinkupClient } from "linkup-sdk"

// ============================================================================
// CONSTANTS
// ============================================================================

const PROPUBLICA_API_BASE = "https://projects.propublica.org/nonprofits/api/v2"
const PROPUBLICA_TIMEOUT_MS = 15000

// ============================================================================
// TYPES
// ============================================================================

export interface GrantRecord {
  recipientName: string
  recipientEIN?: string
  amount: number
  purpose?: string
  city?: string
  state?: string
  grantDate?: string
}

export interface FoundationGrantsResult {
  foundation: {
    name: string
    ein: string
    city?: string
    state?: string
    taxYear: number
  }
  totalGrantsAmount: number
  grantCount: number
  grants: GrantRecord[]
  grantsByCategory: Record<string, number>
  avgGrantSize: number
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

interface ProPublicaFiling {
  ein: number
  tax_prd: number
  tax_prd_yr: number
  formtype: number
  pdf_url?: string
  updated?: string
  totrevenue?: number
  totfuncexpns?: number
  totassetsend?: number
  totliabend?: number
}

interface ProPublicaOrgResponse {
  organization: {
    ein: number
    strein: string
    name: string
    address?: string
    city?: string
    state?: string
    zipcode?: string
    ntee_code?: string
    subseccd?: number
    guidestar_url?: string
  }
  filings_with_data: ProPublicaFiling[]
  filings_without_data: ProPublicaFiling[]
}

// ============================================================================
// SCHEMAS
// ============================================================================

const foundationGrantsSchema = z.object({
  foundationEIN: z
    .string()
    .optional()
    .describe(
      "Foundation's EIN (9 digits, with or without hyphen). " +
        "Preferred method - use if known."
    ),
  foundationName: z
    .string()
    .optional()
    .describe(
      "Foundation name to search for (e.g., 'Gates Foundation', 'Smith Family Foundation'). " +
        "Used if EIN is not known."
    ),
  taxYear: z
    .number()
    .optional()
    .describe("Specific tax year to retrieve grants for (e.g., 2022)"),
  recipientName: z
    .string()
    .optional()
    .describe("Filter grants to a specific recipient organization"),
  limit: z
    .number()
    .optional()
    .default(25)
    .describe("Maximum number of grants to return (default: 25)"),
})

export type FoundationGrantsParams = z.infer<typeof foundationGrantsSchema>

// ============================================================================
// HELPERS
// ============================================================================

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

function formatEin(ein: string | number): string {
  const einStr = String(ein).replace(/-/g, "").padStart(9, "0")
  return `${einStr.slice(0, 2)}-${einStr.slice(2)}`
}

/**
 * Search ProPublica for a foundation by name
 */
async function searchFoundation(
  name: string
): Promise<{ ein: string; name: string; city?: string; state?: string } | null> {
  const url = `${PROPUBLICA_API_BASE}/search.json?q=${encodeURIComponent(name)}`

  try {
    const response = await withTimeout(
      fetch(url, {
        headers: { Accept: "application/json" },
      }),
      PROPUBLICA_TIMEOUT_MS,
      "ProPublica search timed out"
    )

    if (!response.ok) {
      console.error(`[Foundation Grants] Search failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    const orgs = data.organizations || []

    // Look for private foundations (Form 990-PF filers)
    // Or just return the first match
    for (const org of orgs) {
      return {
        ein: formatEin(org.ein),
        name: org.name,
        city: org.city,
        state: org.state,
      }
    }

    return null
  } catch (error) {
    console.error("[Foundation Grants] Search error:", error)
    return null
  }
}

/**
 * Get foundation details from ProPublica
 */
async function getFoundationDetails(ein: string): Promise<ProPublicaOrgResponse | null> {
  // Remove hyphen for API call
  const cleanEin = ein.replace(/-/g, "")
  const url = `${PROPUBLICA_API_BASE}/organizations/${cleanEin}.json`

  try {
    const response = await withTimeout(
      fetch(url, {
        headers: { Accept: "application/json" },
      }),
      PROPUBLICA_TIMEOUT_MS,
      "ProPublica fetch timed out"
    )

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Foundation Grants] Foundation not found: ${ein}`)
        return null
      }
      console.error(`[Foundation Grants] API error: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[Foundation Grants] Fetch error:", error)
    return null
  }
}

/**
 * Search for grant details via Linkup
 * Schedule I data isn't in the ProPublica API, so we search the web
 */
async function searchGrantsViaLinkup(
  foundationName: string,
  taxYear?: number,
  recipientName?: string
): Promise<{ grants: GrantRecord[]; sources: Array<{ name: string; url: string }> }> {
  const apiKey = getLinkupApiKeyOptional()
  if (!apiKey || !isLinkupEnabled()) {
    return { grants: [], sources: [] }
  }

  const client = new LinkupClient({ apiKey })

  // Build search query
  const queryParts = [`"${foundationName}"`, "foundation grants", "990-PF"]
  if (taxYear) queryParts.push(String(taxYear))
  if (recipientName) queryParts.push(`"${recipientName}"`)
  queryParts.push("Schedule I grantees")

  const query = queryParts.join(" ")

  console.log(`[Foundation Grants] Linkup search: ${query}`)

  try {
    const result = await client.search({
      query,
      depth: "deep",
      outputType: "sourcedAnswer",
    })

    if (!result.answer) {
      return { grants: [], sources: [] }
    }

    // Parse grants from the answer
    const grants: GrantRecord[] = []

    // Look for grant patterns: "$X to Organization" or "Organization: $X"
    const grantPatterns = [
      /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:to|for)\s+([^,\n]+)/gi,
      /([A-Z][^:,\n]+)(?::|received)\s*\$\s*([\d,]+)/gi,
    ]

    for (const pattern of grantPatterns) {
      let match
      while ((match = pattern.exec(result.answer)) !== null) {
        let amount: number
        let recipient: string

        if (match[1].startsWith("$") || /^\d/.test(match[1])) {
          // Pattern 1: $X to Organization
          amount = parseFloat(match[1].replace(/[$,]/g, ""))
          recipient = match[2].trim()
        } else {
          // Pattern 2: Organization: $X
          recipient = match[1].trim()
          amount = parseFloat(match[2].replace(/[$,]/g, ""))
        }

        if (amount > 0 && recipient.length > 2) {
          grants.push({
            recipientName: recipient,
            amount,
          })
        }
      }
    }

    const sources = (result.sources || []).map(
      (s: { name?: string; url: string }) => ({
        name: s.name || "Foundation Grants Data",
        url: s.url,
      })
    )

    return { grants, sources }
  } catch (error) {
    console.error("[Foundation Grants] Linkup search failed:", error)
    return { grants: [], sources: [] }
  }
}

/**
 * Categorize grants by recipient type
 */
function categorizeGrants(grants: GrantRecord[]): Record<string, number> {
  const categories: Record<string, number> = {}

  const categoryKeywords: Record<string, string[]> = {
    Education: ["school", "university", "college", "academy", "education", "scholarship"],
    Health: ["hospital", "health", "medical", "clinic", "cancer", "disease"],
    "Arts & Culture": ["museum", "arts", "theater", "symphony", "cultural", "library"],
    "Human Services": ["food bank", "shelter", "homeless", "family services", "community"],
    Environment: ["conservation", "wildlife", "environmental", "nature", "climate"],
    Religion: ["church", "temple", "mosque", "synagogue", "religious", "faith"],
    International: ["international", "global", "overseas", "foreign"],
  }

  for (const grant of grants) {
    let matched = false
    const recipientLower = grant.recipientName.toLowerCase()

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => recipientLower.includes(kw))) {
        categories[category] = (categories[category] || 0) + grant.amount
        matched = true
        break
      }
    }

    if (!matched) {
      categories["Other"] = (categories["Other"] || 0) + grant.amount
    }
  }

  return categories
}

/**
 * Format grant for display
 */
function formatGrant(grant: GrantRecord, index: number): string {
  const lines: string[] = []
  lines.push(`${index + 1}. **${grant.recipientName}**`)
  lines.push(`   - Amount: $${grant.amount.toLocaleString()}`)
  if (grant.recipientEIN) {
    lines.push(`   - EIN: ${grant.recipientEIN}`)
  }
  if (grant.purpose) {
    lines.push(`   - Purpose: ${grant.purpose}`)
  }
  if (grant.city || grant.state) {
    lines.push(`   - Location: ${[grant.city, grant.state].filter(Boolean).join(", ")}`)
  }
  return lines.join("\n")
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const foundationGrantsTool = tool({
  description:
    "Get grants made by a private foundation from Form 990-PF Schedule I. " +
    "Returns: grant recipients, amounts, purposes, and giving patterns. " +
    "Search by foundation name or EIN. " +
    "Useful for understanding foundation philanthropy and funding history. " +
    "Uses ProPublica Nonprofit Explorer (FREE) + web search for grant details.",

  parameters: foundationGrantsSchema,

  execute: async (params: FoundationGrantsParams): Promise<FoundationGrantsResult> => {
    console.log("[Foundation Grants] Starting search:", params)

    const sources: Array<{ name: string; url: string }> = []

    // Validate input
    if (!params.foundationEIN && !params.foundationName) {
      return {
        foundation: {
          name: "Unknown",
          ein: "",
          taxYear: params.taxYear || new Date().getFullYear() - 1,
        },
        totalGrantsAmount: 0,
        grantCount: 0,
        grants: [],
        grantsByCategory: {},
        avgGrantSize: 0,
        rawContent: "Error: Must provide either foundationEIN or foundationName",
        sources: [],
        error: "Must provide either foundationEIN or foundationName",
      }
    }

    // Step 1: Get foundation EIN if only name provided
    let ein = params.foundationEIN
    let foundationName = params.foundationName || ""

    if (!ein && foundationName) {
      const searchResult = await searchFoundation(foundationName)
      if (searchResult) {
        ein = searchResult.ein
        foundationName = searchResult.name
      } else {
        return {
          foundation: {
            name: foundationName,
            ein: "",
            taxYear: params.taxYear || new Date().getFullYear() - 1,
          },
          totalGrantsAmount: 0,
          grantCount: 0,
          grants: [],
          grantsByCategory: {},
          avgGrantSize: 0,
          rawContent: `# Foundation Grants Search\n\nNo foundation found matching "${foundationName}".\n\nTry:\n- Using the exact legal name\n- Searching by EIN if known\n- Checking for variations (e.g., "The Smith Foundation" vs "Smith Family Foundation")`,
          sources: [],
          error: `No foundation found matching "${foundationName}"`,
        }
      }
    }

    // Step 2: Get foundation details from ProPublica
    const details = ein ? await getFoundationDetails(ein) : null

    if (details) {
      foundationName = details.organization.name
      sources.push({
        name: `ProPublica: ${foundationName}`,
        url: `https://projects.propublica.org/nonprofits/organizations/${ein?.replace(/-/g, "")}`,
      })
    }

    // Step 3: Search for grant details via Linkup
    let grants: GrantRecord[] = []
    if (foundationName) {
      const linkupResult = await searchGrantsViaLinkup(
        foundationName,
        params.taxYear,
        params.recipientName
      )
      grants = linkupResult.grants
      sources.push(...linkupResult.sources)
    }

    // Filter by recipient if specified
    if (params.recipientName && grants.length > 0) {
      const filterLower = params.recipientName.toLowerCase()
      grants = grants.filter((g) =>
        g.recipientName.toLowerCase().includes(filterLower)
      )
    }

    // Limit results
    grants = grants.slice(0, params.limit || 25)

    // Calculate summary stats
    const totalGrantsAmount = grants.reduce((sum, g) => sum + g.amount, 0)
    const avgGrantSize = grants.length > 0 ? totalGrantsAmount / grants.length : 0
    const grantsByCategory = categorizeGrants(grants)

    // Determine tax year
    const taxYear =
      params.taxYear ||
      (details?.filings_with_data?.[0]?.tax_prd_yr) ||
      new Date().getFullYear() - 1

    // Build raw content
    const rawLines: string[] = []
    rawLines.push(`# Foundation Grants Report`)
    rawLines.push("")
    rawLines.push("## Foundation")
    rawLines.push(`- **Name:** ${foundationName}`)
    rawLines.push(`- **EIN:** ${ein || "Unknown"}`)
    if (details?.organization.city) {
      rawLines.push(`- **Location:** ${details.organization.city}, ${details.organization.state}`)
    }
    rawLines.push(`- **Tax Year:** ${taxYear}`)
    rawLines.push("")

    rawLines.push("## Summary")
    rawLines.push(`- **Total Grants:** $${totalGrantsAmount.toLocaleString()}`)
    rawLines.push(`- **Grant Count:** ${grants.length}`)
    rawLines.push(`- **Average Grant Size:** $${Math.round(avgGrantSize).toLocaleString()}`)
    rawLines.push("")

    if (Object.keys(grantsByCategory).length > 0) {
      rawLines.push("## Grants by Category")
      const sortedCategories = Object.entries(grantsByCategory).sort(
        (a, b) => b[1] - a[1]
      )
      for (const [category, amount] of sortedCategories) {
        const percent = totalGrantsAmount > 0 ? (amount / totalGrantsAmount) * 100 : 0
        rawLines.push(`- **${category}:** $${amount.toLocaleString()} (${percent.toFixed(1)}%)`)
      }
      rawLines.push("")
    }

    if (grants.length > 0) {
      rawLines.push("## Grant Recipients")
      rawLines.push("")
      for (let i = 0; i < grants.length; i++) {
        rawLines.push(formatGrant(grants[i], i))
        rawLines.push("")
      }
    } else {
      rawLines.push("## Grant Recipients")
      rawLines.push("")
      rawLines.push("No grant details found in public records.")
      rawLines.push("")
      rawLines.push("**Suggestions:**")
      rawLines.push("- Try a different tax year")
      rawLines.push("- Check the foundation's 990-PF PDF for Schedule I")
      if (details) {
        rawLines.push(`- View 990-PF: ${details.filings_with_data?.[0]?.pdf_url || "N/A"}`)
      }
    }

    rawLines.push("")
    rawLines.push("## Sources")
    for (const source of sources) {
      rawLines.push(`- [${source.name}](${source.url})`)
    }

    const result: FoundationGrantsResult = {
      foundation: {
        name: foundationName,
        ein: ein || "",
        city: details?.organization.city,
        state: details?.organization.state,
        taxYear,
      },
      totalGrantsAmount,
      grantCount: grants.length,
      grants,
      grantsByCategory,
      avgGrantSize,
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
 * Check if foundation grants tool should be enabled
 */
export function shouldEnableFoundationGrantsTool(): boolean {
  // ProPublica is always available
  // Linkup adds grant details but is optional
  return true
}
