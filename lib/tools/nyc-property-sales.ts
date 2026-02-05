/**
 * NYC Property Sales Tool
 *
 * Searches NYC Rolling Sales Data for actual property sale prices.
 * This provides REAL transaction data, not estimated values.
 *
 * Data Source: NYC Department of Finance via Socrata
 * Dataset ID: uzf5-f8n2 (Annualized Rolling Sales)
 *
 * Coverage: All NYC property sales since 2003
 * Updates: Monthly (rolling 12-month window, historical data preserved)
 *
 * Use Cases:
 * - Verify actual purchase prices paid by prospects
 * - Compare estimated values to real market transactions
 * - Track property portfolio acquisitions
 *
 * FREE - No API key required
 */

import { tool } from "ai"
import { z } from "zod"
import {
  executeSoQLQuery,
  buildAddressSearchQuery,
  buildNameSearchQuery,
} from "../socrata"
import type { DataSourceConfig } from "../socrata/types"

// ============================================================================
// CONFIGURATION
// ============================================================================

const NYC_SALES_CONFIG: DataSourceConfig = {
  id: "nyc-rolling-sales",
  name: "NYC Rolling Property Sales",
  category: "property_sales",
  state: "NY",
  locality: "New York City",
  portal: "https://data.cityofnewyork.us",
  datasetId: "uzf5-f8n2",
  fields: [
    { source: "borough", normalized: "borough", label: "Borough", type: "string" },
    { source: "neighborhood", normalized: "neighborhood", label: "Neighborhood", type: "string" },
    { source: "building_class_category", normalized: "building_class", label: "Building Class", type: "string" },
    { source: "address", normalized: "address", label: "Address", type: "string" },
    { source: "apartment_number", normalized: "apartment", label: "Apartment", type: "string" },
    { source: "zip_code", normalized: "zip", label: "ZIP Code", type: "string" },
    { source: "residential_units", normalized: "residential_units", label: "Residential Units", type: "number" },
    { source: "commercial_units", normalized: "commercial_units", label: "Commercial Units", type: "number" },
    { source: "total_units", normalized: "total_units", label: "Total Units", type: "number" },
    { source: "land_square_feet", normalized: "land_sqft", label: "Land Sq Ft", type: "number" },
    { source: "gross_square_feet", normalized: "gross_sqft", label: "Gross Sq Ft", type: "number" },
    { source: "year_built", normalized: "year_built", label: "Year Built", type: "number" },
    { source: "sale_price", normalized: "sale_price", label: "Sale Price", type: "currency" },
    { source: "sale_date", normalized: "sale_date", label: "Sale Date", type: "date" },
  ],
  searchFields: ["address", "neighborhood"],
  verified: true,
  lastVerified: "2024-12",
  notes: "Actual NYC property sale transactions since 2003",
}

const BOROUGH_MAP: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
}

// ============================================================================
// TYPES
// ============================================================================

interface NYCSaleRecord {
  borough: string
  neighborhood: string
  building_class_category: string
  address: string
  apartment_number?: string
  zip_code: string
  residential_units?: string
  commercial_units?: string
  total_units?: string
  land_square_feet?: string
  gross_square_feet?: string
  year_built?: string
  sale_price: string
  sale_date: string
}

interface PropertySale {
  address: string
  apartment?: string
  borough: string
  neighborhood: string
  zip: string
  buildingClass: string
  landSqft?: number
  grossSqft?: number
  yearBuilt?: number
  totalUnits?: number
  salePrice: number
  saleDate: string
}

interface NYCPropertySalesResult {
  searchTerm: string
  searchType: "address" | "neighborhood" | "price_range"
  sales: PropertySale[]
  summary: {
    totalFound: number
    totalSalesValue: number
    averageSalePrice: number
    priceRange: { min: number; max: number }
    dateRange: { earliest: string; latest: string }
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""))
  return isNaN(num) ? undefined : num
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

