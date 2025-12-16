/**
 * DonorPerfect API Client
 * XML API: https://www.donorperfect.net/prod/xmlrequest.asp
 *
 * Key characteristics:
 * - All responses are XML, not JSON
 * - Authentication via ?apikey=xxx query parameter
 * - 500 row retrieval limit per query
 * - Uses stored procedures (dp_donorsearch, dp_gifts) and dynamic SELECT queries
 */

import { CRM_API_CONFIG } from "../config"
import type {
  DonorPerfectDonor,
  DonorPerfectGift,
  DonorPerfectXMLResult,
  DonorPerfectDonorSearchParams,
} from "./types"

const DONORPERFECT_BASE_URL = "https://www.donorperfect.net/prod/xmlrequest.asp"
const ROW_LIMIT = 500 // DonorPerfect's maximum rows per query

// ============================================================================
// XML PARSER
// ============================================================================

/**
 * Parse DonorPerfect XML response into structured data
 * Handles responses like:
 * <result>
 *   <record>
 *     <field name="donor_id" id="donor_id" value="147"/>
 *     <field name="first_name" id="first_name" value="John"/>
 *   </record>
 * </result>
 */
function parseXMLResponse(xmlString: string): DonorPerfectXMLResult {
  const result: DonorPerfectXMLResult = { records: [] }

  // Check for error response
  const errorMatch = xmlString.match(/<error[^>]*>([\s\S]*?)<\/error>/i)
  if (errorMatch) {
    result.error = errorMatch[1].trim()
    return result
  }

  // Also check for error in different format
  const errorMsgMatch = xmlString.match(/error[^:]*:\s*([^<]+)/i)
  if (errorMsgMatch && !xmlString.includes("<record")) {
    result.error = errorMsgMatch[1].trim()
    return result
  }

  // Parse records
  const recordMatches = xmlString.matchAll(/<record[^>]*>([\s\S]*?)<\/record>/gi)

  for (const recordMatch of recordMatches) {
    const recordContent = recordMatch[1]
    const fields: { name: string; id: string; value: string }[] = []

    // Parse fields within record
    // Format: <field name="donor_id" id="donor_id" value="147"/>
    const fieldMatches = recordContent.matchAll(
      /<field\s+name="([^"]*)"[^>]*id="([^"]*)"[^>]*value="([^"]*)"\s*\/?\s*>/gi
    )

    for (const fieldMatch of fieldMatches) {
      fields.push({
        name: fieldMatch[1],
        id: fieldMatch[2],
        value: decodeXMLEntities(fieldMatch[3]),
      })
    }

    // Also try alternative attribute order
    const altFieldMatches = recordContent.matchAll(
      /<field[^>]*value="([^"]*)"[^>]*name="([^"]*)"[^>]*id="([^"]*)"[^>]*\/?\s*>/gi
    )

    for (const fieldMatch of altFieldMatches) {
      // Check if we already have this field
      const name = fieldMatch[2]
      if (!fields.some((f) => f.name === name)) {
        fields.push({
          name: fieldMatch[2],
          id: fieldMatch[3],
          value: decodeXMLEntities(fieldMatch[1]),
        })
      }
    }

    if (fields.length > 0) {
      result.records.push({ fields })
    }
  }

  return result
}

/**
 * Decode common XML entities
 */
function decodeXMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
}

/**
 * Convert XML record to donor object
 */
function recordToDonor(record: { fields: { name: string; value: string }[] }): DonorPerfectDonor {
  const donor: Record<string, string | number | undefined> = {}

  for (const field of record.fields) {
    const key = field.name.toLowerCase()
    const value = field.value

    // Handle numeric fields
    if (
      ["donor_id", "gifts", "gift_total", "last_contrib_amt", "max_amt", "avg_amt", "ytd", "ly_ytd", "yrs_donated"].includes(
        key
      )
    ) {
      donor[key] = value ? parseFloat(value) || 0 : undefined
    } else {
      donor[key] = value || undefined
    }
  }

  return donor as unknown as DonorPerfectDonor
}

