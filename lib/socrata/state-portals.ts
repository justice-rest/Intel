/**
 * State-Level Socrata Data Portal Configurations
 *
 * Comprehensive list of state data portals with verified working endpoints
 * for professional licenses, business entities, campaign finance, and more.
 *
 * Each state portal typically has:
 * - Professional license databases
 * - Business entity registrations
 * - Campaign finance contributions
 * - Government employee salaries
 * - Contracts and procurement
 */

import type { DataSourceConfig, FieldMapping } from "./types"

// ============================================================================
// HELPER TO CREATE FIELD MAPPINGS
// ============================================================================

function fields(
  mappings: Record<string, { source: string; type?: "string" | "number" | "date" | "currency" }>
): FieldMapping[] {
  return Object.entries(mappings).map(([normalized, config]) => ({
    source: config.source,
    normalized,
    label: normalized
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    type: config.type || "string",
  }))
}

// ============================================================================
// STATE PORTAL CONFIGURATIONS
// ============================================================================

export const STATE_DATA_SOURCES: DataSourceConfig[] = [
  // =========================================================================
  // NEW YORK
  // =========================================================================
  {
    id: "ny-corporations",
    name: "New York Business Entities",
    category: "business_entities",
    state: "NY",
    portal: "https://data.ny.gov",
    datasetId: "3gg2-jgnp",
    fields: fields({
      entity_name: { source: "name" },
      dos_id: { source: "dos_id" },
      jurisdiction: { source: "jurisdiction" },
      entity_type: { source: "entity_type" },
      formation_date: { source: "dos_process_date", type: "date" },
      county: { source: "county" },
      status: { source: "current_entity_status" },
    }),
    searchFields: ["name"],
    verified: true,
    lastVerified: "2024-12",
    notes: "All active/inactive corporations, LLCs, and partnerships",
  },
  {
    id: "ny-professional-licenses",
    name: "New York Professional Licenses",
    category: "professional_license",
    state: "NY",
    portal: "https://data.ny.gov",
    datasetId: "6hft-k9xm",
    fields: fields({
      license_holder: { source: "first_name" },
      profession: { source: "profession" },
      license_number: { source: "license_no" },
      status: { source: "license_status" },
      effective_date: { source: "date_of_licensure", type: "date" },
      county: { source: "county" },
    }),
    searchFields: ["first_name", "last_name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "ny-lobbyist",
    name: "New York Lobbyist Registrations",
    category: "lobbyist",
    state: "NY",
    portal: "https://data.ny.gov",
    datasetId: "s5fs-fh5g",
    fields: fields({
      lobbyist_name: { source: "lobbyist_name" },
      client_name: { source: "client_name" },
      year: { source: "year", type: "number" },
      compensation: { source: "compensation", type: "currency" },
    }),
    searchFields: ["lobbyist_name", "client_name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "ny-state-contracts",
    name: "New York State Contracts",
    category: "contracts",
    state: "NY",
    portal: "https://data.ny.gov",
    datasetId: "4fve-7k9b",
    fields: fields({
      vendor_name: { source: "vendor_name" },
      contract_amount: { source: "contract_amount", type: "currency" },
      agency_name: { source: "agency_name" },
      contract_number: { source: "contract_id" },
      start_date: { source: "start_date", type: "date" },
      end_date: { source: "end_date", type: "date" },
    }),
    searchFields: ["vendor_name"],
    verified: true,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // CALIFORNIA
  // =========================================================================
  {
    id: "ca-professional-licenses",
    name: "California Professional Licenses",
    category: "professional_license",
    state: "CA",
    portal: "https://data.ca.gov",
    datasetId: "n3vy-t6j5",
    fields: fields({
      license_holder: { source: "first_name" },
      last_name: { source: "last_name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "license_status" },
      expiration_date: { source: "exp_date", type: "date" },
      city: { source: "city" },
    }),
    searchFields: ["first_name", "last_name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "ca-lobbyist-employers",
    name: "California Lobbyist Employers",
    category: "lobbyist",
    state: "CA",
    portal: "https://cal-access.sos.ca.gov",
    datasetId: "lobbyist-employer",
    fields: fields({
      employer_name: { source: "employer_name" },
      lobbyist_name: { source: "lobbyist_name" },
      total_payments: { source: "total_payments", type: "currency" },
      filing_date: { source: "filing_date", type: "date" },
    }),
    searchFields: ["employer_name", "lobbyist_name"],
    verified: false,
    notes: "CAL-ACCESS database - may require separate integration",
  },

  // =========================================================================
  // TEXAS
  // =========================================================================
  {
    id: "tx-professional-licenses",
    name: "Texas Professional Licenses",
    category: "professional_license",
    state: "TX",
    portal: "https://data.texas.gov",
    datasetId: "tm3v-pfq9",
    fields: fields({
      license_holder: { source: "license_holder" },
      license_type: { source: "license_type" },
      license_number: { source: "license_nbr" },
      status: { source: "license_status" },
      expiration_date: { source: "license_exp_dt", type: "date" },
      city: { source: "mailing_city" },
      state: { source: "mailing_state" },
    }),
    searchFields: ["license_holder"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "tx-lobbyist-registrations",
    name: "Texas Lobbyist Registrations",
    category: "lobbyist",
    state: "TX",
    portal: "https://data.texas.gov",
    datasetId: "hrpr-qt4r",
    fields: fields({
      lobbyist_name: { source: "lobbyist_name" },
      client_name: { source: "client_name" },
      compensation: { source: "compensation_range" },
      registration_date: { source: "registration_date", type: "date" },
    }),
    searchFields: ["lobbyist_name", "client_name"],
    verified: true,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // FLORIDA
  // =========================================================================
  {
    id: "fl-professional-licenses",
    name: "Florida Professional Licenses (DBPR)",
    category: "professional_license",
    state: "FL",
    portal: "https://www.myfloridalicense.com",
    datasetId: "licensee-search",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "profession" },
      license_number: { source: "license_number" },
      status: { source: "status" },
      county: { source: "county" },
    }),
    searchFields: ["name"],
    verified: false,
    notes: "May require web scraping - no Socrata endpoint",
  },
  {
    id: "fl-lobbyist-registrations",
    name: "Florida Lobbyist Registrations",
    category: "lobbyist",
    state: "FL",
    portal: "https://floridalobbyist.gov",
    datasetId: "lobbyist-search",
    fields: fields({
      lobbyist_name: { source: "lobbyist" },
      principal_name: { source: "principal" },
      type: { source: "type" },
    }),
    verified: false,
    notes: "State site - may require separate integration",
  },

  // =========================================================================
  // COLORADO
  // =========================================================================
  {
    id: "co-professional-licenses",
    name: "Colorado Professional Licenses",
    category: "professional_license",
    state: "CO",
    portal: "https://data.colorado.gov",
    datasetId: "7s5z-vewr",
    fields: fields({
      license_holder: { source: "full_name" },
      license_type: { source: "profession_or_occupation" },
      license_number: { source: "license_number" },
      status: { source: "license_status" },
      expiration_date: { source: "expiration_date", type: "date" },
      city: { source: "city" },
    }),
    searchFields: ["full_name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "co-campaign-contributions",
    name: "Colorado Campaign Contributions",
    category: "campaign_finance",
    state: "CO",
    portal: "https://data.colorado.gov",
    datasetId: "4aps-z5kb",
    fields: fields({
      contributor_name: { source: "contributor" },
      amount: { source: "amount", type: "currency" },
      recipient: { source: "committee_name" },
      contribution_date: { source: "contribution_date", type: "date" },
      occupation: { source: "occupation" },
      employer: { source: "employer" },
    }),
    searchFields: ["contributor", "committee_name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "co-business-entities",
    name: "Colorado Business Entities",
    category: "business_entities",
    state: "CO",
    portal: "https://data.colorado.gov",
    datasetId: "4ykn-tg5h",
    fields: fields({
      entity_name: { source: "entityname" },
      entity_id: { source: "entityid" },
      entity_type: { source: "entitytype" },
      status: { source: "entitystatus" },
      formation_date: { source: "entityformdate", type: "date" },
      principal_address: { source: "principaladdress1" },
      principal_city: { source: "principalcity" },
      principal_state: { source: "principalstate" },
      principal_zip: { source: "principalpostalcode" },
      registered_agent: { source: "agentname" },
      agent_address: { source: "agentprincipaladdress1" },
    }),
    searchFields: ["entityname", "agentname"],
    verified: true,
    lastVerified: "2024-12",
    notes: "2M+ business entities registered in Colorado.",
  },

  // =========================================================================
  // WASHINGTON
  // =========================================================================
  {
    id: "wa-campaign-contributions",
    name: "Washington Campaign Contributions",
    category: "campaign_finance",
    state: "WA",
    portal: "https://data.wa.gov",
    datasetId: "kv7h-kjye",
    fields: fields({
      contributor_name: { source: "contributor_name" },
      amount: { source: "amount", type: "currency" },
      recipient_name: { source: "filer_name" },
      contribution_date: { source: "receipt_date", type: "date" },
      employer: { source: "contributor_employer_name" },
      occupation: { source: "contributor_occupation" },
      city: { source: "contributor_city" },
    }),
    searchFields: ["contributor_name", "filer_name"],
    verified: true,
    lastVerified: "2024-12",
    notes: "Excellent campaign finance data - includes employer/occupation",
  },
  {
    id: "wa-lobbyist-employers",
    name: "Washington Lobbyist Employers",
    category: "lobbyist",
    state: "WA",
    portal: "https://data.wa.gov",
    datasetId: "4hrr-5sj4",
    fields: fields({
      employer_name: { source: "employer_name" },
      lobbyist_name: { source: "lobbyist_name" },
      total_expenditures: { source: "total_expenditures", type: "currency" },
      year: { source: "report_year", type: "number" },
    }),
    searchFields: ["employer_name", "lobbyist_name"],
    verified: true,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // ILLINOIS
  // =========================================================================
  {
    id: "il-professional-licenses",
    name: "Illinois Professional Licenses",
    category: "professional_license",
    state: "IL",
    portal: "https://data.illinois.gov",
    datasetId: "xjrf-3yed",
    fields: fields({
      license_holder: { source: "full_name" },
      profession: { source: "profession" },
      license_number: { source: "license_number" },
      status: { source: "license_status" },
      city: { source: "city" },
      state: { source: "state" },
    }),
    searchFields: ["full_name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "il-government-salaries",
    name: "Illinois Government Salaries",
    category: "government_salary",
    state: "IL",
    portal: "https://data.illinois.gov",
    datasetId: "gkqz-jg3f",
    fields: fields({
      employee_name: { source: "name" },
      agency: { source: "agency" },
      position: { source: "position_title" },
      salary: { source: "ytd_gross", type: "currency" },
      year: { source: "fiscal_year", type: "number" },
    }),
    searchFields: ["name", "agency"],
    verified: true,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // PENNSYLVANIA
  // =========================================================================
  {
    id: "pa-professional-licenses",
    name: "Pennsylvania Professional Licenses",
    category: "professional_license",
    state: "PA",
    portal: "https://data.pa.gov",
    datasetId: "2xan-r7kt",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
      expiration_date: { source: "expiration_date", type: "date" },
    }),
    searchFields: ["name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "pa-lobbyist",
    name: "Pennsylvania Lobbyist Registrations",
    category: "lobbyist",
    state: "PA",
    portal: "https://data.pa.gov",
    datasetId: "ldrg-4e83",
    fields: fields({
      lobbyist_name: { source: "lobbyist_name" },
      principal_name: { source: "principal_name" },
      registration_date: { source: "registration_date", type: "date" },
    }),
    searchFields: ["lobbyist_name", "principal_name"],
    verified: true,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // OHIO
  // =========================================================================
  {
    id: "oh-professional-licenses",
    name: "Ohio Professional Licenses",
    category: "professional_license",
    state: "OH",
    portal: "https://elicense.ohio.gov",
    datasetId: "license-lookup",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
    notes: "Ohio eLicense - may require web scraping",
  },

  // =========================================================================
  // GEORGIA
  // =========================================================================
  {
    id: "ga-professional-licenses",
    name: "Georgia Professional Licenses",
    category: "professional_license",
    state: "GA",
    portal: "https://sos.ga.gov",
    datasetId: "license-verification",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "profession" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
    notes: "Secretary of State site - may need web scraping",
  },

  // =========================================================================
  // NORTH CAROLINA
  // =========================================================================
  {
    id: "nc-professional-licenses",
    name: "North Carolina Professional Licenses",
    category: "professional_license",
    state: "NC",
    portal: "https://data.nc.gov",
    datasetId: "professional-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // MICHIGAN
  // =========================================================================
  {
    id: "mi-professional-licenses",
    name: "Michigan Professional Licenses (LARA)",
    category: "professional_license",
    state: "MI",
    portal: "https://data.michigan.gov",
    datasetId: "5gq3-jbvv",
    fields: fields({
      license_holder: { source: "licensee_name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
      city: { source: "city" },
    }),
    searchFields: ["licensee_name"],
    verified: true,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // VIRGINIA
  // =========================================================================
  {
    id: "va-professional-licenses",
    name: "Virginia Professional Licenses (DPOR)",
    category: "professional_license",
    state: "VA",
    portal: "https://data.virginia.gov",
    datasetId: "dpor-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "board_name" },
      license_number: { source: "license_number" },
      status: { source: "license_status" },
    }),
    verified: false,
    notes: "DPOR database - verify dataset ID",
  },
  {
    id: "va-lobbyist",
    name: "Virginia Lobbyist Registrations",
    category: "lobbyist",
    state: "VA",
    portal: "https://data.virginia.gov",
    datasetId: "lobbyist-registrations",
    fields: fields({
      lobbyist_name: { source: "lobbyist_name" },
      principal_name: { source: "principal_name" },
    }),
    verified: false,
  },

  // =========================================================================
  // NEW JERSEY
  // =========================================================================
  {
    id: "nj-professional-licenses",
    name: "New Jersey Professional Licenses",
    category: "professional_license",
    state: "NJ",
    portal: "https://data.nj.gov",
    datasetId: "professional-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "profession" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },

  // =========================================================================
  // ARIZONA
  // =========================================================================
  {
    id: "az-professional-licenses",
    name: "Arizona Professional Licenses",
    category: "professional_license",
    state: "AZ",
    portal: "https://azdata.gov",
    datasetId: "professional-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },

  // =========================================================================
  // MASSACHUSETTS
  // =========================================================================
  {
    id: "ma-professional-licenses",
    name: "Massachusetts Professional Licenses",
    category: "professional_license",
    state: "MA",
    portal: "https://data.mass.gov",
    datasetId: "dpl-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },
  {
    id: "ma-government-salaries",
    name: "Massachusetts Government Salaries",
    category: "government_salary",
    state: "MA",
    portal: "https://data.mass.gov",
    datasetId: "chs6-xbtx",
    fields: fields({
      employee_name: { source: "employee_name" },
      agency: { source: "department" },
      position: { source: "title" },
      salary: { source: "pay", type: "currency" },
    }),
    searchFields: ["employee_name", "department"],
    verified: true,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // MARYLAND
  // =========================================================================
  {
    id: "md-professional-licenses",
    name: "Maryland Professional Licenses",
    category: "professional_license",
    state: "MD",
    portal: "https://data.maryland.gov",
    datasetId: "professional-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },

  // =========================================================================
  // TENNESSEE
  // =========================================================================
  {
    id: "tn-professional-licenses",
    name: "Tennessee Professional Licenses",
    category: "professional_license",
    state: "TN",
    portal: "https://data.tn.gov",
    datasetId: "verify-license",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "profession" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },

  // =========================================================================
  // INDIANA
  // =========================================================================
  {
    id: "in-professional-licenses",
    name: "Indiana Professional Licenses",
    category: "professional_license",
    state: "IN",
    portal: "https://data.in.gov",
    datasetId: "professional-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },

  // =========================================================================
  // MISSOURI
  // =========================================================================
  {
    id: "mo-professional-licenses",
    name: "Missouri Professional Licenses",
    category: "professional_license",
    state: "MO",
    portal: "https://data.mo.gov",
    datasetId: "pr3-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "profession" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },

  // =========================================================================
  // WISCONSIN
  // =========================================================================
  {
    id: "wi-professional-licenses",
    name: "Wisconsin Professional Licenses",
    category: "professional_license",
    state: "WI",
    portal: "https://data.wi.gov",
    datasetId: "dsps-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "credential_type" },
      license_number: { source: "credential_number" },
      status: { source: "status" },
    }),
    verified: false,
  },

  // =========================================================================
  // CONNECTICUT
  // =========================================================================
  {
    id: "ct-professional-licenses",
    name: "Connecticut Professional Licenses",
    category: "professional_license",
    state: "CT",
    portal: "https://data.ct.gov",
    datasetId: "dph-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "profession" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },
  {
    id: "ct-campaign-contributions",
    name: "Connecticut Campaign Contributions",
    category: "campaign_finance",
    state: "CT",
    portal: "https://data.ct.gov",
    datasetId: "3a6n-x6p9",
    fields: fields({
      contributor_name: { source: "contributor_name" },
      amount: { source: "contribution_amount", type: "currency" },
      recipient: { source: "committee_name" },
      contribution_date: { source: "contribution_date", type: "date" },
    }),
    searchFields: ["contributor_name", "committee_name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "ct-business-master",
    name: "Connecticut Business Registry",
    category: "business_entities",
    state: "CT",
    portal: "https://data.ct.gov",
    datasetId: "n7gp-d28j",
    fields: fields({
      entity_name: { source: "business_name" },
      entity_id: { source: "business_id" },
      entity_type: { source: "business_type" },
      status: { source: "status" },
      formation_date: { source: "formation_date", type: "date" },
      state_of_origin: { source: "state_country_of_origin" },
      principal_office: { source: "principal_office_address" },
      mailing_address: { source: "mailing_address" },
    }),
    searchFields: ["business_name"],
    verified: true,
    lastVerified: "2024-12",
    notes: "FREE bulk data, updated nightly. Best-in-class state business registry.",
  },
  {
    id: "ct-business-agents",
    name: "Connecticut Business Agents",
    category: "business_entities",
    state: "CT",
    portal: "https://data.ct.gov",
    datasetId: "egd5-wb6r",
    fields: fields({
      entity_id: { source: "business_id" },
      agent_name: { source: "agent_name" },
      agent_type: { source: "agent_type" },
      agent_address: { source: "agent_address" },
      agent_city: { source: "agent_city" },
      agent_state: { source: "agent_state" },
      agent_zip: { source: "agent_zip" },
    }),
    searchFields: ["agent_name"],
    verified: true,
    lastVerified: "2024-12",
    notes: "Registered agents for Connecticut businesses. Join with business_id.",
  },
  {
    id: "ct-business-filings",
    name: "Connecticut Business Filings",
    category: "business_entities",
    state: "CT",
    portal: "https://data.ct.gov",
    datasetId: "ah3s-bes7",
    fields: fields({
      entity_id: { source: "business_id" },
      filing_type: { source: "filing_type" },
      filing_date: { source: "filing_date", type: "date" },
      effective_date: { source: "effective_date", type: "date" },
    }),
    searchFields: ["business_id"],
    verified: true,
    lastVerified: "2024-12",
    notes: "All business filings on record. Use for compliance/activity history.",
  },

  // =========================================================================
  // OREGON
  // =========================================================================
  {
    id: "or-professional-licenses",
    name: "Oregon Professional Licenses",
    category: "professional_license",
    state: "OR",
    portal: "https://data.oregon.gov",
    datasetId: "professional-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },
  {
    id: "or-campaign-contributions",
    name: "Oregon Campaign Contributions",
    category: "campaign_finance",
    state: "OR",
    portal: "https://data.oregon.gov",
    datasetId: "c38t-w9cy",
    fields: fields({
      contributor_name: { source: "contributor_name" },
      amount: { source: "amount", type: "currency" },
      recipient: { source: "filer_name" },
      contribution_date: { source: "tran_date", type: "date" },
    }),
    searchFields: ["contributor_name", "filer_name"],
    verified: true,
    lastVerified: "2024-12",
  },

  // =========================================================================
  // MINNESOTA
  // =========================================================================
  {
    id: "mn-professional-licenses",
    name: "Minnesota Professional Licenses",
    category: "professional_license",
    state: "MN",
    portal: "https://mn.gov/data",
    datasetId: "professional-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },
  {
    id: "mn-campaign-contributions",
    name: "Minnesota Campaign Finance",
    category: "campaign_finance",
    state: "MN",
    portal: "https://cfb.mn.gov",
    datasetId: "contributions",
    fields: fields({
      contributor_name: { source: "contributor" },
      amount: { source: "amount", type: "currency" },
      recipient: { source: "committee" },
    }),
    verified: false,
    notes: "Campaign Finance Board - separate site",
  },

  // =========================================================================
  // IOWA
  // =========================================================================
  {
    id: "ia-business-entities",
    name: "Iowa Business Entities",
    category: "business_entities",
    state: "IA",
    portal: "https://data.iowa.gov",
    datasetId: "6big-mntg",
    fields: fields({
      entity_name: { source: "name" },
      entity_type: { source: "entity_type" },
      status: { source: "status" },
      formation_date: { source: "incorp_date", type: "date" },
      county: { source: "county" },
    }),
    searchFields: ["name"],
    verified: true,
    lastVerified: "2024-12",
  },
  {
    id: "ia-professional-licenses",
    name: "Iowa Professional Licenses",
    category: "professional_license",
    state: "IA",
    portal: "https://data.iowa.gov",
    datasetId: "professional-licenses",
    fields: fields({
      license_holder: { source: "name" },
      license_type: { source: "license_type" },
      license_number: { source: "license_number" },
      status: { source: "status" },
    }),
    verified: false,
  },

  // =========================================================================
  // NEVADA
  // =========================================================================
  {
    id: "nv-business-entities",
    name: "Nevada Business Entities",
    category: "business_entities",
    state: "NV",
    portal: "https://opennv.nv.gov",
    datasetId: "business-entities",
    fields: fields({
      entity_name: { source: "entity_name" },
      entity_type: { source: "entity_type" },
      status: { source: "status" },
      formation_date: { source: "formation_date", type: "date" },
      resident_agent: { source: "resident_agent_name" },
    }),
    verified: false,
    notes: "Nevada SOS database",
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find data sources by state
 */
export function findDataSourcesByState(state: string): DataSourceConfig[] {
  return STATE_DATA_SOURCES.filter(
    (source) => source.state.toUpperCase() === state.toUpperCase()
  )
}

/**
 * Find data sources by category
 */
export function findDataSourcesByCategory(
  category: DataSourceConfig["category"]
): DataSourceConfig[] {
  return STATE_DATA_SOURCES.filter((source) => source.category === category)
}

/**
 * Find data source by ID
 */
export function findDataSourceById(id: string): DataSourceConfig | undefined {
  return STATE_DATA_SOURCES.find((source) => source.id === id)
}

/**
 * Get all verified data sources
 */
export function getVerifiedDataSources(): DataSourceConfig[] {
  return STATE_DATA_SOURCES.filter((source) => source.verified)
}

/**
 * Get data sources by state and category
 */
export function findDataSource(
  state: string,
  category: DataSourceConfig["category"]
): DataSourceConfig | undefined {
  return STATE_DATA_SOURCES.find(
    (source) =>
      source.state.toUpperCase() === state.toUpperCase() &&
      source.category === category &&
      source.verified
  )
}

// ============================================================================
// STATISTICS
// ============================================================================

export function getDataSourceStats(): {
  total: number
  verified: number
  byCategory: Record<string, number>
  byState: Record<string, number>
} {
  const stats = {
    total: STATE_DATA_SOURCES.length,
    verified: STATE_DATA_SOURCES.filter((s) => s.verified).length,
    byCategory: {} as Record<string, number>,
    byState: {} as Record<string, number>,
  }

  for (const source of STATE_DATA_SOURCES) {
    stats.byCategory[source.category] =
      (stats.byCategory[source.category] || 0) + 1
    stats.byState[source.state] = (stats.byState[source.state] || 0) + 1
  }

  return stats
}
