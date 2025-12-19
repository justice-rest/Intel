/**
 * Washington Secretary of State Business Registry Config
 * Tier 3: Requires Playwright (Angular SPA)
 */

import { StateRegistryConfig, selector } from "../state-template"

export const WASHINGTON_CONFIG: StateRegistryConfig = {
  stateCode: "wa",
  stateName: "Washington",
  registryName: "Secretary of State",
  tier: 3,
  baseUrl: "https://ccfs.sos.wa.gov",

  scraping: {
    searchUrl: "https://ccfs.sos.wa.gov/#/BusinessSearch",
    detailUrlTemplate: "https://ccfs.sos.wa.gov/#/BusinessSearch/{id}",
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
      entityType: selector(".business-type"),
      registeredAgent: selector(".registered-agent .name"),
      registeredAgentAddress: selector(".registered-agent .address"),
      principalAddress: selector(".principal-office"),
      officerContainer: ".governors-table tbody",
      officerRows: "tr",
      officerName: selector("td:nth-child(1)"),
      officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector(".formation-date"),
      status: selector(".status-badge"),
    },
    formFields: [{ name: "businessName", selector: "input[name='businessName']", type: "text" }],
    jsRequired: true,
  },

  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01", notes: "Angular SPA" },
}
