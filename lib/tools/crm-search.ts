/**
 * CRM Search Tool
 * Enables AI to search synced CRM data for prospect research
 */

import { tool } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { NormalizedConstituent, CRMProvider } from "@/lib/crm/types"

// ============================================================================
// SCHEMA
// ============================================================================

const crmSearchSchema = z.object({
  query: z
    .string()
    .describe("Search term - name, email, or keyword to search for in CRM data"),
  provider: z
    .enum(["bloomerang", "virtuous", "neoncrm", "donorperfect", "all"])
    .optional()
    .default("all")
    .describe("Which CRM to search. Use 'all' to search all connected CRMs."),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of results to return (1-50)"),
})

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const crmSearchTool = tool({
  description:
    "ALWAYS call this tool FIRST when researching a named donor or prospect. " +
    "Execute BEFORE any external research (perplexity_prospect_research, sec_edgar, propublica, etc). " +
    "Searches connected CRMs (Bloomerang, Virtuous, Neon CRM, DonorPerfect) for: " +
    "(1) existing donor records, (2) giving history & lifetime value, (3) contact info & address. " +
    "Use when: user asks about a specific person/donor, user says 'look up [name]', " +
    "or when you need to check if prospect is already in the donor database. " +
    "This prevents duplicate research on existing donors.",
  parameters: crmSearchSchema,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async (_params, _context) => {
    // Note: userId needs to be passed in context - this will be handled by the chat route
    return {
      error: "CRM search requires authentication context. Use crmSearchWithUserId instead.",
    }
  },
})

// ============================================================================
// ACTUAL IMPLEMENTATION (called from chat route with userId)
// ============================================================================

