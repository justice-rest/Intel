/**
 * Arizona Corporation Commission Business Registry Config
 * Tier 2: HTTP Scraping
 */
import { StateRegistryConfig, selector } from "../state-template"

export const ARIZONA_CONFIG: StateRegistryConfig = {
  stateCode: "az", stateName: "Arizona", registryName: "Corporation Commission", tier: 2,
  baseUrl: "https://ecorp.azcc.gov",
  scraping: {
    searchUrl: "https://ecorp.azcc.gov/EntitySearch/Index",
    detailUrlTemplate: "https://ecorp.azcc.gov/BusinessSearch/BusinessInfo?entityNumber={id}",
    searchSelectors: {
      resultsContainer: ".table-results", resultRows: ".table-results tbody tr",
      entityName: selector("td:nth-child(1) a"), entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"), status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector(".entity-type"), registeredAgent: selector(".statutory-agent"),
      registeredAgentAddress: selector(".agent-address"), principalAddress: selector(".principal-address"),
      officerContainer: ".officers tbody", officerRows: "tr",
      officerName: selector("td:nth-child(1)"), officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector(".formation-date"), status: selector(".status"),
    },
    formFields: [{ name: "EntityName", selector: "#EntityName", type: "text" }],
    jsRequired: false,
  },
  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
