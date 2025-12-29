/**
 * Parallel AI Prospect Discovery Tool
 *
 * Uses FindAll API to discover new prospects matching specific criteria.
 * Unlike prospect research (which researches known names), this DISCOVERS
 * new prospects that match your nonprofit's target donor profile.
 *
 * Use Cases:
 * - "Find tech entrepreneurs in Austin who support education"
 * - "Discover healthcare executives in Boston involved in philanthropy"
 * - "Identify real estate investors in Miami who sit on nonprofit boards"
 *
 * @see /lib/parallel/findall.ts
 */

import { tool } from "ai"
import { z } from "zod"
import {
  executeProspectDiscovery,
  getFindAllStatus,
  DISCOVERY_TEMPLATES,
  type ProspectDiscoveryOptions,
  type DiscoveryResult,
  type FindAllError,
} from "@/lib/parallel/findall"
import { shouldUseParallel } from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * Check if prospect discovery should be enabled for a user
 */
export function shouldEnableProspectDiscovery(userId?: string): boolean {
  if (!userId) {
    return getFindAllStatus().available
  }

  return shouldUseParallel(userId, "PARALLEL_FINDALL")
}

/**
 * Get availability message for error responses
 */
export function getProspectDiscoveryAvailabilityMessage(): string {
  const status = getFindAllStatus()

  if (!status.configured) {
    return "Prospect discovery is not configured. PARALLEL_API_KEY is missing."
  }

  if (!status.enabled) {
    return "Prospect discovery is currently disabled."
  }

  if (status.circuitOpen) {
    return "Prospect discovery is temporarily unavailable due to high error rates."
  }

  return "Prospect discovery is available."
}

// ============================================================================
// SCHEMA
// ============================================================================

const prospectDiscoverySchema = z.object({
  objective: z
    .string()
    .describe(
      "Natural language description of who to find. Be specific about industry, location, wealth indicators, and philanthropic interests."
    ),
  entity_type: z
    .string()
    .optional()
    .default("philanthropist")
    .describe("Type of entity: 'philanthropist', 'executive', 'investor', etc."),
  match_conditions: z
    .array(
      z.object({
        name: z.string().describe("Short name for the condition"),
        description: z
          .string()
          .describe("Detailed description of what makes a match"),
      })
    )
    .min(1)
    .max(5)
    .describe("Conditions that prospects must match. More specific = better results."),
  match_limit: z
    .number()
    .min(5)
    .max(50)
    .optional()
    .default(10)
    .describe("Maximum prospects to find (5-50). Default: 10"),
  location: z
    .string()
    .optional()
    .describe("Geographic focus (city, state, or region)"),
  exclude_names: z
    .array(z.string())
    .optional()
    .describe("Names to exclude from results (e.g., existing donors)"),
})

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * Parallel AI Prospect Discovery Tool
 *
 * Discovers new prospects matching specific criteria.
 * Use when the user wants to FIND new donors, not research known names.
 */
