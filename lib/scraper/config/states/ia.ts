/**
 * Iowa Secretary of State Business Registry Config
 * Tier 2: HTTP Scraping
 *
 * NOTE: Iowa's REST API is blocked by WAF (Akamai/EdgeSuite).
 * Using HTTP scraping of search results page instead.
 */

import { StateRegistryConfig, selector } from "../state-template"

export const IOWA_CONFIG: StateRegistryConfig = {
  stateCode: "ia",
  stateName: "Iowa",
  registryName: "Secretary of State",
  tier: 2,
  baseUrl: "https://sos.iowa.gov",

  // API blocked by WAF - do not use
  api: undefined,

  scraping: {
    searchUrl: "https://sos.iowa.gov/search/business/search.aspx",
    detailUrlTemplate: "https://sos.iowa.gov/search/business/entity.aspx?id={id}",
    searchSelectors: {
      resultsContainer: "#grdResults",
      resultRows: "#grdResults tr:not(:first-child)",
      entityName: selector("td:nth-child(1) a"),
      entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"),
      status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector("#lblEntityType"),
      registeredAgent: selector("#lblAgentName"),
      registeredAgentAddress: selector("#lblAgentAddress"),
      principalAddress: selector("#lblPrincipalAddress"),
      officerContainer: "#grdOfficers",
      officerRows: "tr",
      officerName: selector("td:nth-child(1)"),
      officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector("#lblFormationDate"),
      status: selector("#lblStatus"),
    },
    formFields: [{ name: "txtBusinessName", selector: "#txtBusinessName", type: "text" }],
    jsRequired: false,
  },

  searchTypes: { byName: true, byOfficer: false, byAgent: false, byAddress: false },
  notes: { hasCaptcha: false, requiresAccount: false, feePerSearch: 0, lastVerified: "2025-01" },
}
