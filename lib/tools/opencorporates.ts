/**
 * OpenCorporates Tool
 * Provides company search, officer lookup, and corporate registry data
 * from 140+ jurisdictions worldwide.
 *
 * API Reference: https://api.opencorporates.com/documentation/API-Reference
 */

import { tool } from "ai"
import { z } from "zod"
import {
  isOpenCorporatesEnabled,
  getOpenCorporatesApiKey,
  OPENCORPORATES_API_BASE,
  OPENCORPORATES_DEFAULTS,
  US_JURISDICTION_CODES,
} from "../opencorporates/config"

// ============================================================================
// SCHEMAS
// ============================================================================

const companySearchSchema = z.object({
  query: z
    .string()
    .describe("Company name to search for (e.g., 'Apple Inc', 'Microsoft Corporation')"),
  jurisdiction: z
    .string()
    .optional()
    .describe("Jurisdiction code to filter by (e.g., 'us_de' for Delaware, 'us_ca' for California, 'gb' for UK). Leave empty to search all jurisdictions."),
})

const officerSearchSchema = z.object({
  query: z
    .string()
    .describe("Officer/director name to search for (e.g., 'John Smith', 'Tim Cook')"),
  jurisdiction: z
    .string()
    .optional()
    .describe("Jurisdiction code to filter by (e.g., 'us_de', 'us_ca'). Leave empty to search all."),
})

const companyDetailsSchema = z.object({
  jurisdictionCode: z
    .string()
    .describe("Jurisdiction code (e.g., 'us_de' for Delaware)"),
  companyNumber: z
    .string()
    .describe("Company registration number in that jurisdiction"),
})

// ============================================================================
// TYPES
// ============================================================================

interface OpenCorporatesCompany {
  name: string
  companyNumber: string
  jurisdictionCode: string
  incorporationDate?: string
  companyType?: string
  registryUrl?: string
  currentStatus?: string
  registeredAddress?: string
  officers?: Array<{
    name: string
    position: string
    startDate?: string
    endDate?: string
  }>
}

export interface CompanySearchResult {
  companies: OpenCorporatesCompany[]
  totalCount: number
  query: string
  jurisdiction?: string
  error?: string
}

export interface OfficerSearchResult {
  officers: Array<{
    name: string
    position?: string
    companyName: string
    companyNumber: string
    jurisdictionCode: string
    startDate?: string
    endDate?: string
  }>
  totalCount: number
  query: string
  error?: string
}

export interface CompanyDetailsResult {
  company?: OpenCorporatesCompany
  error?: string
}

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

