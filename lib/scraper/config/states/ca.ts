/**
 * California Secretary of State Configuration
 *
 * California uses a modern React-based SPA (bizfileonline.sos.ca.gov).
 * May require browser-based scraping for dynamic content.
 *
 * Features:
 * - Search by entity name or number
 * - Statement of Information (SOI) filings contain officer data
 * - Modern UI but some JavaScript rendering required
 *
 * URL Patterns:
 * - Search: https://bizfileonline.sos.ca.gov/search/business
 * - Entity details: https://bizfileonline.sos.ca.gov/search/business/{entityNumber}
 *
 * Note: California charges for certified copies but basic search is free.
 */

import { StateRegistryConfig, selector } from "../state-template"

export const CALIFORNIA_CONFIG: StateRegistryConfig = {
  stateCode: "ca",
  stateName: "California",
  registryName: "Secretary of State - Business Programs Division",
  tier: 3, // JavaScript-heavy, requires Playwright
  baseUrl: "https://bizfileonline.sos.ca.gov",

  scraping: {
    searchUrl: "https://bizfileonline.sos.ca.gov/search/business",
    detailUrlTemplate: "/search/business/{id}",

    searchSelectors: {
      resultsContainer: ".search-results, .results-container, [class*='search-result']",
      resultRows: ".search-result-item, .result-row, [class*='result-item']",
      entityName: selector(".entity-name, .business-name", {
        fallbacks: ["a[class*='entity']", "h3 a", ".result-name"],
        transform: (v) => v.trim(),
      }),
      entityNumber: selector(".entity-number, .file-number", {
        fallbacks: [".result-number", "[class*='number']"],
        regex: /([A-Z]?\d+)/,
        transform: (v) => v.trim(),
      }),
      status: selector(".entity-status, .status", {
        fallbacks: [".result-status", "[class*='status']"],
        transform: (v) => v.trim().toUpperCase(),
      }),
      filingDate: selector(".formation-date, .filing-date", {
        fallbacks: [".result-date", "[class*='date']"],
      }),
      entityType: selector(".entity-type, .business-type", {
        fallbacks: [".result-type", "[class*='type']"],
      }),
      detailLink: selector(".entity-name a, .business-name a", {
        attribute: "href",
        fallbacks: ["a[class*='entity']", "h3 a"],
      }),
    },

    detailSelectors: {
      // Entity information
      entityName: selector("h1.entity-name, .business-name h1", {
        fallbacks: ["[class*='entity-name']", ".detail-header h1"],
      }),
      entityType: selector(".entity-type, [class*='type'] .value", {
        fallbacks: ["label:has-text('Type') + span", "[data-field='entityType']"],
        transform: (v) => v.trim(),
      }),
      status: selector(".entity-status, [class*='status'] .value", {
        fallbacks: ["label:has-text('Status') + span", "[data-field='status']"],
        transform: (v) => v.trim().toUpperCase(),
      }),
      incorporationDate: selector(".formation-date, [class*='formation'] .value", {
        fallbacks: [
          "label:has-text('Registration Date') + span",
          "label:has-text('Formation Date') + span",
          "[data-field='formationDate']",
        ],
      }),
      jurisdictionOfFormation: selector(".jurisdiction, [class*='jurisdiction'] .value", {
        fallbacks: ["label:has-text('Jurisdiction') + span"],
      }),

      // Registered agent (called "Agent for Service of Process" in CA)
      registeredAgent: selector(".agent-name, [class*='agent'] .name", {
        fallbacks: [
          "label:has-text('Agent for Service') + span",
          "[data-field='agentName']",
        ],
      }),
      registeredAgentAddress: selector(".agent-address, [class*='agent'] .address", {
        fallbacks: [".agent-info .address", "[data-field='agentAddress']"],
      }),

      // Addresses
      principalAddress: selector(".principal-address, [class*='principal'] .address", {
        fallbacks: [
          "label:has-text('Principal Address') + div",
          "[data-field='principalAddress']",
        ],
      }),
      mailingAddress: selector(".mailing-address, [class*='mailing'] .address", {
        fallbacks: [
          "label:has-text('Mailing Address') + div",
          "[data-field='mailingAddress']",
        ],
      }),

      // Officers/directors (from Statement of Information)
      officerContainer: ".officers-section, [class*='officers'], .soi-officers",
      officerRows: ".officer-row, [class*='officer-item'], tr",
      officerName: selector(".officer-name, [class*='name']", {
        fallbacks: ["td:nth-child(1)"],
        transform: (v) => v.trim(),
      }),
      officerTitle: selector(".officer-title, [class*='title']", {
        fallbacks: ["td:nth-child(2)"],
        transform: (v) => v.trim(),
      }),
      officerAddress: selector(".officer-address, [class*='address']", {
        fallbacks: ["td:nth-child(3)"],
      }),

      // Filing history
      filingHistoryContainer: ".filing-history, [class*='filings'], .documents-section",
      filingRows: ".filing-row, [class*='filing-item'], tr",
      filingDate: selector(".filing-date, [class*='date']", {
        fallbacks: ["td:nth-child(1)"],
      }),
      filingType: selector(".filing-type, [class*='type']", {
        fallbacks: ["td:nth-child(2)"],
      }),
    },

    formFields: [
      {
        name: "searchValue",
        selector: 'input[name="searchValue"], #searchInput',
        type: "text",
      },
      {
        name: "searchType",
        selector: 'select[name="searchType"]',
        type: "select",
        value: "CORP", // Corporation search
      },
    ],
    jsRequired: true, // React SPA
    waitForSelector: ".search-results, [class*='result']",
    postSearchDelay: 2000,
    searchSubmitMethod: "click",
  },

  notes: {
    hasCaptcha: false,
    requiresAccount: false,
    notes: "React-based SPA requires Playwright. Officer data in Statement of Information filings.",
    lastVerified: "2025-01",
    knownIssues: [
      "React SPA may have slow initial load",
      "Some entity types have different detail page layouts",
      "Officer data only available if SOI has been filed",
    ],
  },

  searchTypes: {
    byName: true,
    byOfficer: false, // Not directly supported in search
    byAgent: false,
    byAddress: false,
  },
}

/**
 * California entity type codes
 */
export const CA_ENTITY_TYPES = {
  CORP: "Corporation",
  LLC: "Limited Liability Company",
  LP: "Limited Partnership",
  LLP: "Limited Liability Partnership",
  GP: "General Partnership",
  FOREIGN: "Foreign Entity",
} as const
