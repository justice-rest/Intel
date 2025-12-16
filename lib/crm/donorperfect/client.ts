/**
 * DonorPerfect API Client
 * XML API: https://www.donorperfect.net/prod/xmlrequest.asp
 *
 * Key characteristics:
 * - All responses are XML, not JSON
 * - Authentication via ?apikey=xxx query parameter
 * - 500 row retrieval limit per query
 * - Uses stored procedures (dp_donorsearch, dp_gifts) and dynamic SELECT queries
 *
 * Uses fast-xml-parser for robust XML parsing:
 * https://github.com/NaturalIntelligence/fast-xml-parser
 */

import { XMLParser } from "fast-xml-parser"
import { CRM_API_CONFIG } from "../config"
import {
  safeMaxId,
  safeParseNumber,
  shouldContinuePagination,
  PAGINATION_LIMITS,
  withRetry,
  sleep,
} from "../utils"
import type {
  DonorPerfectDonor,
  DonorPerfectGift,
  DonorPerfectXMLResult,
  DonorPerfectDonorSearchParams,
} from "./types"

const DONORPERFECT_BASE_URL = "https://www.donorperfect.net/prod/xmlrequest.asp"
const ROW_LIMIT = 500 // DonorPerfect's maximum rows per query

// ============================================================================
// XML PARSER CONFIGURATION
// ============================================================================

/**
 * Configure fast-xml-parser for DonorPerfect's XML format
 * DonorPerfect returns XML like:
 * <result>
 *   <record>
 *     <field name="donor_id" id="donor_id" value="147"/>
 *   </record>
 * </result>
 */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  trimValues: true,
  // Handle single record as array for consistent processing
  isArray: (name) => name === "record" || name === "field",
})

// ============================================================================
// XML RESPONSE PARSING
// ============================================================================

/**
 * Parse DonorPerfect XML response using fast-xml-parser
 * Handles the standard DonorPerfect response format
 */
function parseXMLResponse(xmlString: string): DonorPerfectXMLResult {
  const result: DonorPerfectXMLResult = { records: [] }

  try {
    const parsed = xmlParser.parse(xmlString)

    // Check for error response patterns
    // DonorPerfect may return errors in various formats
    if (parsed.error) {
      result.error = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error)
      return result
    }

    // Check for error in result object
    if (parsed.result?.error) {
      result.error = typeof parsed.result.error === "string"
        ? parsed.result.error
        : JSON.stringify(parsed.result.error)
      return result
    }

    // Check for HTML error page (invalid API key often returns HTML)
    if (parsed.html || parsed.HTML || xmlString.toLowerCase().includes("<!doctype html")) {
      result.error = "Invalid API response - received HTML instead of XML. Please check your API key."
      return result
    }

    // Parse successful result
    const resultObj = parsed.result || parsed.Result || parsed

    if (!resultObj) {
      return result // Empty result, no records
    }

    // Get records array (could be under 'record' or 'Record')
    let records = resultObj.record || resultObj.Record || []

    // Ensure records is an array
    if (!Array.isArray(records)) {
      records = records ? [records] : []
    }

    // Process each record
    for (const record of records) {
      // Get fields array from record
      let fields = record.field || record.Field || []

      // Ensure fields is an array
      if (!Array.isArray(fields)) {
        fields = fields ? [fields] : []
      }

      const parsedFields: { name: string; id: string; value: string }[] = []

      for (const field of fields) {
        // fast-xml-parser prefixes attributes with @_
        const name = field["@_name"] || field["@_NAME"] || ""
        const id = field["@_id"] || field["@_ID"] || name
        const value = field["@_value"] || field["@_VALUE"] || ""

        if (name) {
          parsedFields.push({
            name: String(name),
            id: String(id),
            value: String(value),
          })
        }
      }

      if (parsedFields.length > 0) {
        result.records.push({ fields: parsedFields })
      }
    }

    return result
  } catch (error) {
    // If parsing fails, try to extract error message from raw XML
    const errorMatch = xmlString.match(/<error[^>]*>([\s\S]*?)<\/error>/i)
    if (errorMatch) {
      result.error = errorMatch[1].trim()
    } else if (xmlString.includes("error") || xmlString.includes("Error")) {
      result.error = `XML parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`
    } else {
      result.error = `Failed to parse DonorPerfect response: ${error instanceof Error ? error.message : "Unknown error"}`
    }
    return result
  }
}

/**
 * Convert parsed XML record to donor object
 */
