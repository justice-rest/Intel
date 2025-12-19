/**
 * Illinois Secretary of State Business Registry Config
 * Tier 2: HTTP Scraping
 */

import { StateRegistryConfig, selector } from "../state-template"

export const ILLINOIS_CONFIG: StateRegistryConfig = {
  stateCode: "il",
  stateName: "Illinois",
  registryName: "Secretary of State",
  tier: 2,
  baseUrl: "https://www.ilsos.gov",

  scraping: {
    searchUrl: "https://www.ilsos.gov/corporatellc/CorporateLlcController",
    detailUrlTemplate: "https://www.ilsos.gov/corporatellc/CorporateLlcController?command=cllcDetails&fileNbr={id}",
    searchSelectors: {
      resultsContainer: "table.searchResults",
      resultRows: "table.searchResults tr:not(:first-child)",
      entityName: selector("td:nth-child(1) a"),
      entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"),
      status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector("td:contains('Type') + td"),
      registeredAgent: selector("td:contains('Agent') + td"),
      registeredAgentAddress: selector("td:contains('Agent Address') + td"),
      principalAddress: selector("td:contains('Principal') + td"),
      officerContainer: "table.officers",
      officerRows: "tr",
      officerName: selector("td:nth-child(1)"),
      officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector("td:contains('Date') + td"),
      status: selector("td:contains('Status') + td"),
    },
    formFields: [{ name: "corpName", selector: "input[name='corpName']", type: "text" }],
    jsRequired: false,
  },

  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
