/**
 * Cross-Reference Verification Layer
 *
 * Compares claims from LLM synthesis against direct API results
 * to detect hallucinations and validate data accuracy.
 *
 * This is the KEY differentiator that makes Rōmy more reliable than
 * competitors who rely on black-box scoring.
 */

import { verifySecInsider, searchSecProxy } from "./sec-verifier"
import { verifyFecContributions, hasFecContributions } from "./fec-verifier"
import { verifyNonprofitAffiliations, searchNonprofits } from "./propublica-verifier"
import {
  calculateDisambiguationScore,
  isCommonName,
  getDisambiguationWarnings,
  type PersonContext,
  type MatchCandidate,
} from "./name-disambiguation"
import type { ProspectResearchOutput } from "../types"

// ============================================================================
// TYPES
// ============================================================================

export type VerificationStatus =
  | "VERIFIED"       // Confirmed by direct API
  | "CONTRADICTED"   // LLM claim contradicted by API
  | "UNVERIFIABLE"   // Can't verify (no API data available)
  | "PARTIAL"        // Partially verified

export interface ClaimVerification {
  claim: string
  claimType: ClaimType
  llmValue: unknown
  apiValue: unknown
  status: VerificationStatus
  confidence: number // 0-1
  source: string
  details?: string
}

export type ClaimType =
  | "sec_insider"
  | "political_giving"
  | "nonprofit_board"
  | "property_value"
  | "business_ownership"
  | "net_worth"

export interface VerificationReport {
  personName: string
  timestamp: Date
  totalClaims: number
  verifiedClaims: number
  contradictedClaims: number
  unverifiableClaims: number
  overallConfidence: number // 0-1
  claims: ClaimVerification[]
  hallucinations: ClaimVerification[]
  recommendations: string[]
  disambiguationWarnings: string[]
  isCommonName: boolean
}

// ============================================================================
// CLAIM EXTRACTORS
// ============================================================================

/**
 * Extract verifiable claims from LLM output
 */
