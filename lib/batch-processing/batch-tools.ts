/**
 * Batch Processing Tools Configuration
 * Provides the same tools available to the normal chat AI for batch research.
 * This allows batch processing to gather more grounded, data-rich results.
 */

import { ToolSet } from "ai"

// Import all the tools from lib/tools
// Note: Perplexity Sonar Reasoning has built-in web search - no need for separate search tools
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
  businessLookupTool,
  shouldEnableBusinessLookupTool,
} from "@/lib/tools/business-lookup"
import {
  propertyValuationTool,
  shouldEnablePropertyValuationTool,
} from "@/lib/tools/property-valuation"
import {
  rentalInvestmentTool,
  shouldEnableRentalInvestmentTool,
} from "@/lib/tools/rental-investment-tool"
import {
  prospectProfileTool,
  shouldEnableProspectProfileTool,
} from "@/lib/tools/prospect-profile"
import {
  gleifSearchTool,
  gleifLookupTool,
  shouldEnableGleifTools,
} from "@/lib/tools/gleif-lei"
// find-business-ownership merged into business-lookup
import {
  countyAssessorTool,
  shouldEnableCountyAssessorTool,
} from "@/lib/tools/county-assessor"
import {
  voterRegistrationTool,
  shouldEnableVoterRegistrationTool,
} from "@/lib/tools/voter-registration"
import {
  foundationGrantsTool,
  shouldEnableFoundationGrantsTool,
} from "@/lib/tools/foundation-grants"

/**
 * Build the tools object for batch processing
 * All research tools from the chat API, minus user-specific tools (RAG, memory, documents, CRM)
 * Includes: web search, financial data, nonprofit research, property valuation, prospect scoring, etc.
 */
