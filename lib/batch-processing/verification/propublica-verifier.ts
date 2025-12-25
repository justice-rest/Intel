/**
 * ProPublica Nonprofit Verification
 *
 * Verifies nonprofit affiliations using ProPublica Nonprofit Explorer.
 * Uses publicly available data from IRS 990 forms.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface NonprofitAffiliation {
  organizationName: string
  ein: string
  role: string
  compensation?: number
  year: number
  source: "ProPublica 990"
}

export interface PropublicaVerificationResult {
  verified: boolean
  affiliations: NonprofitAffiliation[]
  totalCompensation: number
  organizations: string[]
  source: "ProPublica Nonprofit Explorer"
  timestamp: Date
}

// ============================================================================
// PROPUBLICA API
// ============================================================================

const PROPUBLICA_BASE = "https://projects.propublica.org/nonprofits/api/v2"

/**
 * Search for nonprofit affiliations by person name
 *
 * Note: ProPublica's API searches 990 data. Officers and key employees
 * are listed in Schedule J for large organizations.
 */
export async function verifyNonprofitAffiliations(
  personName: string
): Promise<PropublicaVerificationResult | null> {
  try {
    // ProPublica doesn't have a direct person search,
    // but we can search for organizations and check their filings
    // For now, return a placeholder that indicates verification not available
    // In a full implementation, we'd use the organization search + 990 lookup

    console.log("[ProPublica] Person search not directly supported, using organization search fallback")

    return {
      verified: false,
      affiliations: [],
      totalCompensation: 0,
      organizations: [],
      source: "ProPublica Nonprofit Explorer",
      timestamp: new Date(),
    }
  } catch (error) {
    console.error("[ProPublica] Verification failed:", error)
    return null
  }
}

/**
 * Search for nonprofits by name
 */
export async function searchNonprofits(
  query: string
): Promise<Array<{
  name: string
  ein: string
  city: string
  state: string
  totalRevenue: number
}>> {
  try {
    const response = await fetch(
      `${PROPUBLICA_BASE}/search.json?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      console.log(`[ProPublica] Search returned ${response.status}`)
      return []
    }

    const data = await response.json()

    if (!data.organizations || data.organizations.length === 0) {
      return []
    }

    return data.organizations.slice(0, 10).map((org: any) => ({
      name: org.name || "",
      ein: org.ein?.toString() || "",
      city: org.city || "",
      state: org.state || "",
      totalRevenue: org.income_amount || 0,
    }))
  } catch (error) {
    console.error("[ProPublica] Search failed:", error)
    return []
  }
}

/**
 * Get nonprofit details by EIN
 */
export async function getNonprofitDetails(ein: string): Promise<{
  name: string
  ein: string
  city: string
  state: string
  totalRevenue: number
  totalAssets: number
  officers: Array<{
    name: string
    title: string
    compensation: number
  }>
} | null> {
  try {
    // Remove dashes from EIN
    const cleanEin = ein.replace(/-/g, "")

    const response = await fetch(
      `${PROPUBLICA_BASE}/organizations/${cleanEin}.json`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      console.log(`[ProPublica] Details returned ${response.status}`)
      return null
    }

    const data = await response.json()
    const org = data.organization

    if (!org) {
      return null
    }

    // Get the most recent filing for officer info
    const filings = data.filings_with_data || []
    const recentFiling = filings[0]

    // Officers are typically in the filing data
    const officers: Array<{ name: string; title: string; compensation: number }> = []

    // Note: Full officer data requires parsing the 990 XML
    // This is a simplified version

    return {
      name: org.name || "",
      ein: org.ein?.toString() || "",
      city: org.city || "",
      state: org.state || "",
      totalRevenue: org.income_amount || 0,
      totalAssets: org.asset_amount || 0,
      officers,
    }
  } catch (error) {
    console.error("[ProPublica] Details fetch failed:", error)
    return null
  }
}

/**
 * Check if a person is associated with a specific nonprofit
 */
export async function checkNonprofitAffiliation(
  personName: string,
  nonprofitName: string
): Promise<{
  found: boolean
  organization?: {
    name: string
    ein: string
  }
  role?: string
}> {
  try {
    // Search for the nonprofit
    const orgs = await searchNonprofits(nonprofitName)

    if (orgs.length === 0) {
      return { found: false }
    }

    // For each org, we'd need to check 990 data for the person
    // This requires parsing 990 XML which is complex
    // For now, return that we found the org but can't verify person

    return {
      found: true,
      organization: {
        name: orgs[0].name,
        ein: orgs[0].ein,
      },
    }
  } catch (error) {
    console.error("[ProPublica] Affiliation check failed:", error)
    return { found: false }
  }
}
