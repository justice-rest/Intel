/**
 * Person Search Engine
 *
 * Unified person-to-business search across all sources.
 * Type a person's name → Find all businesses they own or control.
 *
 * Search Strategy:
 * 1. State Officer Search: Find companies where person is CEO, President, Director, Manager
 * 2. State Agent Search: Find companies where person is Registered Agent
 * 3. SEC Insider Search: Find public companies where person filed Form 3/4/5
 *
 * Why Officer ≈ Owner for Small Businesses:
 * - LLC: Managing Member = Owner who manages
 * - S-Corp: Sole Owner = President/CEO/Secretary
 * - Partnership: General Partner = Listed in filings
 */

import type { ScrapedBusinessEntity, ScrapedOfficer, ScraperSource, ScraperResult } from "../config"
import { getRateLimiter } from "../services/rate-limiter"
import { getCircuitBreaker } from "../services/circuit-breaker"
import { getScraperCache } from "../services/cache"
import { validateSearchQuery, validateStateCodes, VALID_STATE_CODES } from "../validation"
import {
  inferOwnership,
  type OwnershipLikelihood,
  type OwnershipInference,
  type DataSource,
} from "./ownership-inference"

/**
 * Business result with ownership inference
 */
export interface PersonBusinessResult {
  // Core business info
  companyName: string
  entityNumber: string | null
  state: string
  jurisdiction: string
  entityType: string | null
  status: string | null

  // Person's roles at this company
  roles: string[]

  // Ownership inference
  ownershipLikelihood: OwnershipLikelihood
  ownershipReason: string
  ownershipScore: number

  // Additional details
  officers?: Array<{ name: string; position: string }>
  registeredAgent?: string | null
  principalAddress?: string | null
  incorporationDate?: string | null

  // Source info
  sourceUrl: string
  source: DataSource
  scrapedAt: string
}

/**
 * SEC insider filing result
 */
export interface SecInsiderResult {
  companyName: string
  ticker?: string
  filingType: string // "Form 3" | "Form 4" | "Form 5"
  relationship: string // "Officer" | "Director" | "10%+ Owner"
  transactionDate?: string
  filingUrl: string
  ownershipLikelihood: "confirmed"
  ownershipReason: string
}

/**
 * Person search result
 */
export interface PersonSearchResult {
  success: boolean
  personSearched: string
  totalFound: number

  // State registry results
  businesses: PersonBusinessResult[]

  // SEC results (separate for clarity)
  secInsiderFilings?: SecInsiderResult[]

  // Search metadata
  statesSearched: string[]
  statesSucceeded: string[]
  statesFailed: string[]
  searchDuration: number

  // Warnings/errors
  warnings?: string[]
  error?: string
}

/**
 * Person search options
 */
export interface PersonSearchOptions {
  /** Specific states to search (default: all available) */
  states?: string[]
  /** Include SEC EDGAR search (default: true) */
  includeSecEdgar?: boolean
  /** Fetch detail pages for full officer lists (default: false for speed) */
  fetchDetailPages?: boolean
  /** Maximum results per source (default: 25) */
  limit?: number
  /** Run searches in parallel (default: true) */
  parallel?: boolean
}

/**
 * Convert scraped data to PersonBusinessResult
 */
function toPersonBusinessResult(
  entity: ScrapedBusinessEntity,
  personName: string,
  roles: string[],
  source: DataSource
): PersonBusinessResult {
  // Infer ownership from roles and entity
  const inference = inferOwnership(roles, entity.name, source)

  // Extract state code from jurisdiction
  const state = entity.jurisdiction.replace("us_", "").toUpperCase()

  return {
    companyName: entity.name,
    entityNumber: entity.entityNumber,
    state,
    jurisdiction: entity.jurisdiction,
    entityType: entity.entityType,
    status: entity.status,
    roles,
    ownershipLikelihood: inference.likelihood,
    ownershipReason: inference.reason,
    ownershipScore: inference.score,
    officers: entity.officers,
    registeredAgent: entity.registeredAgent,
    principalAddress: entity.registeredAddress,
    incorporationDate: entity.incorporationDate,
    sourceUrl: entity.sourceUrl,
    source,
    scrapedAt: entity.scrapedAt,
  }
}

/**
 * Convert officer search result to PersonBusinessResult
 */
function officerToPersonBusinessResult(
  officer: ScrapedOfficer,
  source: DataSource
): PersonBusinessResult {
  const roles = [officer.position]
  const inference = inferOwnership(roles, officer.companyName, source)
  const state = officer.jurisdiction.replace("us_", "").toUpperCase()

  return {
    companyName: officer.companyName,
    entityNumber: officer.companyNumber,
    state,
    jurisdiction: officer.jurisdiction,
    entityType: null,
    status: officer.current ? "Active" : "Unknown",
    roles,
    ownershipLikelihood: inference.likelihood,
    ownershipReason: inference.reason,
    ownershipScore: inference.score,
    sourceUrl: officer.sourceUrl,
    source,
    scrapedAt: officer.scrapedAt,
  }
}

