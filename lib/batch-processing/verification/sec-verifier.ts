/**
 * SEC EDGAR Verification
 *
 * Verifies SEC insider status and filings directly from SEC EDGAR API.
 * FREE - no API key required.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SecVerificationResult {
  verified: boolean
  hasFilings: boolean
  filings: Array<{
    company: string
    cik: string
    formType: string
    filingDate: string
    accessionNumber: string
  }>
  companies: string[]
  source: "SEC EDGAR"
  timestamp: Date
}

// ============================================================================
// SEC EDGAR API
// ============================================================================

const SEC_EDGAR_BASE = "https://efts.sec.gov/LATEST/search-index"
const SEC_SEARCH_BASE = "https://www.sec.gov/cgi-bin/browse-edgar"

/**
 * Search SEC EDGAR for insider filings by person name
 */
export async function verifySecInsider(personName: string): Promise<SecVerificationResult | null> {
  try {
    // Use SEC EDGAR full-text search API
    const response = await fetch(
      `${SEC_EDGAR_BASE}?q=${encodeURIComponent(`"${personName}"`)}&dateRange=custom&startdt=2019-01-01&forms=3,4,5&returnCounts=true`,
      {
        headers: {
          "User-Agent": "Romy Prospect Research/1.0 (support@greenflux.com)",
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      console.log(`[SEC] EDGAR search returned ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.hits || data.hits.total === 0) {
      return {
        verified: true,
        hasFilings: false,
        filings: [],
        companies: [],
        source: "SEC EDGAR",
        timestamp: new Date(),
      }
    }

    // Parse filings
    const filings: SecVerificationResult["filings"] = []
    const companies = new Set<string>()

    for (const hit of data.hits.hits?.slice(0, 10) || []) {
      const source = hit._source || {}
      const company = source.display_names?.[0] || source.company || "Unknown"
      companies.add(company)

      filings.push({
        company,
        cik: source.ciks?.[0] || "",
        formType: source.form || "",
        filingDate: source.file_date || "",
        accessionNumber: source.adsh || "",
      })
    }

    return {
      verified: true,
      hasFilings: filings.length > 0,
      filings,
      companies: Array.from(companies),
      source: "SEC EDGAR",
      timestamp: new Date(),
    }
  } catch (error) {
    console.error("[SEC] Verification failed:", error)
    return null
  }
}

/**
 * Search SEC for company proxy statements (DEF 14A) to find board members
 */
export async function searchSecProxy(companyName: string): Promise<{
  found: boolean
  proxyFilings: Array<{
    company: string
    cik: string
    filingDate: string
    url: string
  }>
}> {
  try {
    const response = await fetch(
      `${SEC_EDGAR_BASE}?q=${encodeURIComponent(`"${companyName}"`)}&dateRange=custom&startdt=2020-01-01&forms=DEF%2014A&returnCounts=true`,
      {
        headers: {
          "User-Agent": "Romy Prospect Research/1.0 (support@greenflux.com)",
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      return { found: false, proxyFilings: [] }
    }

    const data = await response.json()

    if (!data.hits || data.hits.total === 0) {
      return { found: false, proxyFilings: [] }
    }

    const proxyFilings = (data.hits.hits || []).slice(0, 5).map((hit: any) => {
      const source = hit._source || {}
      return {
        company: source.display_names?.[0] || source.company || companyName,
        cik: source.ciks?.[0] || "",
        filingDate: source.file_date || "",
        url: source.file_url || `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${source.ciks?.[0]}&type=DEF%2014A`,
      }
    })

    return {
      found: proxyFilings.length > 0,
      proxyFilings,
    }
  } catch (error) {
    console.error("[SEC] Proxy search failed:", error)
    return { found: false, proxyFilings: [] }
  }
}