export function extractVerifiableClaims(
  output: ProspectResearchOutput
): Array<{ type: ClaimType; value: unknown; description: string }> {
  const claims: Array<{ type: ClaimType; value: unknown; description: string }> = []

  // SEC Insider claims
  if (output.wealth.securities.has_sec_filings) {
    claims.push({
      type: "sec_insider",
      value: {
        hasFilings: true,
        companies: output.wealth.securities.insider_at,
      },
      description: `SEC insider at ${output.wealth.securities.insider_at.join(", ") || "unknown companies"}`,
    })
  }

  // Political giving claims
  if (output.philanthropy.political_giving.total > 0) {
    claims.push({
      type: "political_giving",
      value: {
        total: output.philanthropy.political_giving.total,
        partyLean: output.philanthropy.political_giving.party_lean,
      },
      description: `Political contributions of $${output.philanthropy.political_giving.total.toLocaleString()}`,
    })
  }

  // Nonprofit board claims
  if (output.philanthropy.nonprofit_boards.length > 0) {
    claims.push({
      type: "nonprofit_board",
      value: output.philanthropy.nonprofit_boards,
      description: `Board member at ${output.philanthropy.nonprofit_boards.join(", ")}`,
    })
  }

  // Foundation affiliation claims
  if (output.philanthropy.foundation_affiliations.length > 0) {
    claims.push({
      type: "nonprofit_board",
      value: output.philanthropy.foundation_affiliations,
      description: `Foundation affiliations: ${output.philanthropy.foundation_affiliations.join(", ")}`,
    })
  }

  // Property value claims
  if (output.wealth.real_estate.total_value && output.wealth.real_estate.total_value > 0) {
    claims.push({
      type: "property_value",
      value: output.wealth.real_estate.total_value,
      description: `Real estate value of $${output.wealth.real_estate.total_value.toLocaleString()}`,
    })
  }

  // Business ownership claims
  if (output.wealth.business_ownership.length > 0) {
    claims.push({
      type: "business_ownership",
      value: output.wealth.business_ownership.map((b) => ({
        company: b.company,
        role: b.role,
      })),
      description: `Business roles: ${output.wealth.business_ownership.map((b) => `${b.role} at ${b.company}`).join(", ")}`,
    })
  }

  // Net worth claims
  if (output.metrics.estimated_net_worth_low || output.metrics.estimated_net_worth_high) {
    claims.push({
      type: "net_worth",
      value: {
        low: output.metrics.estimated_net_worth_low,
        high: output.metrics.estimated_net_worth_high,
      },
      description: `Net worth $${(output.metrics.estimated_net_worth_low || 0).toLocaleString()}-$${(output.metrics.estimated_net_worth_high || 0).toLocaleString()}`,
    })
  }

  return claims
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

/**
 * Verify SEC insider claim against EDGAR API
 */
async function verifySecClaim(
  personName: string,
  llmClaim: { hasFilings: boolean; companies: string[] }
): Promise<ClaimVerification> {
  try {
    const secResult = await verifySecInsider(personName)

    if (!secResult) {
      return {
        claim: `SEC insider status`,
        claimType: "sec_insider",
        llmValue: llmClaim,
        apiValue: null,
        status: "UNVERIFIABLE",
        confidence: 0.5,
        source: "SEC EDGAR API unavailable",
      }
    }

    const apiHasFilings = secResult.verified && secResult.filings.length > 0
    const llmClaimedFilings = llmClaim.hasFilings

    if (llmClaimedFilings && !apiHasFilings) {
      // LLM says insider, but SEC API found nothing - HALLUCINATION
      return {
        claim: `SEC insider at ${llmClaim.companies.join(", ")}`,
        claimType: "sec_insider",
        llmValue: llmClaim,
        apiValue: { hasFilings: false, filings: [] },
        status: "CONTRADICTED",
        confidence: 0.95, // High confidence in contradiction
        source: "SEC EDGAR",
        details: `SEC EDGAR search found no insider filings for "${personName}"`,
      }
    }

    if (apiHasFilings && llmClaimedFilings) {
      // Both agree - verify companies match
      const apiCompanies = secResult.filings.map((f) => f.company.toLowerCase())
      const llmCompanies = llmClaim.companies.map((c) => c.toLowerCase())
      const matchCount = llmCompanies.filter((c) =>
        apiCompanies.some((ac) => ac.includes(c) || c.includes(ac))
      ).length

      return {
        claim: `SEC insider status`,
        claimType: "sec_insider",
        llmValue: llmClaim,
        apiValue: secResult.filings,
        status: matchCount > 0 ? "VERIFIED" : "PARTIAL",
        confidence: matchCount > 0 ? 0.95 : 0.7,
        source: "SEC EDGAR",
        details: `Found ${secResult.filings.length} SEC filings`,
      }
    }

    if (!llmClaimedFilings && apiHasFilings) {
      // API found filings but LLM didn't mention - not a hallucination, just missed data
      return {
        claim: `SEC insider status (missed by LLM)`,
        claimType: "sec_insider",
        llmValue: llmClaim,
        apiValue: secResult.filings,
        status: "PARTIAL",
        confidence: 0.8,
        source: "SEC EDGAR",
        details: `SEC EDGAR found ${secResult.filings.length} filings not mentioned in LLM output`,
      }
    }

    // Neither claims filings
    return {
      claim: `SEC insider status`,
      claimType: "sec_insider",
      llmValue: llmClaim,
      apiValue: { hasFilings: false },
      status: "VERIFIED",
      confidence: 0.8,
      source: "SEC EDGAR",
      details: "No SEC insider filings found (confirmed)",
    }
  } catch (error) {
    return {
      claim: `SEC insider status`,
      claimType: "sec_insider",
      llmValue: llmClaim,
      apiValue: null,
      status: "UNVERIFIABLE",
      confidence: 0.3,
      source: "SEC EDGAR",
      details: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Verify political giving claim against FEC API
 */
async function verifyFecClaim(
  personName: string,
  state: string | undefined,
  llmClaim: { total: number; partyLean: string }
): Promise<ClaimVerification> {
  try {
    const fecResult = await verifyFecContributions(personName, state)

    if (!fecResult) {
      return {
        claim: `Political contributions`,
        claimType: "political_giving",
        llmValue: llmClaim,
        apiValue: null,
        status: "UNVERIFIABLE",
        confidence: 0.5,
        source: "FEC API unavailable",
      }
    }

    const apiTotal = fecResult.totalAmount
    const llmTotal = llmClaim.total

    // Calculate variance
    const variance = Math.abs(apiTotal - llmTotal) / Math.max(apiTotal, llmTotal, 1)

    if (llmTotal > 0 && apiTotal === 0) {
      // LLM claims giving, FEC found nothing - possible hallucination
      // BUT: FEC only has contributions $200+, so small donors wouldn't show
      return {
        claim: `Political contributions of $${llmTotal.toLocaleString()}`,
        claimType: "political_giving",
        llmValue: llmClaim,
        apiValue: { total: 0 },
        status: llmTotal > 500 ? "CONTRADICTED" : "UNVERIFIABLE",
        confidence: llmTotal > 500 ? 0.8 : 0.4,
        source: "FEC.gov",
        details:
          llmTotal > 500
            ? `FEC records show no contributions ≥$200 for "${personName}"`
            : "Amount below FEC reporting threshold",
      }
    }

    if (apiTotal > 0 && variance < 0.3) {
      // Within 30% - verified
      return {
        claim: `Political contributions`,
        claimType: "political_giving",
        llmValue: llmClaim,
        apiValue: { total: apiTotal, partyLean: fecResult.partyLean },
        status: "VERIFIED",
        confidence: 0.95,
        source: "FEC.gov",
        details: `FEC shows $${apiTotal.toLocaleString()} in contributions`,
      }
    }

    if (apiTotal > 0 && variance >= 0.3) {
      // Significant variance - partial
      return {
        claim: `Political contributions`,
        claimType: "political_giving",
        llmValue: llmClaim,
        apiValue: { total: apiTotal },
        status: "PARTIAL",
        confidence: 0.6,
        source: "FEC.gov",
        details: `LLM claimed $${llmTotal.toLocaleString()}, FEC shows $${apiTotal.toLocaleString()} (${Math.round(variance * 100)}% variance)`,
      }
    }

    return {
      claim: `Political contributions`,
      claimType: "political_giving",
      llmValue: llmClaim,
      apiValue: { total: apiTotal },
      status: "VERIFIED",
      confidence: 0.8,
      source: "FEC.gov",
    }
  } catch (error) {
    return {
      claim: `Political contributions`,
      claimType: "political_giving",
      llmValue: llmClaim,
      apiValue: null,
      status: "UNVERIFIABLE",
      confidence: 0.3,
      source: "FEC.gov",
      details: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Verify nonprofit board claim
 * Note: ProPublica person search isn't available via API, so we search orgs
 */
async function verifyNonprofitClaim(
  personName: string,
  llmClaim: string[]
): Promise<ClaimVerification> {
  if (llmClaim.length === 0) {
    return {
      claim: `Nonprofit board memberships`,
      claimType: "nonprofit_board",
      llmValue: llmClaim,
      apiValue: [],
      status: "VERIFIED",
      confidence: 0.6,
      source: "ProPublica",
      details: "No board memberships claimed",
    }
  }

  try {
    // Search for each claimed organization
    const verifiedOrgs: string[] = []
    const unverifiedOrgs: string[] = []

    for (const orgName of llmClaim.slice(0, 3)) {
      // Limit to 3 to avoid rate limiting
      const orgs = await searchNonprofits(orgName)
      if (orgs.length > 0) {
        verifiedOrgs.push(orgName)
      } else {
        unverifiedOrgs.push(orgName)
      }
    }

    const verificationRate = verifiedOrgs.length / llmClaim.length

    return {
      claim: `Nonprofit affiliations: ${llmClaim.join(", ")}`,
      claimType: "nonprofit_board",
      llmValue: llmClaim,
      apiValue: verifiedOrgs,
      status: verificationRate >= 0.5 ? "PARTIAL" : "UNVERIFIABLE",
      confidence: 0.5 + verificationRate * 0.3,
      source: "ProPublica",
      details: `${verifiedOrgs.length}/${llmClaim.length} organizations found in ProPublica. Note: Person-org link cannot be directly verified via API.`,
    }
  } catch (error) {
    return {
      claim: `Nonprofit affiliations`,
      claimType: "nonprofit_board",
      llmValue: llmClaim,
      apiValue: null,
      status: "UNVERIFIABLE",
      confidence: 0.3,
      source: "ProPublica",
      details: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

// ============================================================================
// MAIN VERIFICATION FUNCTION
// ============================================================================

/**
 * Run full cross-reference verification on LLM output
 *
 * This is the core function that validates LLM claims against
 * authoritative sources and detects hallucinations.
 */
export async function crossReferenceVerify(
  personName: string,
  state: string | undefined,
  output: ProspectResearchOutput,
  additionalContext?: {
    city?: string
    employer?: string
    title?: string
  }
): Promise<VerificationReport> {
  const claims = extractVerifiableClaims(output)
  const verifications: ClaimVerification[] = []

  // Build person context for disambiguation
  const personContext: PersonContext = {
    name: personName,
    state,
    city: additionalContext?.city,
    employer: additionalContext?.employer || output.wealth.business_ownership[0]?.company,
    title: additionalContext?.title || output.wealth.business_ownership[0]?.role,
  }

  // Get disambiguation warnings
  const disambiguationWarnings = getDisambiguationWarnings(personContext)
  const nameIsCommon = isCommonName(personName)

  if (nameIsCommon) {
    console.log(`[CrossRef] ⚠️ Common name detected: ${personName} - results may be less reliable`)
  }

  console.log(`[CrossRef] Verifying ${claims.length} claims for ${personName}`)

  // Run verifications in parallel where possible
  const verificationPromises: Promise<ClaimVerification>[] = []

  for (const claim of claims) {
    switch (claim.type) {
      case "sec_insider":
        verificationPromises.push(
          verifySecClaim(personName, claim.value as { hasFilings: boolean; companies: string[] })
        )
        break

      case "political_giving":
        verificationPromises.push(
          verifyFecClaim(personName, state, claim.value as { total: number; partyLean: string })
        )
        break

      case "nonprofit_board":
        verificationPromises.push(verifyNonprofitClaim(personName, claim.value as string[]))
        break

      case "property_value":
        // Property values can't be directly verified without a paid API
        // Mark as unverifiable but with context
        verifications.push({
          claim: claim.description,
          claimType: "property_value",
          llmValue: claim.value,
          apiValue: null,
          status: "UNVERIFIABLE",
          confidence: 0.5,
          source: "Public Records (LLM synthesis)",
          details: "Property values derived from public records search. Direct API verification not available.",
        })
        break

      case "business_ownership":
        // Business ownership verification would require SOS API
        verifications.push({
          claim: claim.description,
          claimType: "business_ownership",
          llmValue: claim.value,
          apiValue: null,
          status: "UNVERIFIABLE",
          confidence: 0.5,
          source: "Public Records (LLM synthesis)",
          details: "Business ownership from web search. Direct registry verification not available.",
        })
        break

      case "net_worth":
        // Net worth is always estimated
        verifications.push({
          claim: claim.description,
          claimType: "net_worth",
          llmValue: claim.value,
          apiValue: null,
          status: "UNVERIFIABLE",
          confidence: 0.4,
          source: "Calculated estimate",
          details: "Net worth is estimated from available indicators. Cannot be directly verified.",
        })
        break
    }
  }

  // Await all API verifications
  const apiResults = await Promise.allSettled(verificationPromises)
  for (const result of apiResults) {
    if (result.status === "fulfilled") {
      verifications.push(result.value)
    }
  }

  // Categorize results
  const verified = verifications.filter((v) => v.status === "VERIFIED")
  const contradicted = verifications.filter((v) => v.status === "CONTRADICTED")
  const unverifiable = verifications.filter((v) => v.status === "UNVERIFIABLE")
  const partial = verifications.filter((v) => v.status === "PARTIAL")

  // Calculate overall confidence
  const weightedConfidence =
    verifications.reduce((sum, v) => {
      const weight = v.status === "VERIFIED" ? 1 : v.status === "PARTIAL" ? 0.7 : v.status === "CONTRADICTED" ? 0.2 : 0.5
      return sum + v.confidence * weight
    }, 0) / Math.max(verifications.length, 1)

  // Generate recommendations
  const recommendations: string[] = []

  if (contradicted.length > 0) {
    recommendations.push(
      `⚠️ ${contradicted.length} claim(s) contradicted by official sources - review before outreach`
    )
  }

  if (verified.length === 0 && claims.length > 0) {
    recommendations.push(
      "⚠️ No claims could be verified against official sources - treat data as unconfirmed"
    )
  }

  if (verified.length >= claims.length * 0.5) {
    recommendations.push("✓ Majority of claims verified - high confidence in data quality")
  }

  if (unverifiable.length > verified.length) {
    recommendations.push(
      "ℹ️ Most data from LLM synthesis only - consider manual verification for major gift prospects"
    )
  }

  // Add disambiguation warning if common name
  if (nameIsCommon && contradicted.length === 0 && verified.length > 0) {
    recommendations.push(
      "⚠️ Common name detected - verify this is the correct person before major gift outreach"
    )
  }

  console.log(
    `[CrossRef] Complete: ${verified.length} verified, ${contradicted.length} contradicted, ${partial.length} partial, ${unverifiable.length} unverifiable`
  )

  return {
    personName,
    timestamp: new Date(),
    totalClaims: verifications.length,
    verifiedClaims: verified.length,
    contradictedClaims: contradicted.length,
    unverifiableClaims: unverifiable.length,
    overallConfidence: weightedConfidence,
    claims: verifications,
    hallucinations: contradicted,
    recommendations,
    disambiguationWarnings,
    isCommonName: nameIsCommon,
  }
}

/**
 * Quick hallucination check - runs only SEC and FEC verification
 * Use for fast batch processing
 */
export async function quickHallucinationCheck(
  personName: string,
  state: string | undefined,
  output: ProspectResearchOutput
): Promise<{
  hasHallucinations: boolean
  hallucinations: ClaimVerification[]
  confidence: number
}> {
  const verifications: ClaimVerification[] = []

  // Only check SEC and FEC - fastest and most reliable
  if (output.wealth.securities.has_sec_filings) {
    const secVerification = await verifySecClaim(personName, {
      hasFilings: true,
      companies: output.wealth.securities.insider_at,
    })
    verifications.push(secVerification)
  }

  if (output.philanthropy.political_giving.total > 500) {
    const fecVerification = await verifyFecClaim(personName, state, {
      total: output.philanthropy.political_giving.total,
      partyLean: output.philanthropy.political_giving.party_lean,
    })
    verifications.push(fecVerification)
  }

  const hallucinations = verifications.filter((v) => v.status === "CONTRADICTED")
  const avgConfidence =
    verifications.reduce((sum, v) => sum + v.confidence, 0) / Math.max(verifications.length, 1)

  return {
    hasHallucinations: hallucinations.length > 0,
    hallucinations,
    confidence: avgConfidence,
  }
}
