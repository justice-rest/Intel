/**
 * North Carolina Secretary of State Business Registry Config
 * Tier 2: HTTP Scraping
 */

import { StateRegistryConfig, selector } from "../state-template"

export const NORTH_CAROLINA_CONFIG: StateRegistryConfig = {
  stateCode: "nc",
  stateName: "North Carolina",
  registryName: "Secretary of State",
  tier: 2,
  baseUrl: "https://www.sosnc.gov",

  scraping: {
    searchUrl: "https://www.sosnc.gov/online_services/search/Business_Registration_search",
    detailUrlTemplate: "https://www.sosnc.gov/online_services/search/Business_Registration_Results?sosId={id}",
    searchSelectors: {
      resultsContainer: ".search-results table",
      resultRows: ".search-results table tbody tr",
      entityName: selector("td:nth-child(1) a"),
      entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"),
      status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector(".entity-type"),
      registeredAgent: selector(".registered-agent"),
      registeredAgentAddress: selector(".agent-address"),
      principalAddress: selector(".principal-office"),
      officerContainer: ".officers tbody",
      officerRows: "tr",
      officerName: selector("td:nth-child(1)"),
      officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector(".date-formed"),
      status: selector(".status"),
    },
    formFields: [{ name: "Words", selector: "#Words", type: "text" }],
    jsRequired: false,
  },

  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
