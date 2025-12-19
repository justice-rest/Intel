/**
 * New Jersey Division of Revenue Business Registry Config
 * Tier 2: HTTP Scraping
 */
import { StateRegistryConfig, selector } from "../state-template"

export const NEW_JERSEY_CONFIG: StateRegistryConfig = {
  stateCode: "nj", stateName: "New Jersey", registryName: "Division of Revenue", tier: 2,
  baseUrl: "https://www.njportal.com",
  scraping: {
    searchUrl: "https://www.njportal.com/DOR/BusinessNameSearch/",
    detailUrlTemplate: "https://www.njportal.com/DOR/BusinessNameSearch/Detail/{id}",
    searchSelectors: {
      resultsContainer: "#results", resultRows: "#results tbody tr",
      entityName: selector("td:nth-child(1) a"), entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"), status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector(".entity-type"), registeredAgent: selector(".registered-agent"),
      registeredAgentAddress: selector(".agent-address"), principalAddress: selector(".principal-address"),
      officerContainer: ".officers tbody", officerRows: "tr",
      officerName: selector("td:nth-child(1)"), officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector(".formation-date"), status: selector(".status"),
    },
    formFields: [{ name: "BusinessName", selector: "#BusinessName", type: "text" }],
    jsRequired: false,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
