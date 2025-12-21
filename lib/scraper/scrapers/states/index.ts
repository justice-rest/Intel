/**
 * State Secretary of State Scrapers Index
 *
 * Exports all state-specific business registry scrapers.
 * All scrapers are serverless-compatible (HTTP/API only, no Playwright).
 *
 * Available states:
 * - Florida: HTTP scraping (search.sunbiz.org)
 * - New York: Socrata Open Data API (data.ny.gov)
 * - Colorado: Socrata Open Data API (data.colorado.gov)
 */

export { scrapeFloridaBusinesses, scrapeFloridaByOfficer, searchFloridaHttp } from "./florida"
export { scrapeNewYorkBusinesses, searchNewYorkOpenData } from "./new-york"
export { scrapeColoradoBusinesses, searchColoradoOpenData } from "./colorado"