function recordToDonor(record: { fields: { name: string; value: string }[] }): DonorPerfectDonor {
  const donor: Record<string, string | number | undefined> = {}

  const numericFields = new Set([
    "donor_id", "gifts", "gift_total", "last_contrib_amt", "max_amt",
    "avg_amt", "ytd", "ly_ytd", "yrs_donated"
  ])

  for (const field of record.fields) {
    const key = field.name.toLowerCase()
    const value = field.value

    if (numericFields.has(key)) {
      donor[key] = value ? parseFloat(value) || 0 : undefined
    } else {
      donor[key] = value || undefined
    }
  }

  return donor as unknown as DonorPerfectDonor
}

/**
 * Convert parsed XML record to gift object
 */
function recordToGift(record: { fields: { name: string; value: string }[] }): DonorPerfectGift {
  const gift: Record<string, string | number | undefined> = {}

  const numericFields = new Set([
    "gift_id", "donor_id", "amount", "total", "balance", "fmv", "batch_no", "gift_aid_amt"
  ])

  for (const field of record.fields) {
    const key = field.name.toLowerCase()
    const value = field.value

    if (numericFields.has(key)) {
      gift[key] = value ? parseFloat(value) || 0 : undefined
    } else {
      gift[key] = value || undefined
    }
  }

  return gift as unknown as DonorPerfectGift
}

// ============================================================================
// API REQUEST HELPERS
// ============================================================================

/**
 * Make a request to DonorPerfect API
 */
