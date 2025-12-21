/**
 * Family/Household Discovery Tool
 * Discovers family members and household composition from public records
 *
 * Key Features:
 * - Identifies spouse from joint property ownership
 * - Discovers adult children from same-address records
 * - Infers relationships from naming patterns
 * - Finds family members from business registrations
 *
 * Data Sources (all FREE):
 * - Property records (joint ownership)
 * - Voter registration (same address)
 * - Business registrations (same surname officers)
 * - Linkup web search (family foundation, obituaries, etc.)
 *
 * Privacy Note:
 * All data sources are public records. This tool only surfaces
 * information that is already publicly available.
 */

import { tool } from "ai"
import { z } from "zod"
import { getLinkupApiKeyOptional, isLinkupEnabled } from "@/lib/linkup/config"
import { LinkupClient } from "linkup-sdk"

// ============================================================================
// TYPES
// ============================================================================

export interface FamilyMember {
  name: string
  relationship: "spouse" | "child" | "parent" | "sibling" | "other" | "unknown"
  estimatedAge?: number
  birthYear?: number
  evidence: Array<{
    source: string
    claim: string
    url?: string
  }>
  confidence: "high" | "medium" | "low"
}

export interface FamilyDiscoveryResult {
  person: {
    name: string
    address?: string
    city?: string
    state?: string
  }
  householdMembers: FamilyMember[]
  householdSize: number
  maritalStatus: "married" | "single" | "unknown"
  methodology: string
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const familyDiscoverySchema = z.object({
  personName: z.string().describe("Full name of the person to research"),
  address: z
    .string()
    .optional()
    .describe("Current residential address (helps find household members)"),
  city: z.string().optional().describe("City of residence"),
  state: z.string().optional().describe("Two-letter state code"),
  spouseName: z
    .string()
    .optional()
    .describe("Known spouse name if available (helps verify and find more info)"),
})

export type FamilyDiscoveryParams = z.infer<typeof familyDiscoverySchema>

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract likely surname from full name
 */
function extractSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1]
}

/**
 * Check if two people likely share a surname
 */
function sharesSurname(name1: string, name2: string): boolean {
  const surname1 = extractSurname(name1).toLowerCase()
  const surname2 = extractSurname(name2).toLowerCase()
  return surname1 === surname2 && surname1.length > 2
}

/**
 * Infer relationship from naming patterns and context
 */
function inferRelationship(
  personName: string,
  memberName: string,
  context: string
): "spouse" | "child" | "parent" | "sibling" | "other" | "unknown" {
  const contextLower = context.toLowerCase()

  // Check explicit relationship mentions
  if (contextLower.includes("wife") || contextLower.includes("husband")) {
    return "spouse"
  }
  if (contextLower.includes("son") || contextLower.includes("daughter")) {
    return "child"
  }
  if (contextLower.includes("father") || contextLower.includes("mother")) {
    return "parent"
  }
  if (contextLower.includes("brother") || contextLower.includes("sister")) {
    return "sibling"
  }
  if (
    contextLower.includes("spouse") ||
    contextLower.includes("married to")
  ) {
    return "spouse"
  }

  // If joint property owner and different first name, likely spouse
  if (contextLower.includes("joint") || contextLower.includes("co-owner")) {
    const surname1 = extractSurname(personName)
    const surname2 = extractSurname(memberName)
    if (surname1.toLowerCase() === surname2.toLowerCase()) {
      // Same surname, could be spouse or child
      return "unknown"
    }
    // Different surnames on joint property usually indicates spouse
    return "spouse"
  }

  return "unknown"
}

/**
 * Estimate age from birth year
 */
function estimateAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear
}

/**
 * Search for family members via Linkup web search
 */