export async function searchCRMConstituents(
  userId: string,
  query: string,
  provider: "bloomerang" | "virtuous" | "neoncrm" | "donorperfect" | "all" = "all",
  limit: number = 10
): Promise<{
  rawContent: string
  sources: { url: string; title: string }[]
  constituents: NormalizedConstituent[]
  totalCount: number
}> {
  const supabase = await createClient()
  if (!supabase) {
    return {
      rawContent: "CRM search is not available (database not configured).",
      sources: [],
      constituents: [],
      totalCount: 0,
    }
  }

  // Sanitize and prepare search query - escape SQL LIKE special characters
  const sanitizedQuery = query
    .trim()
    .toLowerCase()
    .replace(/[%_\\]/g, "\\$&") // Escape %, _, and \ for LIKE patterns
    .replace(/['"`,;()[\]{}]/g, "") // Remove characters that could break filter syntax
    .substring(0, 100) // Limit query length

  if (!sanitizedQuery) {
    return {
      rawContent: "Please provide a search term.",
      sources: [],
      constituents: [],
      totalCount: 0,
    }
  }

  const clampedLimit = Math.min(Math.max(limit, 1), 50)

  // Build the query (using any to handle tables not yet in generated types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbQuery = (supabase as any)
    .from("crm_constituents")
    .select("*")
    .eq("user_id", userId)

  // Filter by provider if specified
  if (provider !== "all") {
    dbQuery = dbQuery.eq("provider", provider)
  }

  // Search by name or email using case-insensitive pattern matching
  // Note: Using parameterized patterns to prevent injection
  dbQuery = dbQuery.or(
    `full_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%,first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%`
  )

  // Order by lifetime giving (most valuable donors first) and limit results
  dbQuery = dbQuery
    .order("total_lifetime_giving", { ascending: false, nullsFirst: false })
    .limit(clampedLimit)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await dbQuery as { data: any[] | null; error: any; count: number | null }

  if (error) {
    console.error("CRM search error:", error)
    return {
      rawContent: `Error searching CRM data: ${error.message}`,
      sources: [],
      constituents: [],
      totalCount: 0,
    }
  }

  if (!data || data.length === 0) {
    return {
      rawContent: `No constituents found matching "${query}" in ${provider === "all" ? "any connected CRM" : provider}.`,
      sources: [],
      constituents: [],
      totalCount: 0,
    }
  }

  // Map database rows to normalized constituents
  const constituents: NormalizedConstituent[] = data.map((row) => ({
    id: row.id,
    externalId: row.external_id,
    provider: row.provider as CRMProvider,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    fullName: row.full_name || "Unknown",
    email: row.email || undefined,
    phone: row.phone || undefined,
    streetAddress: row.street_address || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    zipCode: row.zip_code || undefined,
    country: row.country || undefined,
    totalLifetimeGiving: row.total_lifetime_giving || undefined,
    largestGift: row.largest_gift || undefined,
    lastGiftAmount: row.last_gift_amount || undefined,
    lastGiftDate: row.last_gift_date || undefined,
    firstGiftDate: row.first_gift_date || undefined,
    giftCount: row.gift_count || undefined,
    customFields: row.custom_fields || undefined,
    syncedAt: row.synced_at,
  }))

  // Format output for AI consumption
  const rawContent = formatConstituentResults(constituents, query, provider)

  // Create source entries for each CRM
  const sources: { url: string; title: string }[] = []
  const uniqueProviders = [...new Set(constituents.map((c) => c.provider))]
  const providerUrls: Record<string, string> = {
    bloomerang: "https://bloomerang.co",
    virtuous: "https://virtuoussoftware.com",
    neoncrm: "https://neoncrm.com",
    donorperfect: "https://donorperfect.com",
  }
  for (const p of uniqueProviders) {
    sources.push({
      url: providerUrls[p] || "#",
      title: `${p.charAt(0).toUpperCase() + p.slice(1)} CRM`,
    })
  }

  return {
    rawContent,
    sources,
    constituents,
    totalCount: constituents.length,
  }
}

// ============================================================================
// FORMATTING
// ============================================================================

function formatConstituentResults(
  constituents: NormalizedConstituent[],
  query: string,
  provider: string
): string {
  const lines: string[] = []

  lines.push(`## CRM Search Results for "${query}"`)
  lines.push(`Found ${constituents.length} constituent(s) in ${provider === "all" ? "connected CRMs" : provider}:\n`)

  for (const c of constituents) {
    lines.push(`### ${c.fullName}`)
    lines.push(`- **CRM**: ${c.provider.charAt(0).toUpperCase() + c.provider.slice(1)}`)

    if (c.email) lines.push(`- **Email**: ${c.email}`)
    if (c.phone) lines.push(`- **Phone**: ${c.phone}`)

    // Address
    const addressParts = [c.streetAddress, c.city, c.state, c.zipCode].filter(Boolean)
    if (addressParts.length > 0) {
      lines.push(`- **Address**: ${addressParts.join(", ")}`)
    }

    // Giving history
    if (c.totalLifetimeGiving !== undefined) {
      lines.push(`- **Lifetime Giving**: $${c.totalLifetimeGiving.toLocaleString()}`)
    }
    if (c.lastGiftAmount !== undefined) {
      lines.push(`- **Last Gift**: $${c.lastGiftAmount.toLocaleString()}${c.lastGiftDate ? ` (${c.lastGiftDate})` : ""}`)
    }
    if (c.giftCount !== undefined) {
      lines.push(`- **Total Gifts**: ${c.giftCount}`)
    }
    if (c.firstGiftDate) {
      lines.push(`- **First Gift Date**: ${c.firstGiftDate}`)
    }
    if (c.largestGift !== undefined) {
      lines.push(`- **Largest Gift**: $${c.largestGift.toLocaleString()}`)
    }

    lines.push("") // Empty line between constituents
  }

  return lines.join("\n")
}

// ============================================================================
// HELPER: Check if user has CRM connections
// ============================================================================

export async function hasCRMConnections(userId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { data, error } = await supabase
    .from("user_keys")
    .select("provider")
    .eq("user_id", userId)
    .in("provider", ["bloomerang", "virtuous", "neoncrm", "donorperfect"])
    .limit(1)

  if (error) {
    console.error("Error checking CRM connections:", error)
    return false
  }

  return data && data.length > 0
}

// ============================================================================
// HELPER: Get CRM connection summary
// ============================================================================

export async function getCRMConnectionSummary(userId: string): Promise<{
  connected: boolean
  providers: CRMProvider[]
  totalConstituents: number
}> {
  const supabase = await createClient()
  if (!supabase) {
    return { connected: false, providers: [], totalConstituents: 0 }
  }

  // Get connected providers
  const { data: keys } = await supabase
    .from("user_keys")
    .select("provider")
    .eq("user_id", userId)
    .in("provider", ["bloomerang", "virtuous", "neoncrm", "donorperfect"])

  const providers = (keys?.map((k) => k.provider) || []) as CRMProvider[]

  if (providers.length === 0) {
    return { connected: false, providers: [], totalConstituents: 0 }
  }

  // Get constituent count (using any to handle tables not yet in generated types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("crm_constituents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  return {
    connected: true,
    providers,
    totalConstituents: count || 0,
  }
}
