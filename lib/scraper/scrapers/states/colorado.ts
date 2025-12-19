/**
 * Colorado Secretary of State Business Entity Scraper
 *
 * Uses Colorado Open Data (Socrata API) - FREE, no scraping needed!
 * This is one of the most reliable state data sources.
 *
 * Dataset: Business Entities in Colorado
 * URL: https://data.colorado.gov/Business/Business-Entities-in-Colorado/4ykn-tg5h
 * API: https://data.colorado.gov/resource/4ykn-tg5h.json
 *
 * Features:
 * - 1M+ entities back to 1800s
 * - Includes registered agents
 * - Status, entity type, formation date
 * - Principal address
 * - FREE Socrata API (same as NY Open Data)
 * - No authentication required (optional app token for higher rate limits)
 *
 * Also available (separate datasets):
 * - UCC Filings: https://data.colorado.gov/Business/UCC-Data/yfwe-cc27
 * - Corporate Transactions: https://data.colorado.gov/Business/Corporate-Transactions/wbpd-dpzf
 */

import {
  type ScrapedBusinessEntity,
  type ScraperResult,
} from "../../config"

// Colorado Open Data API endpoints (Socrata API)
const CO_OPEN_DATA = {
  businesses: "https://data.colorado.gov/resource/4ykn-tg5h.json",
}

// HTTP headers for API requests
const HTTP_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
}

// Optional: Socrata app token for higher rate limits
// Get one at: https://data.colorado.gov/profile/edit/developer_settings
function getSocrataAppToken(): string | null {
  return process.env.COLORADO_SOCRATA_APP_TOKEN || null
}

/**
 * Normalize status values to consistent format
 */
function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) return null
  const s = status.trim().toUpperCase()

  // Colorado status codes
  if (s === "GOOD STANDING" || s === "GOOD" || s === "GS") return "Active"
  if (s === "EXISTS" || s === "ACTIVE") return "Active"
  if (s === "DELINQUENT" || s === "DEL") return "Delinquent"
  if (s === "WITHDRAWN") return "Withdrawn"
  if (s === "DISSOLVED" || s === "DISS") return "Dissolved"
  if (s === "ADMINISTRATIVELY DISSOLVED" || s === "ADM DISS") return "Administratively Dissolved"
  if (s === "VOLUNTARILY DISSOLVED" || s === "VOL DISS") return "Voluntarily Dissolved"
  if (s === "NONCOMPLIANT") return "Noncompliant"
  if (s === "EXPIRED") return "Expired"
  if (s === "REVOKED") return "Revoked"
  if (s === "CANCELED" || s === "CANCELLED") return "Cancelled"
  if (s === "CONVERTED") return "Converted"
  if (s === "MERGED") return "Merged"

  return status.trim()
}

/**
 * Parse date safely
 */
function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    // Socrata returns ISO format
    const datePart = dateStr.split("T")[0]
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart
    }
    return null
  } catch {
    return null
  }
}

/**
 * Search Colorado businesses via Open Data API
 * This is the primary and recommended method - FREE, fast, reliable
 */
