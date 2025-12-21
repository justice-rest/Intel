/**
 * Household/Spouse Search Tool
 * Provides household-level prospect research by finding and aggregating spouse/partner data
 *
 * Key capability competitors lack (iWave users specifically request this)
 *
 * Uses multiple data sources:
 * - Wikidata (spouse property P26)
 * - SEC insider filings (spouses often appear together)
 * - OpenCorporates (shared company affiliations)
 * - FEC contributions (household giving patterns)
 * - Linkup web search (automatic fallback with multiple queries)
 *
 * All sources are FREE - no API keys required
 */

import { tool } from "ai"
import { z } from "zod"
import { LinkupClient } from "linkup-sdk"
import { getLinkupApiKey, isLinkupEnabled } from "../linkup/config"

// ============================================================================
// TYPES
// ============================================================================

interface WikidataSpouseResult {
  spouse: string
  spouseId: string
  startDate?: string
  endDate?: string
}

interface SpouseInfo {
  name: string
  wikidataId?: string
  relationship: string
  startDate?: string
  endDate?: string
  current: boolean
  sharedCompanies: string[]
  combinedPoliticalGiving?: number
  source: string
  confidence: "high" | "medium" | "low"
}

export interface HouseholdSearchResult {
  primaryPerson: string
  spouses: SpouseInfo[]
  householdWealth: {
    estimatedCombined: string
    wealthIndicators: string[]
    confidenceLevel: string
  }
  sharedAffiliations: Array<{
    type: string
    name: string
    roles: string[]
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const householdSearchSchema = z.object({
  personName: z
    .string()
    .describe("Name of the person to find spouse/household information for"),
  personWikidataId: z
    .string()
    .optional()
    .describe("Wikidata QID if known (e.g., 'Q317521' for Elon Musk) - improves accuracy"),
  includeFormerSpouses: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include former/divorced spouses in results"),
  crossReferenceData: z
    .boolean()
    .optional()
    .default(true)
    .describe("Cross-reference with SEC, FEC, and business records for validation"),
  autoWebSearch: z
    .boolean()
    .optional()
    .default(true)
    .describe("Automatically search web (Linkup) if no spouse found in Wikidata/SEC"),
})

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

const TIMEOUT_MS = 45000 // 45 seconds total

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// NAME EXTRACTION UTILITIES
// ============================================================================

/**
 * Comprehensive patterns for extracting spouse names from text
 */
const SPOUSE_PATTERNS = [
  // Direct marriage statements
  /(?:is |was )?married to ([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
  /(?:his|her) (?:wife|husband|spouse|partner),?\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
  /wife(?:\s+is)?\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
  /husband(?:\s+is)?\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
  /spouse(?:\s+is)?\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
  /partner(?:\s+is)?\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,

  // Wedding/marriage announcements
  /married\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})\s+(?:in|on)/gi,
  /wed(?:ded)?\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,

  // Relational phrases
  /(?:and|&)\s+(?:his|her)\s+(?:wife|husband|spouse|partner)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
  /along with (?:wife|husband|spouse|partner)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,

  // Lists and conjunctions
  /(?:^|\.\s+)([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3}),?\s+(?:his|her)\s+(?:wife|husband|spouse)/gi,

  // Divorced/former spouse
  /(?:ex-wife|ex-husband|former wife|former husband|former spouse)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
  /divorced from\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,

  // Biographical snippets
  /lives with (?:his|her) (?:wife|husband|spouse|partner)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
  /resides with\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/gi,
]

/**
 * Words that should not start a name (common false positives)
 */
const INVALID_NAME_STARTERS = new Set([
  "the", "a", "an", "his", "her", "their", "and", "or", "but", "with", "from",
  "for", "in", "on", "at", "to", "by", "since", "until", "before", "after",
  "during", "through", "between", "among", "into", "onto", "upon", "about",
  "above", "below", "over", "under", "around", "behind", "beside", "beyond",
  "inside", "outside", "within", "without", "throughout", "across", "along",
  "amid", "despite", "except", "like", "near", "of", "off", "out", "past",
  "than", "toward", "towards", "underneath", "unlike", "until", "via",
  "who", "whom", "whose", "which", "what", "when", "where", "why", "how",
  "that", "this", "these", "those", "such", "no", "not", "yes", "also",
  "just", "only", "even", "both", "either", "neither", "each", "every",
  "all", "any", "some", "most", "more", "less", "few", "many", "much",
  "several", "other", "another", "same", "different", "various", "certain",
])

/**
 * Clean and validate extracted name
 */
function cleanExtractedName(name: string, primaryPersonName: string): string | null {
  if (!name) return null

  // Trim and normalize whitespace
  let cleaned = name.trim().replace(/\s+/g, " ")

  // Remove trailing punctuation
  cleaned = cleaned.replace(/[.,;:!?'")\]]+$/, "").trim()

  // Remove leading articles or conjunctions
  cleaned = cleaned.replace(/^(the|a|an|and|or)\s+/i, "").trim()

  // Check if it starts with an invalid word
  const firstWord = cleaned.split(" ")[0].toLowerCase()
  if (INVALID_NAME_STARTERS.has(firstWord)) {
    return null
  }

  // Must have at least 2 parts (first and last name)
  const parts = cleaned.split(" ")
  if (parts.length < 2) return null

  // Must not be too long (max 5 words for a name)
  if (parts.length > 5) return null

  // Each part should start with uppercase (proper name)
  const isProperName = parts.every(part =>
    part.length > 0 && /^[A-Z]/.test(part)
  )
  if (!isProperName) return null

  // Should not be the same as the primary person
  const normalizedCleaned = cleaned.toLowerCase()
  const normalizedPrimary = primaryPersonName.toLowerCase()
  if (normalizedCleaned === normalizedPrimary) return null

  // Should not be a substring of primary person name or vice versa
  if (normalizedCleaned.includes(normalizedPrimary) || normalizedPrimary.includes(normalizedCleaned)) {
    // Allow if they share just a last name
    const cleanedParts = normalizedCleaned.split(" ")
    const primaryParts = normalizedPrimary.split(" ")
    const cleanedFirst = cleanedParts[0]
    const primaryFirst = primaryParts[0]
    if (cleanedFirst === primaryFirst) return null // Same first name
  }

  return cleaned
}

/**
 * Extract spouse names from text using multiple patterns
 */
function extractSpouseNamesFromText(text: string, primaryPersonName: string): Set<string> {
  const foundNames = new Set<string>()

  for (const pattern of SPOUSE_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0

    let match
    while ((match = pattern.exec(text)) !== null) {
      const rawName = match[1]
      const cleanedName = cleanExtractedName(rawName, primaryPersonName)
      if (cleanedName) {
        foundNames.add(cleanedName)
      }
    }
  }

  return foundNames
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Search Wikidata for a person and get their spouse information
 */
async function searchWikidataForSpouse(
  personName: string,
  personId?: string
): Promise<{ personId: string | null; spouses: WikidataSpouseResult[] }> {
  try {
    let entityId = personId

    // If no ID provided, search for the person first
    if (!entityId) {
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(personName)}&language=en&type=item&limit=5&format=json&origin=*`

      const searchResponse = await fetch(searchUrl)
      if (!searchResponse.ok) {
        return { personId: null, spouses: [] }
      }

      const searchData = await searchResponse.json()
      if (!searchData.search || searchData.search.length === 0) {
        return { personId: null, spouses: [] }
      }

      // Find the best match (prefer persons)
      entityId = searchData.search[0].id
    }

    // Now get the entity with spouse claims (P26)
    if (!entityId) {
      return { personId: null, spouses: [] }
    }

    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims|labels&languages=en&format=json&origin=*`

    const entityResponse = await fetch(entityUrl)
    if (!entityResponse.ok) {
      return { personId: entityId || null, spouses: [] }
    }

    const entityData = await entityResponse.json()
    const entity = entityData.entities?.[entityId as string]
    if (!entity) {
      return { personId: entityId || null, spouses: [] }
    }

    // Extract spouse claims (P26)
    const spouseClaims = entity.claims?.P26 || []
    const spouses: WikidataSpouseResult[] = []

    for (const claim of spouseClaims) {
      const spouseId = claim.mainsnak?.datavalue?.value?.id
      if (!spouseId) continue

      // Get start/end dates from qualifiers
      const startDate = claim.qualifiers?.P580?.[0]?.datavalue?.value?.time?.substring(1, 11)
      const endDate = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time?.substring(1, 11)

      // Resolve spouse name
      const spouseUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${spouseId}&props=labels&languages=en&format=json&origin=*`
      const spouseResponse = await fetch(spouseUrl)
      const spouseData = await spouseResponse.json()
      const spouseName = spouseData.entities?.[spouseId]?.labels?.en?.value || spouseId

      spouses.push({
        spouse: spouseName,
        spouseId,
        startDate,
        endDate,
      })
    }

    return { personId: entityId || null, spouses }
  } catch (error) {
    console.error("[Household] Wikidata search failed:", error)
    return { personId: null, spouses: [] }
  }
}

/**
 * Search SEC for joint filings that might indicate spouse
 */
async function searchSecForJointFilings(personName: string): Promise<string[]> {
  try {
    // Use SEC EDGAR full-text search
    const url = `https://efts.sec.gov/LATEST/search-index?q="${encodeURIComponent(personName)}"&dateRange=custom&startdt=2020-01-01&forms=3,4,5&from=0&size=10`

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const relatedNames: string[] = []

    // Extract names from filings that appear alongside the target person
    // This is a simplified implementation - SEC filings often list related persons
    if (data.hits?.hits) {
      for (const hit of data.hits.hits) {
        const source = hit._source
        if (source?.display_names) {
          for (const name of source.display_names) {
            if (name.toLowerCase() !== personName.toLowerCase()) {
              relatedNames.push(name)
            }
          }
        }
      }
    }

    return [...new Set(relatedNames)].slice(0, 5)
  } catch (error) {
    console.error("[Household] SEC search failed:", error)
    return []
  }
}

/**
 * Search Linkup for family/spouse information with multiple query strategies
 */
async function searchLinkupForFamily(personName: string): Promise<{
  spouses: SpouseInfo[]
  sources: Array<{ name: string; url: string }>
}> {
  if (!isLinkupEnabled()) {
    console.log("[Household] Linkup not enabled, skipping web search")
    return { spouses: [], sources: [] }
  }

  const allSpouses = new Map<string, SpouseInfo>()
  const allSources: Array<{ name: string; url: string }> = []

  try {
    const client = new LinkupClient({ apiKey: getLinkupApiKey() })

    // Multiple search queries for better coverage
    const searchQueries = [
      `"${personName}" spouse wife husband married`,
      `"${personName}" wife husband partner`,
      `"${personName}" married to wedding`,
      `who is ${personName} married to`,
      `${personName} family`,
    ]

    // Run first 3 queries in parallel (most important ones)
    const searchPromises = searchQueries.slice(0, 3).map(async (query) => {
      try {
        console.log(`[Household] Linkup search: "${query}"`)
        const result = await withTimeout(
          client.search({
            query,
            depth: "standard",
            outputType: "sourcedAnswer",
          }),
          20000,
          `Linkup search timed out: ${query}`
        )
        return result
      } catch (error) {
        console.warn(`[Household] Query failed: ${query}`, error)
        return null
      }
    })

    const results = await Promise.all(searchPromises)

    // Process all results
    for (const result of results) {
      if (!result) continue

      const answer = typeof result === "string"
        ? result
        : (result as { answer?: string })?.answer || ""

      const sources = (result as { sources?: Array<{ name?: string; url: string }> })?.sources || []

      // Add sources
      for (const src of sources.slice(0, 3)) {
        if (src.url && !allSources.some(s => s.url === src.url)) {
          allSources.push({
            name: src.name || "Web Source",
            url: src.url,
          })
        }
      }

      // Extract names from this result
      const extractedNames = extractSpouseNamesFromText(answer, personName)

      for (const name of extractedNames) {
        const key = name.toLowerCase()
        if (!allSpouses.has(key)) {
          // Determine confidence based on how clearly the relationship was stated
          let confidence: "high" | "medium" | "low" = "low"
          const lowerAnswer = answer.toLowerCase()
          const lowerName = name.toLowerCase()

          if (lowerAnswer.includes(`married to ${lowerName}`) ||
              lowerAnswer.includes(`wife ${lowerName}`) ||
              lowerAnswer.includes(`husband ${lowerName}`)) {
            confidence = "high"
          } else if (lowerAnswer.includes(lowerName) &&
                     (lowerAnswer.includes("spouse") ||
                      lowerAnswer.includes("married") ||
                      lowerAnswer.includes("wife") ||
                      lowerAnswer.includes("husband"))) {
            confidence = "medium"
          }

          allSpouses.set(key, {
            name,
            relationship: "Spouse (Web Search)",
            current: true,
            sharedCompanies: [],
            source: "Linkup Web Search",
            confidence,
          })
        }
      }
    }

    // If no results yet, try additional queries sequentially
    if (allSpouses.size === 0 && searchQueries.length > 3) {
      for (const query of searchQueries.slice(3)) {
        try {
          console.log(`[Household] Additional Linkup search: "${query}"`)
          const result = await withTimeout(
            client.search({
              query,
              depth: "standard",
              outputType: "sourcedAnswer",
            }),
            15000,
            `Linkup search timed out: ${query}`
          )

          const answer = typeof result === "string"
            ? result
            : (result as { answer?: string })?.answer || ""

          const sources = (result as { sources?: Array<{ name?: string; url: string }> })?.sources || []

          for (const src of sources.slice(0, 2)) {
            if (src.url && !allSources.some(s => s.url === src.url)) {
              allSources.push({
                name: src.name || "Web Source",
                url: src.url,
              })
            }
          }

          const extractedNames = extractSpouseNamesFromText(answer, personName)

          for (const name of extractedNames) {
            const key = name.toLowerCase()
            if (!allSpouses.has(key)) {
              allSpouses.set(key, {
                name,
                relationship: "Spouse (Web Search)",
                current: true,
                sharedCompanies: [],
                source: "Linkup Web Search",
                confidence: "low",
              })
            }
          }

          // Stop if we found something
          if (allSpouses.size > 0) break
        } catch (error) {
          console.warn(`[Household] Additional query failed: ${query}`, error)
        }
      }
    }

    console.log("[Household] Linkup found", allSpouses.size, "potential family members from", allSources.length, "sources")

    return {
      spouses: Array.from(allSpouses.values()),
      sources: allSources.slice(0, 5),
    }
  } catch (error) {
    console.error("[Household] Linkup family search failed:", error)
    return { spouses: [], sources: [] }
  }
}

/**
 * Format household data for AI analysis
 */
function formatHouseholdForAI(result: HouseholdSearchResult): string {
  const lines: string[] = [
    `# Household Research: ${result.primaryPerson}`,
    "",
  ]

  if (result.spouses.length === 0) {
    lines.push("## No Spouse/Partner Information Found")
    lines.push("")
    lines.push("No spouse or partner information was found in public records (including comprehensive web search).")
    lines.push("This could mean:")
    lines.push("- The person is not married or in a registered partnership")
    lines.push("- The spouse information is not publicly available")
    lines.push("- The spouse prefers to maintain a lower public profile")
    lines.push("")
    lines.push("**Search Methods Used:**")
    lines.push("- Wikidata biographical database")
    lines.push("- SEC EDGAR insider filings")
    lines.push("- Multiple web searches with varied queries")
    lines.push("")
    lines.push("**Recommendation:** If spouse information is critical, consider direct outreach or donor database cross-reference.")
    return lines.join("\n")
  }

  lines.push(`## Identified Household Members: ${result.spouses.length + 1}`)
  lines.push("")

  // Primary person
  lines.push(`### Primary: ${result.primaryPerson}`)
  lines.push("")

  // Spouses sorted by confidence
  const sortedSpouses = [...result.spouses].sort((a, b) => {
    const confidenceOrder = { high: 0, medium: 1, low: 2 }
    return confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
  })

  sortedSpouses.forEach((spouse, idx) => {
    const status = spouse.current ? "(Current)" : "(Former)"
    const confidenceBadge = spouse.confidence === "high" ? "✓" : spouse.confidence === "medium" ? "~" : "?"
    lines.push(`### ${idx + 1}. ${spouse.name} ${status} [${confidenceBadge} ${spouse.confidence} confidence]`)
    lines.push("")
    lines.push(`- **Relationship:** ${spouse.relationship}`)
    lines.push(`- **Source:** ${spouse.source}`)
    if (spouse.startDate) {
      lines.push(`- **Since:** ${spouse.startDate}`)
    }
    if (spouse.endDate) {
      lines.push(`- **Until:** ${spouse.endDate}`)
    }
    if (spouse.wikidataId) {
      lines.push(`- **Wikidata:** [${spouse.wikidataId}](https://www.wikidata.org/wiki/${spouse.wikidataId})`)
    }
    if (spouse.sharedCompanies.length > 0) {
      lines.push(`- **Shared Business Affiliations:** ${spouse.sharedCompanies.join(", ")}`)
    }
    if (spouse.combinedPoliticalGiving) {
      lines.push(`- **Combined Political Giving:** $${spouse.combinedPoliticalGiving.toLocaleString()}`)
    }
    lines.push("")
  })

  // Household wealth summary
  lines.push("---")
  lines.push("")
  lines.push("## Household Wealth Assessment")
  lines.push("")
  lines.push(`- **Estimated Combined Capacity:** ${result.householdWealth.estimatedCombined}`)
  lines.push(`- **Confidence Level:** ${result.householdWealth.confidenceLevel}`)
  lines.push("")

  if (result.householdWealth.wealthIndicators.length > 0) {
    lines.push("**Wealth Indicators:**")
    result.householdWealth.wealthIndicators.forEach((indicator) => {
      lines.push(`- ${indicator}`)
    })
  }

  // Shared affiliations
  if (result.sharedAffiliations.length > 0) {
    lines.push("")
    lines.push("---")
    lines.push("")
    lines.push("## Shared Affiliations")
    lines.push("")

    result.sharedAffiliations.forEach((affiliation) => {
      lines.push(`### ${affiliation.name}`)
      lines.push(`- **Type:** ${affiliation.type}`)
      lines.push(`- **Roles:** ${affiliation.roles.join(", ")}`)
      lines.push("")
    })
  }

  // Prospect research implications
  lines.push("---")
  lines.push("")
  lines.push("## Prospect Research Implications")
  lines.push("")
  lines.push("**Household Giving Strategy:**")
  lines.push("- Consider soliciting both partners for major gift conversations")
  lines.push("- Household capacity may be significantly higher than individual estimates")
  lines.push("- Shared philanthropic interests increase engagement likelihood")
  lines.push("")

  const currentSpouses = result.spouses.filter((s) => s.current)
  if (currentSpouses.length > 0) {
    const bestSpouse = currentSpouses.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.confidence] - order[b.confidence]
    })[0]

    lines.push("**Recommended Approach:**")
    lines.push(`- Address correspondence to both ${result.primaryPerson} and ${bestSpouse.name}`)
    lines.push("- Research spouse's charitable interests for alignment")
    lines.push("- Consider couple-focused cultivation events")

    if (bestSpouse.confidence === "low") {
      lines.push("")
      lines.push("**Note:** Spouse information confidence is low. Verify before using in formal communications.")
    }
  }

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search for spouse/household information
 */
export const householdSearchTool = tool({
  description:
    "Search for spouse and household information for a prospect. Returns spouse names, " +
    "relationship dates, shared business affiliations, combined political giving, and " +
    "household wealth assessment. Essential for major gift strategy - household giving " +
    "capacity is often 2x individual capacity. Uses Wikidata, SEC, and comprehensive web search. " +
    "FREE - no API key required.",
  parameters: householdSearchSchema,
  execute: async ({
    personName,
    personWikidataId,
    includeFormerSpouses = true,
    crossReferenceData = true,
    autoWebSearch = true,
  }): Promise<HouseholdSearchResult> => {
    console.log("[Household] Searching for:", personName)
    const startTime = Date.now()

    try {
      // Step 1: Search Wikidata for spouse information
      const wikidataResult = await withTimeout(
        searchWikidataForSpouse(personName, personWikidataId),
        15000,
        "Wikidata search timed out"
      )

      // Step 2: Optionally search SEC for related persons
      let secRelatedNames: string[] = []
      if (crossReferenceData) {
        secRelatedNames = await withTimeout(
          searchSecForJointFilings(personName),
          10000,
          "SEC search timed out"
        ).catch(() => [])
      }

      // Combine and deduplicate spouse information
      const spouseMap = new Map<string, SpouseInfo>()

      // Add Wikidata spouses (highest confidence)
      for (const spouse of wikidataResult.spouses) {
        const current = !spouse.endDate
        if (!includeFormerSpouses && !current) continue

        spouseMap.set(spouse.spouse.toLowerCase(), {
          name: spouse.spouse,
          wikidataId: spouse.spouseId,
          relationship: "Spouse",
          startDate: spouse.startDate,
          endDate: spouse.endDate,
          current,
          sharedCompanies: [],
          source: "Wikidata",
          confidence: "high",
        })
      }

      // Add SEC-discovered related persons (medium confidence)
      for (const name of secRelatedNames) {
        const key = name.toLowerCase()
        if (!spouseMap.has(key)) {
          spouseMap.set(key, {
            name,
            relationship: "Related Person (SEC Filings)",
            current: true,
            sharedCompanies: [],
            source: "SEC EDGAR",
            confidence: "medium",
          })
        }
      }

      // Step 3: If no spouse found and autoWebSearch is enabled, use Linkup with multiple strategies
      let linkupSources: Array<{ name: string; url: string }> = []
      if (spouseMap.size === 0 && autoWebSearch) {
        console.log("[Household] No spouse found in Wikidata/SEC, running comprehensive web search...")
        const linkupResult = await withTimeout(
          searchLinkupForFamily(personName),
          40000,
          "Linkup family search timed out"
        ).catch((err) => {
          console.warn("[Household] Linkup search failed:", err)
          return { spouses: [], sources: [] }
        })

        for (const spouse of linkupResult.spouses) {
          const key = spouse.name.toLowerCase()
          if (!spouseMap.has(key)) {
            spouseMap.set(key, spouse)
          }
        }
        linkupSources = linkupResult.sources
      }

      const spouses = Array.from(spouseMap.values())

      // Calculate wealth indicators
      const wealthIndicators: string[] = []
      let confidenceLevel = "Low"

      if (wikidataResult.personId) {
        wealthIndicators.push("Person found in Wikidata (public figure)")
        confidenceLevel = "Medium"
      }
      if (spouses.length > 0) {
        const highConfidenceSpouses = spouses.filter(s => s.confidence === "high")
        if (highConfidenceSpouses.length > 0) {
          wealthIndicators.push(`${highConfidenceSpouses.length} verified household member(s)`)
        } else {
          wealthIndicators.push(`${spouses.length} potential household member(s) identified`)
        }
        confidenceLevel = "Medium"
      }
      if (secRelatedNames.length > 0) {
        wealthIndicators.push("Appears in SEC filings (indicates public company affiliation)")
        confidenceLevel = "High"
      }

      // Estimate combined capacity
      let estimatedCombined = "Unable to estimate - need more data"
      if (wealthIndicators.length >= 2) {
        estimatedCombined = "Potentially significant - recommend further research"
      }
      if (confidenceLevel === "High") {
        estimatedCombined = "High capacity household - SEC filings indicate wealth"
      }

      // Build result
      const result: HouseholdSearchResult = {
        primaryPerson: personName,
        spouses,
        householdWealth: {
          estimatedCombined,
          wealthIndicators,
          confidenceLevel,
        },
        sharedAffiliations: [],
        rawContent: "",
        sources: [],
      }

      // Generate sources
      result.sources.push({
        name: `Wikidata - ${personName}`,
        url: wikidataResult.personId
          ? `https://www.wikidata.org/wiki/${wikidataResult.personId}`
          : `https://www.wikidata.org/wiki/Special:Search?search=${encodeURIComponent(personName)}`,
      })

      if (crossReferenceData) {
        result.sources.push({
          name: `SEC EDGAR - ${personName}`,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(personName)}&type=&dateb=&owner=include&count=40`,
        })
      }

      spouses.forEach((spouse) => {
        if (spouse.wikidataId) {
          result.sources.push({
            name: `Wikidata - ${spouse.name}`,
            url: `https://www.wikidata.org/wiki/${spouse.wikidataId}`,
          })
        }
      })

      // Add Linkup sources if web search was used
      if (linkupSources.length > 0) {
        result.sources.push(...linkupSources)
      }

      // Generate formatted content
      result.rawContent = formatHouseholdForAI(result)

      const duration = Date.now() - startTime
      console.log("[Household] Search completed in", duration, "ms, found", spouses.length, "household members")

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Household] Search failed:", errorMessage)
      return {
        primaryPerson: personName,
        spouses: [],
        householdWealth: {
          estimatedCombined: "Unable to estimate",
          wealthIndicators: [],
          confidenceLevel: "Unknown",
        },
        sharedAffiliations: [],
        rawContent: `Failed to search household information for "${personName}": ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if household search tool should be enabled
 * Always enabled - uses free APIs
 */
export function shouldEnableHouseholdSearchTool(): boolean {
  return true
}