export const parallelProspectDiscoveryTool = tool({
  description:
    "DISCOVER NEW PROSPECTS: Finds people matching specific criteria without needing names. " +
    "Use when user asks to 'find', 'discover', or 'identify' new donors. " +
    "Examples: 'Find tech entrepreneurs who support education', " +
    "'Discover philanthropists in healthcare', 'Identify real estate investors'. " +
    "Returns matched prospects with names, descriptions, and sources. " +
    "COST: ~$0.10-0.50 per discovery (varies by match_limit). " +
    "TIMING: 30-120 seconds depending on complexity.",
  parameters: prospectDiscoverySchema,
  execute: async (params): Promise<{
    success: boolean
    findallId?: string
    prospects: Array<{
      name: string
      description?: string
      url: string
      sources: Array<{ url: string; title?: string }>
    }>
    totalCandidates: number
    matchedCount: number
    durationMs: number
    error?: string
  }> => {
    const {
      objective,
      entity_type,
      match_conditions,
      match_limit,
      location,
      exclude_names,
    } = params

    console.log(`[Parallel Discovery] Starting: ${objective}`)

    // Check availability
    const status = getFindAllStatus()
    if (!status.available) {
      return {
        success: false,
        prospects: [],
        totalCandidates: 0,
        matchedCount: 0,
        durationMs: 0,
        error: getProspectDiscoveryAvailabilityMessage(),
      }
    }

    try {
      // Build full objective with location
      const fullObjective = location
        ? `${objective} in ${location}`
        : objective

      // Build exclude list if provided
      const excludeList = exclude_names?.map((name) => ({
        name,
        url: "", // URL not known for exclusion by name
      }))

      const options: ProspectDiscoveryOptions = {
        objective: fullObjective,
        entityType: entity_type,
        matchConditions: match_conditions,
        matchLimit: Math.min(match_limit ?? 10, 50),
        generator: "pro",
        excludeList: excludeList?.length ? excludeList : undefined,
        metadata: {
          source: "chat_tool",
          location: location ?? "",
        },
      }

      const result = await executeProspectDiscovery(options)

      console.log(
        `[Parallel Discovery] Found ${result.prospects.length} prospects ` +
          `in ${result.durationMs}ms`
      )

      return {
        success: true,
        findallId: result.findallId,
        prospects: result.prospects.map((p) => ({
          name: p.name,
          description: p.description,
          url: p.url,
          sources: p.sources.slice(0, 5).map((s) => ({
            url: s.url,
            title: s.title,
          })),
        })),
        totalCandidates: result.allCandidates.length,
        matchedCount: result.prospects.length,
        durationMs: result.durationMs,
      }
    } catch (error) {
      const findAllError = error as FindAllError
      console.error(`[Parallel Discovery] Failed:`, findAllError.message)

      return {
        success: false,
        prospects: [],
        totalCandidates: 0,
        matchedCount: 0,
        durationMs: 0,
        error: `Discovery failed: ${findAllError.message}`,
      }
    }
  },
})

// ============================================================================
// PRESET DISCOVERY TOOLS
// ============================================================================

/**
 * Quick discovery using preset templates
 */
const presetDiscoverySchema = z.object({
  template: z
    .enum([
      "tech_philanthropists",
      "real_estate_investors",
      "healthcare_executives",
      "finance_philanthropists",
    ])
    .describe("Pre-configured discovery template"),
  location: z.string().optional().describe("Geographic focus (optional)"),
  match_limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum prospects to find"),
})

/**
 * Quick preset discovery tool
 */
export const parallelPresetDiscoveryTool = tool({
  description:
    "QUICK PROSPECT DISCOVERY using pre-configured templates. " +
    "Templates: tech_philanthropists, real_estate_investors, healthcare_executives, finance_philanthropists. " +
    "Faster setup than custom discovery. Add optional location for geographic focus.",
  parameters: presetDiscoverySchema,
  execute: async (params): Promise<{
    success: boolean
    template: string
    prospects: Array<{
      name: string
      description?: string
      url: string
    }>
    matchedCount: number
    durationMs: number
    error?: string
  }> => {
    const { template, location, match_limit } = params

    console.log(`[Parallel Preset Discovery] Template: ${template}`)

    // Check availability
    const status = getFindAllStatus()
    if (!status.available) {
      return {
        success: false,
        template,
        prospects: [],
        matchedCount: 0,
        durationMs: 0,
        error: getProspectDiscoveryAvailabilityMessage(),
      }
    }

    try {
      // Get template
      let options: ProspectDiscoveryOptions

      switch (template) {
        case "tech_philanthropists":
          options = DISCOVERY_TEMPLATES.techPhilanthropists(location)
          break
        case "real_estate_investors":
          options = DISCOVERY_TEMPLATES.realEstateInvestors(location)
          break
        case "healthcare_executives":
          options = DISCOVERY_TEMPLATES.healthcareExecutives(location)
          break
        case "finance_philanthropists":
          options = DISCOVERY_TEMPLATES.financePhilanthropists(location)
          break
        default:
          throw new Error(`Unknown template: ${template}`)
      }

      // Override match limit if provided
      if (match_limit) {
        options.matchLimit = Math.min(match_limit, 50)
      }

      const result = await executeProspectDiscovery(options)

      return {
        success: true,
        template,
        prospects: result.prospects.map((p) => ({
          name: p.name,
          description: p.description,
          url: p.url,
        })),
        matchedCount: result.prospects.length,
        durationMs: result.durationMs,
      }
    } catch (error) {
      const findAllError = error as FindAllError

      return {
        success: false,
        template,
        prospects: [],
        matchedCount: 0,
        durationMs: 0,
        error: findAllError.message,
      }
    }
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export {
  executeProspectDiscovery,
  DISCOVERY_TEMPLATES,
} from "@/lib/parallel/findall"
