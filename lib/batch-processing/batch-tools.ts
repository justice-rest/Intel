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
  businessRegistryScraperTool,
  shouldEnableBusinessRegistryScraperTool,
} from "@/lib/tools/business-registry-scraper"
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
  prospectProfileTool,
  shouldEnableProspectProfileTool,
} from "@/lib/tools/prospect-profile"
import {
  nonprofitBoardSearchTool,
  shouldEnableNonprofitBoardSearchTool,
} from "@/lib/tools/nonprofit-board-search"
import {
  givingHistoryTool,
  shouldEnableGivingHistoryTool,
} from "@/lib/tools/giving-history"
import {
  gleifSearchTool,
  gleifLookupTool,
  shouldEnableGleifTools,
} from "@/lib/tools/gleif-lei"
import {
  findBusinessOwnershipTool,
  shouldEnableFindBusinessOwnershipTool,
} from "@/lib/tools/find-business-ownership"
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
import {
  familyDiscoveryTool,
  shouldEnableFamilyDiscoveryTool,
} from "@/lib/tools/family-discovery"
import {
  businessRevenueEstimatorTool,
  shouldEnableBusinessRevenueEstimatorTool,
} from "@/lib/tools/business-revenue-estimator"

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

    // Business Registry Scraper - Stealth web scraping fallback
    // Scrapes State SoS (FL, NY, CA, DE, CO) registries
    ...(shouldEnableBusinessRegistryScraperTool()
      ? {
          business_registry_scraper: businessRegistryScraperTool,
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
    // Automatically searches SEC EDGAR + Wikidata + Web + State Registries
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

    // Prospect Profile Tool - Unified wealth assessment + research report
    // Combines scoring (capacity, propensity, affinity) with verified evidence
    // FREE alternative to DonorSearch AI, iWave, DonorSearch Research on Demand
    ...(shouldEnableProspectProfileTool()
      ? {
          prospect_profile: prospectProfileTool,
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

    // GLEIF LEI Tools - Global corporate ownership data
    // FREE API, no authentication required, 2.5M+ entities
    ...(shouldEnableGleifTools()
      ? {
          gleif_search: gleifSearchTool,
          gleif_lookup: gleifLookupTool,
        }
      : {}),

    // Find Business Ownership Tool - Person→Business search with ownership inference
    // Searches FL, NY, CA, DE, CO state registries for businesses where person is officer/registered agent
    ...(shouldEnableFindBusinessOwnershipTool()
      ? {
          find_business_ownership: findBusinessOwnershipTool,
        }
      : {}),

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

    // Family Discovery Tool - Discover spouse/children from public records
    // Uses property records, voter data, web search
    ...(shouldEnableFamilyDiscoveryTool()
      ? {
          family_discovery: familyDiscoveryTool,
        }
      : {}),

    // Business Revenue Estimator - Estimate private company revenue
    // Uses employee count × industry benchmarks (BLS data)
    ...(shouldEnableBusinessRevenueEstimatorTool()
      ? {
          business_revenue_estimate: businessRevenueEstimatorTool,
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
  // Business research tools - different tools for different purposes
  dataTools.push("business_affiliation_search (UNIFIED: finds PUBLIC company roles from SEC EDGAR + Wikidata + Web - best for officer/director search at PUBLIC companies)")
  if (shouldEnableFindBusinessOwnershipTool()) {
    dataTools.push("find_business_ownership (STATE REGISTRIES: find what businesses a person owns/controls - searches FL, NY, CA, DE, CO with ownership inference)")
  }
  if (shouldEnableBusinessRegistryScraperTool()) {
    dataTools.push("business_registry_scraper (STATE REGISTRIES: search by company name OR officer name - FL, NY, CA, DE, CO)")
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
  if (shouldEnableProspectProfileTool()) {
    dataTools.push("prospect_profile (unified wealth scoring + verified evidence - FREE DonorSearch/iWave alternative)")
  }
  if (shouldEnableNonprofitBoardSearchTool()) {
    dataTools.push("nonprofit_board_search (find ALL board positions held by a person)")
  }
  if (shouldEnableGivingHistoryTool()) {
    dataTools.push("giving_history (comprehensive giving history aggregation across all sources)")
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
  if (shouldEnableFamilyDiscoveryTool()) {
    dataTools.push("family_discovery (discover spouse, children from property records, voter data, web search)")
  }
  if (shouldEnableBusinessRevenueEstimatorTool()) {
    dataTools.push("business_revenue_estimate (estimate private company revenue from employee count × industry benchmarks)")
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
- business_affiliation_search: PUBLIC company roles - SEC EDGAR + Wikidata + Web search
- find_business_ownership: PRIVATE business ownership - FL, NY, CA, DE, CO state registries with ownership inference
- business_registry_scraper: State registry search by company OR officer name
- opensanctions_screening: PEP & sanctions check - returns risk level (HIGH/MEDIUM/LOW/CLEAR)
- lobbying_search: Federal lobbying disclosures by lobbyist, client, or firm name
- court_search: Federal court opinions and dockets by party name or case
- judge_search: Judge biographical data, positions, appointers, education
- household_search: Find spouse/partner - returns household wealth assessment and shared affiliations
- nonprofit_affiliation_search: AUTOMATIC person-to-nonprofit workflow - web search + ProPublica lookup
- property_valuation: AVM (Automated Valuation Model) for real estate - uses hedonic pricing + comparables
- rental_investment: Rental analysis - rent estimate, cap rate, cash-on-cash return, cash flow
- prospect_profile: AI wealth/capacity scoring + verified evidence - outputs donor rating (A-D) with source citations
- nonprofit_board_search: Find ALL nonprofit board positions for a person
- giving_history: Aggregate giving history from FEC, foundations, public records
- gleif_search/lookup: Global LEI database - corporate ownership chains, parent relationships\n\n`
    }

    description += `### Research Strategy
1. Run 6-10 **searchWeb** queries covering property, business, philanthropy
2. Use **data API tools** to get detailed info on discovered entities
3. **propublica workflow**: searchWeb to find nonprofit names → propublica_nonprofit_search with ORG name
4. **business ownership**: See Business & Ownership Research section below for which tool to use
5. **compliance screening**: ALWAYS run opensanctions_screening for major donor prospects (PEP/sanctions check)
6. Run tools in parallel when possible. Be thorough.

### Business & Ownership Research
**TOOL SELECTION GUIDE** - Choose the right tool based on your goal:

| Goal | Tool | When to Use |
|------|------|-------------|
| Find PUBLIC company roles | business_affiliation_search | Board seats, officer positions at NYSE/NASDAQ companies |
| Find PRIVATE business ownership | find_business_ownership | LLCs, private corps, small businesses |
| Search by COMPANY name | business_registry_scraper | Know the company, need officers/details |
| Verify SPECIFIC public role | sec_insider_search | Confirm someone is insider at specific public company |

**State Registry Knowledge (for find_business_ownership & business_registry_scraper):**
- **Delaware (DE)**: Most LLCs/corps registered here. ICIS system - may hit CAPTCHA
- **Florida (FL)**: Sunbiz - most reliable scraper. Officer + Registered Agent search
- **New York (NY)**: Has Open Data API (FREE, fast). Falls back to web search
- **California (CA)**: bizfile React SPA - searches active entities
- **Colorado (CO)**: Socrata Open Data API - very reliable

**Ownership Inference Logic:**
- LLC Managing Member = likely OWNER (personal liability)
- S-Corp President = likely OWNER (small corps)
- C-Corp Officer = may be employee (check for founder indicators)
- Registered Agent = may just be service provider, not owner
- Multiple officer roles at SAME address = likely owner

### Board & Officer Validation (PUBLIC COMPANIES)
When verifying board membership or officer status:
1. **sec_insider_search("[person name]")** - If results found, they ARE an insider (officer/director/10%+ owner)
2. **sec_proxy_search("[company name]")** - Lists ALL directors and officers from DEF 14A proxy statement

### Due Diligence Workflow
For comprehensive prospect due diligence:
1. **opensanctions_screening** - Check for sanctions/PEP status (REQUIRED for major gifts)
2. **business_affiliation_search** - Find PUBLIC company affiliations (SEC + Wikidata + Web)
3. **find_business_ownership** - Find PRIVATE business ownership (state registries)
4. **court_search** - Check for litigation history
5. **lobbying_search** - Discover political connections
6. **fec_contributions** - Political giving patterns
7. **household_search** - Identify spouse/household wealth\n`
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
