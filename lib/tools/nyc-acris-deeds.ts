/**
 * NYC ACRIS Property Deeds Tool
 *
 * Searches NYC ACRIS (Automated City Register Information System) for
 * property ownership records, deed transfers, and mortgages.
 *
 * Data Source: NYC Department of Finance via Socrata
 * Datasets:
 * - bnx9-e6tj: Real Property Master (main deed records)
 * - 8h5j-fqxa: Real Property Legals (property descriptions)
 * - pwkr-dpni: Real Property Parties (buyer/seller names)
 *
 * Coverage: All NYC property deeds since 1966
 * Updates: Daily (automated from DOF)
 *
 * Use Cases:
 * - Verify property ownership history
 * - Find properties owned by specific individuals/entities
 * - Track mortgage activity and liens
 *
 * FREE - No API key required
 */

import { tool } from "ai"
import { z } from "zod"
import { executeSoQLQuery, buildNameSearchQuery } from "../socrata"
import type { DataSourceConfig, SoQLQuery } from "../socrata/types"

// ============================================================================
// CONFIGURATION
// ============================================================================

const ACRIS_PARTIES_CONFIG: DataSourceConfig = {
  id: "nyc-acris-parties",
  name: "NYC ACRIS Real Property Parties",
  category: "deeds",
  state: "NY",
  locality: "New York City",
  portal: "https://data.cityofnewyork.us",
  datasetId: "636b-3b5g",
  fields: [
    { source: "document_id", normalized: "document_id", label: "Document ID", type: "string" },
    { source: "record_type", normalized: "record_type", label: "Record Type", type: "string" },
    { source: "party_type", normalized: "party_type", label: "Party Type", type: "string" },
    { source: "name", normalized: "name", label: "Name", type: "string" },
    { source: "address_1", normalized: "address_1", label: "Address 1", type: "string" },
    { source: "address_2", normalized: "address_2", label: "Address 2", type: "string" },
    { source: "city", normalized: "city", label: "City", type: "string" },
    { source: "state", normalized: "state", label: "State", type: "string" },
    { source: "zip", normalized: "zip", label: "ZIP", type: "string" },
    { source: "country", normalized: "country", label: "Country", type: "string" },
  ],
  searchFields: ["name"],
  verified: true,
  lastVerified: "2024-12",
  notes: "Party names (buyers/sellers) for all NYC property transactions",
}

const ACRIS_MASTER_CONFIG: DataSourceConfig = {
  id: "nyc-acris-master",
  name: "NYC ACRIS Real Property Master",
  category: "deeds",
  state: "NY",
  locality: "New York City",
  portal: "https://data.cityofnewyork.us",
  datasetId: "bnx9-e6tj",
  fields: [
    { source: "document_id", normalized: "document_id", label: "Document ID", type: "string" },
    { source: "record_type", normalized: "record_type", label: "Record Type", type: "string" },
    { source: "crfn", normalized: "crfn", label: "CRFN", type: "string" },
    { source: "recorded_borough", normalized: "borough", label: "Borough", type: "string" },
    { source: "doc_type", normalized: "doc_type", label: "Document Type", type: "string" },
    { source: "document_date", normalized: "document_date", label: "Document Date", type: "date" },
    { source: "document_amt", normalized: "document_amt", label: "Document Amount", type: "currency" },
    { source: "recorded_datetime", normalized: "recorded_datetime", label: "Recorded Date", type: "date" },
    { source: "modified_date", normalized: "modified_date", label: "Modified Date", type: "date" },
    { source: "reel_yr", normalized: "reel_year", label: "Reel Year", type: "number" },
    { source: "reel_nbr", normalized: "reel_number", label: "Reel Number", type: "number" },
    { source: "reel_pg", normalized: "reel_page", label: "Reel Page", type: "number" },
    { source: "percent_trans", normalized: "percent_transferred", label: "Percent Transferred", type: "number" },
  ],
  searchFields: ["document_id"],
  verified: true,
  lastVerified: "2024-12",
  notes: "Master deed records with amounts and dates",
}