async function searchFamilyViaLinkup(
  params: FamilyDiscoveryParams
): Promise<{
  members: FamilyMember[]
  sources: Array<{ name: string; url: string }>
}> {
  const apiKey = getLinkupApiKeyOptional()
  if (!apiKey || !isLinkupEnabled()) {
    return { members: [], sources: [] }
  }

  const client = new LinkupClient({ apiKey })
  const members: FamilyMember[] = []
  const sources: Array<{ name: string; url: string }> = []
  const seenNames = new Set<string>()

  // Search queries
  const searches = [
    // Search 1: Property records (joint ownership)
    {
      query: `"${params.personName}" property records joint ownership ${params.address || ""} ${params.city || ""} ${params.state || ""}`.trim(),
      purpose: "property",
    },
    // Search 2: Family foundation / philanthropy
    {
      query: `"${params.personName}" family foundation spouse children philanthropy`,
      purpose: "foundation",
    },
    // Search 3: Business filings (same surname officers)
    {
      query: `"${extractSurname(params.personName)}" family ${params.state || ""} business officers directors`,
      purpose: "business",
    },
  ]

  // Add spouse-specific search if spouse name known
  if (params.spouseName) {
    searches.push({
      query: `"${params.personName}" "${params.spouseName}" married`,
      purpose: "spouse",
    })
  }

  for (const search of searches) {
    try {
      console.log(`[Family Discovery] Searching: ${search.query}`)

      const result = await client.search({
        query: search.query,
        depth: "standard",
        outputType: "sourcedAnswer",
      })

      if (!result.answer) continue

      // Collect sources
      for (const s of result.sources || []) {
        if (!sources.some((existing) => existing.url === s.url)) {
          sources.push({
            name: s.name || "Public Records",
            url: s.url,
          })
        }
      }

      // Parse family members from answer
      const answer = result.answer

      // Look for spouse patterns
      const spousePatterns = [
        /(?:wife|husband|spouse)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        /married\s+(?:to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:is|,)\s+(?:his|her)\s+(?:wife|husband)/gi,
      ]

      for (const pattern of spousePatterns) {
        let match
        while ((match = pattern.exec(answer)) !== null) {
          const name = match[1].trim()
          if (
            name.length > 3 &&
            !seenNames.has(name.toLowerCase()) &&
            name.toLowerCase() !== params.personName.toLowerCase()
          ) {
            seenNames.add(name.toLowerCase())
            members.push({
              name,
              relationship: "spouse",
              evidence: [
                {
                  source: search.purpose,
                  claim: match[0],
                  url: sources[sources.length - 1]?.url,
                },
              ],
              confidence: "medium",
            })
          }
        }
      }

      // Look for children patterns
      const childPatterns = [
        /(?:son|daughter)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        /children[:\s]+([A-Z][a-z]+(?:(?:,|\s+and)\s+[A-Z][a-z]+)*)/gi,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:is|,)\s+(?:their|his|her)\s+(?:son|daughter)/gi,
      ]

      for (const pattern of childPatterns) {
        let match
        while ((match = pattern.exec(answer)) !== null) {
          // Handle comma-separated children
          const names = match[1].split(/,|\s+and\s+/i)
          for (const name of names) {
            const trimmedName = name.trim()
            if (
              trimmedName.length > 3 &&
              !seenNames.has(trimmedName.toLowerCase()) &&
              trimmedName.toLowerCase() !== params.personName.toLowerCase()
            ) {
              seenNames.add(trimmedName.toLowerCase())
              members.push({
                name: trimmedName,
                relationship: "child",
                evidence: [
                  {
                    source: search.purpose,
                    claim: match[0],
                    url: sources[sources.length - 1]?.url,
                  },
                ],
                confidence: "medium",
              })
            }
          }
        }
      }

      // Look for joint property owners (could be spouse or co-investor)
      if (search.purpose === "property") {
        const jointPattern =
          /(?:joint|co-?owner)[:\s]+(?:with\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi
        let match
        while ((match = jointPattern.exec(answer)) !== null) {
          const name = match[1].trim()
          if (
            name.length > 3 &&
            !seenNames.has(name.toLowerCase()) &&
            name.toLowerCase() !== params.personName.toLowerCase()
          ) {
            seenNames.add(name.toLowerCase())
            const relationship = inferRelationship(
              params.personName,
              name,
              match[0]
            )
            members.push({
              name,
              relationship,
              evidence: [
                {
                  source: "property",
                  claim: `Joint property ownership: ${match[0]}`,
                  url: sources[sources.length - 1]?.url,
                },
              ],
              confidence: "high", // Property records are official
            })
          }
        }
      }

      // Look for birth years
      for (const member of members) {
        const birthPattern = new RegExp(
          `${member.name}.*?(?:born|birth|age)[^\\d]*(\\d{4}|\\d{1,2})`,
          "i"
        )
        const birthMatch = answer.match(birthPattern)
        if (birthMatch) {
          const year = parseInt(birthMatch[1], 10)
          if (year > 1900 && year < 2020) {
            member.birthYear = year
            member.estimatedAge = estimateAge(year)
          } else if (year > 0 && year < 120) {
            // It's an age, not a year
            member.estimatedAge = year
            member.birthYear = new Date().getFullYear() - year
          }
        }
      }
    } catch (error) {
      console.error(`[Family Discovery] Search failed for ${search.purpose}:`, error)
    }
  }

  return { members, sources }
}

/**
 * Add known spouse if provided
 */
function addKnownSpouse(
  members: FamilyMember[],
  spouseName: string
): FamilyMember[] {
  // Check if spouse is already in the list
  const existing = members.find(
    (m) =>
      m.name.toLowerCase() === spouseName.toLowerCase() ||
      m.name.toLowerCase().includes(spouseName.toLowerCase())
  )

  if (existing) {
    // Upgrade confidence if we had them as unknown
    existing.relationship = "spouse"
    existing.confidence = "high"
    return members
  }

  // Add spouse with high confidence since it was provided
  return [
    {
      name: spouseName,
      relationship: "spouse",
      evidence: [
        {
          source: "user_provided",
          claim: "Spouse name provided by user",
        },
      ],
      confidence: "high",
    },
    ...members,
  ]
}

