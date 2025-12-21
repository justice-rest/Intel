/**
 * Government Salary Search Tool
 *
 * Searches public employee salary/payroll databases via Socrata.
 * Public employee salaries are public record - reveals income for government workers.
 *
 * Coverage:
 * - NYC: data.cityofnewyork.us - Citywide Payroll (300K+ employees)
 * - Vermont: data.vermont.gov - State Employee Salaries
 * - New Jersey: data.nj.gov - Agency Payroll
 * - Oregon: data.oregon.gov - State Agency Salaries
 * - LA City: controllerdata.lacity.org - City Employee Payroll
 * - Baton Rouge: data.brla.gov - City-Parish Salaries
 *
 * Use Cases:
 * - Verify income for public employees
 * - Wealth indicator for government workers
 * - Confirm employment at government agencies
 *
 * Data Sources: All FREE, no API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface GovernmentEmployee {
  name: string
  agency: string
  title: string
  salary: number
  totalCompensation?: number
  year: string
  location: string
  source: string
}

export interface GovernmentSalaryResult {
  personName: string
  employees: GovernmentEmployee[]
  summary: {
    totalFound: number
    highestSalary: number
    averageSalary: number
    agencies: string[]
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SALARY ENDPOINTS
// ============================================================================

interface SalaryEndpoint {
  name: string
  location: string
  portal: string
  datasetId: string
  fields: {
    name?: string
    firstName?: string
    lastName?: string
    agency: string
    title: string
    salary: string
    totalComp?: string
    year?: string
  }
}

const SALARY_ENDPOINTS: SalaryEndpoint[] = [
  // NYC Citywide Payroll (300K+ employees)
  {
    name: "NYC Citywide Payroll",
    location: "New York City",
    portal: "https://data.cityofnewyork.us/resource",
    datasetId: "k397-673e",
    fields: {
      firstName: "first_name",
      lastName: "last_name",
      agency: "agency_name",
      title: "title_description",
      salary: "base_salary",
      totalComp: "total_other_pay",
      year: "fiscal_year",
    },
  },
  // Vermont State Employees
  {
    name: "Vermont State Employees",
    location: "Vermont",
    portal: "https://data.vermont.gov/resource",
    datasetId: "jgqy-2smf",
    fields: {
      name: "employee_name",
      agency: "department",
      title: "job_title",
      salary: "annual_salary",
    },
  },
  // New Jersey Agency Payroll
  {
    name: "New Jersey Agency Payroll",
    location: "New Jersey",
    portal: "https://data.nj.gov/resource",
    datasetId: "iqwc-r2w7",
    fields: {
      name: "name",
      agency: "department_agency",
      title: "title",
      salary: "salary",
      year: "calendar_year",
    },
  },
  // Oregon State Agency Salaries
  {
    name: "Oregon State Salaries",
    location: "Oregon",
    portal: "https://data.oregon.gov/resource",
    datasetId: "4cmg-5yp4",
    fields: {
      name: "employee_name",
      agency: "agency",
      title: "classification",
      salary: "annual_salary",
      year: "fiscal_year",
    },
  },
  // LA City Employee Payroll
  {
    name: "LA City Payroll",
    location: "Los Angeles",
    portal: "https://controllerdata.lacity.org/resource",
    datasetId: "pazn-qyym",
    fields: {
      name: "employee_name",
      agency: "department_title",
      title: "job_class_title",
      salary: "total_payments",
      year: "year",
    },
  },
  // Baton Rouge City-Parish
  {
    name: "Baton Rouge City-Parish",
    location: "Baton Rouge",
    portal: "https://data.brla.gov/resource",
    datasetId: "g9vh-zeiw",
    fields: {
      name: "employee_name",
      agency: "department",
      title: "job_title",
      salary: "annual_salary",
    },
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

async function querySalaryEndpoint(
  endpoint: SalaryEndpoint,
  personName: string
): Promise<GovernmentEmployee[]> {
  const employees: GovernmentEmployee[] = []

  try {
    // Parse name
    const nameParts = personName.trim().split(/\s+/)
    const lastName = nameParts[nameParts.length - 1]

    // Build SoQL query
    let whereClause: string
    if (endpoint.fields.firstName && endpoint.fields.lastName) {
      whereClause = `upper(${endpoint.fields.lastName}) like '%${lastName.toUpperCase()}%'`
    } else if (endpoint.fields.name) {
      whereClause = `upper(${endpoint.fields.name}) like '%${lastName.toUpperCase()}%'`
    } else {
      return []
    }

    const url = `${endpoint.portal}/${endpoint.datasetId}.json?$where=${encodeURIComponent(whereClause)}&$limit=50&$order=${endpoint.fields.salary} DESC`

    console.log(`[GovernmentSalary] Querying ${endpoint.name}: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[GovernmentSalary] ${endpoint.name} API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      return []
    }

    // Filter by first name if provided
    const firstName = nameParts[0]?.toUpperCase() || ""

    for (const record of data) {
      // Get full name
      let fullName: string
      if (endpoint.fields.firstName && endpoint.fields.lastName) {
        fullName = `${record[endpoint.fields.firstName] || ""} ${record[endpoint.fields.lastName] || ""}`.trim()
      } else if (endpoint.fields.name) {
        fullName = String(record[endpoint.fields.name] || "")
      } else {
        continue // Skip if no name field available
      }

      // Filter by first name
      if (firstName && !fullName.toUpperCase().includes(firstName)) {
        continue
      }

      const salary = parseFloat(String(record[endpoint.fields.salary] || "0").replace(/[^0-9.-]/g, "")) || 0
      if (salary <= 0) continue

      const employee: GovernmentEmployee = {
        name: fullName,
        agency: String(record[endpoint.fields.agency] || "Unknown"),
        title: String(record[endpoint.fields.title] || "Unknown"),
        salary,
        year: endpoint.fields.year ? String(record[endpoint.fields.year] || new Date().getFullYear()) : String(new Date().getFullYear()),
        location: endpoint.location,
        source: endpoint.name,
      }

      if (endpoint.fields.totalComp && record[endpoint.fields.totalComp]) {
        const totalComp = parseFloat(String(record[endpoint.fields.totalComp]).replace(/[^0-9.-]/g, "")) || 0
        if (totalComp > 0) {
          employee.totalCompensation = salary + totalComp
        }
      }

      employees.push(employee)
    }

    console.log(`[GovernmentSalary] Found ${employees.length} employees in ${endpoint.name}`)
  } catch (error) {
    console.error(`[GovernmentSalary] Error querying ${endpoint.name}:`, error)
  }

  return employees
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchGovernmentSalaries(
  personName: string,
  locations: string[] = ["NYC", "VT", "NJ", "OR", "LA", "BR"]
): Promise<GovernmentSalaryResult> {
  console.log(`[GovernmentSalary] Searching for "${personName}"`)

  const allEmployees: GovernmentEmployee[] = []
  const sources: Array<{ name: string; url: string }> = []

  // Map location codes to endpoints
  const locationMap: Record<string, string[]> = {
    NYC: ["New York City"],
    VT: ["Vermont"],
    NJ: ["New Jersey"],
    OR: ["Oregon"],
    LA: ["Los Angeles"],
    BR: ["Baton Rouge"],
  }

  const targetLocations = locations.flatMap((loc) => locationMap[loc.toUpperCase()] || [loc])

  // Find matching endpoints
  const endpoints = SALARY_ENDPOINTS.filter((e) =>
    targetLocations.some((loc) => e.location.toLowerCase().includes(loc.toLowerCase()))
  )

  // Query each endpoint in parallel
  const endpointPromises = endpoints.map(async (endpoint) => {
    sources.push({
      name: endpoint.name,
      url: endpoint.portal.replace("/resource", ""),
    })
    return querySalaryEndpoint(endpoint, personName)
  })

  const results = await Promise.all(endpointPromises)
  for (const employees of results) {
    allEmployees.push(...employees)
  }

  // Sort by salary descending
  allEmployees.sort((a, b) => b.salary - a.salary)

  // Calculate summary
  const totalSalary = allEmployees.reduce((sum, e) => sum + e.salary, 0)
  const agencies = [...new Set(allEmployees.map((e) => e.agency))]

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# Government Salary Search: ${personName}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Employees Found:** ${allEmployees.length}`)
  if (allEmployees.length > 0) {
    rawLines.push(`- **Highest Salary:** ${formatCurrency(allEmployees[0].salary)}`)
    rawLines.push(`- **Average Salary:** ${formatCurrency(totalSalary / allEmployees.length)}`)
    rawLines.push(`- **Agencies:** ${agencies.slice(0, 5).join(", ")}`)
  }
  rawLines.push("")

  if (allEmployees.length > 0) {
    rawLines.push(`## Employees Found`)
    rawLines.push("")

    for (const employee of allEmployees.slice(0, 20)) {
      rawLines.push(`### ${employee.name}`)
      rawLines.push(`- **Agency:** ${employee.agency}`)
      rawLines.push(`- **Title:** ${employee.title}`)
      rawLines.push(`- **Salary:** ${formatCurrency(employee.salary)}`)
      if (employee.totalCompensation) {
        rawLines.push(`- **Total Compensation:** ${formatCurrency(employee.totalCompensation)}`)
      }
      rawLines.push(`- **Year:** ${employee.year}`)
      rawLines.push(`- **Location:** ${employee.location}`)
      rawLines.push("")
    }

    if (allEmployees.length > 20) {
      rawLines.push(`*... and ${allEmployees.length - 20} more employees*`)
    }
  } else {
    rawLines.push(`## Results`)
    rawLines.push(`No government employees found matching "${personName}".`)
    rawLines.push("")
    rawLines.push(`**Note:** This searches public payroll databases. Coverage includes NYC, Vermont, NJ, Oregon, LA, and Baton Rouge.`)
  }

  return {
    personName,
    employees: allEmployees,
    summary: {
      totalFound: allEmployees.length,
      highestSalary: allEmployees.length > 0 ? allEmployees[0].salary : 0,
      averageSalary: allEmployees.length > 0 ? totalSalary / allEmployees.length : 0,
      agencies,
    },
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const governmentSalarySchema = z.object({
  personName: z.string().describe("Full name of the person to search for"),
  locations: z
    .array(z.string())
    .optional()
    .default(["NYC", "VT", "NJ", "OR", "LA", "BR"])
    .describe("Location codes: NYC, VT (Vermont), NJ, OR (Oregon), LA, BR (Baton Rouge)"),
})

export const governmentSalaryTool = tool({
  description:
    "Search public government employee salary databases. " +
    "Public employee salaries are PUBLIC RECORD. " +
    "Covers: NYC (300K employees), Vermont, New Jersey, Oregon, LA City, Baton Rouge. " +
    "Returns: name, agency, title, salary, total compensation. " +
    "WEALTH INDICATOR: Confirms income for government workers. " +
    "Use to verify employment claims or estimate income for public sector workers.",

  parameters: governmentSalarySchema,

  execute: async ({ personName, locations }): Promise<GovernmentSalaryResult> => {
    return searchGovernmentSalaries(personName, locations)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableGovernmentSalaryTool(): boolean {
  return true
}

export { searchGovernmentSalaries }