const ACRIS_LEGALS_CONFIG: DataSourceConfig = {
  id: "nyc-acris-legals",
  name: "NYC ACRIS Real Property Legals",
  category: "deeds",
  state: "NY",
  locality: "New York City",
  portal: "https://data.cityofnewyork.us",
  datasetId: "8h5j-fqxa",
  fields: [
    { source: "document_id", normalized: "document_id", label: "Document ID", type: "string" },
    { source: "record_type", normalized: "record_type", label: "Record Type", type: "string" },
    { source: "borough", normalized: "borough", label: "Borough", type: "string" },
    { source: "block", normalized: "block", label: "Block", type: "number" },
    { source: "lot", normalized: "lot", label: "Lot", type: "number" },
    { source: "easement", normalized: "easement", label: "Easement", type: "string" },
    { source: "partial_lot", normalized: "partial_lot", label: "Partial Lot", type: "string" },
    { source: "air_rights", normalized: "air_rights", label: "Air Rights", type: "string" },
    { source: "subterranean_rights", normalized: "subterranean_rights", label: "Subterranean Rights", type: "string" },
    { source: "property_type", normalized: "property_type", label: "Property Type", type: "string" },
    { source: "street_number", normalized: "street_number", label: "Street Number", type: "string" },
    { source: "street_name", normalized: "street_name", label: "Street Name", type: "string" },
    { source: "unit", normalized: "unit", label: "Unit", type: "string" },
  ],
  searchFields: ["street_name"],
  verified: true,
  lastVerified: "2024-12",
  notes: "Property legal descriptions with addresses",
}

