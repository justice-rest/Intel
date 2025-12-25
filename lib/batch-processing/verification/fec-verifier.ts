/**
 * FEC Contribution Verification
 *
 * Verifies political contributions directly from FEC.gov API.
 * FREE - no API key required.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FecContribution {
  amount: number
  date: string
  recipientName: string
  recipientType: "candidate" | "committee" | "pac"
  party?: "REPUBLICAN" | "DEMOCRATIC" | "OTHER"
  employer?: string
  occupation?: string
}

export interface FecVerificationResult {
  verified: boolean
  totalAmount: number
  contributions: FecContribution[]
  partyLean: "REPUBLICAN" | "DEMOCRATIC" | "BIPARTISAN" | "NONE"
  yearRange: { from: number; to: number } | null
  source: "FEC.gov"
  timestamp: Date
}

// ============================================================================
// FEC API
// ============================================================================

const FEC_API_BASE = "https://api.open.fec.gov/v1"
const FEC_API_KEY = process.env.FEC_API_KEY || "DEMO_KEY"

/**
 * Search FEC for individual contributions
 */
export async function verifyFecContributions(
  personName: string,
  state?: string
): Promise<FecVerificationResult | null> {
  try {
    // Build search URL
    const params = new URLSearchParams({
      api_key: FEC_API_KEY,
      contributor_name: personName,
      per_page: "50",
      sort: "-contribution_receipt_date",
      is_individual: "true",
    })

    if (state) {
      params.set("contributor_state", state)
    }

    const response = await fetch(
      `${FEC_API_BASE}/schedules/schedule_a/?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      console.log(`[FEC] API returned ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return {
        verified: true,
        totalAmount: 0,
        contributions: [],
        partyLean: "NONE",
        yearRange: null,
        source: "FEC.gov",
        timestamp: new Date(),
      }
    }

    // Parse contributions
    const contributions: FecContribution[] = []
    let totalAmount = 0
    let republicanAmount = 0
    let democraticAmount = 0
    let minYear = 9999
    let maxYear = 0

    for (const result of data.results) {
      const amount = result.contribution_receipt_amount || 0
      const party = determineParty(result.committee?.party || "", result.committee?.designation || "")

      const contribution: FecContribution = {
        amount,
        date: result.contribution_receipt_date || "",
        recipientName: result.committee?.name || result.recipient_name || "Unknown",
        recipientType: getRecipientType(result.committee?.committee_type || ""),
        party,
        employer: result.contributor_employer,
        occupation: result.contributor_occupation,
      }

      contributions.push(contribution)
      totalAmount += amount

      if (party === "REPUBLICAN") republicanAmount += amount
      if (party === "DEMOCRATIC") democraticAmount += amount

      const year = parseInt(result.contribution_receipt_date?.slice(0, 4) || "0", 10)
      if (year > 0) {
        minYear = Math.min(minYear, year)
        maxYear = Math.max(maxYear, year)
      }
    }

    // Determine party lean
    let partyLean: FecVerificationResult["partyLean"] = "NONE"
    if (totalAmount > 0) {
      const repPct = republicanAmount / totalAmount
      const demPct = democraticAmount / totalAmount

      if (repPct > 0.7) partyLean = "REPUBLICAN"
      else if (demPct > 0.7) partyLean = "DEMOCRATIC"
      else if (repPct > 0.3 && demPct > 0.3) partyLean = "BIPARTISAN"
      else if (repPct > demPct) partyLean = "REPUBLICAN"
      else if (demPct > repPct) partyLean = "DEMOCRATIC"
    }

    return {
      verified: true,
      totalAmount,
      contributions,
      partyLean,
      yearRange: minYear < 9999 ? { from: minYear, to: maxYear } : null,
      source: "FEC.gov",
      timestamp: new Date(),
    }
  } catch (error) {
    console.error("[FEC] Verification failed:", error)
    return null
  }
}

/**
 * Determine party from committee info
 */
function determineParty(party: string, designation: string): FecContribution["party"] {
  const p = party.toUpperCase()
  if (p === "REP" || p === "REPUBLICAN") return "REPUBLICAN"
  if (p === "DEM" || p === "DEMOCRATIC") return "DEMOCRATIC"
  return "OTHER"
}

/**
 * Get recipient type from committee type
 */
function getRecipientType(type: string): FecContribution["recipientType"] {
  const t = type.toUpperCase()
  if (t === "H" || t === "S" || t === "P") return "candidate"
  if (t === "N" || t === "Q" || t === "O") return "pac"
  return "committee"
}

/**
 * Quick check if person has any FEC contributions
 */
export async function hasFecContributions(personName: string, state?: string): Promise<boolean> {
  const result = await verifyFecContributions(personName, state)
  return result !== null && result.totalAmount > 0
}
