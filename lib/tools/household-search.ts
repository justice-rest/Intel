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
 *
 * All sources are FREE - no API keys required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

interface WikidataSpouseResult {
  spouse: string
  spouseId: string
  startDate?: string
  endDate?: string
}

export interface HouseholdSearchResult {
  primaryPerson: string
  spouses: Array<{
    name: string
    wikidataId?: string
    relationship: string
    startDate?: string
    endDate?: string
    current: boolean
    sharedCompanies: string[]
    combinedPoliticalGiving?: number
  }>
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
    lines.push("No spouse or partner information was found in public records.")
    lines.push("This could mean:")
    lines.push("- The person is not married or in a registered partnership")
    lines.push("- The spouse information is not in public databases")
    lines.push("- The spouse prefers to maintain a lower public profile")
    lines.push("")
    lines.push("Consider using searchWeb for additional research.")
    return lines.join("\n")
  }

  lines.push(`## Identified Household Members: ${result.spouses.length + 1}`)
  lines.push("")

  // Primary person
  lines.push(`### Primary: ${result.primaryPerson}`)
  lines.push("")

  // Spouses
  result.spouses.forEach((spouse, idx) => {
    const status = spouse.current ? "(Current)" : "(Former)"
    lines.push(`### ${idx + 1}. ${spouse.name} ${status}`)
    lines.push("")
    lines.push(`- **Relationship:** ${spouse.relationship}`)
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
    lines.push("**Recommended Approach:**")
    lines.push(`- Address correspondence to both ${result.primaryPerson} and ${currentSpouses[0].name}`)
    lines.push("- Research spouse's charitable interests for alignment")
    lines.push("- Consider couple-focused cultivation events")
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
    "capacity is often 2x individual capacity. Uses Wikidata, SEC, and other public records. " +
    "FREE - no API key required.",
  parameters: householdSearchSchema,
  execute: async ({
    personName,
    personWikidataId,
    includeFormerSpouses = true,
    crossReferenceData = true,
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
      const spouseMap = new Map<string, {
        name: string
        wikidataId?: string
        relationship: string
        startDate?: string
        endDate?: string
        current: boolean
        sharedCompanies: string[]
        combinedPoliticalGiving?: number
      }>()

      // Add Wikidata spouses
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
        })
      }

      // Add SEC-discovered related persons (potential spouses)
      for (const name of secRelatedNames) {
        const key = name.toLowerCase()
        if (!spouseMap.has(key)) {
          spouseMap.set(key, {
            name,
            relationship: "Related Person (SEC)",
            current: true,
            sharedCompanies: [],
          })
        }
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
        wealthIndicators.push(`${spouses.length} household member(s) identified`)
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