/**
 * Convert XML record to gift object
 */
function recordToGift(record: { fields: { name: string; value: string }[] }): DonorPerfectGift {
  const gift: Record<string, string | number | undefined> = {}

  for (const field of record.fields) {
    const key = field.name.toLowerCase()
    const value = field.value

    // Handle numeric fields
    if (["gift_id", "donor_id", "amount", "total", "balance", "fmv", "batch_no", "gift_aid_amt"].includes(key)) {
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

    return response.text()
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
    // Use dp_donorsearch with a specific known ID pattern to validate
    // We'll search for donor_id 1 which should always exist or return empty
    const result = await executeProcedure(
      apiKey,
      "dp_donorsearch",
      "@donor_id=1,@last_name=null,@first_name=null,@opt_line=null,@address=null,@city=null,@state=null,@zip=null,@country=null,@filter_id=null,@user_id=null"
    )

    // If we get an error response, the API key is invalid
    if (result.error) {
      return {
        valid: false,
        error: result.error,
      }
    }

    // If we get here, the API key is valid
    return {
      valid: true,
      organizationName: "DonorPerfect Online",
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    }
  }
}

// ============================================================================
// DONOR OPERATIONS
// ============================================================================

/**
 * Search for donors using dp_donorsearch procedure
 */
export async function searchDonorPerfectDonors(
  apiKey: string,
  params: DonorPerfectDonorSearchParams = {}
): Promise<DonorPerfectDonor[]> {
  const paramStr = [
    `@donor_id=${params.donor_id ?? "null"}`,
    `@last_name=${params.last_name ? `'${params.last_name.replace(/'/g, "''")}'` : "null"}`,
    `@first_name=${params.first_name ? `'${params.first_name.replace(/'/g, "''")}'` : "null"}`,
    `@opt_line=${params.opt_line ? `'${params.opt_line.replace(/'/g, "''")}'` : "null"}`,
    `@address=${params.address ? `'${params.address.replace(/'/g, "''")}'` : "null"}`,
    `@city=${params.city ? `'${params.city.replace(/'/g, "''")}'` : "null"}`,
    `@state=${params.state ? `'${params.state.replace(/'/g, "''")}'` : "null"}`,
    `@zip=${params.zip ? `'${params.zip.replace(/'/g, "''")}'` : "null"}`,
    `@country=${params.country ? `'${params.country.replace(/'/g, "''")}'` : "null"}`,
    `@filter_id=${params.filter_id ?? "null"}`,
    `@user_id=${params.user_id ? `'${params.user_id.replace(/'/g, "''")}'` : "null"}`,
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

  while (hasMore) {
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

    const result = await executeQuery(apiKey, query)

    if (result.error) {
      throw new Error(`DonorPerfect query error: ${result.error}`)
    }

    const donors = result.records.map(recordToDonor)

    if (donors.length === 0) {
      hasMore = false
      break
    }

    // Update pagination state
    lastDonorId = Math.max(...donors.map((d) => parseInt(d.donor_id, 10) || 0))
    hasMore = donors.length === Math.min(batchSize, ROW_LIMIT)

    yield donors

    // Rate limiting delay
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, CRM_API_CONFIG.rateLimitDelay))
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

  while (hasMore) {
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

    const result = await executeQuery(apiKey, query)

    if (result.error) {
      throw new Error(`DonorPerfect query error: ${result.error}`)
    }

    const gifts = result.records.map(recordToGift)

    if (gifts.length === 0) {
      hasMore = false
      break
    }

    // Update pagination state
    lastGiftId = Math.max(...gifts.map((g) => parseInt(g.gift_id, 10) || 0))
    hasMore = gifts.length === Math.min(batchSize, ROW_LIMIT)

    yield gifts

    // Rate limiting delay
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, CRM_API_CONFIG.rateLimitDelay))
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