// Document type descriptions
const DOC_TYPES: Record<string, string> = {
  "DEED": "Deed Transfer",
  "MTGE": "Mortgage",
  "ASST": "Assignment",
  "AGMT": "Agreement",
  "CTOR": "Corrective",
  "AALR": "Assignment of Leases and Rents",
  "APTS": "Apartment",
  "ASPM": "Assumption of Mortgage",
  "CERP": "Certificate",
  "DECL": "Declaration",
  "EASE": "Easement",
  "M&CON": "Mortgage and Consolidation",
  "RPTT": "Real Property Transfer Tax",
  "SAT": "Satisfaction",
  "SPRD": "Spreading Agreement",
  "SUBL": "Sublease",
  "UCC1": "UCC1 Filing",
  "UCC3": "UCC3 Filing",
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

interface ACRISPartyRecord {
  document_id: string
  record_type: string
  party_type: string
  name: string
  address_1?: string
  address_2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

interface ACRISMasterRecord {
  document_id: string
  record_type: string
  crfn: string
  recorded_borough: string
  doc_type: string
  document_date: string
  document_amt: string
  recorded_datetime: string
  percent_trans?: string
}

interface ACRISLegalRecord {
  document_id: string
  record_type: string
  borough: string
  block: string
  lot: string
  property_type?: string
  street_number?: string
  street_name?: string
  unit?: string
}

interface DeedRecord {
  documentId: string
  partyName: string
  partyType: "Buyer" | "Seller" | "Borrower" | "Lender" | "Other"
  address?: string
  city?: string
  state?: string
  documentType: string
  documentDate: string
  amount: number
  borough: string
  propertyAddress?: string
  block?: number
  lot?: number
}

interface ACRISDeedsResult {
  searchTerm: string
  searchType: "party_name" | "address" | "block_lot"
  deeds: DeedRecord[]
  summary: {
    totalFound: number
    totalTransactionValue: number
    byRole: { buyer: number; seller: number; borrower: number; lender: number }
    byDocType: Record<string, number>
    dateRange: { earliest: string; latest: string }
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseNumber(value: string | undefined): number {
  if (!value) return 0
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""))
  return isNaN(num) ? 0 : num
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

function getPartyRole(partyType: string): "Buyer" | "Seller" | "Borrower" | "Lender" | "Other" {
  const type = (partyType || "").toUpperCase()
  if (type.includes("BUYER") || type === "2" || type === "GRANTEE") return "Buyer"
  if (type.includes("SELLER") || type === "1" || type === "GRANTOR") return "Seller"
  if (type.includes("BORROWER") || type === "MORTGAGOR") return "Borrower"
  if (type.includes("LENDER") || type === "MORTGAGEE") return "Lender"
  return "Other"
}

function getDocTypeDescription(docType: string): string {
  return DOC_TYPES[docType] || docType
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

async function searchByPartyName(name: string): Promise<ACRISDeedsResult> {
  console.log(`[ACRIS] Searching for party: "${name}"`)

  // Search parties table for the name
  const partyQuery = buildNameSearchQuery("name", name, { limit: 100 })
  partyQuery.orderBy = [{ field: "document_id", direction: "DESC" }]

  const partyResponse = await executeSoQLQuery<ACRISPartyRecord>(
    ACRIS_PARTIES_CONFIG,
    partyQuery
  )

  if (partyResponse.error) {
    return buildErrorResult(name, "party_name", partyResponse.error)
  }

  if (partyResponse.data.length === 0) {
    return buildSuccessResult(name, "party_name", [], partyResponse.sources)
  }

  // Get unique document IDs
  const documentIds = [...new Set(partyResponse.data.map((p) => p.document_id))].slice(0, 50)

  // Fetch master records for these documents
  const masterQuery: SoQLQuery = {
    whereRaw: `document_id IN (${documentIds.map((id) => `'${id}'`).join(", ")})`,
    limit: 100,
  }

  const masterResponse = await executeSoQLQuery<ACRISMasterRecord>(
    ACRIS_MASTER_CONFIG,
    masterQuery
  )

  // Combine party and master data
  const masterMap = new Map(
    masterResponse.data.map((m) => [m.document_id, m])
  )

  const deeds: DeedRecord[] = []

  for (const party of partyResponse.data) {
    const master = masterMap.get(party.document_id)
    if (!master) continue

    const amount = parseNumber(master.document_amt)

    // Skip very small transactions
    if (amount < 1000) continue

    deeds.push({
      documentId: party.document_id,
      partyName: party.name,
      partyType: getPartyRole(party.party_type),
      address: [party.address_1, party.address_2].filter(Boolean).join(", "),
      city: party.city,
      state: party.state,
      documentType: getDocTypeDescription(master.doc_type),
      documentDate: master.document_date,
      amount,
      borough: BOROUGH_MAP[master.recorded_borough] || master.recorded_borough,
    })
  }

  return buildSuccessResult(name, "party_name", deeds, [
    ...partyResponse.sources,
    ...masterResponse.sources,
  ])
}

async function searchByAddress(address: string): Promise<ACRISDeedsResult> {
  console.log(`[ACRIS] Searching for address: "${address}"`)

  // Search legals table for the address
  const legalQuery: SoQLQuery = {
    whereRaw: `upper(street_name) LIKE '%${address.toUpperCase().replace(/'/g, "''")}%'`,
    limit: 50,
    orderBy: [{ field: "document_id", direction: "DESC" }],
  }

  const legalResponse = await executeSoQLQuery<ACRISLegalRecord>(
    ACRIS_LEGALS_CONFIG,
    legalQuery
  )

  if (legalResponse.error) {
    return buildErrorResult(address, "address", legalResponse.error)
  }

  if (legalResponse.data.length === 0) {
    return buildSuccessResult(address, "address", [], legalResponse.sources)
  }

  // Get document IDs and fetch master/party data
  const documentIds = [...new Set(legalResponse.data.map((l) => l.document_id))].slice(0, 50)

  const [masterResponse, partyResponse] = await Promise.all([
    executeSoQLQuery<ACRISMasterRecord>(ACRIS_MASTER_CONFIG, {
      whereRaw: `document_id IN (${documentIds.map((id) => `'${id}'`).join(", ")})`,
      limit: 100,
    }),
    executeSoQLQuery<ACRISPartyRecord>(ACRIS_PARTIES_CONFIG, {
      whereRaw: `document_id IN (${documentIds.map((id) => `'${id}'`).join(", ")})`,
      limit: 200,
    }),
  ])

  // Build maps for joining
  const masterMap = new Map(masterResponse.data.map((m) => [m.document_id, m]))
  const legalMap = new Map(legalResponse.data.map((l) => [l.document_id, l]))
  const partyMap = new Map<string, ACRISPartyRecord[]>()

  for (const party of partyResponse.data) {
    const existing = partyMap.get(party.document_id) || []
    existing.push(party)
    partyMap.set(party.document_id, existing)
  }

  const deeds: DeedRecord[] = []

  for (const docId of documentIds) {
    const master = masterMap.get(docId)
    const legal = legalMap.get(docId)
    const parties = partyMap.get(docId) || []

    if (!master) continue

    const amount = parseNumber(master.document_amt)
    if (amount < 1000) continue

    const propertyAddress = legal
      ? `${legal.street_number || ""} ${legal.street_name || ""}`.trim()
      : undefined

    // Add a deed record for each party
    for (const party of parties) {
      deeds.push({
        documentId: docId,
        partyName: party.name,
        partyType: getPartyRole(party.party_type),
        documentType: getDocTypeDescription(master.doc_type),
        documentDate: master.document_date,
        amount,
        borough: BOROUGH_MAP[master.recorded_borough] || master.recorded_borough,
        propertyAddress,
        block: legal ? parseInt(legal.block) : undefined,
        lot: legal ? parseInt(legal.lot) : undefined,
      })
    }
  }

  return buildSuccessResult(address, "address", deeds, [
    ...legalResponse.sources,
    ...masterResponse.sources,
    ...partyResponse.sources,
  ])
}

// ============================================================================
// RESULT BUILDERS
// ============================================================================

function buildErrorResult(
  searchTerm: string,
  searchType: "party_name" | "address" | "block_lot",
  error: string
): ACRISDeedsResult {
  return {
    searchTerm,
    searchType,
    deeds: [],
    summary: {
      totalFound: 0,
      totalTransactionValue: 0,
      byRole: { buyer: 0, seller: 0, borrower: 0, lender: 0 },
      byDocType: {},
      dateRange: { earliest: "", latest: "" },
    },
    rawContent: `## Error\n\nFailed to search ACRIS: ${error}`,
    sources: [{ name: "NYC ACRIS", url: "https://data.cityofnewyork.us/d/bnx9-e6tj" }],
    error,
  }
}

function buildSuccessResult(
  searchTerm: string,
  searchType: "party_name" | "address" | "block_lot",
  deeds: DeedRecord[],
  sources: Array<{ name: string; url: string }>
): ACRISDeedsResult {
  // Calculate summary statistics
  let totalTransactionValue = 0
  const byRole = { buyer: 0, seller: 0, borrower: 0, lender: 0 }
  const byDocType: Record<string, number> = {}
  let earliestDate = ""
  let latestDate = ""

  for (const deed of deeds) {
    totalTransactionValue += deed.amount

    if (deed.partyType === "Buyer") byRole.buyer++
    else if (deed.partyType === "Seller") byRole.seller++
    else if (deed.partyType === "Borrower") byRole.borrower++
    else if (deed.partyType === "Lender") byRole.lender++

    byDocType[deed.documentType] = (byDocType[deed.documentType] || 0) + 1

    if (!earliestDate || deed.documentDate < earliestDate) earliestDate = deed.documentDate
    if (!latestDate || deed.documentDate > latestDate) latestDate = deed.documentDate
  }

  // Build formatted output
  const lines: string[] = []
  lines.push(`# NYC ACRIS Property Deeds Search`)
  lines.push("")
  lines.push(`**Search Term:** ${searchTerm}`)
  lines.push(`**Search Type:** ${searchType.replace(/_/g, " ").toUpperCase()}`)
  lines.push("")

  if (deeds.length > 0) {
    lines.push(`## Summary`)
    lines.push("")
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Records | ${deeds.length} |`)
    lines.push(`| Total Transaction Value | ${formatCurrency(totalTransactionValue)} |`)
    lines.push(`| As Buyer/Grantee | ${byRole.buyer} |`)
    lines.push(`| As Seller/Grantor | ${byRole.seller} |`)
    lines.push(`| As Borrower | ${byRole.borrower} |`)
    lines.push(`| As Lender | ${byRole.lender} |`)
    lines.push(`| Date Range | ${formatDate(earliestDate)} - ${formatDate(latestDate)} |`)
    lines.push("")

    lines.push(`## Document Types`)
    lines.push("")
    lines.push(`| Type | Count |`)
    lines.push(`|------|-------|`)
    for (const [type, count] of Object.entries(byDocType).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${type} | ${count} |`)
    }
    lines.push("")

    lines.push(`## Transaction Details`)
    lines.push("")

    // Group by document for cleaner output
    const seenDocs = new Set<string>()
    for (const deed of deeds.slice(0, 15)) {
      if (seenDocs.has(deed.documentId)) continue
      seenDocs.add(deed.documentId)

      lines.push(`### ${deed.documentType} - ${formatDate(deed.documentDate)}`)
      lines.push("")
      lines.push(`| Field | Value |`)
      lines.push(`|-------|-------|`)
      lines.push(`| Amount | **${formatCurrency(deed.amount)}** |`)
      lines.push(`| Party | ${deed.partyName} (${deed.partyType}) |`)
      lines.push(`| Borough | ${deed.borough} |`)
      if (deed.propertyAddress) lines.push(`| Property | ${deed.propertyAddress} |`)
      if (deed.block && deed.lot) lines.push(`| Block/Lot | ${deed.block}/${deed.lot} |`)
      lines.push(`| Document ID | ${deed.documentId} |`)
      lines.push("")
    }

    if (seenDocs.size < deeds.length / 2) {
      lines.push(`*...and more transactions*`)
    }
  } else {
    lines.push(`## No Results`)
    lines.push("")
    lines.push(`No property deeds found matching "${searchTerm}".`)
    lines.push("")
    lines.push(`**Note:** ACRIS contains NYC property records since 1966.`)
    lines.push(`Try searching with the full legal name as it appears on deeds.`)
  }

  return {
    searchTerm,
    searchType,
    deeds,
    summary: {
      totalFound: deeds.length,
      totalTransactionValue,
      byRole,
      byDocType,
      dateRange: { earliest: earliestDate, latest: latestDate },
    },
    rawContent: lines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const acrisDeedsSchema = z.object({
  searchTerm: z.string().describe("Person/company name or property address to search"),
  searchType: z
    .enum(["party_name", "address"])
    .optional()
    .default("party_name")
    .describe("Search by party name (buyer/seller) or property address"),
})

export const acrisDeedsTool = (tool as any)({
  description:
    "Search NYC ACRIS for property deeds, mortgages, and ownership records. " +
    "Shows: buyer/seller names, transaction amounts, dates, property addresses. " +
    "WEALTH INDICATOR: Property purchases and mortgages reveal real estate holdings. " +
    "Coverage: All NYC boroughs since 1966. " +
    "Use to verify property ownership or find real estate portfolio.",

  parameters: acrisDeedsSchema,

  execute: async ({ searchTerm, searchType }: { searchTerm: string; searchType?: "party_name" | "address" }): Promise<ACRISDeedsResult> => {
    if (searchType === "address") {
      return searchByAddress(searchTerm)
    }
    return searchByPartyName(searchTerm)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableACRISDeedsTool(): boolean {
  return true
}

export { searchByPartyName, searchByAddress }
