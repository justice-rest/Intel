/**
 * Batch Processing Tools Configuration
 * Provides the same tools available to the normal chat AI for batch research.
 * This allows batch processing to gather more grounded, data-rich results.
 */

import { ToolSet } from "ai"

// Import all the tools from lib/tools
import { linkupSearchTool, shouldEnableLinkupTool } from "@/lib/tools/linkup-search"
import {
  yahooFinanceQuoteTool,
  yahooFinanceSearchTool,
  yahooFinanceProfileTool,
  shouldEnableYahooFinanceTools,
} from "@/lib/tools/yahoo-finance"
import {
  propublicaNonprofitSearchTool,
  propublicaNonprofitDetailsTool,
  shouldEnableProPublicaTools,
} from "@/lib/tools/propublica-nonprofits"
import { secEdgarFilingsTool, shouldEnableSecEdgarTools } from "@/lib/tools/sec-edgar"
import {
  secInsiderSearchTool,
  secProxySearchTool,
  shouldEnableSecInsiderTools,
} from "@/lib/tools/sec-insider"
import { fecContributionsTool, shouldEnableFecTools } from "@/lib/tools/fec-contributions"
import { usGovDataTool, shouldEnableUsGovDataTools } from "@/lib/tools/us-gov-data"
import {
  wikidataSearchTool,
  wikidataEntityTool,
  shouldEnableWikidataTools,
} from "@/lib/tools/wikidata"
import {
  opencorporatesCompanySearchTool,
  opencorporatesOfficerSearchTool,
  shouldEnableOpenCorporatesTools,
} from "@/lib/tools/opencorporates"
import {
  opensanctionsScreeningTool,
  shouldEnableOpenSanctionsTools,
} from "@/lib/tools/opensanctions"
import {
  lobbyingSearchTool,
  shouldEnableLobbyingTools,
} from "@/lib/tools/lobbying"
import {
  courtSearchTool,
  judgeSearchTool,
  shouldEnableCourtListenerTools,
} from "@/lib/tools/courtlistener"
import {
  householdSearchTool,
  shouldEnableHouseholdSearchTool,
} from "@/lib/tools/household-search"
import {
  businessAffiliationSearchTool,
  shouldEnableBusinessAffiliationSearchTool,
} from "@/lib/tools/business-affiliation-search"
import {
  nonprofitAffiliationSearchTool,
  shouldEnableNonprofitAffiliationTool,
} from "@/lib/tools/nonprofit-affiliation-search"
import {
  propertyValuationTool,
  shouldEnablePropertyValuationTool,
} from "@/lib/tools/property-valuation"
import {
  rentalInvestmentTool,
  shouldEnableRentalInvestmentTool,
} from "@/lib/tools/rental-investment-tool"
import {
  prospectScoringTool,
  shouldEnableProspectScoringTool,
} from "@/lib/tools/prospect-scoring"
import {
  prospectReportTool,
  shouldEnableProspectReportTool,
} from "@/lib/tools/prospect-report"
import {
  nonprofitBoardSearchTool,
  shouldEnableNonprofitBoardSearchTool,
} from "@/lib/tools/nonprofit-board-search"
import {
  givingHistoryTool,
  shouldEnableGivingHistoryTool,
} from "@/lib/tools/giving-history"

/**
 * Build the tools object for batch processing
 * All research tools from the chat API, minus user-specific tools (RAG, memory, documents, CRM)
 * Includes: web search, financial data, nonprofit research, property valuation, prospect scoring, etc.
 */
