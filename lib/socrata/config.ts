/**
 * Socrata Open Data API Configuration
 * FREE public data APIs for county property assessor records
 *
 * Socrata SODA (Socrata Open Data API) is completely FREE:
 * - No API key required for basic queries
 * - Optional app token for higher rate limits (1000 vs 60 req/hour)
 * - Docs: https://dev.socrata.com/
 *
 * Each county has its own Socrata portal with different dataset IDs.
 * This config maps counties to their property data endpoints.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Optional Socrata App Token for higher rate limits
 * Without token: 60 requests/hour per IP
 * With token: 1000 requests/hour
 * Get one free at: https://dev.socrata.com/register
 */
export function getSocrataAppToken(): string | undefined {
  return process.env.SOCRATA_APP_TOKEN
}

/**
 * Check if Socrata is available (always true - free API)
 */
export function isSocrataEnabled(): boolean {
  return true
}

/**
 * Default configuration for Socrata requests
 */
export const SOCRATA_DEFAULTS = {
  limit: 25,
  timeoutMs: 30000,
} as const

// ============================================================================
// COUNTY DATA SOURCES
// ============================================================================

/**
 * County property assessor Socrata endpoints
 * Each county has different dataset IDs and field names
 */
export interface CountyDataSource {
  name: string
  state: string
  portal: string // Base URL for Socrata portal
  datasetId: string // The resource ID for property data
  fields: {
    parcelId?: string
    ownerName?: string
    address?: string
    city?: string
    zip?: string
    assessedValue?: string
    marketValue?: string
    landValue?: string
    improvementValue?: string
    acreage?: string
    lastSaleDate?: string
    lastSalePrice?: string
    yearBuilt?: string
    bedrooms?: string
    bathrooms?: string
    sqft?: string
    propertyType?: string
  }
  // Optional alternative datasets (e.g., sales data separate from assessments)
  salesDatasetId?: string
}

/**
 * Supported county Socrata endpoints
 * Priority: Most populous counties with reliable Socrata APIs
 */
