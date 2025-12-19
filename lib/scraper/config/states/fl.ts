/**
 * Florida Division of Corporations (Sunbiz) Configuration
 *
 * Florida has one of the most scrape-friendly state registries.
 * No CAPTCHA, free access, well-structured HTML.
 *
 * Features:
 * - Search by entity name
 * - Search by officer/registered agent name
 * - Full officer lists on detail pages
 * - Filing history
 *
 * URL Patterns:
 * - Search: https://search.sunbiz.org/Inquiry/CorporationSearch/ByName
 * - Officer search: https://search.sunbiz.org/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent
 * - Detail page: https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?...
 */

import { StateRegistryConfig, selector } from "../state-template"

export const FLORIDA_CONFIG: StateRegistryConfig = {
  stateCode: "fl",
  stateName: "Florida",
  registryName: "Division of Corporations (Sunbiz)",
  tier: 2, // HTTP scraping, no JavaScript required
  baseUrl: "https://search.sunbiz.org",

  scraping: {
    searchUrl: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
    alternateSearchUrls: {
      officer: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent",
      agent: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent",
    },
    detailUrlTemplate: "/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=EntityName&directionType=Initial&searchNameOrder={id}",

    searchSelectors: {
      resultsContainer: "#search-results",
      resultRows: "#search-results tbody tr",
      entityName: selector("td:nth-child(1) a", {
        fallbacks: ["td.large-width a"],
      }),
      entityNumber: selector("td:nth-child(2)", {
        fallbacks: ["td.medium-width"],
        transform: (v) => v.trim(),
      }),
      status: selector("td:nth-child(3)", {
        fallbacks: ["td.small-width"],
        transform: (v) => v.trim().toUpperCase(),
      }),
      filingDate: selector("td:nth-child(4)", {
        transform: (v) => v.trim(),
      }),
      detailLink: selector("td:nth-child(1) a", {
        attribute: "href",
      }),
      totalResults: selector(".results-count", {
        regex: /(\d+)/,
      }),
    },

    detailSelectors: {
      // Entity information
      entityName: selector("#maincontent h1", {
        fallbacks: [".corporationName"],
        transform: (v) => v.replace(/Document Number.*$/i, "").trim(),
      }),
      entityType: selector("label:has-text('Document Type') + span", {
        fallbacks: [
          "#maincontent p:has-text('Document Type')",
          ".detailSection:has-text('Document Type') span",
        ],
        regex: /Document Type[:\s]*(.+)/i,
      }),
      status: selector("label:has-text('Status') + span", {
        fallbacks: [
          "#maincontent span:has-text('Status')",
        ],
        regex: /Status[:\s]*(.+)/i,
      }),
      incorporationDate: selector("label:has-text('Filing Date') + span", {
        fallbacks: [
          "label:has-text('Date Filed') + span",
        ],
        regex: /(?:Filing Date|Date Filed)[:\s]*(.+)/i,
      }),
      jurisdictionOfFormation: selector("label:has-text('State') + span", {
        fallbacks: [
          "label:has-text('Jurisdiction') + span",
        ],
      }),

      // Registered agent
      registeredAgent: selector("#maincontent label:has-text('Registered Agent') + span", {
        fallbacks: [
          ".detailSection:has-text('Registered Agent') span.name",
          "#maincontent div:has-text('Registered Agent Name') + div",
        ],
      }),
      registeredAgentAddress: selector("#maincontent div.raAddress", {
        fallbacks: [
          ".registeredAgentSection .address",
          ".detailSection:has-text('Registered Agent') .address",
        ],
      }),

      // Addresses
      principalAddress: selector("label:has-text('Principal Address') + div", {
        fallbacks: [
          "#maincontent div:has-text('Principal Address') + div",
          ".principalAddress",
        ],
      }),
      mailingAddress: selector("label:has-text('Mailing Address') + div", {
        fallbacks: [
          "#maincontent div:has-text('Mailing Address') + div",
          ".mailingAddress",
        ],
      }),

      // Officers/directors table
      officerContainer: "#maincontent table.detailSection, #officerInfo",
      officerRows: "tbody tr",
      officerName: selector("td:nth-child(1)", {
        fallbacks: ["td:first-child a", "td:first-child"],
        transform: (v) => v.trim(),
      }),
      officerTitle: selector("td:nth-child(2)", {
        fallbacks: ["td:nth-child(2) span"],
        transform: (v) => v.trim(),
      }),
      officerAddress: selector("td:nth-child(3)", {
        fallbacks: ["td.address"],
      }),

      // Filing history
      filingHistoryContainer: "#annualReports, #filingHistory",
      filingRows: "tbody tr",
      filingDate: selector("td:nth-child(1)", {
        transform: (v) => v.trim(),
      }),
      filingType: selector("td:nth-child(2)", {
        transform: (v) => v.trim(),
      }),
    },

    formFields: [
      {
        name: "SearchTerm",
        selector: "#SearchTerm",
        type: "text",
      },
    ],
    jsRequired: false,
    waitForSelector: "#search-results",
    postSearchDelay: 1000,
    searchSubmitMethod: "click",
  },

  notes: {
    hasCaptcha: false,
    requiresAccount: false,
    notes: "One of the most scrape-friendly state registries. Stable selectors, no CAPTCHA.",
    lastVerified: "2025-01",
    knownIssues: [],
  },

  searchTypes: {
    byName: true,
    byOfficer: true,
    byAgent: true,
    byAddress: false,
  },
}
