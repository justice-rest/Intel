/**
 * New York Department of State Configuration
 *
 * New York has both a web interface and an Open Data API (Socrata).
 * The Open Data API is preferred for bulk data access.
 *
 * Features:
 * - Socrata Open Data API (Tier 1)
 * - Web scraping fallback (Tier 2)
 * - Search by entity name
 * - Detail pages with officer information
 *
 * URL Patterns:
 * - Search: https://apps.dos.ny.gov/publicInquiry/
 * - Open Data API: https://data.ny.gov/resource/7tqb-y2d4.json
 */

import { StateRegistryConfig, selector } from "../state-template"

export const NEW_YORK_CONFIG: StateRegistryConfig = {
  stateCode: "ny",
  stateName: "New York",
  registryName: "Department of State - Division of Corporations",
  tier: 1, // Has Socrata Open Data API
  baseUrl: "https://apps.dos.ny.gov",

  // Tier 1: Socrata Open Data API
  api: {
    baseUrl: "https://data.ny.gov",
    type: "socrata",
    authRequired: false,
    resourceId: "7tqb-y2d4", // Active Corporations dataset
    rateLimit: 60, // Requests per minute (without app token)
  },

  // Tier 2 fallback: Web scraping
  scraping: {
    searchUrl: "https://apps.dos.ny.gov/publicInquiry/",
    detailUrlTemplate: "/EntityDisplay/api/EntityDisplay/EntityDisplay/{id}",

    searchSelectors: {
      resultsContainer: ".results-table, #searchResults",
      resultRows: ".results-table tbody tr, #searchResults tbody tr",
      entityName: selector("td:nth-child(1) a", {
        fallbacks: ["td:first-child a", "a.entity-name"],
      }),
      entityNumber: selector("td:nth-child(2)", {
        fallbacks: [".dos-id", "td.dosId"],
        transform: (v) => v.trim(),
      }),
      status: selector("td:nth-child(3)", {
        fallbacks: [".status", "td.status"],
        transform: (v) => v.trim().toUpperCase(),
      }),
      filingDate: selector("td:nth-child(4)", {
        fallbacks: [".filing-date", "td.date"],
      }),
      detailLink: selector("td:nth-child(1) a", {
        attribute: "href",
      }),
    },

    detailSelectors: {
      // Entity information
      entityName: selector("h1.entity-name, .corporationName", {
        fallbacks: ["#entityName", ".company-name h1"],
      }),
      entityType: selector(".entity-type, .dos-entity-type", {
        fallbacks: ["label:has-text('Type') + span"],
        transform: (v) => v.trim(),
      }),
      status: selector(".entity-status, .dos-status", {
        fallbacks: ["label:has-text('Status') + span"],
        transform: (v) => v.trim().toUpperCase(),
      }),
      incorporationDate: selector(".filing-date, .dos-filing-date", {
        fallbacks: ["label:has-text('Filing Date') + span", "label:has-text('Date of Incorporation') + span"],
      }),
      jurisdictionOfFormation: selector(".jurisdiction, .state-of-formation", {
        fallbacks: ["label:has-text('Jurisdiction') + span"],
      }),

      // Registered agent
      registeredAgent: selector(".registered-agent-name, .dos-agent-name", {
        fallbacks: ["label:has-text('Registered Agent') + span", ".agentName"],
      }),
      registeredAgentAddress: selector(".registered-agent-address, .dos-agent-address", {
        fallbacks: [".agent-address", ".registeredAgentAddress"],
      }),

      // Addresses
      principalAddress: selector(".principal-address, .dos-office-address", {
        fallbacks: ["label:has-text('Principal Office') + div", ".officeAddress"],
      }),
      mailingAddress: selector(".mailing-address", {
        fallbacks: ["label:has-text('Mailing Address') + div"],
      }),

      // Officers/directors
      officerContainer: ".officers-table, #officers, .dos-officers",
      officerRows: "tbody tr, .officer-row",
      officerName: selector("td:nth-child(1), .officer-name", {
        transform: (v) => v.trim(),
      }),
      officerTitle: selector("td:nth-child(2), .officer-title", {
        transform: (v) => v.trim(),
      }),
      officerAddress: selector("td:nth-child(3), .officer-address"),

      // Filing history
      filingHistoryContainer: ".filing-history, #filings",
      filingRows: "tbody tr",
      filingDate: selector("td:nth-child(1)"),
      filingType: selector("td:nth-child(2)"),
    },

    formFields: [
      {
        name: "search_text",
        selector: "#search_text, #SearchTerm",
        type: "text",
      },
    ],
    jsRequired: false,
    waitForSelector: ".results-table, #searchResults",
    postSearchDelay: 1500,
    searchSubmitMethod: "click",
  },

  notes: {
    hasCaptcha: false,
    requiresAccount: false,
    notes: "Preferred: Use Socrata Open Data API for bulk access. Web scraping as fallback.",
    lastVerified: "2025-01",
    knownIssues: [
      "Open Data API may not have the most recent filings (1-2 day delay)",
      "Web interface requires exact name matches",
    ],
  },

  searchTypes: {
    byName: true,
    byOfficer: false, // Not directly supported
    byAgent: false,
    byAddress: false,
  },
}

/**
 * Socrata field mapping for NY Open Data API
 */
export const NY_SOCRATA_FIELD_MAPPING = {
  entityName: "current_entity_name",
  entityNumber: "dos_id",
  status: "current_entity_status",
  incorporationDate: "dos_filing_date",
  entityType: "dos_entity_type",
  jurisdiction: "jurisdiction",
  county: "county",
}