export async function searchColoradoOpenData(
  query: string,
  options: {
    limit?: number
    status?: "active" | "inactive" | "all"
    entityType?: string
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, status = "all", entityType } = options

  console.log("[Colorado Scraper] Searching via Open Data API:", query)

  try {
    // Build Socrata Query Language (SoQL) query
    const params = new URLSearchParams({
      $limit: limit.toString(),
      $order: "entityformdate DESC",
    })

    // Add app token if available (increases rate limits)
    const appToken = getSocrataAppToken()
    if (appToken) {
      params.append("$$app_token", appToken)
    }

    // Build WHERE clause for search
    // Escape single quotes in query for SoQL
    const escapedQuery = query.toUpperCase().replace(/'/g, "''")

    // Search in entity name
    let whereClause = `UPPER(entityname) LIKE '%${escapedQuery}%'`

    // Add status filter
    if (status === "active") {
      whereClause += ` AND (entitystatus = 'Good Standing' OR entitystatus = 'Exists')`
    } else if (status === "inactive") {
      whereClause += ` AND entitystatus NOT IN ('Good Standing', 'Exists')`
    }

    // Add entity type filter
    if (entityType) {
      whereClause += ` AND UPPER(entitytype) = '${entityType.toUpperCase()}'`
    }

    params.append("$where", whereClause)

    const url = `${CO_OPEN_DATA.businesses}?${params.toString()}`
    console.log("[Colorado Scraper] API URL:", url)

    const response = await fetch(url, { headers: HTTP_HEADERS })

    if (!response.ok) {
      throw new Error(`Colorado Open Data API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Map Colorado Open Data fields to our ScrapedBusinessEntity format
    // Dataset 4ykn-tg5h fields:
    // - entityid: Unique ID
    // - entityname: Business name
    // - principaladdress1, principaladdress2, principalcity, principalstate, principalzipcode
    // - entitystatus: Good Standing, Delinquent, Dissolved, etc.
    // - entitytype: Corporation, LLC, LP, LLP, etc.
    // - entityformdate: Formation date
    // - agentfirstname, agentmiddlename, agentlastname
    // - agentaddress1, agentcity, agentstate, agentzipcode
    const businesses: ScrapedBusinessEntity[] = data.map((entity: {
      entityid?: string | null
      entityname?: string | null
      entitystatus?: string | null
      entitytype?: string | null
      entityformdate?: string | null
      principaladdress1?: string | null
      principaladdress2?: string | null
      principalcity?: string | null
      principalstate?: string | null
      principalzipcode?: string | null
      principalcountry?: string | null
      agentfirstname?: string | null
      agentmiddlename?: string | null
      agentlastname?: string | null
      agentorganizationname?: string | null
    }) => {
      // Build principal address
      const addressParts = [
        entity.principaladdress1,
        entity.principaladdress2,
        entity.principalcity,
        entity.principalstate,
        entity.principalzipcode,
      ].filter(Boolean)

      // Build registered agent name
      const agentNameParts = [
        entity.agentfirstname,
        entity.agentmiddlename,
        entity.agentlastname,
      ].filter(Boolean)
      const registeredAgent = agentNameParts.length > 0
        ? agentNameParts.join(" ")
        : entity.agentorganizationname || null

      return {
        name: entity.entityname || "",
        entityNumber: entity.entityid || null,
        jurisdiction: "us_co",
        status: normalizeStatus(entity.entitystatus),
        incorporationDate: parseDate(entity.entityformdate),
        entityType: entity.entitytype || null,
        registeredAddress: addressParts.length > 0 ? addressParts.join(", ") : null,
        registeredAgent: registeredAgent,
        sourceUrl: entity.entityid
          ? `https://www.sos.state.co.us/biz/BusinessEntityDetail.do?quitButtonDestination=BusinessEntityResults&fileId=${entity.entityid}&masterFileId=${entity.entityid}`
          : "https://www.sos.state.co.us/biz/BusinessEntitySearch.do",
        source: "colorado" as const,
        scrapedAt: new Date().toISOString(),
      }
    })

    const duration = Date.now() - startTime
    console.log(`[Colorado Scraper] Found ${businesses.length} results in ${duration}ms`)

    return {
      success: true,
      data: businesses,
      totalFound: businesses.length,
      source: "colorado",
      query,
      scrapedAt: new Date().toISOString(),
      duration,
      warnings: status === "all" ? [
        "Results include both active and inactive entities. Use status filter to narrow results.",
      ] : undefined,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Colorado Scraper] API error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "colorado",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
      warnings: [
        "Colorado Open Data API failed. Try again later or search directly at:",
        "https://www.sos.state.co.us/biz/BusinessEntitySearch.do",
      ],
    }
  }
}

// Export the Open Data search as the primary method
export { searchColoradoOpenData as scrapeColoradoBusinesses }
