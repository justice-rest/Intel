/**
 * Bulk Tier 2 State Configs
 * HTTP Scraping for remaining states
 * These use standardized selector patterns
 */

import { StateRegistryConfig, selector } from "../state-template"

// Standard Tier 2 config factory
function createTier2Config(
  stateCode: string,
  stateName: string,
  registryName: string,
  searchUrl: string,
  baseUrl: string,
  detailUrlTemplate?: string
): StateRegistryConfig {
  return {
    stateCode,
    stateName,
    registryName,
    tier: 2,
    baseUrl,

    scraping: {
      searchUrl,
      detailUrlTemplate: detailUrlTemplate || `${baseUrl}/entity/{id}`,
      searchSelectors: {
        resultsContainer: ".results, #results, table.searchResults",
        resultRows: "tbody tr, tr:not(:first-child)",
        entityName: selector("td:nth-child(1) a, td:first-child a"),
        entityNumber: selector("td:nth-child(2)"),
        entityType: selector("td:nth-child(3)"),
        status: selector("td:nth-child(4)"),
        detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
      },
      detailSelectors: {
        entityType: selector(".entity-type, #entityType, .type"),
        registeredAgent: selector(".registered-agent, #agent, .agent-name"),
        registeredAgentAddress: selector(".agent-address, #agentAddress"),
        principalAddress: selector(".principal-address, #principalAddress"),
        officerContainer: ".officers tbody, #officers, table.officers",
        officerRows: "tr",
        officerName: selector("td:nth-child(1)"),
        officerTitle: selector("td:nth-child(2)"),
        incorporationDate: selector(".formation-date, #formationDate"),
        status: selector(".status, #status"),
      },
      formFields: [{ name: "businessName", selector: "#businessName, input[name*='name']", type: "text" }],
      jsRequired: false,
    },

    searchTypes: {
      byName: true,
      byOfficer: false,
      byAgent: false,
      byAddress: false,
    },

    notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
  }
}

// Tier 2 States - Alphabetical
export const ALABAMA_CONFIG = createTier2Config(
  "al", "Alabama", "Secretary of State",
  "https://arc-sos.state.al.us/cgi/corpname.mbr/input",
  "https://arc-sos.state.al.us"
)

export const ALASKA_CONFIG = createTier2Config(
  "ak", "Alaska", "Division of Corporations",
  "https://www.commerce.alaska.gov/cbp/Main/Search/Entities",
  "https://www.commerce.alaska.gov"
)

export const ARKANSAS_CONFIG = createTier2Config(
  "ar", "Arkansas", "Secretary of State",
  "https://www.sos.arkansas.gov/corps/search_all.php",
  "https://www.sos.arkansas.gov"
)

export const CONNECTICUT_CONFIG = createTier2Config(
  "ct", "Connecticut", "Secretary of the State",
  "https://service.ct.gov/business/s/onlinebusinesssearch",
  "https://service.ct.gov"
)

export const HAWAII_CONFIG = createTier2Config(
  "hi", "Hawaii", "Department of Commerce",
  "https://hbe.ehawaii.gov/documents/search.html",
  "https://hbe.ehawaii.gov"
)

export const IDAHO_CONFIG = createTier2Config(
  "id", "Idaho", "Secretary of State",
  "https://sosbiz.idaho.gov/search/business",
  "https://sosbiz.idaho.gov"
)

export const KANSAS_CONFIG = createTier2Config(
  "ks", "Kansas", "Secretary of State",
  "https://www.kansas.gov/bess/flow/main?execution=e1s1",
  "https://www.kansas.gov"
)

export const KENTUCKY_CONFIG = createTier2Config(
  "ky", "Kentucky", "Secretary of State",
  "https://web.sos.ky.gov/ftsearch/",
  "https://web.sos.ky.gov"
)

export const LOUISIANA_CONFIG = createTier2Config(
  "la", "Louisiana", "Secretary of State",
  "https://coraweb.sos.la.gov/commercialsearch/CommercialSearch.aspx",
  "https://coraweb.sos.la.gov"
)

export const MAINE_CONFIG = createTier2Config(
  "me", "Maine", "Secretary of State",
  "https://icrs.informe.org/nei-sos-icrs/ICRS",
  "https://icrs.informe.org"
)

export const MARYLAND_CONFIG = createTier2Config(
  "md", "Maryland", "Department of Assessments",
  "https://egov.maryland.gov/BusinessExpress/EntitySearch",
  "https://egov.maryland.gov"
)

export const MINNESOTA_CONFIG = createTier2Config(
  "mn", "Minnesota", "Secretary of State",
  "https://mblsportal.sos.state.mn.us/Business/Search",
  "https://mblsportal.sos.state.mn.us"
)

export const MISSISSIPPI_CONFIG = createTier2Config(
  "ms", "Mississippi", "Secretary of State",
  "https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx",
  "https://corp.sos.ms.gov"
)

export const MISSOURI_CONFIG = createTier2Config(
  "mo", "Missouri", "Secretary of State",
  "https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx",
  "https://bsd.sos.mo.gov"
)