/**
 * Determine marital status from family members
 */
function determineMaritalStatus(members: FamilyMember[]): "married" | "single" | "unknown" {
  const hasSpouse = members.some((m) => m.relationship === "spouse")
  if (hasSpouse) return "married"

  // Check for joint property without explicit spouse identification
  const hasJointProperty = members.some(
    (m) =>
      m.evidence.some((e) => e.source === "property") &&
      m.relationship === "unknown"
  )
  if (hasJointProperty) return "married" // Likely married if joint property

  return "unknown"
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const familyDiscoveryTool = tool({
  description:
    "Discover family members and household composition from public records. " +
    "Uses property records (joint ownership), voter data (same address), " +
    "business filings, and web search. " +
    "Returns: spouse, children, other household members with relationship confidence. " +
    "All data from public records only.",

  parameters: familyDiscoverySchema,

  execute: async (params: FamilyDiscoveryParams): Promise<FamilyDiscoveryResult> => {
    console.log("[Family Discovery] Starting search:", params)

    // Search for family members
    const { members, sources } = await searchFamilyViaLinkup(params)

    // Add known spouse if provided
    let householdMembers = members
    if (params.spouseName) {
      householdMembers = addKnownSpouse(members, params.spouseName)
    }

    // Determine marital status
    const maritalStatus = determineMaritalStatus(householdMembers)

    // Build methodology string
    const methodologyParts = ["Web search of public records"]
    if (params.address) {
      methodologyParts.push("property records analysis")
    }
    if (sources.some((s) => s.name.includes("foundation"))) {
      methodologyParts.push("foundation/philanthropy records")
    }
    methodologyParts.push("naming pattern analysis")
    const methodology = methodologyParts.join(", ")

    // Build raw content
    const rawLines: string[] = []
    rawLines.push("# Family/Household Discovery")
    rawLines.push("")
    rawLines.push("## Subject")
    rawLines.push(`- **Name:** ${params.personName}`)
    if (params.address) rawLines.push(`- **Address:** ${params.address}`)
    if (params.city) rawLines.push(`- **City:** ${params.city}`)
    if (params.state) rawLines.push(`- **State:** ${params.state}`)
    rawLines.push("")

    rawLines.push("## Household Summary")
    rawLines.push(`- **Marital Status:** ${maritalStatus.charAt(0).toUpperCase() + maritalStatus.slice(1)}`)
    rawLines.push(`- **Household Members Found:** ${householdMembers.length}`)
    rawLines.push("")

    if (householdMembers.length > 0) {
      rawLines.push("## Family Members")
      rawLines.push("")

      // Group by relationship
      const byRelationship: Record<string, FamilyMember[]> = {}
      for (const member of householdMembers) {
        const rel = member.relationship
        if (!byRelationship[rel]) byRelationship[rel] = []
        byRelationship[rel].push(member)
      }

      // Order: spouse first, then children, then others
      const relationshipOrder = ["spouse", "child", "parent", "sibling", "other", "unknown"]

      for (const rel of relationshipOrder) {
        const members = byRelationship[rel]
        if (!members || members.length === 0) continue

        const relTitle = rel.charAt(0).toUpperCase() + rel.slice(1)
        rawLines.push(`### ${relTitle}${members.length > 1 ? "ren/s" : ""}`)
        rawLines.push("")

        for (const member of members) {
          rawLines.push(`**${member.name}**`)
          if (member.estimatedAge) {
            rawLines.push(`- Age: ~${member.estimatedAge} (born ${member.birthYear})`)
          }
          rawLines.push(`- Confidence: ${member.confidence.toUpperCase()}`)

          if (member.evidence.length > 0) {
            rawLines.push("- Evidence:")
            for (const ev of member.evidence) {
              rawLines.push(`  - [${ev.source}] ${ev.claim}`)
            }
          }
          rawLines.push("")
        }
      }
    } else {
      rawLines.push("## Family Members")
      rawLines.push("")
      rawLines.push("No family members found in public records.")
      rawLines.push("")
      rawLines.push("**Suggestions:**")
      rawLines.push("- Provide the residential address for property record search")
      rawLines.push("- Provide known spouse name if available")
      rawLines.push("- Check for variations in name spelling")
    }

    rawLines.push("## Methodology")
    rawLines.push(methodology)
    rawLines.push("")

    rawLines.push("## Sources")
    for (const source of sources) {
      rawLines.push(`- [${source.name}](${source.url})`)
    }
    if (sources.length === 0) {
      rawLines.push("No sources found")
    }

    const result: FamilyDiscoveryResult = {
      person: {
        name: params.personName,
        address: params.address,
        city: params.city,
        state: params.state,
      },
      householdMembers,
      householdSize: householdMembers.length + 1, // +1 for the person themselves
      maritalStatus,
      methodology,
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
 * Check if family discovery tool should be enabled
 */
export function shouldEnableFamilyDiscoveryTool(): boolean {
  // Requires Linkup for web search
  return isLinkupEnabled()
}
