/**
 * Socrata SoQL Query Builder
 *
 * Builds and executes SoQL queries against Socrata Open Data APIs
 * Includes rate limiting and consistent error handling
 *
 * Rate Limits:
 * - Without app token: 60 requests/hour per IP
 * - With app token: 1000 requests/hour
 *
 * Get a free app token at: https://dev.socrata.com/register
 */

import type {
  SoQLQuery,
  SoQLCondition,
  SocrataResponse,
  DataSourceConfig,
} from "./types"

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 1000

// Rate limit tracking per portal
const rateLimitState: Map<
  string,
  { count: number; windowStart: number }
> = new Map()

// ============================================================================
// CONFIGURATION
// ============================================================================

export function getSocrataAppToken(): string | undefined {
  return process.env.SOCRATA_APP_TOKEN
}

export function hasAppToken(): boolean {
  return !!getSocrataAppToken()
}

function getRateLimit(): number {
  // Without token: 60/hour, with token: 1000/hour
  return hasAppToken() ? 1000 : 60
}

// ============================================================================
// RATE LIMITING
// ============================================================================

function checkRateLimit(portal: string): { allowed: boolean; waitMs: number } {
  const now = Date.now()
  const hourMs = 60 * 60 * 1000
  const limit = getRateLimit()

  let state = rateLimitState.get(portal)

  // Reset window if expired
  if (!state || now - state.windowStart >= hourMs) {
    state = { count: 0, windowStart: now }
    rateLimitState.set(portal, state)
  }

  if (state.count >= limit) {
    const waitMs = state.windowStart + hourMs - now
    return { allowed: false, waitMs }
  }

  return { allowed: true, waitMs: 0 }
}

function recordRequest(portal: string): void {
  const state = rateLimitState.get(portal)
  if (state) {
    state.count++
  }
}

// ============================================================================
// SOQL QUERY BUILDING
// ============================================================================