export function buildBatchTools(): ToolSet {
  const tools: ToolSet = {
    // Web Search Tool - Linkup for prospect research with curated domains
    ...(shouldEnableLinkupTool() ? { searchWeb: linkupSearchTool } : {}),

    // Financial Data Tools
    ...(shouldEnableYahooFinanceTools()
      ? {
          yahoo_finance_quote: yahooFinanceQuoteTool,
          yahoo_finance_search: yahooFinanceSearchTool,
          yahoo_finance_profile: yahooFinanceProfileTool,
        }
      : {}),

    // Nonprofit Research Tools
    ...(shouldEnableProPublicaTools()
      ? {
          propublica_nonprofit_search: propublicaNonprofitSearchTool,
          propublica_nonprofit_details: propublicaNonprofitDetailsTool,
        }
      : {}),

    // SEC EDGAR (public company filings)
    ...(shouldEnableSecEdgarTools() ? { sec_edgar_filings: secEdgarFilingsTool } : {}),

    // SEC Insider (board/officer validation via Form 3/4/5 and DEF 14A)
    ...(shouldEnableSecInsiderTools()
      ? {
          sec_insider_search: secInsiderSearchTool,
          sec_proxy_search: secProxySearchTool,
        }
      : {}),

    // FEC Contributions (political giving)
    ...(shouldEnableFecTools() ? { fec_contributions: fecContributionsTool } : {}),

    // US Government Data (federal contracts, treasury, regulations)
    ...(shouldEnableUsGovDataTools() ? { us_gov_data: usGovDataTool } : {}),

    // Wikidata (biographical research)
    ...(shouldEnableWikidataTools()
      ? {
          wikidata_search: wikidataSearchTool,
          wikidata_entity: wikidataEntityTool,
        }
      : {}),

    // OpenCorporates (company and officer search)
    ...(shouldEnableOpenCorporatesTools()
      ? {
          opencorporates_company_search: opencorporatesCompanySearchTool,
          opencorporates_officer_search: opencorporatesOfficerSearchTool,
        }
      : {}),

    // OpenSanctions (PEP and sanctions screening)
    ...(shouldEnableOpenSanctionsTools()
      ? {
          opensanctions_screening: opensanctionsScreeningTool,
        }
      : {}),

    // Lobbying Disclosure (federal LDA filings)
    ...(shouldEnableLobbyingTools()
      ? {
          lobbying_search: lobbyingSearchTool,
        }
      : {}),

    // CourtListener (federal court records and judges)
    ...(shouldEnableCourtListenerTools()
      ? {
          court_search: courtSearchTool,
          judge_search: judgeSearchTool,
        }
      : {}),

    // Household/Spouse Search
    ...(shouldEnableHouseholdSearchTool()
      ? {
          household_search: householdSearchTool,
        }
      : {}),

    // Business Affiliation Search - UNIFIED enterprise-grade tool
    // Automatically searches SEC EDGAR + Wikidata + Web + OpenCorporates
    ...(shouldEnableBusinessAffiliationSearchTool()
      ? {
          business_affiliation_search: businessAffiliationSearchTool,
        }
      : {}),

    // Nonprofit Affiliation Search - AUTOMATIC person-to-nonprofit workflow
    // Searches web for person's nonprofit connections, then queries ProPublica
    ...(shouldEnableNonprofitAffiliationTool()
      ? {
          nonprofit_affiliation_search: nonprofitAffiliationSearchTool,
        }
      : {}),

    // Property Valuation Tool - AVM (Automated Valuation Model) calculations
    // Uses hedonic pricing, comparable sales, and online estimates
    ...(shouldEnablePropertyValuationTool()
      ? {
          property_valuation: propertyValuationTool,
        }
      : {}),

    // Rental Investment Tool - rental valuation and investment analysis
    // Returns rent estimate, cap rate, cash flow
    ...(shouldEnableRentalInvestmentTool()
      ? {
          rental_investment: rentalInvestmentTool,
        }
      : {}),

    // Prospect Scoring Tool - AI-powered wealth/capacity assessment
    // FREE alternative to DonorSearch AI, iWave
    ...(shouldEnableProspectScoringTool()
      ? {
          prospect_score: prospectScoringTool,
        }
      : {}),

    // Prospect Report Tool - Comprehensive research reports
    // FREE alternative to DonorSearch Research on Demand
    ...(shouldEnableProspectReportTool()
      ? {
          prospect_report: prospectReportTool,
        }
      : {}),

    // Nonprofit Board Search - Find board positions held by a person
    // FREE alternative to premium board mapping services
    ...(shouldEnableNonprofitBoardSearchTool()
      ? {
          nonprofit_board_search: nonprofitBoardSearchTool,
        }
      : {}),

    // Giving History Tool - Comprehensive giving history aggregation
    // FREE alternative to DonorSearch/iWave giving history features
    ...(shouldEnableGivingHistoryTool()
      ? {
          giving_history: givingHistoryTool,
        }
      : {}),
  }

  return tools
}

/**
 * Get a description of available tools for the system prompt
 */
