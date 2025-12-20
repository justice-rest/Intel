/**
 * FollowTheMoney.org API Client
 *
 * State-level campaign finance data for ALL 50 states.
 * This is the ONLY comprehensive source for state campaign finance.
 *
 * API Documentation: https://www.followthemoney.org/our-data/apis
 *
 * To get an API key:
 * 1. Create a free account at https://www.followthemoney.org/login
 * 2. Log in and visit the API section
 * 3. Your API key will be displayed
 *
 * Coverage: State campaign contributions since 2000
 * Updates: Regularly updated with state filings
 *
 * Note: FollowTheMoney.org has merged with OpenSecrets.
 * Federal data is at OpenSecrets.org, state data remains here.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const FTM_API_BASE = "https://api.followthemoney.org"
const FTM_TIMEOUT_MS = 30000

export function getFollowTheMoneyApiKey(): string | undefined {
  return process.env.FOLLOWTHEMONEY_API_KEY
}

export function isFollowTheMoneyEnabled(): boolean {
  return !!getFollowTheMoneyApiKey()
}

// ============================================================================
// TYPES
// ============================================================================

export interface FTMContribution {
  recordId: string
  amount: number
  date: string
  contributorName: string
  contributorType: string
  contributorOccupation?: string
  contributorEmployer?: string
  contributorCity?: string
  contributorState?: string
  contributorZip?: string
  recipientName: string
  recipientType: string
  recipientParty?: string
  recipientOffice?: string
  state: string
  electionYear: number
}

export interface FTMEntity {
  entityId: string
  name: string
  type: string
  state?: string
  party?: string
  office?: string
  status?: string
  totalContributions?: number
  totalExpenses?: number
}

export interface FTMSearchResult {
  query: string
  records: FTMContribution[]
  entities: FTMEntity[]
  summary: {
    totalRecords: number
    totalAmount: number
    statesCovered: string[]
    yearRange: { min: number; max: number }
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

export interface FTMApiResponse {
  records?: {
    record?: FTMApiRecord | FTMApiRecord[]
  }
  error?: string
}

export interface FTMApiRecord {
  Contributor?: string
  Contributor_Name?: string
  Contributor_Type?: string
  Occupation?: string
  Employer?: string
  Contributor_City?: string
  Contributor_State?: string
  Contributor_Zip?: string
  Recipient?: string
  Recipient_Name?: string
  Recipient_Type?: string
  Recipient_Party?: string
  Recipient_Office?: string
  Amount?: string
  Date?: string
  State?: string
  Election_Year?: string
  Record_ID?: string
}

// ============================================================================
// API CLIENT
// ============================================================================

async function callFTMApi(
  endpoint: string,
  params: Record<string, string>
): Promise<FTMApiResponse> {
  const apiKey = getFollowTheMoneyApiKey()

  if (!apiKey) {
    throw new Error(
      "FollowTheMoney API key not configured. " +
        "Set FOLLOWTHEMONEY_API_KEY environment variable. " +
        "Get a free API key at https://www.followthemoney.org/login"
    )
  }

  const url = new URL(endpoint, FTM_API_BASE)
  url.searchParams.set("APIKey", apiKey)
  url.searchParams.set("mode", "json")

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value)
    }
  }

  console.log(`[FollowTheMoney] API call: ${url.toString().replace(apiKey, "***")}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FTM_TIMEOUT_MS)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`FollowTheMoney API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`FollowTheMoney API error: ${data.error}`)
    }

    return data as FTMApiResponse
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

function parseAmount(value: string | undefined): number {
  if (!value) return 0
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""))
  return isNaN(num) ? 0 : num
}

function transformRecord(record: FTMApiRecord): FTMContribution {
  return {
    recordId: record.Record_ID || "",
    amount: parseAmount(record.Amount),
    date: record.Date || "",
    contributorName: record.Contributor || record.Contributor_Name || "",
    contributorType: record.Contributor_Type || "",
    contributorOccupation: record.Occupation,
    contributorEmployer: record.Employer,
    contributorCity: record.Contributor_City,
    contributorState: record.Contributor_State,
    contributorZip: record.Contributor_Zip,
    recipientName: record.Recipient || record.Recipient_Name || "",
    recipientType: record.Recipient_Type || "",
    recipientParty: record.Recipient_Party,
    recipientOffice: record.Recipient_Office,
    state: record.State || "",
    electionYear: parseInt(record.Election_Year || "0", 10),
  }
}

/**
 * Search for campaign contributions by donor name
 */
