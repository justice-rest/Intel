/**
 * Delaware Division of Corporations Configuration
 *
 * Delaware is the MOST IMPORTANT jurisdiction - hosts 65% of Fortune 500
 * companies and over 1.1 million business entities.
 *
 * CAPTCHA Protection: Delaware uses hCaptcha which is now solvable
 * via our AI-powered CAPTCHA solving system (requires OPENROUTER_API_KEY).
 *
 * Features:
 * - Search by entity name or file number
 * - AI-powered hCaptcha solving
 * - Free basic search, $10 for status, $20 for detailed info
 *
 * URL Patterns:
 * - Search: https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx
 * - Entity: https://icis.corp.delaware.gov/Ecorp/EntitySearch/Status.aspx?i=XXX
 */

import { StateRegistryConfig, selector } from "../state-template"

export const DELAWARE_CONFIG: StateRegistryConfig = {
  stateCode: "de",
  stateName: "Delaware",
  registryName: "Division of Corporations",
  tier: 4, // CAPTCHA protected, requires AI solving
  baseUrl: "https://icis.corp.delaware.gov",

  scraping: {
    searchUrl: "https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx",
    alternateSearchUrls: {
      // File number search
      // https://icis.corp.delaware.gov/ecorp/entitysearch/filenumber.aspx
    },
    detailUrlTemplate: "/Ecorp/EntitySearch/Status.aspx?i={id}",

    searchSelectors: {
      resultsContainer: "#tblResults, .search-results",
      resultRows: "#tblResults tbody tr, .search-results tr",
      entityName: selector("td:nth-child(1) a", {
        fallbacks: [".entityName", "td a"],
        transform: (v) => v.trim(),
      }),
      entityNumber: selector("td:nth-child(2)", {
        fallbacks: [".fileNumber"],
        regex: /(\d+)/,
        transform: (v) => v.trim(),
      }),
      status: selector("td:nth-child(7)", {
        fallbacks: [".status", "td:last-child"],
        transform: (v) => v.trim().toUpperCase(),
      }),
      filingDate: selector("td:nth-child(3)", {
        fallbacks: [".incDate"],
      }),
      entityType: selector("td:nth-child(5)", {
        fallbacks: [".entityType", "td:nth-child(4)"],
      }),
      detailLink: selector("td:nth-child(1) a", {
        attribute: "href",
      }),
    },

    detailSelectors: {
      // Entity information
      entityName: selector(".entityName, h1", {
        fallbacks: ["#entityName", ".company-name"],
      }),
      entityType: selector("span:has-text('Entity Type') + span", {
        fallbacks: [".entityType", "#entityType"],
        transform: (v) => v.trim(),
      }),
      status: selector("span:has-text('Status') + span", {
        fallbacks: [".status", "#status"],
        transform: (v) => v.trim().toUpperCase(),
      }),
      incorporationDate: selector("span:has-text('Date of Incorporation') + span", {
        fallbacks: [
          "span:has-text('Formation Date') + span",
          ".incDate",
          "#formationDate",
        ],
      }),
      jurisdictionOfFormation: selector("span:has-text('State') + span", {
        fallbacks: [".jurisdiction"],
      }),

      // Registered agent
      registeredAgent: selector(".registeredAgent, #raName", {
        fallbacks: ["span:has-text('Registered Agent') + span"],
      }),
      registeredAgentAddress: selector(".raAddress, #raAddress", {
        fallbacks: [".registered-agent-address"],
      }),

      // Addresses (Note: Delaware detail pages have limited address info for free)
      principalAddress: selector(".principalAddress, #principalAddress", {
        fallbacks: [".business-address"],
      }),

      // Officers (Note: May require paid status report for full list)
      officerContainer: ".officers-table, #officers",
      officerRows: "tbody tr",
      officerName: selector("td:nth-child(1)", {
        transform: (v) => v.trim(),
      }),
      officerTitle: selector("td:nth-child(2)", {
        transform: (v) => v.trim(),
      }),
      officerAddress: selector("td:nth-child(3)"),
    },

    formFields: [
      {
        name: "txtEntityName",
        selector: "#txtEntityName",
        type: "text",
      },
      {
        name: "txtFileNumber",
        selector: "#txtFileNumber",
        type: "text",
      },
    ],
    jsRequired: false,
    waitForSelector: "#tblResults, .search-results",
    postSearchDelay: 2000,
    searchSubmitMethod: "click",
  },

  notes: {
    hasCaptcha: true,
    requiresAccount: false,
    feePerSearch: 0, // Basic search is free
    notes: `
CAPTCHA: Delaware uses hCaptcha. Our AI-powered CAPTCHA solver can handle this automatically.
Set OPENROUTER_API_KEY environment variable to enable AI CAPTCHA solving.

Fee Structure:
- Basic name search: FREE
- Status check: $10 per entity
- Certified Good Standing: $50
- Detailed report: $20

IMPORTANT: Delaware is the #1 jurisdiction for incorporation:
- 65% of Fortune 500 companies
- 1.1+ million business entities
- Business-friendly courts and laws
    `.trim(),
    lastVerified: "2025-01",
    knownIssues: [
      "hCaptcha protection may trigger on repeated searches",
      "Detailed officer information requires paid status report",
      "Some historical data not available online",
    ],
  },

  searchTypes: {
    byName: true,
    byOfficer: false,
    byAgent: false,
    byAddress: false,
  },
}

/**
 * Delaware entity type abbreviations
 */
export const DE_ENTITY_TYPES = {
  "CORPORATION": "Corporation",
  "LLC": "Limited Liability Company",
  "LP": "Limited Partnership",
  "LLP": "Limited Liability Partnership",
  "GP": "General Partnership",
  "CORP": "Corporation",
  "GENERAL PARTNERSHIP": "General Partnership",
  "LIMITED PARTNERSHIP": "Limited Partnership",
  "LIMITED LIABILITY COMPANY": "Limited Liability Company",
  "STATUTORY TRUST": "Statutory Trust",
} as const
