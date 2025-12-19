/**
 * Pennsylvania Department of State Business Registry Config
 * Tier 2: HTTP Scraping
 */

import { StateRegistryConfig, selector } from "../state-template"

export const PENNSYLVANIA_CONFIG: StateRegistryConfig = {
  stateCode: "pa",
  stateName: "Pennsylvania",
  registryName: "Department of State",
  tier: 2,
  baseUrl: "https://www.corporations.pa.gov",

  scraping: {
    searchUrl: "https://www.corporations.pa.gov/search/corpsearch",
    detailUrlTemplate: "https://www.corporations.pa.gov/search/CorpDetail?id={id}",
    searchSelectors: {
      resultsContainer: "#searchResults",
      resultRows: "#searchResults tbody tr",
      entityName: selector("td:nth-child(1) a"),
      entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"),
      status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector(".entity-type"),
      registeredAgent: selector(".registered-agent-name"),
      registeredAgentAddress: selector(".registered-agent-address"),
      principalAddress: selector(".principal-address"),
      officerContainer: ".officers-table tbody",
      officerRows: "tr",
      officerName: selector("td:nth-child(1)"),
      officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector(".creation-date"),
      status: selector(".entity-status"),
    },
    formFields: [{ name: "BusinessName", selector: "#BusinessName", type: "text" }],
    jsRequired: false,
  },

  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
