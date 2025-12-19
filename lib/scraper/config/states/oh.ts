/**
 * Ohio Secretary of State Business Registry Config
 * Tier 2: HTTP Scraping
 */
import { StateRegistryConfig, selector } from "../state-template"

export const OHIO_CONFIG: StateRegistryConfig = {
  stateCode: "oh", stateName: "Ohio", registryName: "Secretary of State", tier: 2,
  baseUrl: "https://businesssearch.ohiosos.gov",
  scraping: {
    searchUrl: "https://businesssearch.ohiosos.gov/",
    detailUrlTemplate: "https://businesssearch.ohiosos.gov/?=businessDetails/{id}",
    searchSelectors: {
      resultsContainer: ".results-table", resultRows: ".results-table tbody tr",
      entityName: selector("td:nth-child(1) a"), entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"), status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector(".entity-type-value"), registeredAgent: selector(".statutory-agent-name"),
      registeredAgentAddress: selector(".statutory-agent-address"), principalAddress: selector(".principal-place"),
      officerContainer: ".officers-directors tbody", officerRows: "tr",
      officerName: selector("td:nth-child(1)"), officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector(".formation-date"), status: selector(".entity-status"),
    },
    formFields: [{ name: "businessName", selector: "#businessName", type: "text" }],
    jsRequired: false,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