export function getToolDescriptions(): string {
  const dataTools: string[] = []

  // Data API tools
  if (shouldEnableSecEdgarTools()) {
    dataTools.push("sec_edgar_filings (SEC 10-K/10-Q filings, financial statements, executive compensation)")
  }
  if (shouldEnableSecInsiderTools()) {
    dataTools.push("sec_insider_search (verify board membership - Form 3/4/5 by person name)")
    dataTools.push("sec_proxy_search (DEF 14A proxy statements - lists all directors/officers)")
  }
  if (shouldEnableFecTools()) {
    dataTools.push("fec_contributions (FEC political contributions by individual name)")
  }
  if (shouldEnableYahooFinanceTools()) {
    dataTools.push("yahoo_finance_* (stock quotes, company profiles, insider holdings)")
  }
  if (shouldEnableProPublicaTools()) {
    dataTools.push("propublica_nonprofit_* (foundation 990s, nonprofit financials)")
  }
  if (shouldEnableUsGovDataTools()) {
    dataTools.push("us_gov_data (federal contracts/grants via USAspending, treasury data, regulations)")
  }
  if (shouldEnableWikidataTools()) {
    dataTools.push("wikidata_search/entity (biographical data: education, employers, positions, net worth, awards)")
  }
  // Business Affiliation Search is always available (uses free sources)
  dataTools.push("business_affiliation_search (UNIFIED: finds ALL business roles from SEC EDGAR + Wikidata + Web - use this for officer/director search)")
  if (shouldEnableOpenCorporatesTools()) {
    dataTools.push("opencorporates_company_search / opencorporates_officer_search (company ownership, officers, directors across 140+ jurisdictions)")
  }
  if (shouldEnableOpenSanctionsTools()) {
    dataTools.push("opensanctions_screening (PEP/sanctions screening - OFAC, EU, UN sanctions + politically exposed persons)")
  }
  if (shouldEnableLobbyingTools()) {
    dataTools.push("lobbying_search (federal lobbying disclosures - lobbyists, clients, issues, spending)")
  }
  if (shouldEnableCourtListenerTools()) {
    dataTools.push("court_search / judge_search (federal court records, opinions, dockets, judge profiles)")
  }
  if (shouldEnableHouseholdSearchTool()) {
    dataTools.push("household_search (spouse/partner search - household wealth assessment, shared affiliations)")
  }
  if (shouldEnableNonprofitAffiliationTool()) {
    dataTools.push("nonprofit_affiliation_search (AUTOMATIC person-to-nonprofit workflow - finds foundation/charity connections)")
  }
  if (shouldEnablePropertyValuationTool()) {
    dataTools.push("property_valuation (AVM - Automated Valuation Model for real estate wealth estimation)")
  }
  if (shouldEnableRentalInvestmentTool()) {
    dataTools.push("rental_investment (rental valuation - rent estimate, cap rate, cash flow analysis)")
  }
  if (shouldEnableProspectScoringTool()) {
    dataTools.push("prospect_score (AI-powered wealth/capacity scoring - FREE DonorSearch/iWave alternative)")
  }
  if (shouldEnableProspectReportTool()) {
    dataTools.push("prospect_report (comprehensive research reports - FREE DonorSearch ROD alternative)")
  }
  if (shouldEnableNonprofitBoardSearchTool()) {
    dataTools.push("nonprofit_board_search (find ALL board positions held by a person)")
  }
  if (shouldEnableGivingHistoryTool()) {
    dataTools.push("giving_history (comprehensive giving history aggregation across all sources)")
  }

  const hasLinkup = shouldEnableLinkupTool()
  let description = ""

  if (hasLinkup || dataTools.length > 0) {
    description += `## Available Research Tools\n\n`

    if (hasLinkup) {
      description += `### searchWeb - Your Primary Research Tool
Use searchWeb for prospect research with curated domains (SEC filings, FEC contributions, foundation 990s, property records, corporate data).
Run 6-10 searchWeb queries per prospect with different angles:
- Property: "[address] home value Zillow Redfin", "[address] property records"
- Business: "[name] founder CEO business [city]", "[name] LLC [state]"
- Philanthropy: "[name] foundation board nonprofit", "[name] donor charitable giving"\n\n`
    }

    if (dataTools.length > 0) {
      description += `### Data API Tools\n${dataTools.map((t) => `- ${t}`).join("\n")}\n\n`
      description += `**Usage:**
- sec_edgar_filings: Public company financials, 10-K/10-Q, executive compensation
- sec_insider_search: Verify board membership - search Form 3/4/5 by person name
- sec_proxy_search: DEF 14A proxy statements listing all directors/officers
- fec_contributions: Political contribution history by individual name
- yahoo_finance_*: Stock data, company profiles, insider holdings
- propublica_nonprofit_*: Foundation 990s, nonprofit financials (search by ORG name)
- us_gov_data: Federal contracts/grants by company/org name
- wikidata_search/entity: Biographical data (education, employers, net worth)
- business_affiliation_search: **USE THIS** for officer/director search - automatically searches SEC EDGAR + Wikidata + Web + OpenCorporates
- opencorporates_company_search: Search companies by name (LLC, Corp, etc.) - returns officers, status, filings (requires API key)
- opencorporates_officer_search: Find all companies where a person is officer/director (requires API key)
- opensanctions_screening: PEP & sanctions check - returns risk level (HIGH/MEDIUM/LOW/CLEAR)
- lobbying_search: Federal lobbying disclosures by lobbyist, client, or firm name
- court_search: Federal court opinions and dockets by party name or case
- judge_search: Judge biographical data, positions, appointers, education
- household_search: Find spouse/partner - returns household wealth assessment and shared affiliations
- nonprofit_affiliation_search: AUTOMATIC person-to-nonprofit workflow - web search + ProPublica lookup
- property_valuation: AVM (Automated Valuation Model) for real estate - uses hedonic pricing + comparables
- rental_investment: Rental analysis - rent estimate, cap rate, cash-on-cash return, cash flow
- prospect_score: AI wealth/capacity scoring - outputs donor rating (A-D) with confidence
- prospect_report: Full research report generation - comprehensive prospect profiles
- nonprofit_board_search: Find ALL nonprofit board positions for a person
- giving_history: Aggregate giving history from FEC, foundations, public records\n\n`
    }

    description += `### Research Strategy
1. Run 6-10 **searchWeb** queries covering property, business, philanthropy
2. Use **data API tools** to get detailed info on discovered entities
3. **propublica workflow**: searchWeb to find nonprofit names → propublica_nonprofit_search with ORG name
4. **business ownership**: Use **business_affiliation_search** (unified tool) - automatically searches SEC + Wikidata + Web + OpenCorporates
5. **compliance screening**: ALWAYS run opensanctions_screening for major donor prospects (PEP/sanctions check)
6. Run tools in parallel when possible. Be thorough.

### Board & Officer Validation (PUBLIC COMPANIES)
When verifying board membership or officer status:
1. **sec_insider_search("[person name]")** - If results found, they ARE an insider (officer/director/10%+ owner)
2. **sec_proxy_search("[company name]")** - Lists ALL directors and officers from DEF 14A proxy statement

### Due Diligence Workflow
For comprehensive prospect due diligence:
1. **opensanctions_screening** - Check for sanctions/PEP status (REQUIRED for major gifts)
2. **business_affiliation_search** - Find ALL business affiliations (unified search)
3. **court_search** - Check for litigation history
4. **lobbying_search** - Discover political connections
5. **fec_contributions** - Political giving patterns
6. **household_search** - Identify spouse/household wealth\n`
  }

  return description
}

