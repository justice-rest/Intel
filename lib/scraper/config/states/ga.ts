/**
 * Georgia Secretary of State Business Registry Config
 * Tier 2: HTTP Scraping
 */
import { StateRegistryConfig, selector } from "../state-template"

export const GEORGIA_CONFIG: StateRegistryConfig = {
  stateCode: "ga", stateName: "Georgia", registryName: "Secretary of State", tier: 2,
  baseUrl: "https://ecorp.sos.ga.gov",
  scraping: {
    searchUrl: "https://ecorp.sos.ga.gov/BusinessSearch",
    detailUrlTemplate: "https://ecorp.sos.ga.gov/BusinessSearch/BusinessInformation?businessId={id}",
    searchSelectors: {
      resultsContainer: "#results", resultRows: "#results tbody tr",
      entityName: selector("td:nth-child(1) a"), entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"), status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector("#entityType"), registeredAgent: selector("#registeredAgent"),
      registeredAgentAddress: selector("#agentAddress"), principalAddress: selector("#principalAddress"),
      officerContainer: "#officers tbody", officerRows: "tr",
      officerName: selector("td:nth-child(1)"), officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector("#formationDate"), status: selector("#status"),
    },
    formFields: [{ name: "businessName", selector: "#businessName", type: "text" }],
    jsRequired: false,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