function transformSaleRecord(record: NYCSaleRecord): PropertySale | null {
  const salePrice = parseNumber(record.sale_price)

  // Filter out $0 sales (transfers, etc.) and invalid data
  if (!salePrice || salePrice < 1000) return null

  const borough = BOROUGH_MAP[record.borough] || record.borough

  return {
    address: record.address || "Unknown",
    apartment: record.apartment_number,
    borough,
    neighborhood: record.neighborhood || "Unknown",
    zip: record.zip_code || "",
    buildingClass: record.building_class_category || "Unknown",
    landSqft: parseNumber(record.land_square_feet),
    grossSqft: parseNumber(record.gross_square_feet),
    yearBuilt: parseNumber(record.year_built),
    totalUnits: parseNumber(record.total_units),
    salePrice,
    saleDate: record.sale_date || "Unknown",
  }
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

async function searchByAddress(address: string): Promise<NYCPropertySalesResult> {
  console.log(`[NYCPropertySales] Searching for address: "${address}"`)

  const query = buildAddressSearchQuery("address", address, { limit: 50 })

  // Add order by sale date descending
  query.orderBy = [{ field: "sale_date", direction: "DESC" }]

  const response = await executeSoQLQuery<NYCSaleRecord>(NYC_SALES_CONFIG, query)

  if (response.error) {
    return buildErrorResult(address, "address", response.error)
  }

  return buildSuccessResult(address, "address", response.data, response.sources)
}

async function searchByNeighborhood(neighborhood: string): Promise<NYCPropertySalesResult> {
  console.log(`[NYCPropertySales] Searching for neighborhood: "${neighborhood}"`)

  const query = {
    where: [
      {
        field: "upper(neighborhood)",
        operator: "LIKE" as const,
        value: `%${neighborhood.toUpperCase()}%`,
      },
    ],
    orderBy: [{ field: "sale_date", direction: "DESC" as const }],
    limit: 50,
  }

  const response = await executeSoQLQuery<NYCSaleRecord>(NYC_SALES_CONFIG, query)

  if (response.error) {
    return buildErrorResult(neighborhood, "neighborhood", response.error)
  }

  return buildSuccessResult(neighborhood, "neighborhood", response.data, response.sources)
}

async function searchByPriceRange(
  minPrice: number,
  maxPrice: number
): Promise<NYCPropertySalesResult> {
  console.log(`[NYCPropertySales] Searching for price range: ${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`)

  const query = {
    where: [
      { field: "sale_price", operator: ">=" as const, value: minPrice },
      { field: "sale_price", operator: "<=" as const, value: maxPrice },
    ],
    orderBy: [{ field: "sale_price", direction: "DESC" as const }],
    limit: 50,
  }

  const response = await executeSoQLQuery<NYCSaleRecord>(NYC_SALES_CONFIG, query)

  const searchTerm = `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`

  if (response.error) {
    return buildErrorResult(searchTerm, "price_range", response.error)
  }

  return buildSuccessResult(searchTerm, "price_range", response.data, response.sources)
}

// ============================================================================
// RESULT BUILDERS
// ============================================================================

function buildErrorResult(
  searchTerm: string,
  searchType: "address" | "neighborhood" | "price_range",
  error: string
): NYCPropertySalesResult {
  return {
    searchTerm,
    searchType,
    sales: [],
    summary: {
      totalFound: 0,
      totalSalesValue: 0,
      averageSalePrice: 0,
      priceRange: { min: 0, max: 0 },
      dateRange: { earliest: "", latest: "" },
    },
    rawContent: `## Error\n\nFailed to search NYC property sales: ${error}`,
    sources: [{ name: "NYC Rolling Property Sales", url: "https://data.cityofnewyork.us/d/uzf5-f8n2" }],
    error,
  }
}

function buildSuccessResult(
  searchTerm: string,
  searchType: "address" | "neighborhood" | "price_range",
  records: NYCSaleRecord[],
  sources: Array<{ name: string; url: string }>
): NYCPropertySalesResult {
  // Transform and filter records
  const sales = records
    .map(transformSaleRecord)
    .filter((s): s is PropertySale => s !== null)

  // Calculate summary statistics
  let totalSalesValue = 0
  let minPrice = Infinity
  let maxPrice = 0
  let earliestDate = ""
  let latestDate = ""

  for (const sale of sales) {
    totalSalesValue += sale.salePrice
    if (sale.salePrice < minPrice) minPrice = sale.salePrice
    if (sale.salePrice > maxPrice) maxPrice = sale.salePrice
    if (!earliestDate || sale.saleDate < earliestDate) earliestDate = sale.saleDate
    if (!latestDate || sale.saleDate > latestDate) latestDate = sale.saleDate
  }

  const averageSalePrice = sales.length > 0 ? totalSalesValue / sales.length : 0

  // Build formatted output
  const lines: string[] = []
  lines.push(`# NYC Property Sales Search`)
  lines.push("")
  lines.push(`**Search Term:** ${searchTerm}`)
  lines.push(`**Search Type:** ${searchType.replace(/_/g, " ").toUpperCase()}`)
  lines.push("")

  if (sales.length > 0) {
    lines.push(`## Summary`)
    lines.push("")
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Sales Found | ${sales.length} |`)
    lines.push(`| Total Sales Value | ${formatCurrency(totalSalesValue)} |`)
    lines.push(`| Average Sale Price | ${formatCurrency(averageSalePrice)} |`)
    lines.push(`| Price Range | ${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)} |`)
    lines.push(`| Date Range | ${formatDate(earliestDate)} - ${formatDate(latestDate)} |`)
    lines.push("")
    lines.push(`## Recent Sales`)
    lines.push("")

    for (const sale of sales.slice(0, 10)) {
      lines.push(`### ${sale.address}${sale.apartment ? `, Apt ${sale.apartment}` : ""}`)
      lines.push("")
      lines.push(`| Field | Value |`)
      lines.push(`|-------|-------|`)
      lines.push(`| Sale Price | **${formatCurrency(sale.salePrice)}** |`)
      lines.push(`| Sale Date | ${formatDate(sale.saleDate)} |`)
      lines.push(`| Borough | ${sale.borough} |`)
      lines.push(`| Neighborhood | ${sale.neighborhood} |`)
      if (sale.zip) lines.push(`| ZIP | ${sale.zip} |`)
      lines.push(`| Building Class | ${sale.buildingClass} |`)
      if (sale.grossSqft) lines.push(`| Gross Sq Ft | ${sale.grossSqft.toLocaleString()} |`)
      if (sale.yearBuilt) lines.push(`| Year Built | ${sale.yearBuilt} |`)
      if (sale.totalUnits && sale.totalUnits > 1) lines.push(`| Total Units | ${sale.totalUnits} |`)
      lines.push("")
    }

    if (sales.length > 10) {
      lines.push(`*...and ${sales.length - 10} more sales*`)
    }
  } else {
    lines.push(`## No Results`)
    lines.push("")
    lines.push(`No property sales found matching "${searchTerm}".`)
    lines.push("")
    lines.push(`**Note:** Only sales with prices above $1,000 are included (filters out $0 transfers).`)
  }

  return {
    searchTerm,
    searchType,
    sales,
    summary: {
      totalFound: sales.length,
      totalSalesValue,
      averageSalePrice,
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice,
      },
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
    },
    rawContent: lines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const nycPropertySalesSchema = z.object({
  searchTerm: z.string().describe("Address, neighborhood name, or left empty for price range search"),
  searchType: z
    .enum(["address", "neighborhood", "price_range"])
    .optional()
    .default("address")
    .describe("Search type: 'address' for street address, 'neighborhood' for area, 'price_range' for high-value sales"),
  minPrice: z
    .number()
    .optional()
    .describe("Minimum sale price (only for price_range search)"),
  maxPrice: z
    .number()
    .optional()
    .describe("Maximum sale price (only for price_range search)"),
})

export const nycPropertySalesTool = tool({
  description:
    "Search NYC property sales for ACTUAL transaction prices (not estimates). " +
    "Data from NYC Department of Finance - all sales since 2003. " +
    "Returns: sale price, date, address, building class, square footage. " +
    "WEALTH INDICATOR: High-value property purchases indicate significant net worth. " +
    "$1M+ = affluent, $5M+ = wealthy, $20M+ = ultra-high net worth.",

  inputSchema: nycPropertySalesSchema,

  execute: async ({ searchTerm, searchType, minPrice, maxPrice }): Promise<NYCPropertySalesResult> => {
    if (searchType === "price_range") {
      return searchByPriceRange(minPrice || 1000000, maxPrice || 100000000)
    }

    if (searchType === "neighborhood") {
      return searchByNeighborhood(searchTerm)
    }

    return searchByAddress(searchTerm)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableNYCPropertySalesTool(): boolean {
  return true
}

export { searchByAddress, searchByNeighborhood, searchByPriceRange }