async function donorPerfectFetch(apiKey: string, action: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CRM_API_CONFIG.timeout)

  try {
    // Build URL with API key and action
    const url = `${DONORPERFECT_BASE_URL}?apikey=${encodeURIComponent(apiKey)}&action=${encodeURIComponent(action)}`

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`DonorPerfect API error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()

    // Quick validation of response
    if (!text || text.trim().length === 0) {
      throw new Error("DonorPerfect API returned empty response")
    }

    return text
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("DonorPerfect API request timed out")
    }
    throw error
  }
}

/**
 * Execute a stored procedure
 */
async function executeProcedure(
  apiKey: string,
  procedure: string,
  params: string
): Promise<DonorPerfectXMLResult> {
  const action = `${procedure}&params=${params}`
  const xmlResponse = await donorPerfectFetch(apiKey, action)
  return parseXMLResponse(xmlResponse)
}

/**
 * Execute a dynamic SELECT query
 */
async function executeQuery(apiKey: string, query: string): Promise<DonorPerfectXMLResult> {
  const xmlResponse = await donorPerfectFetch(apiKey, query)
  return parseXMLResponse(xmlResponse)
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate DonorPerfect API key by making a test request
 * @param apiKey The DonorPerfect API key
 * @returns Validation result
 */
export async function validateDonorPerfectKey(apiKey: string): Promise<{
  valid: boolean
  organizationName?: string
  error?: string
}> {
  try {
    // Validate API key format first
    if (!apiKey || apiKey.trim().length < 10) {
      return {
        valid: false,
        error: "API key appears to be too short. DonorPerfect API keys are typically over 100 characters.",
      }
    }

    // Use dp_donorsearch with null parameters to validate credentials
    // This will return records if valid, or an error if invalid
    const result = await executeProcedure(
      apiKey,
      "dp_donorsearch",
      "@donor_id=null,@last_name='%',@first_name=null,@opt_line=null,@address=null,@city=null,@state=null,@zip=null,@country=null,@filter_id=null,@user_id=null"
    )

    // If we get an error response, the API key is invalid
    if (result.error) {
      // Check for common error patterns
      if (result.error.includes("HTML")) {
        return {
          valid: false,
          error: "Invalid API key. Please verify your DonorPerfect API key is correct.",
        }
      }
      return {
        valid: false,
        error: result.error,
      }
    }

    // If we get here, the API key is valid (even if no records returned)
    return {
      valid: true,
      organizationName: "DonorPerfect Online",
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Failed to validate API key",
    }
  }
}

// ============================================================================
// DONOR OPERATIONS
// ============================================================================

/**
 * Escape single quotes for SQL parameters
 */
function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''")
}

/**
 * Search for donors using dp_donorsearch procedure
 */
export async function searchDonorPerfectDonors(
  apiKey: string,
  params: DonorPerfectDonorSearchParams = {}
): Promise<DonorPerfectDonor[]> {
  const paramStr = [
    `@donor_id=${params.donor_id ?? "null"}`,
    `@last_name=${params.last_name ? `'${escapeSqlString(params.last_name)}'` : "null"}`,
    `@first_name=${params.first_name ? `'${escapeSqlString(params.first_name)}'` : "null"}`,
    `@opt_line=${params.opt_line ? `'${escapeSqlString(params.opt_line)}'` : "null"}`,
    `@address=${params.address ? `'${escapeSqlString(params.address)}'` : "null"}`,
    `@city=${params.city ? `'${escapeSqlString(params.city)}'` : "null"}`,
    `@state=${params.state ? `'${escapeSqlString(params.state)}'` : "null"}`,
    `@zip=${params.zip ? `'${escapeSqlString(params.zip)}'` : "null"}`,
    `@country=${params.country ? `'${escapeSqlString(params.country)}'` : "null"}`,
    `@filter_id=${params.filter_id ?? "null"}`,
    `@user_id=${params.user_id ? `'${escapeSqlString(params.user_id)}'` : "null"}`,
  ].join(",")

  const result = await executeProcedure(apiKey, "dp_donorsearch", paramStr)

  if (result.error) {
    throw new Error(`DonorPerfect search error: ${result.error}`)
  }

  return result.records.map(recordToDonor)
}

/**
 * Get a specific donor by ID with full details
 */
export async function getDonorPerfectDonor(
  apiKey: string,
  donorId: number
): Promise<DonorPerfectDonor | null> {
  try {
    // Use SELECT to get all fields for a specific donor
    const query = `SELECT * FROM DP WHERE donor_id = ${donorId}`
    const result = await executeQuery(apiKey, query)

    if (result.error || result.records.length === 0) {
      return null
    }

    return recordToDonor(result.records[0])
  } catch (error) {
    console.error("[DonorPerfect] Get donor failed:", error)
    return null
  }
}

/**
 * Fetch all donors with pagination (handles 500 row limit)
 * Uses dynamic SELECT with ordering by donor_id for consistent pagination
 */
export async function* fetchAllDonorPerfectDonors(
  apiKey: string,
  batchSize: number = ROW_LIMIT
): AsyncGenerator<DonorPerfectDonor[], void, unknown> {
  let lastDonorId = 0
  let hasMore = true
  let consecutiveEmptyBatches = 0
  let iterationCount = 0
  let totalRecordsFetched = 0

  while (hasMore) {
    // Check pagination safety limits
    const paginationCheck = shouldContinuePagination(
      totalRecordsFetched,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[DonorPerfect] Pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    // Use SELECT with donor_id > lastDonorId for pagination
    // Include key fields needed for constituent mapping
    const query = `SELECT TOP ${Math.min(batchSize, ROW_LIMIT)}
      donor_id, first_name, last_name, middle_name, suffix, title,
      opt_line, address, address2, city, state, zip, country,
      home_phone, business_phone, mobile_phone, email, org_rec, donor_type,
      created_date, modified_date
    FROM DP
    WHERE donor_id > ${lastDonorId}
    ORDER BY donor_id`

    // Execute with retry logic
    const result = await withRetry(() => executeQuery(apiKey, query))

    if (result.error) {
      throw new Error(`DonorPerfect query error: ${result.error}`)
    }

    const donors = result.records.map(recordToDonor)

    if (donors.length === 0) {
      consecutiveEmptyBatches++
      hasMore = false
      break
    }

    consecutiveEmptyBatches = 0 // Reset on successful batch
    totalRecordsFetched += donors.length

    // Update pagination state using safe max calculation
    const maxId = safeMaxId(
      donors,
      (d) => safeParseNumber(d.donor_id),
      lastDonorId
    )
    if (maxId <= lastDonorId) {
      // Safety check: prevent infinite loop if IDs don't increase
      console.warn(`[DonorPerfect] ID progression stopped at ${maxId}, ending pagination`)
      hasMore = false
      break
    }
    lastDonorId = maxId
    hasMore = donors.length === Math.min(batchSize, ROW_LIMIT)

    yield donors

    // Rate limiting delay
    if (hasMore) {
      await sleep(CRM_API_CONFIG.rateLimitDelay)
    }
  }
}

// ============================================================================
// GIFT OPERATIONS
// ============================================================================

/**
 * Get gifts for a specific donor using dp_gifts procedure
 */
export async function getDonorPerfectGifts(
  apiKey: string,
  donorId: number
): Promise<DonorPerfectGift[]> {
  const result = await executeProcedure(apiKey, "dp_gifts", `@donor_id=${donorId}`)

  if (result.error) {
    throw new Error(`DonorPerfect gifts error: ${result.error}`)
  }

  return result.records.map(recordToGift)
}

/**
 * Get a specific gift by ID
 */
export async function getDonorPerfectGift(
  apiKey: string,
  giftId: number
): Promise<DonorPerfectGift | null> {
  try {
    const query = `SELECT * FROM DPGIFT WHERE gift_id = ${giftId}`
    const result = await executeQuery(apiKey, query)

    if (result.error || result.records.length === 0) {
      return null
    }

    return recordToGift(result.records[0])
  } catch (error) {
    console.error("[DonorPerfect] Get gift failed:", error)
    return null
  }
}

/**
 * Fetch all gifts with pagination (handles 500 row limit)
 * Uses dynamic SELECT with ordering by gift_id for consistent pagination
 */
export async function* fetchAllDonorPerfectGifts(
  apiKey: string,
  batchSize: number = ROW_LIMIT
): AsyncGenerator<DonorPerfectGift[], void, unknown> {
  let lastGiftId = 0
  let hasMore = true
  let consecutiveEmptyBatches = 0
  let iterationCount = 0
  let totalRecordsFetched = 0

  while (hasMore) {
    // Check pagination safety limits
    const paginationCheck = shouldContinuePagination(
      totalRecordsFetched,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[DonorPerfect] Gift pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    // Use SELECT with gift_id > lastGiftId for pagination
    // Include key fields needed for donation mapping
    const query = `SELECT TOP ${Math.min(batchSize, ROW_LIMIT)}
      gift_id, donor_id, record_type, gift_date, amount,
      gl_code, solicit_code, sub_solicit_code, campaign, gift_type,
      split_gift, pledge_payment, reference, gift_narrative,
      ty_letter_no, currency, created_date, modified_date
    FROM DPGIFT
    WHERE gift_id > ${lastGiftId} AND record_type = 'G'
    ORDER BY gift_id`

    // Execute with retry logic
    const result = await withRetry(() => executeQuery(apiKey, query))

    if (result.error) {
      throw new Error(`DonorPerfect query error: ${result.error}`)
    }

    const gifts = result.records.map(recordToGift)

    if (gifts.length === 0) {
      consecutiveEmptyBatches++
      hasMore = false
      break
    }

    consecutiveEmptyBatches = 0
    totalRecordsFetched += gifts.length

    // Update pagination state using safe max calculation
    const maxId = safeMaxId(
      gifts,
      (g) => safeParseNumber(g.gift_id),
      lastGiftId
    )
    if (maxId <= lastGiftId) {
      console.warn(`[DonorPerfect] Gift ID progression stopped at ${maxId}, ending pagination`)
      hasMore = false
      break
    }
    lastGiftId = maxId
    hasMore = gifts.length === Math.min(batchSize, ROW_LIMIT)

    yield gifts

    // Rate limiting delay
    if (hasMore) {
      await sleep(CRM_API_CONFIG.rateLimitDelay)
    }
  }
}

/**
 * Fetch donor giving summary
 * Returns aggregated giving data for a donor
 */
export async function getDonorPerfectDonorSummary(
  apiKey: string,
  donorId: number
): Promise<{
  totalGifts: number
  totalAmount: number
  largestGift: number
  lastGiftDate?: string
  lastGiftAmount?: number
  firstGiftDate?: string
} | null> {
  try {
    // Get summary from DP table which has pre-calculated fields
    const query = `SELECT gifts, gift_total, max_amt, max_date, last_contrib_amt FROM DP WHERE donor_id = ${donorId}`
    const result = await executeQuery(apiKey, query)

    if (result.error || result.records.length === 0) {
      return null
    }

    const record = result.records[0]
    const getValue = (name: string) => record.fields.find((f) => f.name.toLowerCase() === name.toLowerCase())?.value

    return {
      totalGifts: parseInt(getValue("gifts") || "0", 10),
      totalAmount: parseFloat(getValue("gift_total") || "0"),
      largestGift: parseFloat(getValue("max_amt") || "0"),
      lastGiftDate: getValue("max_date") || undefined,
      lastGiftAmount: getValue("last_contrib_amt") ? parseFloat(getValue("last_contrib_amt")!) : undefined,
    }
  } catch (error) {
    console.error("[DonorPerfect] Get donor summary failed:", error)
    return null
  }
}