/**
 * Extract sources from tool results for display
 * Handles the various source formats returned by different tools
 */
export function extractSourcesFromToolResults(
  toolResults: Array<{ toolName: string; result: unknown }>
): Array<{ name: string; url: string }> {
  const sources: Array<{ name: string; url: string }> = []
  const seenUrls = new Set<string>()

  for (const { result } of toolResults) {
    if (!result || typeof result !== "object") continue

    // Handle tools that return sources array (Linkup)
    const resultObj = result as Record<string, unknown>
    if (Array.isArray(resultObj.sources)) {
      for (const source of resultObj.sources as Array<{ name?: string; title?: string; url?: string }>) {
        if (source.url && !seenUrls.has(source.url)) {
          seenUrls.add(source.url)
          sources.push({
            name: source.name || source.title || new URL(source.url).hostname,
            url: source.url,
          })
        }
      }
    }

    // Handle tools that return results array
    if (Array.isArray(resultObj.results)) {
      for (const item of resultObj.results as Array<{ title?: string; url?: string }>) {
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url)
          sources.push({
            name: item.title || new URL(item.url).hostname,
            url: item.url,
          })
        }
      }
    }

    // Handle SEC EDGAR which has filings with URLs
    if (Array.isArray(resultObj.filings)) {
      for (const filing of resultObj.filings as Array<{ url?: string; formType?: string; fiscalYear?: number }>) {
        if (filing.url && !seenUrls.has(filing.url)) {
          seenUrls.add(filing.url)
          sources.push({
            name: `SEC ${filing.formType || "Filing"} (${filing.fiscalYear || ""})`,
            url: filing.url,
          })
        }
      }
    }
  }

  return sources
}
