/**
 * Redfin Unofficial API Client (TypeScript Port)
 *
 * Ported from: https://github.com/reteps/redfin
 * This is an unofficial wrapper around Redfin's internal API endpoints.
 *
 * IMPORTANT: This uses Redfin's internal API which is not officially supported.
 * Use responsibly and respect rate limits. Redfin may block IPs with excessive requests.
 *
 * Key endpoints for property valuation:
 * - search() - Find property by address
 * - initial_info() - Get property ID and listing ID
 * - avm_details() - Get Redfin's automated valuation (estimate)
 * - below_the_fold() - Get detailed property info including MLS data
 * - property_parcel() - Get parcel/tax assessment info
 */

const REDFIN_BASE_URL = "https://redfin.com/stingray/"
const REDFIN_USER_AGENT = "redfin"
const REQUEST_TIMEOUT_MS = 15000

// ============================================================================
// Types
// ============================================================================

export interface RedfinSearchResult {
  payload?: {
    sections?: Array<{
      rows?: Array<{
        id?: string
        type?: number
        name?: string
        subName?: string
        url?: string
        active?: boolean
      }>
    }>
  }
  errorMessage?: string
}

export interface RedfinInitialInfo {
  payload?: {
    propertyId?: number
    listingId?: number | string
    addressSectionInfo?: {
      streetAddress?: {
        assembledAddress?: string
      }
      city?: string
      state?: string
      zip?: string
      countryCode?: string
    }
    publicRecordsInfo?: {
      basicInfo?: {
        beds?: number
        baths?: number
        sqFt?: { value?: number }
        lotSize?: { value?: number }
        yearBuilt?: number
        propertyType?: number
        propertyTypeName?: string
      }
      taxInfo?: {
        taxableLandValue?: number
        taxableImprovementValue?: number
        rollYear?: number
        taxesDue?: number
      }
    }
  }
  errorMessage?: string
}

export interface RedfinAVMDetails {
  payload?: {
    predictedValue?: number
    predictedValueLow?: number
    predictedValueHigh?: number
    lastUpdated?: string
    isServiced?: boolean
    comparables?: Array<{
      propertyId?: number
      listingId?: number
      price?: { value?: number }
      beds?: number
      baths?: number
      sqFt?: { value?: number }
      yearBuilt?: number
      soldDate?: number
      distance?: number
      url?: string
      streetAddress?: { assembledAddress?: string }
    }>
  }
  errorMessage?: string
}

export interface RedfinBelowTheFold {
  payload?: {
    amenitiesInfo?: {
      superGroups?: Array<{
        types?: string[]
        amenityGroups?: Array<{
          groupTitle?: string
          amenityEntries?: Array<{
            amenityName?: string
            amenityValues?: string[]
          }>
        }>
      }>
    }
    publicRecordsInfo?: {
      basicInfo?: {
        beds?: number
        baths?: number
        sqFt?: { value?: number }
        lotSize?: { value?: number }
        yearBuilt?: number
      }
      taxInfo?: {
        taxableLandValue?: number
        taxableImprovementValue?: number
        rollYear?: number
        taxesDue?: number
      }
      countyName?: string
      apn?: string // Assessor Parcel Number
    }
    propertyHistoryInfo?: {
      events?: Array<{
        eventDate?: number
        price?: { value?: number }
        eventDescription?: string
        source?: string
      }>
    }
  }
  errorMessage?: string
}

export interface RedfinPropertyParcel {
  payload?: {
    parcelInfo?: {
      apn?: string
      countyName?: string
      taxInfo?: {
        taxableLandValue?: number
        taxableImprovementValue?: number
        assessedValue?: number
        marketValue?: number
        taxRate?: number
        annualTax?: number
        rollYear?: number
      }
    }
  }
  errorMessage?: string
}

export interface RedfinOwnerEstimate {
  payload?: {
    estimate?: number
    estimateLow?: number
    estimateHigh?: number
    lastUpdated?: string
  }
  errorMessage?: string
}

// Simplified property data for valuation
export interface RedfinPropertyData {
  propertyId: number
  listingId: number | string
  address: string
  city?: string
  state?: string
  zip?: string
  beds?: number
  baths?: number
  sqft?: number
  lotSize?: number
  yearBuilt?: number
  propertyType?: string
  // Redfin estimate (their AVM)
  redfinEstimate?: number
  redfinEstimateLow?: number
  redfinEstimateHigh?: number
  // Tax/Assessment data (COUNTY DATA!)
  assessedValue?: number
  taxableLandValue?: number
  taxableImprovementValue?: number
  marketValue?: number
  annualTax?: number
  taxYear?: number
  countyName?: string
  apn?: string
  // Sales history
  lastSalePrice?: number
  lastSaleDate?: Date
  // Comparables from Redfin
  comparables?: Array<{
    address?: string
    price?: number
    beds?: number
    baths?: number
    sqft?: number
    yearBuilt?: number
    soldDate?: Date
    distance?: number
  }>
  // Source URL
  sourceUrl?: string
}