export function buildBatchTools(): ToolSet {
  const tools: ToolSet = {
    // Note: Perplexity Sonar Reasoning has built-in web search - no need for separate search tools

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

    // Unified Business Lookup - searches CO, CT, NY, OR, IA, WA, FL state registries
    ...(shouldEnableBusinessLookupTool()
      ? {
          business_lookup: businessLookupTool,
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

    // Prospect Profile Tool - Unified wealth assessment + research report
    // Combines scoring (capacity, propensity, affinity) with verified evidence
    // FREE alternative to DonorSearch AI, iWave, DonorSearch Research on Demand
    ...(shouldEnableProspectProfileTool()
      ? {
          prospect_profile: prospectProfileTool,
        }
      : {}),

    // GLEIF LEI Tools - Global corporate ownership data
    // FREE API, no authentication required, 2.5M+ entities
    ...(shouldEnableGleifTools()
      ? {
          gleif_search: gleifSearchTool,
          gleif_lookup: gleifLookupTool,
        }
      : {}),

    // find_business_ownership merged into business_lookup above

    // County Assessor Tool - Official property assessment data from county Socrata APIs
    // FREE, no API key required - verified government data
    ...(shouldEnableCountyAssessorTool()
      ? {
          county_assessor: countyAssessorTool,
        }
      : {}),

    // Voter Registration Tool - Party affiliation and registration data
    // Uses FEC patterns as fallback when direct data unavailable
    ...(shouldEnableVoterRegistrationTool()
      ? {
          voter_registration: voterRegistrationTool,
        }
      : {}),

    // Foundation Grants Tool - 990-PF Schedule I grant data
    // Shows where foundations are giving money
    ...(shouldEnableFoundationGrantsTool()
      ? {
          foundation_grants: foundationGrantsTool,
        }
      : {}),

  }

  return tools
}

/**
 * Get a description of available tools for the system prompt
 * Note: Perplexity Sonar Reasoning has built-in web search - no need for separate search tools
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
  if (shouldEnableBusinessLookupTool()) {
    dataTools.push("business_lookup (search companies OR find person's business ownership - CO, CT, NY, OR, IA, WA, FL)")
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
  if (shouldEnablePropertyValuationTool()) {
    dataTools.push("property_valuation (AVM - Automated Valuation Model for real estate wealth estimation)")
  }
  if (shouldEnableRentalInvestmentTool()) {
    dataTools.push("rental_investment (rental valuation - rent estimate, cap rate, cash flow analysis)")
  }
  if (shouldEnableProspectProfileTool()) {
    dataTools.push("prospect_profile (unified wealth scoring + verified evidence - FREE DonorSearch/iWave alternative)")
  }
  if (shouldEnableGleifTools()) {
    dataTools.push("gleif_search (search Global LEI database by entity name - 2.5M+ entities, FREE)")
    dataTools.push("gleif_lookup (LEI lookup with ownership chain - direct/ultimate parent relationships)")
  }
  if (shouldEnableCountyAssessorTool()) {
    dataTools.push("county_assessor (official property assessment from county Socrata APIs - verified government data)")
  }
  if (shouldEnableVoterRegistrationTool()) {
    dataTools.push("voter_registration (party affiliation, registration date, voting history)")
  }
  if (shouldEnableFoundationGrantsTool()) {
    dataTools.push("foundation_grants (990-PF Schedule I - grants made by foundations)")
  }

  let description = ""

  if (dataTools.length > 0) {
    description += `## Available Research Tools

You have built-in web search capabilities through Perplexity Sonar Reasoning. Use this naturally to search the web for prospect information.

### Data API Tools
${dataTools.map((t) => `- ${t}`).join("\n")}

**Usage:**
- sec_edgar_filings: Public company financials, 10-K/10-Q, executive compensation
- sec_insider_search: Verify board membership - search Form 3/4/5 by person name
- sec_proxy_search: DEF 14A proxy statements listing all directors/officers
- fec_contributions: Political contribution history by individual name
- yahoo_finance_*: Stock data, company profiles, insider holdings
- propublica_nonprofit_*: Foundation 990s, nonprofit financials (search by ORG name)
- us_gov_data: Federal contracts/grants by company/org name
- wikidata_search/entity: Biographical data (education, employers, net worth)
- business_lookup: Search companies OR find person's business ownership via state registries
- opensanctions_screening: PEP & sanctions check - returns risk level (HIGH/MEDIUM/LOW/CLEAR)
- lobbying_search: Federal lobbying disclosures by lobbyist, client, or firm name
- court_search: Federal court opinions and dockets by party name or case
- judge_search: Judge biographical data, positions, appointers, education
- property_valuation: AVM (Automated Valuation Model) for real estate - uses county records + comparables
- rental_investment: Rental analysis - rent estimate, cap rate, cash-on-cash return, cash flow
- prospect_profile: AI wealth/capacity scoring + verified evidence - outputs donor rating (A-D) with source citations
- gleif_search/lookup: Global LEI database - corporate ownership chains, parent relationships

### Research Strategy
1. Use **built-in web search** for general prospect research (property, business, philanthropy)
2. Use **data API tools** to get detailed structured data from authoritative sources
3. **propublica workflow**: Search web for nonprofit names → propublica_nonprofit_search with ORG name
4. **compliance screening**: ALWAYS run opensanctions_screening for major donor prospects (PEP/sanctions check)
5. Run tools in parallel when possible. Be thorough.

### Business & Ownership Research
| Goal | Tool | When to Use |
|------|------|-------------|
| Find person's business ownership | **business_lookup** (searchType="person") | Searches state registries with ownership inference |
| Find public company roles | **sec_insider_search** + **sec_proxy_search** | SEC EDGAR Form 3/4/5 and DEF 14A |
| Search by company name | **business_lookup** (searchType="company") | Gets registration, officers, status |

**Supported States:** CO, CT, NY, OR, IA, WA, FL (free APIs)
**Other states:** Use built-in web search

### Board & Officer Validation (PUBLIC COMPANIES)
1. **sec_insider_search("[person name]")** - If results found, they ARE an insider
2. **sec_proxy_search("[company name]")** - Lists ALL directors and officers

### Due Diligence Workflow
1. **opensanctions_screening** - Sanctions/PEP check (REQUIRED)
2. **business_lookup** - Business affiliations via state registries
3. **sec_insider_search** + **sec_proxy_search** - Public company roles
4. **court_search** - Litigation history
5. **fec_contributions** - Political giving
`
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