export const MONTANA_CONFIG = createTier2Config(
  "mt", "Montana", "Secretary of State",
  "https://biz.sosmt.gov/search",
  "https://biz.sosmt.gov"
)

export const NEBRASKA_CONFIG = createTier2Config(
  "ne", "Nebraska", "Secretary of State",
  "https://www.nebraska.gov/sos/corp/corpsearch.cgi",
  "https://www.nebraska.gov"
)

export const NEVADA_CONFIG = createTier2Config(
  "nv", "Nevada", "Secretary of State",
  "https://esos.nv.gov/EntitySearch/OnlineEntitySearch",
  "https://esos.nv.gov"
)

export const NEW_HAMPSHIRE_CONFIG = createTier2Config(
  "nh", "New Hampshire", "Secretary of State",
  "https://quickstart.sos.nh.gov/online/BusinessInquire",
  "https://quickstart.sos.nh.gov"
)

export const NEW_MEXICO_CONFIG = createTier2Config(
  "nm", "New Mexico", "Secretary of State",
  "https://portal.sos.state.nm.us/BFS/online/CorporationBusinessSearch",
  "https://portal.sos.state.nm.us"
)

export const NORTH_DAKOTA_CONFIG = createTier2Config(
  "nd", "North Dakota", "Secretary of State",
  "https://firststop.sos.nd.gov/search/business",
  "https://firststop.sos.nd.gov"
)

export const OKLAHOMA_CONFIG = createTier2Config(
  "ok", "Oklahoma", "Secretary of State",
  "https://www.sos.ok.gov/corp/corpInquiryFind.aspx",
  "https://www.sos.ok.gov"
)

export const OREGON_CONFIG = createTier2Config(
  "or", "Oregon", "Secretary of State",
  "https://egov.sos.state.or.us/br/pkg_web_name_srch_inq.login",
  "https://egov.sos.state.or.us"
)

export const RHODE_ISLAND_CONFIG = createTier2Config(
  "ri", "Rhode Island", "Secretary of State",
  "https://business.sos.ri.gov/CorpWeb/CorpSearch/CorpSearch.aspx",
  "https://business.sos.ri.gov"
)

export const SOUTH_CAROLINA_CONFIG = createTier2Config(
  "sc", "South Carolina", "Secretary of State",
  "https://businessfilings.sc.gov/BusinessFiling/Entity/Search",
  "https://businessfilings.sc.gov"
)

export const SOUTH_DAKOTA_CONFIG = createTier2Config(
  "sd", "South Dakota", "Secretary of State",
  "https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx",
  "https://sosenterprise.sd.gov"
)

export const TENNESSEE_CONFIG = createTier2Config(
  "tn", "Tennessee", "Secretary of State",
  "https://tnbear.tn.gov/Ecommerce/FilingSearch.aspx",
  "https://tnbear.tn.gov"
)

export const UTAH_CONFIG = createTier2Config(
  "ut", "Utah", "Division of Corporations",
  "https://secure.utah.gov/bes/",
  "https://secure.utah.gov"
)

export const VERMONT_CONFIG = createTier2Config(
  "vt", "Vermont", "Secretary of State",
  "https://bizfilings.vermont.gov/online/BusinessInquire",
  "https://bizfilings.vermont.gov"
)

export const WEST_VIRGINIA_CONFIG = createTier2Config(
  "wv", "West Virginia", "Secretary of State",
  "https://apps.wv.gov/SOS/BusinessEntitySearch/",
  "https://apps.wv.gov"
)

export const WYOMING_CONFIG = createTier2Config(
  "wy", "Wyoming", "Secretary of State",
  "https://wyobiz.wyo.gov/Business/FilingSearch.aspx",
  "https://wyobiz.wyo.gov"
)

// Export all configs
export const BULK_TIER2_CONFIGS = {
  al: ALABAMA_CONFIG,
  ak: ALASKA_CONFIG,
  ar: ARKANSAS_CONFIG,
  ct: CONNECTICUT_CONFIG,
  hi: HAWAII_CONFIG,
  id: IDAHO_CONFIG,
  ks: KANSAS_CONFIG,
  ky: KENTUCKY_CONFIG,
  la: LOUISIANA_CONFIG,
  me: MAINE_CONFIG,
  md: MARYLAND_CONFIG,
  mn: MINNESOTA_CONFIG,
  ms: MISSISSIPPI_CONFIG,
  mo: MISSOURI_CONFIG,
  mt: MONTANA_CONFIG,
  ne: NEBRASKA_CONFIG,
  nv: NEVADA_CONFIG,
  nh: NEW_HAMPSHIRE_CONFIG,
  nm: NEW_MEXICO_CONFIG,
  nd: NORTH_DAKOTA_CONFIG,
  ok: OKLAHOMA_CONFIG,
  or: OREGON_CONFIG,
  ri: RHODE_ISLAND_CONFIG,
  sc: SOUTH_CAROLINA_CONFIG,
  sd: SOUTH_DAKOTA_CONFIG,
  tn: TENNESSEE_CONFIG,
  ut: UTAH_CONFIG,
  vt: VERMONT_CONFIG,
  wv: WEST_VIRGINIA_CONFIG,
  wy: WYOMING_CONFIG,
} as const
