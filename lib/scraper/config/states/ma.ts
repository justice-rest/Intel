/**
 * Massachusetts Secretary of the Commonwealth Business Registry Config
 * Tier 2: HTTP Scraping
 */
import { StateRegistryConfig, selector } from "../state-template"

export const MASSACHUSETTS_CONFIG: StateRegistryConfig = {
  stateCode: "ma", stateName: "Massachusetts", registryName: "Secretary of the Commonwealth", tier: 2,
  baseUrl: "https://corp.sec.state.ma.us",
  scraping: {
    searchUrl: "https://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx",
    detailUrlTemplate: "https://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSummary.aspx?sysvalue={id}",
    searchSelectors: {
      resultsContainer: "#grdSearchResults", resultRows: "#grdSearchResults tr:not(:first-child)",
      entityName: selector("td:nth-child(1) a"), entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"), status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector("#lblEntityType"), registeredAgent: selector("#lblResidentAgent"),
      registeredAgentAddress: selector("#lblResidentAgentAddr"), principalAddress: selector("#lblPrincipalOffice"),
      officerContainer: "#grdOfficers", officerRows: "tr",
      officerName: selector("td:nth-child(1)"), officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector("#lblOrgDate"), status: selector("#lblStatus"),
    },
    formFields: [{ name: "txtEntityName", selector: "#txtEntityName", type: "text" }],
    jsRequired: false,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