function escapeValue(value: string): string {
  // Escape single quotes for SoQL
  return value.replace(/'/g, "''")
}

function formatValue(
  value: string | number | string[] | number[],
  operator: string
): string {
  if (Array.isArray(value)) {
    if (operator === "IN" || operator === "NOT IN") {
      const formatted = value
        .map((v) =>
          typeof v === "string" ? `'${escapeValue(v)}'` : String(v)
        )
        .join(", ")
      return `(${formatted})`
    }
    if (operator === "BETWEEN" && value.length === 2) {
      return `${value[0]} AND ${value[1]}`
    }
    return String(value[0])
  }

  if (typeof value === "string") {
    return `'${escapeValue(value)}'`
  }

  return String(value)
}

function buildCondition(condition: SoQLCondition): string {
  const { field, operator, value } = condition

  if (operator === "IS NULL" || operator === "IS NOT NULL") {
    return `${field} ${operator}`
  }

  if (operator === "LIKE" || operator === "NOT LIKE") {
    // Ensure value has wildcards for LIKE
    const likeValue =
      typeof value === "string" && !value.includes("%")
        ? `%${value}%`
        : value
    return `${field} ${operator} ${formatValue(likeValue as string, operator)}`
  }

  return `${field} ${operator} ${formatValue(value, operator)}`
}

export function buildSoQLUrl(
  portal: string,
  datasetId: string,
  query: SoQLQuery
): string {
  const params = new URLSearchParams()

  // SELECT
  if (query.select && query.select.length > 0) {
    params.set("$select", query.select.join(", "))
  }

  // WHERE
  const whereConditions: string[] = []

  if (query.where && query.where.length > 0) {
    whereConditions.push(...query.where.map(buildCondition))
  }

  if (query.whereRaw) {
    whereConditions.push(query.whereRaw)
  }

  if (whereConditions.length > 0) {
    params.set("$where", whereConditions.join(" AND "))
  }

  // ORDER BY
  if (query.orderBy && query.orderBy.length > 0) {
    const orderClause = query.orderBy
      .map((o) => `${o.field} ${o.direction}`)
      .join(", ")
    params.set("$order", orderClause)
  }

  // GROUP BY
  if (query.groupBy && query.groupBy.length > 0) {
    params.set("$group", query.groupBy.join(", "))
  }

  // HAVING
  if (query.having) {
    params.set("$having", query.having)
  }

  // LIMIT
  const limit = Math.min(query.limit || DEFAULT_LIMIT, MAX_LIMIT)
  params.set("$limit", String(limit))

  // OFFSET
  if (query.offset && query.offset > 0) {
    params.set("$offset", String(query.offset))
  }

  // Full-text search
  if (query.q) {
    params.set("$q", query.q)
  }

  // Build URL
  const baseUrl = portal.endsWith("/") ? portal.slice(0, -1) : portal
  return `${baseUrl}/resource/${datasetId}.json?${params.toString()}`
}

// ============================================================================
// QUERY EXECUTION
// ============================================================================

export async function executeSoQLQuery<T = Record<string, unknown>>(
  dataSource: DataSourceConfig,
  query: SoQLQuery,
  options: { timeoutMs?: number } = {}
): Promise<SocrataResponse<T>> {
  const { portal, datasetId, name } = dataSource
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS

  console.log(`[Socrata] Querying ${name} (${datasetId})`)

  // Check rate limit
  const rateCheck = checkRateLimit(portal)
  if (!rateCheck.allowed) {
    const waitMinutes = Math.ceil(rateCheck.waitMs / 60000)
    throw new Error(
      `Rate limit exceeded for ${portal}. Try again in ${waitMinutes} minutes. ` +
        `Tip: Add SOCRATA_APP_TOKEN for 1000 req/hour instead of 60.`
    )
  }

  const url = buildSoQLUrl(portal, datasetId, query)
  console.log(`[Socrata] Query URL: ${url}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    }

    // Add app token if available
    const appToken = getSocrataAppToken()
    if (appToken) {
      headers["X-App-Token"] = appToken
    }

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    recordRequest(portal)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Socrata API error ${response.status}: ${errorText}`)
    }

    const data = (await response.json()) as T[]

    console.log(`[Socrata] Received ${data.length} records from ${name}`)

    // Build formatted output
    const rawContent = formatRawContent(dataSource, data, query)

    return {
      data,
      metadata: {
        portal,
        datasetId,
        query: url,
        count: data.length,
      },
      sources: [
        {
          name,
          url: `${portal}/d/${datasetId}`,
        },
      ],
      rawContent,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    console.error(`[Socrata] Error querying ${name}:`, errorMessage)

    return {
      data: [],
      metadata: {
        portal,
        datasetId,
        query: url,
        count: 0,
      },
      sources: [
        {
          name,
          url: `${portal}/d/${datasetId}`,
        },
      ],
      rawContent: `## Error\n\nFailed to query ${name}: ${errorMessage}`,
      error: errorMessage,
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRawContent<T>(
  dataSource: DataSourceConfig,
  data: T[],
  query: SoQLQuery
): string {
  const lines: string[] = []

  lines.push(`# ${dataSource.name} - Socrata Query Results`)
  lines.push("")
  lines.push(`**Source:** ${dataSource.portal}/d/${dataSource.datasetId}`)
  lines.push(`**Records Found:** ${data.length}`)
  lines.push("")

  if (data.length === 0) {
    lines.push("No matching records found.")
    return lines.join("\n")
  }

  // Get field mappings for pretty printing
  const fieldMap = new Map(
    dataSource.fields.map((f) => [f.source, f])
  )

  lines.push("## Results")
  lines.push("")

  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const record = data[i] as Record<string, unknown>
    lines.push(`### Record ${i + 1}`)
    lines.push("")
    lines.push("| Field | Value |")
    lines.push("|-------|-------|")

    for (const [key, value] of Object.entries(record)) {
      if (value === null || value === undefined || value === "") continue

      const fieldDef = fieldMap.get(key)
      const label = fieldDef?.label || key
      let displayValue = String(value)

      // Format currency fields
      if (fieldDef?.type === "currency" && typeof value === "number") {
        displayValue = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(value)
      }

      lines.push(`| ${label} | ${displayValue} |`)
    }

    lines.push("")
  }

  if (data.length > 10) {
    lines.push(`*...and ${data.length - 10} more records*`)
  }

  return lines.join("\n")
}

// ============================================================================
// CONVENIENCE QUERY BUILDERS
// ============================================================================

/**
 * Build a name search query
 */
export function buildNameSearchQuery(
  nameField: string,
  searchName: string,
  options: { limit?: number } = {}
): SoQLQuery {
  // Split name into parts for better matching
  const nameParts = searchName.trim().split(/\s+/)

  if (nameParts.length === 1) {
    // Single name - use LIKE
    return {
      where: [
        {
          field: `upper(${nameField})`,
          operator: "LIKE",
          value: `%${nameParts[0].toUpperCase()}%`,
        },
      ],
      limit: options.limit || DEFAULT_LIMIT,
    }
  }

  // Multiple names - search for last name, first name
  const lastName = nameParts[nameParts.length - 1].toUpperCase()
  const firstName = nameParts[0].toUpperCase()

  return {
    whereRaw: `upper(${nameField}) LIKE '%${escapeValue(lastName)}%' AND upper(${nameField}) LIKE '%${escapeValue(firstName)}%'`,
    limit: options.limit || DEFAULT_LIMIT,
  }
}

/**
 * Build an address search query
 */
export function buildAddressSearchQuery(
  addressField: string,
  searchAddress: string,
  options: { cityField?: string; city?: string; limit?: number } = {}
): SoQLQuery {
  const conditions: SoQLCondition[] = [
    {
      field: `upper(${addressField})`,
      operator: "LIKE",
      value: `%${searchAddress.toUpperCase()}%`,
    },
  ]

  if (options.cityField && options.city) {
    conditions.push({
      field: `upper(${options.cityField})`,
      operator: "LIKE",
      value: `%${options.city.toUpperCase()}%`,
    })
  }

  return {
    where: conditions,
    limit: options.limit || DEFAULT_LIMIT,
  }
}

/**
 * Build a value range query (for assessments, salaries, etc.)
 */
export function buildValueRangeQuery(
  valueField: string,
  minValue?: number,
  maxValue?: number,
  options: { limit?: number; orderDesc?: boolean } = {}
): SoQLQuery {
  const conditions: SoQLCondition[] = []

  if (minValue !== undefined) {
    conditions.push({
      field: valueField,
      operator: ">=",
      value: minValue,
    })
  }

  if (maxValue !== undefined) {
    conditions.push({
      field: valueField,
      operator: "<=",
      value: maxValue,
    })
  }

  return {
    where: conditions,
    orderBy: [{ field: valueField, direction: options.orderDesc ? "DESC" : "ASC" }],
    limit: options.limit || DEFAULT_LIMIT,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  DEFAULT_TIMEOUT_MS,
}
