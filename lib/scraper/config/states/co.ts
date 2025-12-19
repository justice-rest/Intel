/**
 * Colorado Secretary of State Business Registry Config
 * Tier 1: Socrata Open Data API
 * https://data.colorado.gov/Business/Business-Entities-in-Colorado/4ykn-tg5h
 */

import { StateRegistryConfig, selector } from "../state-template"

export const COLORADO_CONFIG: StateRegistryConfig = {
  stateCode: "co",
  stateName: "Colorado",
  registryName: "Secretary of State",
  tier: 1,
  baseUrl: "https://data.colorado.gov",

  api: {
    baseUrl: "https://data.colorado.gov/resource/4ykn-tg5h.json",
    type: "socrata",
    authRequired: false,
    resourceId: "4ykn-tg5h",
  },

  scraping: {
    searchUrl: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do",
    detailUrlTemplate: "https://www.sos.state.co.us/biz/BusinessEntityDetail.do?entityId={id}",
    searchSelectors: {
      resultsContainer: "table.results",
      resultRows: "table.results tbody tr",
      entityName: selector("td:nth-child(1) a"),
      entityNumber: selector("td:nth-child(2)"),
      entityType: selector("td:nth-child(3)"),
      status: selector("td:nth-child(4)"),
      detailLink: selector("td:nth-child(1) a", { attribute: "href" }),
    },
    detailSelectors: {
      entityType: selector(".entityType"),
      registeredAgent: selector(".agentName"),
      registeredAgentAddress: selector(".agentAddress"),
      principalAddress: selector(".principalAddress"),
      officerContainer: "table.officers",
      officerRows: "table.officers tbody tr",
      officerName: selector("td:nth-child(1)"),
      officerTitle: selector("td:nth-child(2)"),
      incorporationDate: selector(".formationDate"),
      status: selector(".entityStatus"),
    },
    formFields: [
      { name: "srchName", selector: "#srchName", type: "text" },
    ],
    jsRequired: false,
  },

  searchTypes: {
    byName: true,
    byOfficer: false,
    byAgent: false,
    byAddress: false,
  },

  notes: {
    hasCaptcha: false,
    requiresAccount: false,
    feePerSearch: 0,
    lastVerified: "2025-01",
    notes: "Has Socrata API for programmatic access",
  },
}

export const CO_SOCRATA_FIELDS = {
  entityId: "entityid",
  entityName: "entityname",
  entityType: "entitytype",
  entityStatus: "entitystatus",
  formationDate: "entityformdate",
  principalName: "principalname",
} as const