/**
 * Search a single state for a person
 */
async function searchStateForPerson(
  stateCode: string,
  personName: string,
  _options: PersonSearchOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scraperFunctions: Record<string, (name: string, opts: { limit?: number }) => Promise<ScraperResult<any>>>
): Promise<{
  stateCode: string
  results: PersonBusinessResult[]
  success: boolean
  error?: string
}> {
  const circuitBreaker = getCircuitBreaker()

  // Check circuit breaker
  if (!circuitBreaker.isAllowed(stateCode)) {
    return {
      stateCode,
      results: [],
      success: false,
      error: `Circuit breaker OPEN for ${stateCode}`,
    }
  }

  try {
    const scraperFn = scraperFunctions[stateCode]
    if (!scraperFn) {
      return {
        stateCode,
        results: [],
        success: false,
        error: `No scraper available for ${stateCode}`,
      }
    }

    const result = await scraperFn(personName, { limit: _options.limit })

    if (!result.success) {
      circuitBreaker.recordFailure(stateCode, result.error || "Unknown error")
      return {
        stateCode,
        results: [],
        success: false,
        error: result.error,
      }
    }

    circuitBreaker.recordSuccess(stateCode)

    // Convert results to PersonBusinessResult
    const source: DataSource = "state_registry"
    const personBusinessResults: PersonBusinessResult[] = []

    for (const item of result.data) {
      // Check if it's an officer result or entity result
      if ("position" in item) {
        personBusinessResults.push(officerToPersonBusinessResult(item as ScrapedOfficer, source))
      } else {
        // For entity results, the person might be any officer
        const entity = item as ScrapedBusinessEntity
        const roles = entity.officers
          ?.filter(o => o.name.toLowerCase().includes(personName.toLowerCase()))
          .map(o => o.position) || ["Officer/Agent"]

        personBusinessResults.push(toPersonBusinessResult(entity, personName, roles, source))
      }
    }

    return {
      stateCode,
      results: personBusinessResults,
      success: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    circuitBreaker.recordFailure(stateCode, errorMessage)
    return {
      stateCode,
      results: [],
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Deduplicate results across sources
 */
function deduplicateResults(results: PersonBusinessResult[]): PersonBusinessResult[] {
  const seen = new Map<string, PersonBusinessResult>()

  for (const result of results) {
    // Create a key from company name and state
    const key = `${result.companyName.toLowerCase().trim()}_${result.state}`

    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, result)
    } else {
      // Merge: keep the one with higher ownership score
      if (result.ownershipScore > existing.ownershipScore) {
        // Merge roles
        const mergedRoles = [...new Set([...existing.roles, ...result.roles])]
        seen.set(key, {
          ...result,
          roles: mergedRoles,
        })
      } else {
        // Add roles from new result to existing
        existing.roles = [...new Set([...existing.roles, ...result.roles])]
      }
    }
  }

  return Array.from(seen.values())
}

/**
 * Sort results by ownership likelihood
 */
function sortByOwnership(results: PersonBusinessResult[]): PersonBusinessResult[] {
  const likelihoodOrder: Record<OwnershipLikelihood, number> = {
    confirmed: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  return [...results].sort((a, b) => {
    // First by likelihood
    const likelihoodDiff = likelihoodOrder[a.ownershipLikelihood] - likelihoodOrder[b.ownershipLikelihood]
    if (likelihoodDiff !== 0) return likelihoodDiff

    // Then by score within same likelihood
    return b.ownershipScore - a.ownershipScore
  })
}

/**
 * Main person search function
 *
 * Searches for all businesses owned or controlled by a person.
 */
export async function searchBusinessesByPerson(
  personName: string,
  options: PersonSearchOptions = {}
): Promise<PersonSearchResult> {
  const startTime = Date.now()

  // Validate input
  const validation = validateSearchQuery(personName)
  if (!validation.valid) {
    return {
      success: false,
      personSearched: personName,
      totalFound: 0,
      businesses: [],
      statesSearched: [],
      statesSucceeded: [],
      statesFailed: [],
      searchDuration: Date.now() - startTime,
      error: validation.error,
    }
  }

  const {
    states = Array.from(VALID_STATE_CODES),
    includeSecEdgar: _includeSecEdgar = true,
    fetchDetailPages: _fetchDetailPages = false,
    limit = 25,
    parallel = true,
  } = options

  // Validate states
  const stateValidation = validateStateCodes(states)
  const validStates = stateValidation.validCodes
  const warnings: string[] = []

  if (stateValidation.invalidCodes.length > 0) {
    warnings.push(`Skipped invalid state codes: ${stateValidation.invalidCodes.join(", ")}`)
  }

  // Use unified scraper for all configured states
  const { getAvailableStates: getAllConfiguredStates } = await import("../config/states")
  const { scrapeState } = await import("../engine/unified-scraper")

  // All configured states are searchable
  const configuredStates = getAllConfiguredStates()
  const searchableStates = validStates.filter(s => configuredStates.includes(s as typeof configuredStates[number]))

  if (searchableStates.length === 0) {
    warnings.push(`No configured states in request. Available: ${configuredStates.join(", ")}`)
  }

  // Create wrapper functions for each state using the unified scraper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scraperFunctions: Record<string, (name: string, opts: { limit?: number }) => Promise<ScraperResult<any>>> = {}

  for (const state of searchableStates) {
    scraperFunctions[state] = async (name: string, opts: { limit?: number }) => {
      return scrapeState(state, name, { limit: opts.limit })
    }
  }

  // Special handling for Florida officer search (dedicated endpoint)
  if (searchableStates.includes("fl")) {
    try {
      const { scrapeFloridaByOfficer } = await import("../scrapers/states/florida")
      scraperFunctions["fl"] = scrapeFloridaByOfficer
    } catch {
      // Fall back to unified scraper if Florida scraper not available
    }
  }

  const cache = getScraperCache()
  const rateLimiter = getRateLimiter()

  // Check cache
  const cacheKey = `person_${personName}_${searchableStates.join(",")}`
  const cached = await cache.get<PersonBusinessResult[]>("person_search", cacheKey, { limit })
  if (cached) {
    return {
      success: true,
      personSearched: personName,
      totalFound: cached.totalFound,
      businesses: cached.data,
      statesSearched: searchableStates,
      statesSucceeded: searchableStates,
      statesFailed: [],
      searchDuration: Date.now() - startTime,
    }
  }

  // Rate limit the overall search
  await rateLimiter.acquire("person_search")

  // Search states
  const statesSucceeded: string[] = []
  const statesFailed: string[] = []
  const allResults: PersonBusinessResult[] = []

  if (parallel) {
    // Parallel search
    const searchPromises = searchableStates.map(state =>
      searchStateForPerson(state, personName, { ...options, limit }, scraperFunctions)
    )

    const results = await Promise.all(searchPromises)

    for (const result of results) {
      if (result.success) {
        statesSucceeded.push(result.stateCode)
        allResults.push(...result.results)
      } else {
        statesFailed.push(result.stateCode)
        if (result.error) {
          warnings.push(`${result.stateCode.toUpperCase()}: ${result.error}`)
        }
      }
    }
  } else {
    // Sequential search
    for (const state of searchableStates) {
      const result = await searchStateForPerson(state, personName, { ...options, limit }, scraperFunctions)

      if (result.success) {
        statesSucceeded.push(result.stateCode)
        allResults.push(...result.results)
      } else {
        statesFailed.push(result.stateCode)
        if (result.error) {
          warnings.push(`${result.stateCode.toUpperCase()}: ${result.error}`)
        }
      }
    }
  }

  // TODO: Add SEC EDGAR search when available
  // if (includeSecEdgar) {
  //   const secResults = await searchSecEdgarInsiders(personName)
  //   ...
  // }

  // Deduplicate and sort results
  const dedupedResults = deduplicateResults(allResults)
  const sortedResults = sortByOwnership(dedupedResults)

  // Cache results
  await cache.set("person_search", cacheKey, sortedResults, sortedResults.length, { limit })

  return {
    success: statesSucceeded.length > 0 || searchableStates.length === 0,
    personSearched: personName,
    totalFound: sortedResults.length,
    businesses: sortedResults,
    statesSearched: searchableStates,
    statesSucceeded,
    statesFailed,
    searchDuration: Date.now() - startTime,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Quick search (Florida only - most reliable for officer search)
 */
export async function quickPersonSearch(
  personName: string,
  options: { limit?: number } = {}
): Promise<PersonSearchResult> {
  return searchBusinessesByPerson(personName, {
    states: ["fl"],
    includeSecEdgar: false,
    fetchDetailPages: false,
    limit: options.limit || 25,
    parallel: false,
  })
}

/**
 * Get ownership summary for a person
 */
export function getOwnershipSummary(results: PersonBusinessResult[]): {
  confirmed: number
  highLikelihood: number
  mediumLikelihood: number
  lowLikelihood: number
  total: number
  uniqueStates: string[]
} {
  const counts = {
    confirmed: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  const states = new Set<string>()

  for (const result of results) {
    counts[result.ownershipLikelihood]++
    states.add(result.state)
  }

  return {
    confirmed: counts.confirmed,
    highLikelihood: counts.high,
    mediumLikelihood: counts.medium,
    lowLikelihood: counts.low,
    total: results.length,
    uniqueStates: Array.from(states),
  }
}
