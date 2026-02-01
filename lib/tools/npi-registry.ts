/**
 * NPI Registry Search Tool
 *
 * Searches the CMS National Provider Identifier (NPI) Registry.
 * Every healthcare provider in the US has an NPI - this is the authoritative source.
 *
 * Data Source: CMS NPPES NPI Registry API
 * URL: https://npiregistry.cms.hhs.gov/api/
 *
 * Use Cases:
 * - Verify healthcare provider credentials
 * - Find practice locations and specialties
 * - Wealth indicator (physicians have high income)
 *
 * FREE - No API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface HealthcareProvider {
  npi: string
  name: string
  credential: string
  specialty: string
  taxonomyCode: string
  address: string
  city: string
  state: string
  postalCode: string
  phone: string
  providerType: "individual" | "organization"
  gender?: string
  enumerationDate?: string
  lastUpdated?: string
  estimatedIncome?: string
}

export interface NPIRegistryResult {
  searchTerm: string
  providers: HealthcareProvider[]
  summary: {
    totalFound: number
    specialties: string[]
    states: string[]
    wealthIndicator: "high" | "medium" | "low" | "unknown"
    incomeEstimate?: string
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// INCOME ESTIMATES BY SPECIALTY
// ============================================================================

const SPECIALTY_INCOME: Record<string, { min: number; max: number; description: string }> = {
  "ORTHOPEDIC": { min: 500000, max: 900000, description: "Orthopedic Surgery" },
  "CARDIO": { min: 400000, max: 700000, description: "Cardiology" },
  "GASTROENTER": { min: 400000, max: 600000, description: "Gastroenterology" },
  "UROLOGY": { min: 400000, max: 600000, description: "Urology" },
  "DERMATOLOG": { min: 350000, max: 600000, description: "Dermatology" },
  "RADIOL": { min: 350000, max: 550000, description: "Radiology" },
  "ANESTHESI": { min: 350000, max: 500000, description: "Anesthesiology" },
  "PLASTIC": { min: 350000, max: 600000, description: "Plastic Surgery" },
  "OPHTHALMOL": { min: 300000, max: 500000, description: "Ophthalmology" },
  "SURGERY": { min: 350000, max: 600000, description: "Surgery" },
  "ONCOLOG": { min: 350000, max: 500000, description: "Oncology" },
  "EMERGENCY": { min: 300000, max: 400000, description: "Emergency Medicine" },
  "PULMONOL": { min: 300000, max: 450000, description: "Pulmonology" },
  "NEPHROL": { min: 300000, max: 400000, description: "Nephrology" },
  "NEUROL": { min: 280000, max: 450000, description: "Neurology" },
  "OBSTETRIC": { min: 280000, max: 400000, description: "OB/GYN" },
  "GYNECOL": { min: 280000, max: 400000, description: "OB/GYN" },
  "INTERNAL MEDICINE": { min: 200000, max: 350000, description: "Internal Medicine" },
  "FAMILY": { min: 180000, max: 280000, description: "Family Medicine" },
  "PEDIATRIC": { min: 180000, max: 300000, description: "Pediatrics" },
  "PSYCHIATR": { min: 220000, max: 350000, description: "Psychiatry" },
  "DENTIST": { min: 150000, max: 300000, description: "Dentistry" },
  "NURSE PRACTITIONER": { min: 100000, max: 150000, description: "Nurse Practitioner" },
  "PHYSICIAN ASSISTANT": { min: 100000, max: 140000, description: "Physician Assistant" },
  "PHARMACIST": { min: 120000, max: 150000, description: "Pharmacist" },
  "PHYSICAL THERAP": { min: 80000, max: 120000, description: "Physical Therapy" },
}

function estimateIncome(specialty: string): { min: number; max: number } | null {
  const specUpper = specialty.toUpperCase()

  for (const [key, value] of Object.entries(SPECIALTY_INCOME)) {
    if (specUpper.includes(key)) {
      return { min: value.min, max: value.max }
    }
  }

  return null
}

function formatCurrency(amount: number): string {
  return `$${(amount / 1000).toFixed(0)}K`
}

function getWealthIndicator(income: { min: number; max: number } | null): "high" | "medium" | "low" | "unknown" {
  if (!income) return "unknown"
  const avg = (income.min + income.max) / 2
  if (avg >= 300000) return "high"
  if (avg >= 150000) return "medium"
  return "low"
}

// ============================================================================
// NPI API SEARCH
// ============================================================================

async function searchNPIRegistry(
  searchTerm: string,
  state?: string,
  specialty?: string
): Promise<NPIRegistryResult> {
  console.log(`[NPIRegistry] Searching for "${searchTerm}"${state ? ` in ${state}` : ""}`)

  const providers: HealthcareProvider[] = []
  const sources: Array<{ name: string; url: string }> = [
    {
      name: "CMS NPI Registry",
      url: "https://npiregistry.cms.hhs.gov/",
    },
  ]

  try {
    // Parse name
    const nameParts = searchTerm.trim().split(/\s+/)
    const firstName = nameParts[0] || ""
    const lastName = nameParts[nameParts.length - 1] || ""

    // Build API URL
    const params = new URLSearchParams({
      version: "2.1",
      first_name: firstName,
      last_name: lastName,
      limit: "50",
    })

    if (state) {
      params.set("state", state.toUpperCase())
    }

    if (specialty) {
      params.set("taxonomy_description", specialty)
    }

    const url = `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`

    console.log(`[NPIRegistry] Query URL: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[NPIRegistry] API error: ${response.status}`)
      return {
        searchTerm,
        providers: [],
        summary: {
          totalFound: 0,
          specialties: [],
          states: [],
          wealthIndicator: "unknown",
        },
        rawContent: `# NPI Registry Search\n\nAPI error: ${response.status}`,
        sources,
        error: `API error: ${response.status}`,
      }
    }

    const data = await response.json()

    if (data.result_count === 0 || !data.results) {
      console.log(`[NPIRegistry] No results found`)
    } else {
      for (const result of data.results) {
        const basic = result.basic || {}
        const addresses = result.addresses || []
        const taxonomies = result.taxonomies || []

        // Get primary address
        const primaryAddress = addresses.find((a: Record<string, string>) => a.address_purpose === "LOCATION") || addresses[0] || {}

        // Get primary specialty
        const primaryTaxonomy = taxonomies.find((t: Record<string, boolean>) => t.primary === true) || taxonomies[0] || {}

        // Build name
        let name: string
        if (basic.first_name) {
          name = `${basic.first_name} ${basic.middle_name || ""} ${basic.last_name}`.replace(/\s+/g, " ").trim()
        } else {
          name = basic.organization_name || basic.name || "Unknown"
        }

        const specialtyDesc = primaryTaxonomy.desc || ""
        const income = estimateIncome(specialtyDesc)

        const provider: HealthcareProvider = {
          npi: String(result.number),
          name,
          credential: basic.credential || "",
          specialty: specialtyDesc,
          taxonomyCode: primaryTaxonomy.code || "",
          address: primaryAddress.address_1 || "",
          city: primaryAddress.city || "",
          state: primaryAddress.state || "",
          postalCode: primaryAddress.postal_code || "",
          phone: primaryAddress.telephone_number || "",
          providerType: result.enumeration_type === "NPI-1" ? "individual" : "organization",
          gender: basic.gender || undefined,
          enumerationDate: basic.enumeration_date || undefined,
          lastUpdated: basic.last_updated || undefined,
        }

        if (income) {
          provider.estimatedIncome = `${formatCurrency(income.min)} - ${formatCurrency(income.max)}`
        }

        providers.push(provider)
      }
    }

    console.log(`[NPIRegistry] Found ${providers.length} providers`)
  } catch (error) {
    console.error(`[NPIRegistry] Error:`, error)
  }

  // Calculate summary
  const specialties = [...new Set(providers.map((p) => p.specialty).filter(Boolean))]
  const states = [...new Set(providers.map((p) => p.state).filter(Boolean))]

  // Get highest income specialty for wealth indicator
  let highestIncome: { min: number; max: number } | null = null
  for (const provider of providers) {
    const income = estimateIncome(provider.specialty)
    if (income && (!highestIncome || income.max > highestIncome.max)) {
      highestIncome = income
    }
  }

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# NPI Registry Search: ${searchTerm}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Providers Found:** ${providers.length}`)

  if (providers.length > 0) {
    rawLines.push(`- **Specialties:** ${specialties.slice(0, 5).join(", ")}`)
    rawLines.push(`- **States:** ${states.join(", ")}`)
    if (highestIncome) {
      rawLines.push(`- **Wealth Indicator:** ${getWealthIndicator(highestIncome).toUpperCase()}`)
      rawLines.push(`- **Estimated Income:** ${formatCurrency(highestIncome.min)} - ${formatCurrency(highestIncome.max)}`)
    }
    rawLines.push("")
    rawLines.push(`## Providers Found`)
    rawLines.push("")

    for (const provider of providers.slice(0, 20)) {
      rawLines.push(`### ${provider.name}${provider.credential ? `, ${provider.credential}` : ""}`)
      rawLines.push(`- **NPI:** ${provider.npi}`)
      rawLines.push(`- **Specialty:** ${provider.specialty}`)
      rawLines.push(`- **Location:** ${provider.city}, ${provider.state} ${provider.postalCode}`)
      if (provider.phone) {
        rawLines.push(`- **Phone:** ${provider.phone}`)
      }
      if (provider.estimatedIncome) {
        rawLines.push(`- **Est. Income:** ${provider.estimatedIncome}`)
      }
      if (provider.enumerationDate) {
        rawLines.push(`- **Licensed Since:** ${provider.enumerationDate}`)
      }
      rawLines.push("")
    }

    if (providers.length > 20) {
      rawLines.push(`*... and ${providers.length - 20} more providers*`)
    }
  } else {
    rawLines.push("")
    rawLines.push(`## Results`)
    rawLines.push(`No healthcare providers found matching "${searchTerm}".`)
    rawLines.push("")
    rawLines.push(`**Note:** This searches the CMS NPI Registry - the authoritative source for US healthcare provider credentials.`)
  }

  return {
    searchTerm,
    providers,
    summary: {
      totalFound: providers.length,
      specialties,
      states,
      wealthIndicator: getWealthIndicator(highestIncome),
      incomeEstimate: highestIncome ? `${formatCurrency(highestIncome.min)} - ${formatCurrency(highestIncome.max)}` : undefined,
    },
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const npiRegistrySchema = z.object({
  searchTerm: z.string().describe("Full name of the healthcare provider to search for"),
  state: z
    .string()
    .optional()
    .describe("Two-letter state code to filter by (e.g., 'CA', 'NY')"),
  specialty: z
    .string()
    .optional()
    .describe("Specialty to filter by (e.g., 'Cardiology', 'Surgery')"),
})

export const npiRegistryTool = (tool as any)({
  description:
    "Search the CMS NPI Registry for healthcare provider credentials. " +
    "The AUTHORITATIVE source for US healthcare providers. " +
    "Returns: NPI number, specialty, practice location, credentials. " +
    "WEALTH INDICATOR: Physicians have high income. " +
    "Orthopedic surgeons: $500K-$900K, Cardiologists: $400K-$700K, " +
    "Family Medicine: $180K-$280K. " +
    "Use to verify medical credentials and estimate income.",

  parameters: npiRegistrySchema,

  execute: async ({ searchTerm, state, specialty }: { searchTerm: string; state?: string; specialty?: string }): Promise<NPIRegistryResult> => {
    return searchNPIRegistry(searchTerm, state, specialty)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableNPIRegistryTool(): boolean {
  return true
}

export { searchNPIRegistry }