const OPENCORPORATES_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchOpenCorporates(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const apiKey = getOpenCorporatesApiKey()
  const url = new URL(`${OPENCORPORATES_API_BASE}${endpoint}`)

  // Add API key
  url.searchParams.set("api_token", apiKey)

  // Add other params
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenCorporates API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search for companies by name
 */
export const openCorporatesCompanySearchTool = tool({
  description:
    "Search for companies by name in corporate registries across 140+ jurisdictions. " +
    "Returns company name, registration number, jurisdiction, incorporation date, and status. " +
    "Use for business ownership research and corporate due diligence. " +
    "Common US jurisdiction codes: us_de (Delaware), us_ca (California), us_ny (New York), us_tx (Texas), us_fl (Florida).",
  parameters: companySearchSchema,
  execute: async ({ query, jurisdiction }): Promise<CompanySearchResult> => {
    console.log("[OpenCorporates] Searching companies:", query, "jurisdiction:", jurisdiction)
    const startTime = Date.now()

    if (!isOpenCorporatesEnabled()) {
      return {
        companies: [],
        totalCount: 0,
        query,
        jurisdiction,
        error: "OpenCorporates API key not configured. Add OPENCORPORATES_API_KEY to environment variables.",
      }
    }

    try {
      const params: Record<string, string> = {
        q: query,
        per_page: String(OPENCORPORATES_DEFAULTS.perPage),
      }

      if (jurisdiction) {
        params.jurisdiction_code = jurisdiction
      }

      const data = await withTimeout(
        fetchOpenCorporates("/companies/search", params),
        OPENCORPORATES_TIMEOUT_MS,
        `OpenCorporates search timed out after ${OPENCORPORATES_TIMEOUT_MS / 1000} seconds`
      ) as {
        results?: {
          companies?: Array<{
            company: {
              name: string
              company_number: string
              jurisdiction_code: string
              incorporation_date?: string
              company_type?: string
              registry_url?: string
              current_status?: string
              registered_address_in_full?: string
            }
          }>
          total_count?: number
        }
      }

      const duration = Date.now() - startTime
      const companies = data.results?.companies || []
      console.log("[OpenCorporates] Search completed in", duration, "ms, found", companies.length, "companies")

      return {
        companies: companies.slice(0, 15).map((item) => ({
          name: item.company.name,
          companyNumber: item.company.company_number,
          jurisdictionCode: item.company.jurisdiction_code,
          incorporationDate: item.company.incorporation_date,
          companyType: item.company.company_type,
          registryUrl: item.company.registry_url,
          currentStatus: item.company.current_status,
          registeredAddress: item.company.registered_address_in_full,
        })),
        totalCount: data.results?.total_count || 0,
        query,
        jurisdiction,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[OpenCorporates] Company search failed:", errorMessage)
      return {
        companies: [],
        totalCount: 0,
        query,
        jurisdiction,
        error: `Failed to search companies: ${errorMessage}`,
      }
    }
  },
})

/**
 * Search for company officers/directors by name
 */
export const openCorporatesOfficerSearchTool = tool({
  description:
    "Search for company officers and directors by name across corporate registries. " +
    "Returns officer positions, company associations, and appointment dates. " +
    "Essential for prospect research - find board memberships and corporate roles. " +
    "Use to identify a person's business affiliations and directorships.",
  parameters: officerSearchSchema,
  execute: async ({ query, jurisdiction }): Promise<OfficerSearchResult> => {
    console.log("[OpenCorporates] Searching officers:", query, "jurisdiction:", jurisdiction)
    const startTime = Date.now()

    if (!isOpenCorporatesEnabled()) {
      return {
        officers: [],
        totalCount: 0,
        query,
        error: "OpenCorporates API key not configured. Add OPENCORPORATES_API_KEY to environment variables.",
      }
    }

    try {
      const params: Record<string, string> = {
        q: query,
        per_page: String(OPENCORPORATES_DEFAULTS.perPage),
      }

      if (jurisdiction) {
        params.jurisdiction_code = jurisdiction
      }

      const data = await withTimeout(
        fetchOpenCorporates("/officers/search", params),
        OPENCORPORATES_TIMEOUT_MS,
        `OpenCorporates officer search timed out after ${OPENCORPORATES_TIMEOUT_MS / 1000} seconds`
      ) as {
        results?: {
          officers?: Array<{
            officer: {
              name: string
              position?: string
              start_date?: string
              end_date?: string
              company?: {
                name: string
                company_number: string
                jurisdiction_code: string
              }
            }
          }>
          total_count?: number
        }
      }

      const duration = Date.now() - startTime
      const officers = data.results?.officers || []
      console.log("[OpenCorporates] Officer search completed in", duration, "ms, found", officers.length, "officers")

      return {
        officers: officers.slice(0, 20).map((item) => ({
          name: item.officer.name,
          position: item.officer.position,
          companyName: item.officer.company?.name || "Unknown",
          companyNumber: item.officer.company?.company_number || "",
          jurisdictionCode: item.officer.company?.jurisdiction_code || "",
          startDate: item.officer.start_date,
          endDate: item.officer.end_date,
        })),
        totalCount: data.results?.total_count || 0,
        query,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[OpenCorporates] Officer search failed:", errorMessage)
      return {
        officers: [],
        totalCount: 0,
        query,
        error: `Failed to search officers: ${errorMessage}`,
      }
    }
  },
})

/**
 * Get detailed company information
 */
export const openCorporatesCompanyDetailsTool = tool({
  description:
    "Get detailed company information including officers, filings, and registered address. " +
    "Use after finding a company via search to get full details. " +
    "Requires jurisdiction code and company number from search results.",
  parameters: companyDetailsSchema,
  execute: async ({ jurisdictionCode, companyNumber }): Promise<CompanyDetailsResult> => {
    console.log("[OpenCorporates] Getting company details:", jurisdictionCode, companyNumber)
    const startTime = Date.now()

    if (!isOpenCorporatesEnabled()) {
      return {
        error: "OpenCorporates API key not configured. Add OPENCORPORATES_API_KEY to environment variables.",
      }
    }

    try {
      const data = await withTimeout(
        fetchOpenCorporates(`/companies/${jurisdictionCode}/${companyNumber}`),
        OPENCORPORATES_TIMEOUT_MS,
        `OpenCorporates company details timed out after ${OPENCORPORATES_TIMEOUT_MS / 1000} seconds`
      ) as {
        results?: {
          company?: {
            name: string
            company_number: string
            jurisdiction_code: string
            incorporation_date?: string
            company_type?: string
            registry_url?: string
            current_status?: string
            registered_address_in_full?: string
            officers?: Array<{
              officer: {
                name: string
                position: string
                start_date?: string
                end_date?: string
              }
            }>
          }
        }
      }

      const duration = Date.now() - startTime
      const company = data.results?.company
      console.log("[OpenCorporates] Company details retrieved in", duration, "ms")

      if (!company) {
        return { error: "Company not found" }
      }

      return {
        company: {
          name: company.name,
          companyNumber: company.company_number,
          jurisdictionCode: company.jurisdiction_code,
          incorporationDate: company.incorporation_date,
          companyType: company.company_type,
          registryUrl: company.registry_url,
          currentStatus: company.current_status,
          registeredAddress: company.registered_address_in_full,
          officers: company.officers?.map((item) => ({
            name: item.officer.name,
            position: item.officer.position,
            startDate: item.officer.start_date,
            endDate: item.officer.end_date,
          })),
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[OpenCorporates] Company details failed:", errorMessage)
      return {
        error: `Failed to get company details: ${errorMessage}`,
      }
    }
  },
})

/**
 * Check if OpenCorporates tools should be enabled
 * Returns true if OPENCORPORATES_API_KEY is configured
 */
export function shouldEnableOpenCorporatesTools(): boolean {
  return isOpenCorporatesEnabled()
}

/**
 * Export US jurisdiction codes for convenience
 */
export { US_JURISDICTION_CODES }
