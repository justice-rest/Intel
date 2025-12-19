/**
 * Tier 3 State Configs - Require Playwright (JavaScript rendering)
 * Michigan, Indiana, Virginia, Wisconsin
 */

import { StateRegistryConfig, selector } from "../state-template"

export const MICHIGAN_CONFIG: StateRegistryConfig = {
  stateCode: "mi", stateName: "Michigan", registryName: "LARA", tier: 3,
  baseUrl: "https://cofs.lara.state.mi.us",
  scraping: {
    searchUrl: "https://cofs.lara.state.mi.us/SearchApi/Search/Search",
    detailUrlTemplate: "https://cofs.lara.state.mi.us/SearchApi/Search/GetDetail?id={id}",
    searchSelectors: {
      resultsContainer: ".results-container", resultRows: ".result-row",
      entityName: selector(".entity-name a"), entityNumber: selector(".entity-id"),
      entityType: selector(".entity-type"), status: selector(".entity-status"),
      detailLink: selector(".entity-name a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector(".detail-type"), registeredAgent: selector(".resident-agent-name"),
      registeredAgentAddress: selector(".resident-agent-address"), principalAddress: selector(".principal-address"),
      officerContainer: ".officers-list", officerRows: ".officer-item",
      officerName: selector(".officer-name"), officerTitle: selector(".officer-title"),
      incorporationDate: selector(".formation-date"), status: selector(".status-badge"),
    },
    formFields: [{ name: "searchTerm", selector: "#searchTerm", type: "text" }],
    jsRequired: true,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01", notes: "SPA" },
}

export const INDIANA_CONFIG: StateRegistryConfig = {
  stateCode: "in", stateName: "Indiana", registryName: "Secretary of State", tier: 3,
  baseUrl: "https://bsd.sos.in.gov",
  scraping: {
    searchUrl: "https://bsd.sos.in.gov/publicbusinesssearch",
    detailUrlTemplate: "https://bsd.sos.in.gov/publicbusinesssearch/{id}",
    searchSelectors: {
      resultsContainer: "#searchResults", resultRows: "#searchResults .result-item",
      entityName: selector(".business-name a"), entityNumber: selector(".business-id"),
      entityType: selector(".business-type"), status: selector(".business-status"),
      detailLink: selector(".business-name a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector("#entityType"), registeredAgent: selector("#registeredAgent"),
      registeredAgentAddress: selector("#agentAddress"), principalAddress: selector("#principalAddress"),
      officerContainer: "#principalsList", officerRows: ".principal-item",
      officerName: selector(".principal-name"), officerTitle: selector(".principal-title"),
      incorporationDate: selector("#formationDate"), status: selector("#entityStatus"),
    },
    formFields: [{ name: "BusinessName", selector: "#BusinessName", type: "text" }],
    jsRequired: true,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}

export const VIRGINIA_CONFIG: StateRegistryConfig = {
  stateCode: "va", stateName: "Virginia", registryName: "State Corporation Commission", tier: 3,
  baseUrl: "https://cis.scc.virginia.gov",
  scraping: {
    searchUrl: "https://cis.scc.virginia.gov/EntitySearch/Index",
    detailUrlTemplate: "https://cis.scc.virginia.gov/EntitySearch/BusinessInformation?id={id}",
    searchSelectors: {
      resultsContainer: "#grdResults", resultRows: "#grdResults tbody tr",
      entityName: selector("td:nth-child(1) a"), entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"), status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector("#lblType"), registeredAgent: selector("#lblAgent"),
      registeredAgentAddress: selector("#lblAgentAddress"), principalAddress: selector("#lblPrincipalOffice"),
      officerContainer: "#grdOfficers", officerRows: "tr",
      officerName: selector("td:nth-child(1)"), officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector("#lblDateFiled"), status: selector("#lblStatus"),
    },
    formFields: [{ name: "txtName", selector: "#txtName", type: "text" }],
    jsRequired: true,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01", notes: "ASP.NET" },
}

export const WISCONSIN_CONFIG: StateRegistryConfig = {
  stateCode: "wi", stateName: "Wisconsin", registryName: "DFI", tier: 3,
  baseUrl: "https://www.wdfi.org",
  scraping: {
    searchUrl: "https://www.wdfi.org/apps/CorpSearch/Search.aspx",
    detailUrlTemplate: "https://www.wdfi.org/apps/CorpSearch/Details.aspx?entityID={id}",
    searchSelectors: {
      resultsContainer: "#gvResults", resultRows: "#gvResults tr:not(:first-child)",
      entityName: selector("td:nth-child(1) a"), entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"), status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector("#lblEntityType"), registeredAgent: selector("#lblAgentName"),
      registeredAgentAddress: selector("#lblAgentAddress"), principalAddress: selector("#lblPrincipalOffice"),
      officerContainer: "#gvOfficers", officerRows: "tr",
      officerName: selector("td:nth-child(1)"), officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector("#lblDateIncorporated"), status: selector("#lblStatus"),
    },
    formFields: [{ name: "txtSearchName", selector: "#txtSearchName", type: "text" }],
    jsRequired: true,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}

export const TIER3_CONFIGS = {
  mi: MICHIGAN_CONFIG,
  in: INDIANA_CONFIG,
  va: VIRGINIA_CONFIG,
  wi: WISCONSIN_CONFIG,
} as const