export const COUNTY_DATA_SOURCES: Record<string, CountyDataSource> = {
  // =========================================================================
  // FLORIDA
  // =========================================================================

  // St. Johns County, FL - From Layland example
  "st-johns-fl": {
    name: "St. Johns County",
    state: "FL",
    portal: "https://data.sjcfl.us",
    datasetId: "t5gq-xrdh", // Property Appraiser data
    fields: {
      parcelId: "parcel_id",
      ownerName: "owner_name",
      address: "situs_address",
      city: "situs_city",
      zip: "situs_zip",
      assessedValue: "assessed_value",
      marketValue: "just_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      acreage: "acres",
      lastSaleDate: "sale_date",
      lastSalePrice: "sale_price",
    },
  },

  // Miami-Dade County, FL
  "miami-dade-fl": {
    name: "Miami-Dade County",
    state: "FL",
    portal: "https://opendata.miamidade.gov",
    datasetId: "uf4t-2xc8", // Property data
    fields: {
      parcelId: "folio",
      ownerName: "owner1",
      address: "addr1",
      city: "city",
      zip: "zip",
      assessedValue: "assessed_val",
      marketValue: "just_val",
      landValue: "land_val",
      improvementValue: "bldg_val",
      yearBuilt: "yr_built",
      bedrooms: "bedrooms",
      bathrooms: "baths",
      sqft: "adj_sqft",
    },
  },

  // Hillsborough County, FL (Tampa area)
  "hillsborough-fl": {
    name: "Hillsborough County",
    state: "FL",
    portal: "https://data.hcpafl.org",
    datasetId: "9fxv-t3y4", // Property data
    fields: {
      parcelId: "folio",
      ownerName: "owner_name_1",
      address: "situs_address",
      city: "situs_city",
      zip: "situs_zip",
      assessedValue: "assessed_value",
      marketValue: "just_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "year_built",
      sqft: "living_area",
    },
  },

  // =========================================================================
  // CALIFORNIA
  // =========================================================================

  // Los Angeles County, CA
  "los-angeles-ca": {
    name: "Los Angeles County",
    state: "CA",
    portal: "https://data.lacounty.gov",
    datasetId: "9trm-uz8i", // Assessor parcels
    fields: {
      parcelId: "ain",
      ownerName: "owner_name",
      address: "situs_street",
      city: "situs_city",
      zip: "situs_zip",
      assessedValue: "net_taxable_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "year_built",
      sqft: "sqft",
      propertyType: "property_type",
    },
  },

  // San Francisco County, CA
  "san-francisco-ca": {
    name: "San Francisco County",
    state: "CA",
    portal: "https://data.sfgov.org",
    datasetId: "wv5m-vpq2", // Assessor-Recorder data
    fields: {
      parcelId: "block_lot",
      ownerName: "property_owner",
      address: "property_address",
      assessedValue: "assessed_land_value",
      landValue: "assessed_land_value",
      improvementValue: "assessed_improvement_value",
      propertyType: "property_class_code",
    },
  },

  // =========================================================================
  // ILLINOIS
  // =========================================================================

  // Cook County, IL (Chicago area)
  "cook-il": {
    name: "Cook County",
    state: "IL",
    portal: "https://datacatalog.cookcountyil.gov",
    datasetId: "bcnq-qi2z", // Assessor data
    fields: {
      parcelId: "pin",
      address: "addr",
      city: "city",
      zip: "zip",
      assessedValue: "av_clerk_certified",
      marketValue: "full_market_value",
      landValue: "land_av",
      improvementValue: "bldg_av",
      acreage: "land_sq_ft",
      yearBuilt: "year_built",
      bedrooms: "bedrooms",
      bathrooms: "full_baths",
      sqft: "bldg_sq_ft",
      propertyType: "class",
    },
  },

  // =========================================================================
  // TEXAS
  // =========================================================================

  // Harris County, TX (Houston area)
  "harris-tx": {
    name: "Harris County",
    state: "TX",
    portal: "https://data.hcad.org", // HCAD has their own portal
    datasetId: "real_acct", // May need to use HCAD's own API
    fields: {
      parcelId: "account",
      ownerName: "owner_name",
      address: "site_addr",
      city: "site_city",
      zip: "site_zip",
      assessedValue: "appraised_value",
      marketValue: "market_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      acreage: "acres",
      yearBuilt: "yr_impr",
      sqft: "bld_ar",
    },
  },

  // =========================================================================
  // ARIZONA
  // =========================================================================

  // Maricopa County, AZ (Phoenix area)
  "maricopa-az": {
    name: "Maricopa County",
    state: "AZ",
    portal: "https://data.maricopa.gov",
    datasetId: "vn4d-3jnv", // Assessor property data
    fields: {
      parcelId: "parcel_number",
      ownerName: "owner_name",
      address: "situs_address",
      city: "situs_city",
      zip: "situs_zip",
      assessedValue: "full_cash_value",
      marketValue: "full_cash_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "year_built",
      sqft: "living_area",
      propertyType: "property_type",
    },
  },

  // =========================================================================
  // WASHINGTON
  // =========================================================================

  // King County, WA (Seattle area)
  "king-wa": {
    name: "King County",
    state: "WA",
    portal: "https://data.kingcounty.gov",
    datasetId: "hxpa-77qe", // Parcel data
    fields: {
      parcelId: "pin",
      address: "situsaddress",
      city: "situscity",
      zip: "situszip",
      assessedValue: "apprtotvalue",
      landValue: "apprlandvalue",
      improvementValue: "apprimpsvalue",
      acreage: "sqftlot",
      yearBuilt: "yrblt",
      sqft: "sqfttotliving",
      bedrooms: "bedrooms",
      bathrooms: "bathfullcount",
    },
  },

  // =========================================================================
  // NEW YORK
  // =========================================================================

  // NYC (all 5 boroughs) - DOF Property data
  "new-york-city-ny": {
    name: "New York City",
    state: "NY",
    portal: "https://data.cityofnewyork.us",
    datasetId: "8y4t-faws", // Property valuation and assessment data
    fields: {
      parcelId: "bbl",
      ownerName: "owner",
      address: "address",
      zip: "zip_code",
      assessedValue: "fullval",
      marketValue: "fullval",
      landValue: "avland",
      improvementValue: "avtot",
      yearBuilt: "year_built",
      sqft: "gross_sqft",
      propertyType: "bldgclass",
    },
  },

  // =========================================================================
  // ADDITIONAL CALIFORNIA COUNTIES
  // =========================================================================

  // San Diego County, CA
  "san-diego-ca": {
    name: "San Diego County",
    state: "CA",
    portal: "https://data.sandiego.gov",
    datasetId: "jg8h-p8wd", // Property data
    fields: {
      parcelId: "apn",
      ownerName: "owner_name",
      address: "situs_address",
      city: "situs_city",
      zip: "situs_zip",
      assessedValue: "assessed_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "year_built",
      sqft: "living_area",
    },
  },

  // Orange County, CA
  "orange-ca": {
    name: "Orange County",
    state: "CA",
    portal: "https://data.ocgov.com",
    datasetId: "property-assessment",
    fields: {
      parcelId: "apn",
      ownerName: "owner",
      address: "situs",
      assessedValue: "total_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
    },
  },

  // Alameda County, CA (Oakland, Berkeley)
  "alameda-ca": {
    name: "Alameda County",
    state: "CA",
    portal: "https://data.acgov.org",
    datasetId: "n4s9-hmzv",
    fields: {
      parcelId: "parcel_number",
      ownerName: "owner",
      address: "situs_address",
      assessedValue: "total_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
    },
  },

  // Santa Clara County, CA (San Jose, Silicon Valley)
  "santa-clara-ca": {
    name: "Santa Clara County",
    state: "CA",
    portal: "https://data.sccgov.org",
    datasetId: "property-data",
    fields: {
      parcelId: "apn",
      ownerName: "owner_name",
      address: "situs_address",
      city: "situs_city",
      assessedValue: "assessed_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "year_built",
    },
  },

  // =========================================================================
  // ADDITIONAL FLORIDA COUNTIES
  // =========================================================================

  // Broward County, FL (Fort Lauderdale)
  "broward-fl": {
    name: "Broward County",
    state: "FL",
    portal: "https://data.broward.gov",
    datasetId: "property-appraiser",
    fields: {
      parcelId: "folio",
      ownerName: "owner_name",
      address: "situs_address",
      city: "situs_city",
      zip: "situs_zip",
      assessedValue: "assessed_value",
      marketValue: "just_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "year_built",
      sqft: "living_area",
    },
  },

  // Palm Beach County, FL
  "palm-beach-fl": {
    name: "Palm Beach County",
    state: "FL",
    portal: "https://data.pbcgov.com",
    datasetId: "property-data",
    fields: {
      parcelId: "pcn",
      ownerName: "owner",
      address: "situs",
      assessedValue: "assessed_val",
      marketValue: "market_val",
      landValue: "land_val",
      improvementValue: "bldg_val",
      yearBuilt: "yr_built",
    },
  },

  // Orange County, FL (Orlando)
  "orange-fl": {
    name: "Orange County",
    state: "FL",
    portal: "https://data.ocfl.net",
    datasetId: "property-appraiser",
    fields: {
      parcelId: "parcel_id",
      ownerName: "owner_name",
      address: "situs_address",
      city: "situs_city",
      assessedValue: "assessed_value",
      marketValue: "just_value",
      yearBuilt: "year_built",
    },
  },

  // Duval County, FL (Jacksonville)
  "duval-fl": {
    name: "Duval County",
    state: "FL",
    portal: "https://data.coj.net",
    datasetId: "property-data",
    fields: {
      parcelId: "re_no",
      ownerName: "owner",
      address: "location",
      assessedValue: "assessed",
      marketValue: "just_value",
    },
  },

  // =========================================================================
  // ADDITIONAL TEXAS COUNTIES
  // =========================================================================

  // Dallas County, TX
  "dallas-tx": {
    name: "Dallas County",
    state: "TX",
    portal: "https://data.dallasopendata.com",
    datasetId: "property-records",
    fields: {
      parcelId: "account_num",
      ownerName: "owner_name",
      address: "situs_address",
      city: "situs_city",
      zip: "situs_zip",
      assessedValue: "appraised_value",
      marketValue: "market_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
    },
  },

  // Travis County, TX (Austin)
  "travis-tx": {
    name: "Travis County",
    state: "TX",
    portal: "https://data.austintexas.gov",
    datasetId: "nrgt-7e3p",
    fields: {
      parcelId: "prop_id",
      ownerName: "owner",
      address: "address",
      assessedValue: "appraised_value",
      marketValue: "market_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "yr_built",
    },
  },

  // Bexar County, TX (San Antonio)
  "bexar-tx": {
    name: "Bexar County",
    state: "TX",
    portal: "https://data.sanantonio.gov",
    datasetId: "property-data",
    fields: {
      parcelId: "prop_id",
      ownerName: "owner_name",
      address: "situs_address",
      assessedValue: "appraised_val",
      marketValue: "market_value",
      landValue: "land_value",
      improvementValue: "impr_value",
    },
  },

  // =========================================================================
  // COLORADO
  // =========================================================================

  // Denver County, CO
  "denver-co": {
    name: "Denver County",
    state: "CO",
    portal: "https://data.denvergov.org",
    datasetId: "4fgn-9rn3",
    fields: {
      parcelId: "schednum",
      ownerName: "owner_name",
      address: "address",
      assessedValue: "actual_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "year_built",
      sqft: "total_sqft",
    },
  },

  // =========================================================================
  // MASSACHUSETTS
  // =========================================================================

  // Boston / Suffolk County, MA
  "boston-ma": {
    name: "Boston",
    state: "MA",
    portal: "https://data.boston.gov",
    datasetId: "g5b5-xrwi", // Property Assessment
    fields: {
      parcelId: "pid",
      ownerName: "owner",
      address: "st_num",
      zip: "zipcode",
      assessedValue: "total_value",
      landValue: "land_value",
      improvementValue: "building_value",
      yearBuilt: "yr_built",
      sqft: "living_area",
      bedrooms: "bed_rms",
      bathrooms: "full_bth",
    },
  },

  // =========================================================================
  // PENNSYLVANIA
  // =========================================================================

  // Philadelphia County, PA
  "philadelphia-pa": {
    name: "Philadelphia",
    state: "PA",
    portal: "https://opendataphilly.org",
    datasetId: "real-estate-transfers",
    fields: {
      parcelId: "opa_number",
      ownerName: "grantors",
      address: "street_address",
      zip: "zip_code",
      assessedValue: "total_assessment",
      lastSaleDate: "document_date",
      lastSalePrice: "sale_price",
    },
  },

  // Allegheny County, PA (Pittsburgh)
  "allegheny-pa": {
    name: "Allegheny County",
    state: "PA",
    portal: "https://data.wprdc.org",
    datasetId: "f2b8-mu4j",
    fields: {
      parcelId: "parid",
      ownerName: "owner1",
      address: "propertyhousenum",
      city: "propertycity",
      zip: "propertyzip",
      assessedValue: "countyassessedvalue",
      marketValue: "fairmarketvalue",
      yearBuilt: "yearblt",
      sqft: "finishedlivingarea",
      bedrooms: "bedrooms",
      bathrooms: "fullbaths",
    },
  },

  // =========================================================================
  // MARYLAND/DC AREA
  // =========================================================================

  // Montgomery County, MD
  "montgomery-md": {
    name: "Montgomery County",
    state: "MD",
    portal: "https://data.montgomerycountymd.gov",
    datasetId: "real-property",
    fields: {
      parcelId: "acct_id",
      ownerName: "owner_name",
      address: "premise_address",
      city: "city",
      zip: "zip",
      assessedValue: "assessed_value",
      landValue: "land_assessed",
      improvementValue: "improvement_assessed",
    },
  },

  // =========================================================================
  // VIRGINIA
  // =========================================================================

  // Fairfax County, VA
  "fairfax-va": {
    name: "Fairfax County",
    state: "VA",
    portal: "https://data.fairfaxcounty.gov",
    datasetId: "real-estate-assessments",
    fields: {
      parcelId: "parcel_id",
      ownerName: "owner_name",
      address: "situs",
      assessedValue: "total_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
      yearBuilt: "year_built",
    },
  },

  // =========================================================================
  // OREGON
  // =========================================================================

  // Multnomah County, OR (Portland)
  "multnomah-or": {
    name: "Multnomah County",
    state: "OR",
    portal: "https://data.portlandoregon.gov",
    datasetId: "property-data",
    fields: {
      parcelId: "propertyid",
      ownerName: "owner",
      address: "situs_address",
      assessedValue: "total_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
    },
  },

  // =========================================================================
  // MINNESOTA
  // =========================================================================

  // Hennepin County, MN (Minneapolis)
  "hennepin-mn": {
    name: "Hennepin County",
    state: "MN",
    portal: "https://opendata.minneapolismn.gov",
    datasetId: "property-data",
    fields: {
      parcelId: "pid",
      ownerName: "owner_name",
      address: "address",
      assessedValue: "est_mkt_value",
      landValue: "land_value",
      improvementValue: "building_value",
      yearBuilt: "year_built",
    },
  },

  // =========================================================================
  // OHIO
  // =========================================================================

  // Cuyahoga County, OH (Cleveland)
  "cuyahoga-oh": {
    name: "Cuyahoga County",
    state: "OH",
    portal: "https://data.cuyahogacounty.gov",
    datasetId: "property-data",
    fields: {
      parcelId: "parcel_number",
      ownerName: "owner",
      address: "situs_address",
      city: "situs_city",
      assessedValue: "total_value",
      landValue: "land_value",
      improvementValue: "building_value",
      yearBuilt: "year_built",
    },
  },

  // Franklin County, OH (Columbus)
  "franklin-oh": {
    name: "Franklin County",
    state: "OH",
    portal: "https://data.franklincountyoh.gov",
    datasetId: "property-data",
    fields: {
      parcelId: "parcel",
      ownerName: "owner_name",
      address: "address",
      assessedValue: "appraised_value",
      marketValue: "market_value",
      yearBuilt: "year_built",
    },
  },

  // =========================================================================
  // MICHIGAN
  // =========================================================================

  // Wayne County, MI (Detroit)
  "wayne-mi": {
    name: "Wayne County",
    state: "MI",
    portal: "https://data.detroitmi.gov",
    datasetId: "property-data",
    fields: {
      parcelId: "parcel_id",
      ownerName: "taxpayer",
      address: "address",
      assessedValue: "taxable_value",
      marketValue: "assessed_value",
    },
  },

  // =========================================================================
  // GEORGIA
  // =========================================================================

  // Fulton County, GA (Atlanta)
  "fulton-ga": {
    name: "Fulton County",
    state: "GA",
    portal: "https://data.fultoncountyga.gov",
    datasetId: "property-data",
    fields: {
      parcelId: "parcel_id",
      ownerName: "owner_name",
      address: "situs_address",
      assessedValue: "assessed_value",
      marketValue: "fair_market_value",
      landValue: "land_value",
      improvementValue: "improvement_value",
    },
  },

  // =========================================================================
  // NORTH CAROLINA
  // =========================================================================

  // Mecklenburg County, NC (Charlotte)
  "mecklenburg-nc": {
    name: "Mecklenburg County",
    state: "NC",
    portal: "https://data.charlottenc.gov",
    datasetId: "property-data",
    fields: {
      parcelId: "pid",
      ownerName: "owner",
      address: "situs_address",
      assessedValue: "total_value",
      landValue: "land_value",
      improvementValue: "building_value",
      yearBuilt: "year_built",
    },
  },

  // Wake County, NC (Raleigh)
  "wake-nc": {
    name: "Wake County",
    state: "NC",
    portal: "https://data.wakegov.com",
    datasetId: "property-data",
    fields: {
      parcelId: "reid",
      ownerName: "owner",
      address: "situs_address",
      assessedValue: "total_value",
      landValue: "land_value",
      improvementValue: "building_value",
    },
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find matching county data source by county name and state
 */
export function findCountyDataSource(
  county: string,
  state: string
): CountyDataSource | null {
  const normalizedCounty = county.toLowerCase().replace(/\s+county$/i, "").trim()
  const normalizedState = state.toUpperCase()

  // Try direct match first
  const directKey = `${normalizedCounty.replace(/\s+/g, "-")}-${normalizedState.toLowerCase()}`
  if (COUNTY_DATA_SOURCES[directKey]) {
    return COUNTY_DATA_SOURCES[directKey]
  }

  // Search through all sources
  for (const source of Object.values(COUNTY_DATA_SOURCES)) {
    const sourceName = source.name.toLowerCase().replace(/\s+county$/i, "").trim()
    if (sourceName === normalizedCounty && source.state === normalizedState) {
      return source
    }
  }

  return null
}

/**
 * Get all supported counties
 */
export function getSupportedCounties(): Array<{ name: string; state: string }> {
  return Object.values(COUNTY_DATA_SOURCES).map((source) => ({
    name: source.name,
    state: source.state,
  }))
}

/**
 * Check if a county is supported
 */
export function isCountySupported(county: string, state: string): boolean {
  return findCountyDataSource(county, state) !== null
}