// ============================================================================
// Redfin Client
// ============================================================================

export class RedfinClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor() {
    this.baseUrl = REDFIN_BASE_URL
    this.headers = {
      "User-Agent": REDFIN_USER_AGENT,
      Accept: "application/json",
    }
  }

  /**
   * Make a request to Redfin API
   * Redfin responses start with ")]}'" which needs to be stripped
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean>
  ): Promise<T | null> {
    const url = new URL(this.baseUrl + endpoint)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`[Redfin] HTTP ${response.status} for ${endpoint}`)
        return null
      }

      const text = await response.text()

      // Redfin prepends ")]}'" to their JSON responses
      const jsonText = text.startsWith(")]}") ? text.slice(4) : text

      return JSON.parse(jsonText) as T
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error(`[Redfin] Request timeout for ${endpoint}`)
      } else {
        console.error(`[Redfin] Request failed for ${endpoint}:`, error)
      }
      return null
    }
  }

  /**
   * Property detail request helper
   */
  private async propertyRequest<T>(
    endpoint: string,
    params: Record<string, string | number | boolean>,
    page: boolean = false
  ): Promise<T | null> {
    const fullParams = {
      accessLevel: 1,
      ...params,
      ...(page ? { pageType: 3 } : {}),
    }
    return this.request<T>(`api/home/details/${endpoint}`, fullParams)
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Search for a property by address
   * Returns URL path to use with other methods
   */
  async search(query: string): Promise<RedfinSearchResult | null> {
    return this.request<RedfinSearchResult>("do/location-autocomplete", {
      location: query,
      v: 2,
    })
  }

  /**
   * Get initial property info including propertyId and listingId
   * @param urlPath - The URL path from search results (e.g., "/CA/San-Francisco/123-Main-St-94102/home/12345678")
   */
  async initialInfo(urlPath: string): Promise<RedfinInitialInfo | null> {
    return this.request<RedfinInitialInfo>("api/home/details/initialInfo", {
      path: urlPath,
    })
  }

  /**
   * Get Redfin's AVM (Automated Valuation Model) details
   * This is the Redfin Estimate!
   */
  async avmDetails(
    propertyId: number,
    listingId: number | string
  ): Promise<RedfinAVMDetails | null> {
    return this.propertyRequest<RedfinAVMDetails>("avm", {
      propertyId,
      listingId,
    })
  }

  /**
   * Get detailed property info including MLS data, tax info, history
   * Contains county assessment data!
   */
  async belowTheFold(propertyId: number): Promise<RedfinBelowTheFold | null> {
    return this.propertyRequest<RedfinBelowTheFold>(
      "belowTheFold",
      { propertyId },
      true
    )
  }

  /**
   * Get parcel/tax assessment information
   * Contains county tax assessment data!
   */
  async propertyParcel(
    propertyId: number,
    listingId: number | string
  ): Promise<RedfinPropertyParcel | null> {
    return this.propertyRequest<RedfinPropertyParcel>(
      "propertyParcelInfo",
      { propertyId, listingId },
      true
    )
  }

  /**
   * Get owner's estimate (if claimed home)
   */
  async ownerEstimate(propertyId: number): Promise<RedfinOwnerEstimate | null> {
    return this.request<RedfinOwnerEstimate>("api/home/details/owner-estimate", {
      propertyId,
    })
  }

  /**
   * Get similar sold properties (comparables)
   */
  async similarSold(
    propertyId: number,
    listingId: number | string
  ): Promise<RedfinAVMDetails | null> {
    return this.propertyRequest<RedfinAVMDetails>("similars/solds", {
      propertyId,
      listingId,
    })
  }

  // ==========================================================================
  // High-Level Helper Methods
  // ==========================================================================

  /**
   * Get complete property data for valuation
   * This is the main method to use for AVM
   */
  async getPropertyData(address: string): Promise<RedfinPropertyData | null> {
    console.log(`[Redfin] Looking up property: ${address}`)

    // Step 1: Search for the property
    const searchResult = await this.search(address)
    if (!searchResult?.payload?.sections?.[0]?.rows?.[0]) {
      console.log("[Redfin] Property not found in search")
      return null
    }

    const firstResult = searchResult.payload.sections[0].rows[0]
    const propertyUrl = firstResult.url
    if (!propertyUrl) {
      console.log("[Redfin] No URL in search result")
      return null
    }

    console.log(`[Redfin] Found property URL: ${propertyUrl}`)

    // Step 2: Get initial info (propertyId, listingId)
    const initialInfo = await this.initialInfo(propertyUrl)
    if (!initialInfo?.payload?.propertyId) {
      console.log("[Redfin] Could not get property ID")
      return null
    }

    const propertyId = initialInfo.payload.propertyId
    const listingId = initialInfo.payload.listingId || 0
    console.log(`[Redfin] Property ID: ${propertyId}, Listing ID: ${listingId}`)

    // Step 3: Get detailed info (parallel requests)
    const [avmResult, belowFoldResult, parcelResult] = await Promise.all([
      this.avmDetails(propertyId, listingId),
      this.belowTheFold(propertyId),
      this.propertyParcel(propertyId, listingId),
    ])

    // Build property data
    const addressInfo = initialInfo.payload.addressSectionInfo
    const publicRecords = initialInfo.payload.publicRecordsInfo?.basicInfo
    const taxInfo =
      parcelResult?.payload?.parcelInfo?.taxInfo ||
      belowFoldResult?.payload?.publicRecordsInfo?.taxInfo ||
      initialInfo.payload.publicRecordsInfo?.taxInfo

    const propertyData: RedfinPropertyData = {
      propertyId,
      listingId,
      address: addressInfo?.streetAddress?.assembledAddress || address,
      city: addressInfo?.city,
      state: addressInfo?.state,
      zip: addressInfo?.zip,
      beds: publicRecords?.beds,
      baths: publicRecords?.baths,
      sqft: publicRecords?.sqFt?.value,
      lotSize: publicRecords?.lotSize?.value,
      yearBuilt: publicRecords?.yearBuilt,
      propertyType: publicRecords?.propertyTypeName,
      sourceUrl: `https://www.redfin.com${propertyUrl}`,
    }

    // Add Redfin estimate (AVM)
    if (avmResult?.payload) {
      propertyData.redfinEstimate = avmResult.payload.predictedValue
      propertyData.redfinEstimateLow = avmResult.payload.predictedValueLow
      propertyData.redfinEstimateHigh = avmResult.payload.predictedValueHigh

      // Add comparables
      if (avmResult.payload.comparables) {
        propertyData.comparables = avmResult.payload.comparables.map((comp) => ({
          address: comp.streetAddress?.assembledAddress,
          price: comp.price?.value,
          beds: comp.beds,
          baths: comp.baths,
          sqft: comp.sqFt?.value,
          yearBuilt: comp.yearBuilt,
          soldDate: comp.soldDate ? new Date(comp.soldDate) : undefined,
          distance: comp.distance,
        }))
      }
    }

    // Add tax/assessment data (COUNTY DATA!)
    // Cast to any to handle union type with different properties from different endpoints
    if (taxInfo) {
      const tax = taxInfo as {
        assessedValue?: number
        taxableLandValue?: number
        taxableImprovementValue?: number
        marketValue?: number
        annualTax?: number
        taxesDue?: number
        rollYear?: number
      }
      propertyData.assessedValue =
        tax.assessedValue ||
        (tax.taxableLandValue || 0) + (tax.taxableImprovementValue || 0)
      propertyData.taxableLandValue = tax.taxableLandValue
      propertyData.taxableImprovementValue = tax.taxableImprovementValue
      propertyData.marketValue = tax.marketValue
      propertyData.annualTax = tax.annualTax || tax.taxesDue
      propertyData.taxYear = tax.rollYear
    }

    // Add county info
    if (parcelResult?.payload?.parcelInfo) {
      propertyData.countyName = parcelResult.payload.parcelInfo.countyName
      propertyData.apn = parcelResult.payload.parcelInfo.apn
    } else if (belowFoldResult?.payload?.publicRecordsInfo) {
      propertyData.countyName = belowFoldResult.payload.publicRecordsInfo.countyName
      propertyData.apn = belowFoldResult.payload.publicRecordsInfo.apn
    }

    // Add last sale from history
    if (belowFoldResult?.payload?.propertyHistoryInfo?.events) {
      const saleEvent = belowFoldResult.payload.propertyHistoryInfo.events.find(
        (e) =>
          e.eventDescription?.toLowerCase().includes("sold") && e.price?.value
      )
      if (saleEvent) {
        propertyData.lastSalePrice = saleEvent.price?.value
        propertyData.lastSaleDate = saleEvent.eventDate
          ? new Date(saleEvent.eventDate)
          : undefined
      }
    }

    console.log("[Redfin] Property data retrieved:", {
      address: propertyData.address,
      redfinEstimate: propertyData.redfinEstimate,
      assessedValue: propertyData.assessedValue,
      sqft: propertyData.sqft,
      beds: propertyData.beds,
      baths: propertyData.baths,
      comparables: propertyData.comparables?.length || 0,
    })

    return propertyData
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let redfinClientInstance: RedfinClient | null = null

export function getRedfinClient(): RedfinClient {
  if (!redfinClientInstance) {
    redfinClientInstance = new RedfinClient()
  }
  return redfinClientInstance
}

/**
 * Check if Redfin client is available
 * Always returns true since it doesn't require API key
 */
export function isRedfinEnabled(): boolean {
  return true
}