export async function searchByDonorName(
  name: string,
  options: {
    state?: string
    yearMin?: number
    yearMax?: number
    limit?: number
  } = {}
): Promise<FTMSearchResult> {
  console.log(`[FollowTheMoney] Searching for donor: "${name}"`)

  const params: Record<string, string> = {
    c_t_eid: "", // Contributor entity ID (empty for name search)
    d: name, // Donor name search
    s: options.state || "", // State filter
    y: options.yearMin ? `>=${options.yearMin}` : "",
    y_max: options.yearMax?.toString() || "",
  }

  try {
    const response = await callFTMApi("/", params)

    const records: FTMContribution[] = []

    if (response.records?.record) {
      const recordArray = Array.isArray(response.records.record)
        ? response.records.record
        : [response.records.record]

      for (const rec of recordArray.slice(0, options.limit || 100)) {
        records.push(transformRecord(rec))
      }
    }

    return buildSuccessResult(name, records)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[FollowTheMoney] Error:`, errorMessage)
    return buildErrorResult(name, errorMessage)
  }
}

/**
 * Search for contributions to a specific candidate/committee
 */
export async function searchByRecipient(
  recipient: string,
  options: {
    state?: string
    yearMin?: number
    yearMax?: number
    limit?: number
  } = {}
): Promise<FTMSearchResult> {
  console.log(`[FollowTheMoney] Searching for recipient: "${recipient}"`)

  const params: Record<string, string> = {
    c_t_eid: "", // Contributor entity ID
    r_t_eid: "", // Recipient entity ID (empty for name search)
    c: recipient, // Candidate/recipient name
    s: options.state || "",
    y: options.yearMin ? `>=${options.yearMin}` : "",
  }

  try {
    const response = await callFTMApi("/", params)

    const records: FTMContribution[] = []

    if (response.records?.record) {
      const recordArray = Array.isArray(response.records.record)
        ? response.records.record
        : [response.records.record]

      for (const rec of recordArray.slice(0, options.limit || 100)) {
        records.push(transformRecord(rec))
      }
    }

    return buildSuccessResult(recipient, records)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[FollowTheMoney] Error:`, errorMessage)
    return buildErrorResult(recipient, errorMessage)
  }
}

// ============================================================================
// RESULT BUILDERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function buildErrorResult(query: string, error: string): FTMSearchResult {
  return {
    query,
    records: [],
    entities: [],
    summary: {
      totalRecords: 0,
      totalAmount: 0,
      statesCovered: [],
      yearRange: { min: 0, max: 0 },
    },
    rawContent: `## Error\n\nFailed to search FollowTheMoney: ${error}`,
    sources: [
      {
        name: "FollowTheMoney.org",
        url: "https://www.followthemoney.org/",
      },
    ],
    error,
  }
}

function buildSuccessResult(
  query: string,
  records: FTMContribution[]
): FTMSearchResult {
  // Calculate summary
  let totalAmount = 0
  const states = new Set<string>()
  let minYear = Infinity
  let maxYear = 0

  for (const record of records) {
    totalAmount += record.amount
    if (record.state) states.add(record.state)
    if (record.electionYear > 0) {
      if (record.electionYear < minYear) minYear = record.electionYear
      if (record.electionYear > maxYear) maxYear = record.electionYear
    }
  }

  // Build formatted output
  const lines: string[] = []
  lines.push(`# State Campaign Finance Search`)
  lines.push("")
  lines.push(`**Query:** ${query}`)
  lines.push(`**Source:** FollowTheMoney.org (50-state campaign finance)`)
  lines.push("")

  if (records.length > 0) {
    lines.push(`## Summary`)
    lines.push("")
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Contributions | ${records.length} |`)
    lines.push(`| Total Amount | ${formatCurrency(totalAmount)} |`)
    lines.push(`| States | ${[...states].sort().join(", ") || "N/A"} |`)
    lines.push(`| Years | ${minYear === Infinity ? "N/A" : `${minYear} - ${maxYear}`} |`)
    lines.push("")
    lines.push(`## Top Contributions`)
    lines.push("")

    // Sort by amount descending
    const sortedRecords = [...records].sort((a, b) => b.amount - a.amount)

    for (const record of sortedRecords.slice(0, 10)) {
      lines.push(`### ${formatCurrency(record.amount)} - ${record.date}`)
      lines.push("")
      lines.push(`| Field | Value |`)
      lines.push(`|-------|-------|`)
      lines.push(`| Contributor | ${record.contributorName} |`)
      if (record.contributorOccupation) {
        lines.push(`| Occupation | ${record.contributorOccupation} |`)
      }
      if (record.contributorEmployer) {
        lines.push(`| Employer | ${record.contributorEmployer} |`)
      }
      if (record.contributorCity && record.contributorState) {
        lines.push(`| Location | ${record.contributorCity}, ${record.contributorState} |`)
      }
      lines.push(`| Recipient | ${record.recipientName} |`)
      if (record.recipientOffice) {
        lines.push(`| Office | ${record.recipientOffice} |`)
      }
      if (record.recipientParty) {
        lines.push(`| Party | ${record.recipientParty} |`)
      }
      lines.push(`| State | ${record.state} |`)
      lines.push("")
    }

    if (records.length > 10) {
      lines.push(`*...and ${records.length - 10} more contributions*`)
    }
  } else {
    lines.push(`## No Results`)
    lines.push("")
    lines.push(`No campaign contributions found for "${query}".`)
    lines.push("")
    lines.push(`**Note:** FollowTheMoney covers STATE-level campaign finance.`)
    lines.push(`For FEDERAL contributions, use the FEC search tool.`)
  }

  return {
    query,
    records,
    entities: [],
    summary: {
      totalRecords: records.length,
      totalAmount,
      statesCovered: [...states].sort(),
      yearRange: {
        min: minYear === Infinity ? 0 : minYear,
        max: maxYear,
      },
    },
    rawContent: lines.join("\n"),
    sources: [
      {
        name: "FollowTheMoney.org",
        url: "https://www.followthemoney.org/",
      },
    ],
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { FTM_API_BASE, FTM_TIMEOUT_MS }
