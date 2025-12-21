/**
 * Batch Prospect Report Generator
 * Generates comprehensive prospect research reports using AI + web search
 *
 * Two modes:
 * - Standard: Fast 2-search approach for quick prioritization
 * - Comprehensive: Full agentic research using all available tools (search, ProPublica, SEC, FEC, Wikidata, etc.)
 */

import { streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ProspectInputData, BatchProspectItem, BatchSearchMode } from "./types"
import { buildProspectQueryString } from "./parser"
import { buildBatchTools, getToolDescriptions, extractSourcesFromToolResults } from "./batch-tools"
import {
  getRomyScore,
  RomyScoreDataPoints,
  RomyScoreBreakdown,
} from "@/lib/romy-score"

// ============================================================================
// STANDARD MODE PROMPT
// ============================================================================

/**
 * System prompt for Standard mode - produces concise but comprehensive prospect summaries
 * Includes all key wealth indicators in a compact format
 */
const STANDARD_MODE_SYSTEM_PROMPT = `You are Rōmy, a prospect research assistant. Generate a CONCISE but COMPREHENSIVE prospect summary for major gift screening.

## OUTPUT FORMAT (follow this structure exactly):

### Summary
[1-2 sentence overview: who they are, primary wealth source, and giving potential]

### Real Estate
- **Primary:** [Address] - Est. Value: $[amount] | [Owner/Renter]
- **Additional Properties:** [List any others found, or "None found"]
- **Total Real Estate:** $[amount]

### Business Interests
- **Ownership:** [Company name(s), role(s), est. value if known - or "No business ownership found"]
- **Executive Positions:** [Current title/company if employed - or "Not found"]
- **Board Seats:** [Corporate/nonprofit boards - or "None found"]

### Securities & Stock Holdings
- **Public Company Affiliations:** [If SEC insider or executive - or "None found"]
- **Known Holdings:** [Stock positions if found - or "Not disclosed"]

### Political Giving
- **FEC Contributions:** [Total amount, party lean if clear - or "No federal contributions found"]
- **Pattern:** [Frequency/size of gifts - or "N/A"]

### Philanthropic Profile
- **Foundation Connections:** [Foundations they run/serve on - or "None found"]
- **Known Major Gifts:** [Documented charitable gifts - or "None found"]
- **Nonprofit Board Service:** [Organizations - or "None found"]
- **Giving Interests:** [Causes they support based on evidence]

### Capacity Assessment

| Metric | Value |
|--------|-------|
| **Est. Net Worth** | $[amount] |
| **Est. Gift Capacity** | $[amount] |
| **Capacity Rating** | [MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL] |
| **RōmyScore™** | [X]/41 — [Tier Name] |
| **Recommended Ask** | $[amount] |

### Cultivation Strategy
[2-3 bullet points: specific next steps for engagement, who should reach out, timing considerations]

### Sources
[List 2-4 key sources used: property records, SEC, FEC, news, etc.]

---

## SCORING GUIDE (RōmyScore):

**Property Value:** >$2M=12pts | $1M-$2M=10pts | $750K-$1M=8pts | $500K-$750K=6pts | $250K-$500K=4pts | <$250K=2pts

**Business Ownership:** Founder/Owner=12pts | CEO/President=10pts | C-Suite/VP=8pts | Director=5pts | None=0pts

**Additional:** Multiple properties +3pts | Multiple businesses +3pts | Public company executive +5pts | Foundation board +3pts | Political donor ($10K+) +2pts

**Score Tiers:**
- 31-41: Transformational Prospect (MAJOR capacity, $25K+)
- 21-30: High-Capacity Major Donor (PRINCIPAL capacity, $10K-$25K)
- 11-20: Mid-Capacity Growth (LEADERSHIP capacity, $5K-$10K)
- 0-10: Emerging/Annual Fund (ANNUAL capacity, <$5K)

## CAPACITY RATINGS:
- **MAJOR:** Property >$750K AND business owner/executive = Gift Capacity $25K+
- **PRINCIPAL:** Property >$500K OR significant business role = Gift Capacity $10K-$25K
- **LEADERSHIP:** Property >$300K OR professional role = Gift Capacity $5K-$10K
- **ANNUAL:** Lower indicators = Gift Capacity <$5K

## RULES:
- Keep each section BRIEF (1-3 lines max per section)
- Use "None found" or "Not disclosed" when data unavailable - don't leave blanks
- Always include specific dollar amounts where possible
- Base estimates on actual findings, not guesses
- Recommended Ask = 1-2% of estimated net worth for annual, 5-10% for campaign
- Total report should be ~300-400 words, NOT a full research dossier

---

## CRITICAL: CAPACITY ASSESSMENT TABLE FORMAT

You MUST include the Capacity Assessment table in EXACTLY this format for data extraction:

| Metric | Value |
|--------|-------|
| **Est. Net Worth** | $[AMOUNT] |
| **Est. Gift Capacity** | $[AMOUNT] |
| **Capacity Rating** | [MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL] |
| **RōmyScore™** | [SCORE]/41 — [TIER] |
| **Recommended Ask** | $[AMOUNT] |

REQUIREMENTS:
- Use exact column headers as shown
- Dollar amounts MUST start with $ symbol
- RōmyScore MUST use X/41 format
- Capacity Rating MUST be one of: MAJOR, PRINCIPAL, LEADERSHIP, ANNUAL
- This table is REQUIRED - never skip it`

// ============================================================================
// PROFESSIONAL SUMMARY PROMPT (Concise 1-2 Page Format)
// ============================================================================

/**
 * System prompt for Professional Summary mode - concise prospect summaries
 * designed for reliable data extraction.
 *
 * Key features:
 * - Table-first format for consistent metric extraction
 * - ~600-800 words output (1-2 pages)
 * - All key metrics in a single extractable table
 */
const PROFESSIONAL_SUMMARY_PROMPT = `You are Rōmy, a prospect research assistant. Generate a PROFESSIONAL SUMMARY for major gift screening.

## OUTPUT FORMAT (REQUIRED - Follow this EXACT structure)

### Prospect Summary: [Full Name]
**Address:** [Full Address] | **Report Date:** [Current Date]

---

### Key Metrics
| Metric | Value |
|--------|-------|
| **RōmyScore™** | [X]/41 — [Tier Name] |
| **Est. Net Worth** | $[Amount] |
| **Est. Gift Capacity** | $[Amount] |
| **Capacity Rating** | [MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL] |
| **Recommended Ask** | $[Amount] |

---

### Executive Summary
[2-3 sentences: who they are, primary wealth source, and giving potential]

---

### Wealth Indicators

**Real Estate**
- Primary Residence: [Address] - Est. Value: $[X]
- Additional Properties: [Count] properties totaling $[X] (or "None found")
- **Total Real Estate:** $[X]

**Business Interests**
- [Company Name] - [Role] - Est. Value: $[X] (or "No business ownership found")

**Securities & Holdings**
- [SEC filings if any, or "None found in public filings"]

---

### Philanthropic Profile

**Political Giving (FEC)**
- Total: $[X] | Party Lean: [Republican/Democratic/Bipartisan/None found]

**Foundation Connections**
- [Foundation Name] - [Role] (or "No foundation affiliations found")

**Nonprofit Board Service**
- [Organization] - [Role] (or "None found")

**Known Major Gifts**
- [Organization] - $[X] - [Year] (or "None documented")

---

### Cultivation Strategy
1. [Specific next step with who should execute]
2. [Second action item]
3. [Third action item]

---

### Sources
- [Source 1]: [What it provided]
- [Source 2]: [What it provided]
- [Source 3]: [What it provided]

---

## SCORING GUIDE (RōmyScore):
- 31-41: Transformational Prospect (MAJOR capacity, $25K+)
- 21-30: High-Capacity Major Donor (PRINCIPAL capacity, $10K-$25K)
- 11-20: Mid-Capacity Growth (LEADERSHIP capacity, $5K-$10K)
- 0-10: Emerging/Annual Fund (ANNUAL capacity, <$5K)

## CAPACITY RATINGS:
- **MAJOR:** Property >$750K AND business owner/executive = Gift Capacity $25K+
- **PRINCIPAL:** Property >$500K OR significant business role = Gift Capacity $10K-$25K
- **LEADERSHIP:** Property >$300K OR professional role = Gift Capacity $5K-$10K
- **ANNUAL:** Lower indicators = Gift Capacity <$5K

## RULES:
- Use "None found" or "Not disclosed" when data unavailable - don't leave blanks
- Always include specific dollar amounts where possible
- Base estimates on actual findings, not guesses
- Recommended Ask = 1-2% of estimated net worth for annual, 5-10% for campaign
- Keep report concise (~600-800 words)

---

## CRITICAL: KEY METRICS TABLE FORMAT

You MUST include the Key Metrics table in EXACTLY this format for data extraction:

| Metric | Value |
|--------|-------|
| **RōmyScore™** | [SCORE]/41 — [TIER] |
| **Est. Net Worth** | $[AMOUNT] |
| **Est. Gift Capacity** | $[AMOUNT] |
| **Capacity Rating** | [MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL] |
| **Recommended Ask** | $[AMOUNT] |

REQUIREMENTS:
- Use exact column headers as shown (e.g., "Est. Net Worth" not "Estimated Net Worth")
- Dollar amounts MUST start with $ symbol
- RōmyScore MUST use X/41 format (e.g., "25/41 — High-Capacity Major Donor")
- Capacity Rating MUST be one of: MAJOR, PRINCIPAL, LEADERSHIP, ANNUAL
- This table is REQUIRED - never skip it`

// ============================================================================
// COMPREHENSIVE MODE PROMPT (15-Section Template with Anti-Fabrication Rules)
// ============================================================================

/**
 * System prompt for Comprehensive mode - uses all available research tools
 * to produce data-rich, grounded prospect research reports matching the
 * exact 15-section structure of professional prospect research reports.
 *
 * CRITICAL: Includes anti-fabrication rules to ensure data quality.
 */
const COMPREHENSIVE_MODE_SYSTEM_PROMPT = `You are Rōmy, an expert prospect research assistant for nonprofit fundraising. Generate a COMPREHENSIVE prospect research report using all available research tools.

## CRITICAL RULES - ANTI-FABRICATION

**These rules are NON-NEGOTIABLE. Violation means report failure.**

1. **NEVER FABRICATE DATA.** If information is not found, state "Not found in public records."
2. **MARK ALL ESTIMATES.** Anything not from official sources must be marked [Estimated] with methodology.
3. **CITE EVERY CLAIM.** Each fact must have a source reference in [brackets].
4. **USE RANGES FOR ESTIMATES.** Net worth = range (e.g., $10M-$20M), not precise numbers.
5. **CONFIDENCE LEVELS.** Rate data quality: HIGH (official), MEDIUM (corroborated), LOW (single source).

## DATA QUALITY HIERARCHY

| Confidence | Sources | Marking |
|------------|---------|---------|
| HIGH | SEC, FEC, County Assessor, IRS 990 | [Verified] |
| MEDIUM | 2+ web sources agreeing | [Corroborated] |
| LOW | Single web source | [Unverified] |
| ESTIMATED | Calculated from indicators | [Estimated - Methodology: X] |

---

## RESEARCH APPROACH - USE ALL TOOLS THOROUGHLY

You have access to powerful research tools. Use them ALL to gather comprehensive data.

### MANDATORY RESEARCH WORKFLOW:

**STEP 1: Property Assessment (county_assessor + property_valuation)**
1. county_assessor - OFFICIAL government data (HIGH confidence)
2. property_valuation - AVM estimate with comparables
3. searchWeb for additional properties

**STEP 2: Business & Ownership**
1. find_business_ownership - State registry search
2. business_affiliation_search - PUBLIC company roles
3. business_revenue_estimate - Revenue estimate with methodology
4. sec_insider_search - Verify public company positions

**STEP 3: Family & Household**
1. family_discovery - Spouse, children from public records
2. voter_registration - Party affiliation, registration data
3. household_search - Combined household assessment

**STEP 4: Philanthropic Profile**
1. nonprofit_affiliation_search - Foundation connections
2. foundation_grants - 990-PF Schedule I (where do they give?)
3. fec_contributions - Political giving patterns
4. giving_history - Aggregate giving data

**STEP 5: Background & Due Diligence**
1. wikidata_search + wikidata_entity - Biographical data
2. opensanctions_screening - PEP/sanctions check
3. searchWeb - Career history, education, publications

---

## OUTPUT FORMAT - 15-SECTION PROFESSIONAL REPORT

Produce the report following this EXACT structure:

---

# Donor Profile: [Full Name(s)]

**Report Date:** [Current Date]
**Address:** [Full Address]
**Prepared For:** [Organization Name]
**Research Confidence:** [HIGH/MEDIUM/LOW]

---

## 1. Executive Summary

[2-3 paragraphs synthesizing:
- Who they are and primary wealth source
- Net worth range with confidence level
- Giving capacity estimate with methodology
- Philanthropic interests discovered
- Key recommendation]

---

## 2. Personal Background and Contact Information

### Full Names
- [Name 1] (age [X]; born [Month Year]) [Source: Voter Registration/Wikidata]
- [Spouse if found] (age [X]; born [Month Year]) [Source: X]

### Residence
[Full Address]
- Property Type: [Single Family/Condo/etc.]
- Official Assessed Value: $[X] [Source: County Assessor - VERIFIED]
- Estimated Market Value: $[X] [Source: AVM/Zillow - ESTIMATED]
- Purchase History: [If found]

### Marital Status
[Status] [Source: Property records/Voter Registration/Family Discovery]

### Family
[List from family_discovery tool with relationship and confidence]

### Political Affiliation
[Party] [Source: Voter Registration or FEC pattern analysis]
- Methodology if from FEC: [Explain pattern]

### Religious Affiliation
[If found] [Source: X] or "Not found in public records"

### Contact Information
- Phone: [If found] or "Not found in public records"
- Email: [If found] or "Not found in public records"
- Social Media: [If found] or "Not found in public records"

---

## 3. Professional Background

### [Name] - Career Profile

**Current Primary Roles:**
1. **[Title], [Company]** (since [Year])
   - Role Details: [Description]
   - Company Type: [Public/Private/LLC]
   - Revenue Estimate: $[X]-$[Y] [Estimated - Methodology: Employee count × industry benchmark]
   - Employees: ~[X] [Source: Web search/LinkedIn]
   - Ownership: [If determinable] [Source: State Registry]

### Education
- [Degree], [Institution], [Year] [Source: Wikidata/Web Search]
- [Additional degrees]

### Prior Career
[Chronological list with sources]

### Notable Accomplishments & Publications
[From web search - each with source]

---

## 4. Wealth Indicators and Asset Profile

### Estimated Net Worth: $[Low] - $[High]

**Confidence Level:** [HIGH/MEDIUM/LOW]

### Wealth Basis
| Source | Value | Confidence | Notes |
|--------|-------|------------|-------|
| Real Estate | $[X] | [Level] | [Number] properties |
| Business Equity | $[X] | [Level] | [Methodology] |
| Public Holdings | $[X] | [Level] | [If SEC insider] |
| Other Assets | $[X] | [Level] | [Basis] |
| **TOTAL** | **$[X]-$[Y]** | | |

---

## 5. Real Estate Holdings

| Property | Details | Assessed Value | Market Value | Source |
|----------|---------|----------------|--------------|--------|
| [Address 1] | [Bed/Bath/SqFt] | $[X] [Verified] | $[Y] [Estimated] | County Assessor/AVM |
| [Address 2] | [Details] | $[X] | $[Y] | [Source] |

**Total Real Estate:** $[X] [Methodology: Sum of market values]

---

## 6. Business Interests and Income

### [Company Name 1]
- **Entity Type:** [LLC/Corp/etc.] [Source: State Registry]
- **Role:** [Title/Position] [Source: Registry/SEC]
- **Ownership Inference:** [X%] [Methodology: Managing Member = likely owner]
- **Revenue Estimate:** $[X]-$[Y] [Estimated - Employee count × $[Z]/employee]
- **Equity Value:** $[X]-$[Y] [Estimated - Revenue × [industry multiple]]

### [Company Name 2]
[Same format]

**Total Business Interests:** $[X]-$[Y] [Estimated]

---

## 7. Other Assets and Income Sources

- **Stock Holdings:** [From SEC Form 4 or "Not found"] [Source]
- **Publishing/Speaking:** [If found] [Source]
- **Board Compensation:** [If found] [Source]
- **Lifestyle Indicators:** [Notable expenditures found] [Source]

---

## 8. Philanthropic History, Interests, and Giving Capacity

### Giving Vehicle
[Foundation Name] or "Direct giving (no foundation found)"
- **EIN:** [Number] [Source: ProPublica 990]
- **Type:** Private Family Foundation / DAF / Direct
- **Total Assets:** $[X] [Source: 990]
- **Annual Grants:** $[X] [Source: 990]

### Documented Philanthropic Interests

**[Category 1] (Primary Interest)**
| Recipient | Amount | Year | Source |
|-----------|--------|------|--------|
| [Org 1] | $[X] | [Year] | [990/News] |

**[Category 2]**
[Same format]

### FEC Political Contributions
- **Total Giving:** $[X] [Source: FEC]
- **Party Lean:** [Republican/Democratic/Bipartisan]
- **Pattern:** [Frequency, typical gift size]

---

## 9. Giving Philosophy and Approach

[Key insights from behavior/writings - each with source]
- [Insight 1] [Source: Interview/Speech/Article]
- [Insight 2] [Source]

---

## 10. Giving Capacity Assessment

### Annual Giving Capacity: $[X] - $[Y]
**Methodology:** [Explain calculation]
- Net worth $[X] × 1-2% = $[Y] annual capacity
- Historical giving: $[Z]/year average

### Major Gift Capacity: $[X] - $[Y]
**Methodology:** [Explain calculation]
- Net worth $[X] × 5-10% = $[Y] major gift capacity
- Largest documented gift: $[Z]

### Capacity Rating: [MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL]

---

## 11. Engagement and Solicitation Strategy

### Key Positioning Points
1. [Point based on discovered interests]
2. [Point based on professional background]
3. [Point based on philanthropic history]

### Recommended Engagement Approach

**Phase 1: Relationship Building**
- [Specific actions]
- [Who should reach out]

**Phase 2: Strategic Cultivation**
- [Actions to deepen engagement]

**Phase 3: Strategic Solicitation**
- [Recommended ask]
- [Timing considerations]

### Connection Points and Affinity

| Affinity Area | Connection | Source |
|---------------|------------|--------|
| [Area] | [Evidence] | [Source] |

### Solicitation Guardrails (What NOT to Do)
- [Based on prospect profile - be specific]

### Success Indicators & Red Flags
**Green Lights:** [What would indicate readiness]
**Red Flags:** [Warning signs to watch for]

---

## 12. Summary: Major Giving Assessment

**Prospect Rating:** [PREMIUM/HIGH/MID/EMERGING]

| Metric | Value |
|--------|-------|
| **RōmyScore™** | [X]/41 — [Tier Name] |
| **Est. Net Worth** | $[X]-$[Y] |
| **Est. Gift Capacity** | $[X]-$[Y] |
| **Recommended Ask** | $[X] |

**Why They Matter:**
1. [Reason with evidence]
2. [Reason with evidence]
3. [Reason with evidence]

**Recommended Approach:** [Summary in 1-2 sentences]

---

## 13. Due Diligence Notes

### Sanctions/PEP Screening
- **Result:** [CLEAR/LOW/MEDIUM/HIGH] [Source: OpenSanctions]
- **Details:** [Any findings]

### Court Records
- **Litigation:** [If found] [Source: CourtListener]

### Other Considerations
- [Any reputational notes with sources]

---

## 14. Sources and Research Methodology

### Primary Sources Verified
| Source | Data Provided | Confidence |
|--------|---------------|------------|
| County Assessor | Property values | HIGH |
| FEC | Political contributions | HIGH |
| SEC EDGAR | Insider status | HIGH |
| ProPublica 990 | Foundation data | HIGH |
| State Registry | Business ownership | HIGH |
| [Web Sources] | [Data] | MEDIUM/LOW |

### Estimates and Calculations
| Estimate | Methodology | Confidence |
|----------|-------------|------------|
| Net Worth | Sum of real estate + business equity | MEDIUM |
| Business Revenue | Employee count × industry benchmark | LOW |
| Gift Capacity | Net worth × capacity percentage | MEDIUM |

### Research Confidence Level: [HIGH/MEDIUM/LOW]
[Explanation of overall data quality]

---

## 15. Conclusion

[2 paragraphs summarizing:
1. The opportunity this prospect represents with key evidence
2. Recommended next steps and timeline]

---

## SCORING GUIDE (RōmyScore):
- 31-41: Transformational Prospect (MAJOR capacity, $25K+)
- 21-30: High-Capacity Major Donor (PRINCIPAL capacity, $10K-$25K)
- 11-20: Mid-Capacity Growth (LEADERSHIP capacity, $5K-$10K)
- 0-10: Emerging/Annual Fund (ANNUAL capacity, <$5K)

## CAPACITY RATINGS:
- **MAJOR:** Property >$750K AND business owner/executive = Gift Capacity $25K+
- **PRINCIPAL:** Property >$500K OR significant business role = Gift Capacity $10K-$25K
- **LEADERSHIP:** Property >$300K OR professional role = Gift Capacity $5K-$10K
- **ANNUAL:** Lower indicators = Gift Capacity <$5K

## FINAL REMINDERS:
- Every claim needs a source in [brackets]
- Every estimate needs [Estimated - Methodology: X]
- "Not found in public records" is better than fabrication
- Use tables for clarity
- Be direct - no sycophancy or filler language`

// ============================================================================
// TYPES
// ============================================================================

interface GenerateReportOptions {
  prospect: ProspectInputData
  enableWebSearch: boolean
  generateRomyScore: boolean
  searchMode?: BatchSearchMode
  apiKey?: string
  organizationContext?: string
}

interface GenerateReportResult {
  success: boolean
  report_content?: string
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
  search_queries_used?: string[]
  sources_found?: Array<{ name: string; url: string }>
  tokens_used?: number
  error_message?: string
}

interface WebSearchResult {
  answer: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  query: string
}

// ============================================================================
// WEB SEARCH
// ============================================================================

// Note: Perplexity Sonar Reasoning has built-in web search - no separate search tool needed
// The model will search the web naturally during agentic research

async function performWebSearch(query: string): Promise<WebSearchResult | null> {
  // Web search is now built into Perplexity Sonar Reasoning model
  // Returning null to indicate separate web search is not available
  // The model handles web search natively during generation
  console.log(`[BatchProcessor] Web search for "${query}" - handled by model's built-in search`)
  return null
}

// ============================================================================
// SEARCH QUERIES FOR PROSPECT RESEARCH
// ============================================================================

/**
 * Generate search queries for Standard mode (quick prioritization)
 * Run 5-6 targeted searches to build a complete picture
 * Each search costs ~$0.005 - thoroughness is expected
 */
function generateStandardSearchQueries(prospect: ProspectInputData): string[] {
  const name = prospect.name
  const location = [prospect.city, prospect.state].filter(Boolean).join(", ")
  const fullAddress = buildProspectQueryString(prospect)
  const state = prospect.state || ""

  const queries: string[] = []

  // Business ownership searches (multiple angles)
  queries.push(`"${name}" ${location} business owner company founder CEO`)
  queries.push(`"${name}" ${location} president executive LLC`)
  if (state) {
    queries.push(`"${name}" ${state} secretary of state corporation registered agent`)
  }

  // Property/real estate searches (multiple sources for triangulation)
  if (prospect.address || prospect.full_address) {
    queries.push(`"${fullAddress}" home value Zillow Redfin estimate`)
    queries.push(`"${fullAddress}" property records tax assessment sold price`)
    // County assessor search if we can infer county
    queries.push(`"${fullAddress}" county assessor property tax`)
  } else {
    queries.push(`"${name}" ${location} property home owner real estate`)
    queries.push(`"${name}" ${location} property records tax assessment`)
  }

  // Additional wealth indicators
  queries.push(`"${name}" ${location} philanthropy foundation board nonprofit donor`)

  return queries
}

// ============================================================================
// COMPILE SEARCH RESULTS INTO CONTEXT
// ============================================================================

function compileSearchContext(
  searchResults: (WebSearchResult | null)[]
): { context: string; allSources: Array<{ name: string; url: string }> } {
  const validResults = searchResults.filter((r): r is WebSearchResult => r !== null)

  if (validResults.length === 0) {
    return { context: "", allSources: [] }
  }

  const contextParts: string[] = []
  const allSources: Array<{ name: string; url: string }> = []

  validResults.forEach((result, index) => {
    contextParts.push(`### Search ${index + 1}: ${result.query}`)
    contextParts.push(result.answer)
    contextParts.push("")

    result.sources.forEach((source) => {
      if (!allSources.some((s) => s.url === source.url)) {
        allSources.push({ name: source.name, url: source.url })
      }
    })
  })

  return {
    context: contextParts.join("\n"),
    allSources,
  }
}

// ============================================================================
// EXTRACT METRICS FROM REPORT
// ============================================================================

/**
 * Parse a dollar amount from various formats
 * Handles: $1,000,000 | $1M | $1.5M | $500K | **$1,000,000** | <$1K | <1K$ | $500-$1,000 | Under $500 etc.
 */
function parseDollarAmount(str: string): number | null {
  if (!str) return null

  // Remove markdown formatting and trim
  const cleaned = str.replace(/\*\*/g, "").replace(/\*/g, "").trim()

  // Skip N/A, None, TBD, etc.
  if (/^(n\/a|none|tbd|unknown|not\s+available)/i.test(cleaned)) {
    return null
  }

  // Handle "Under $X" or "Less than $X" - use the value as upper bound
  const underMatch = cleaned.match(/(?:under|less\s+than|below)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?/i)
  if (underMatch) {
    let value = parseFloat(underMatch[1].replace(/,/g, ""))
    const suffix = underMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Handle "<$1K" or "<$1,000" or "<1K$" or "<38K" (no dollar sign) patterns
  const lessThanMatch = cleaned.match(/<\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?\s*\$?/i)
  if (lessThanMatch) {
    let value = parseFloat(lessThanMatch[1].replace(/,/g, ""))
    const suffix = lessThanMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Handle ">$1K" or ">$1,000" or ">38K" (no dollar sign) patterns - use the lower bound
  const greaterThanMatch = cleaned.match(/>\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?\s*\$?/i)
  if (greaterThanMatch) {
    let value = parseFloat(greaterThanMatch[1].replace(/,/g, ""))
    const suffix = greaterThanMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Handle ranges like "$500-$1,000" or "$500 - $1K" - use the higher value
  const rangeMatch = cleaned.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?\s*[-–—to]+\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?/i)
  if (rangeMatch) {
    let value2 = parseFloat(rangeMatch[3].replace(/,/g, ""))
    const suffix2 = rangeMatch[4]?.toUpperCase()
    if (suffix2 === "M") value2 *= 1000000
    else if (suffix2 === "K") value2 *= 1000
    else if (suffix2 === "B") value2 *= 1000000000
    return isNaN(value2) ? null : value2
  }

  // Handle "1K$" pattern (suffix before or after dollar sign)
  const reversedMatch = cleaned.match(/([\d,]+(?:\.\d+)?)\s*([MKBmkb])\s*\$?/i)
  if (reversedMatch) {
    let value = parseFloat(reversedMatch[1].replace(/,/g, ""))
    const suffix = reversedMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Standard patterns: $1.5M, $500K, $1,000,000
  const match = cleaned.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?/i)
  if (!match) return null

  let value = parseFloat(match[1].replace(/,/g, ""))
  const suffix = match[2]?.toUpperCase()

  if (suffix === "M") value *= 1000000
  else if (suffix === "K") value *= 1000
  else if (suffix === "B") value *= 1000000000

  return isNaN(value) ? null : value
}

function extractMetricsFromReport(content: string): {
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
} {
  const metrics: ReturnType<typeof extractMetricsFromReport> = {}

  // Extract RōmyScore - multiple patterns for flexibility
  // Pattern 1: "RōmyScore™: X/41" or "RōmyScore: X/41"
  // Pattern 2: "**RōmyScore™:** X/41"
  // Pattern 3: Just "X/41" near RōmyScore mention
  const romyScorePatterns = [
    /R[oō]myScore[™]?\s*[:=]\s*\**(\d+)\s*\/\s*41/i,
    /\*\*R[oō]myScore[™]?\*\*\s*[:=]?\s*\**(\d+)\s*\/\s*41/i,
    /R[oō]myScore[™]?[:\s]*\**(\d+)\**\s*\/\s*41/i,
    /(\d+)\s*\/\s*41\s*(?:points?)?/i,
  ]

  for (const pattern of romyScorePatterns) {
    const match = content.match(pattern)
    if (match) {
      const score = parseInt(match[1], 10)
      if (score >= 0 && score <= 41) {
        metrics.romy_score = score
        break
      }
    }
  }

  // Extract tier - look for tier names after score or in dedicated section
  const tierPatterns = [
    /(\d+)\s*\/\s*41\s*[—–-]+\s*\**([A-Za-z\s-]+?)(?:\**|\n|$)/i,
    /Score\s*Tier[:\s]*\**([A-Za-z\s-]+?)(?:\**|\n|\||$)/i,
    /\*\*(Transformational|High-Capacity|Mid-Capacity|Emerging|Low)[^*]*\*\*/i,
    /(Transformational|High-Capacity Major|Mid-Capacity Growth|Emerging|Low)[\s-]*(?:Donor)?[\s-]*(?:Target)?/i,
  ]

  for (const pattern of tierPatterns) {
    const match = content.match(pattern)
    if (match) {
      const tier = (match[2] || match[1]).trim().replace(/\*+/g, "")
      if (tier && tier.length > 2) {
        metrics.romy_score_tier = tier
        break
      }
    }
  }

  // Extract capacity rating - multiple formats
  const capacityPatterns = [
    // Table format: | **Capacity Rating** | MAJOR |
    /\|\s*\*\*Capacity\s*Rating\*\*\s*\|\s*\**\s*(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\s*\**\s*\|/i,
    /\|\s*Capacity\s*Rating\s*\|\s*\**\s*(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\s*\**\s*\|/i,
    // Bold format
    /\*\*\[?\s*(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\s*\]?\*\*/i,
    /Capacity\s*Rating[:\s]*\**\[?\s*(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\s*\]?\**/i,
    // Prose format
    /(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\s*(?:Gift)?\s*Prospect/i,
    /\|\s*Capacity[^|]*\|\s*\**\s*(Major|Principal|Leadership|Annual)\s*\**/i,
    // Plain format
    /Capacity\s*Rating[:\s]+(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)/i,
  ]

  for (const pattern of capacityPatterns) {
    const match = content.match(pattern)
    if (match) {
      metrics.capacity_rating = match[1].toUpperCase()
      break
    }
  }

  // Extract net worth - multiple formats including markdown tables, ranges, <$X, etc.
  const netWorthSectionPatterns = [
    // Markdown table format: | **Est. Net Worth** | $1,000,000 |
    /\|\s*\*\*Est\.?\s*Net\s*Worth\*\*\s*\|\s*([^|]+)\s*\|/i,
    /\|\s*Est\.?\s*Net\s*Worth\s*\|\s*([^|]+)\s*\|/i,
    // Bold header formats
    /\*\*Est\.?\s*Net\s*Worth:?\*\*\s*([^\n]+)/i,
    /\*\*Net\s*Worth:?\*\*\s*([^\n]+)/i,
    /\*\*Estimated\s*Net\s*Worth:?\*\*\s*([^\n]+)/i,
    // Standard formats
    /TOTAL\s*(?:ESTIMATED)?\s*NET\s*WORTH[^|\n]*\|?\s*\**\s*([^\n|]+)/i,
    /Estimated\s*Net\s*Worth[:\s]*([^\n|]+)/i,
    /\*\*(?:TOTAL\s*)?(?:ESTIMATED\s*)?NET\s*WORTH\*\*[:\s]*([^\n|]+)/i,
    /Net\s*Worth[:\s]*\$([^\n|,]+)/i,
    /Net\s*Worth[:\s|]+([^\n]+)/i,
    // Summary section patterns
    /Est\.?\s*Net\s*Worth[:\s]+\$([^\n|,]+)/i,
  ]

  for (const pattern of netWorthSectionPatterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const value = parseDollarAmount(match[1])
      if (value !== null && value > 0) {
        metrics.estimated_net_worth = value
        break
      }
    }
  }

  // Extract gift capacity - multiple formats including markdown tables
  const giftCapacitySectionPatterns = [
    // Markdown table format: | **Est. Gift Capacity** | $25,000 |
    /\|\s*\*\*Est\.?\s*Gift\s*Capacity\*\*\s*\|\s*([^|]+)\s*\|/i,
    /\|\s*Est\.?\s*Gift\s*Capacity\s*\|\s*([^|]+)\s*\|/i,
    // Bold header formats
    /\*\*Est\.?\s*Gift\s*Capacity:?\*\*\s*([^\n]+)/i,
    /\*\*Gift\s*Capacity:?\*\*\s*([^\n|]+)/i,
    /\*\*Estimated\s*Gift\s*Capacity:?\*\*\s*([^\n]+)/i,
    // Standard formats
    /(?:Est\.?\s*)?Gift\s*Capacity[:\s]*\$([^\n|,]+)/i,
    /(?:Est\.?\s*)?Gift\s*Capacity[:\s|]+([^\n]+)/i,
    /Giving\s*Capacity[:\s|]*([^\n|]+)/i,
    /Charitable\s*Capacity[:\s|]*([^\n|]+)/i,
    // Summary section patterns
    /Est\.?\s*Gift\s*Capacity[:\s]+\$([^\n|,]+)/i,
  ]

  for (const pattern of giftCapacitySectionPatterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const value = parseDollarAmount(match[1])
      if (value !== null && value > 0) {
        metrics.estimated_gift_capacity = value
        break
      }
    }
  }

  // Extract recommended ask - multiple formats including markdown tables
  const askSectionPatterns = [
    // Markdown table format: | **Recommended Ask** | $5,000 |
    /\|\s*\*\*Recommended\s*Ask\*\*\s*\|\s*([^|]+)\s*\|/i,
    /\|\s*Recommended\s*Ask\s*\|\s*([^|]+)\s*\|/i,
    // Standard formats
    /Recommended\s*Ask[:\s]*\$([^\n|,]+)/i,
    /Ask\s*Amount[:\s]*\$([^\n|,]+)/i,
    /Recommended\s*Ask[:\s|]+([^\n]+)/i,
    /\*\*Ask\s*Amount:?\*\*\s*([^\n|]+)/i,
    /\*\*Recommended\s*Ask:?\*\*\s*([^\n|]+)/i,
    /Ask[:\s]+\$([^\n|,]+)/i,
    /Suggested\s*Ask[:\s]*([^\n|]+)/i,
    /Initial\s*Ask[:\s]*([^\n|]+)/i,
  ]

  for (const pattern of askSectionPatterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const value = parseDollarAmount(match[1])
      if (value !== null && value > 0) {
        metrics.recommended_ask = value
        break
      }
    }
  }

  // Debug logging for troubleshooting
  // Log a preview of the content to help identify format issues
  console.log("[BatchProcessor] Report preview (first 800 chars):")
  console.log(content.substring(0, 800))
  console.log("---")

  // Log extraction results with success/failure for each field
  const extractionResults = {
    romy_score: metrics.romy_score ?? "NOT FOUND",
    romy_score_tier: metrics.romy_score_tier ?? "NOT FOUND",
    capacity_rating: metrics.capacity_rating ?? "NOT FOUND",
    estimated_net_worth: metrics.estimated_net_worth ?? "NOT FOUND",
    estimated_gift_capacity: metrics.estimated_gift_capacity ?? "NOT FOUND",
    recommended_ask: metrics.recommended_ask ?? "NOT FOUND",
  }

  const foundCount = Object.values(extractionResults).filter(v => v !== "NOT FOUND").length
  const totalFields = Object.keys(extractionResults).length

  console.log(`[BatchProcessor] Extraction results: ${foundCount}/${totalFields} fields extracted`)
  console.log("[BatchProcessor] Details:", extractionResults)

  // Warn if critical fields are missing
  if (extractionResults.estimated_net_worth === "NOT FOUND") {
    console.warn("[BatchProcessor] WARNING: Net worth not extracted - check report format")
  }
  if (extractionResults.estimated_gift_capacity === "NOT FOUND") {
    console.warn("[BatchProcessor] WARNING: Gift capacity not extracted - check report format")
  }
  if (extractionResults.romy_score === "NOT FOUND") {
    console.warn("[BatchProcessor] WARNING: RōmyScore not extracted - check report format")
  }

  return metrics
}

// ============================================================================
// ROMYSCORE DATA EXTRACTION FROM TOOL RESULTS
// ============================================================================

/**
 * Extract RomyScore data points from tool results
 * This creates structured data for deterministic scoring
 */
function extractDataPointsFromToolResults(
  toolResults: Array<{ toolName: string; result: unknown }>
): Partial<RomyScoreDataPoints> {
  const dataPoints: Partial<RomyScoreDataPoints> = {}

  for (const { toolName, result } of toolResults) {
    if (!result || typeof result !== "object") continue
    const resultObj = result as Record<string, unknown>

    // Extract from property_valuation tool
    if (toolName === "property_valuation") {
      if (typeof resultObj.estimatedValue === "number" && resultObj.estimatedValue > 0) {
        dataPoints.propertyValue = resultObj.estimatedValue
      }
    }

    // Extract from opencorporates_officer_search
    if (toolName === "opencorporates_officer_search") {
      const officers = resultObj.officers as Array<{
        name: string
        position: string
        companyName: string
        current: boolean
      }> | undefined

      if (officers && officers.length > 0) {
        dataPoints.businessRoles = officers
          .filter((o) => o.current)
          .map((o) => ({
            role: o.position,
            companyName: o.companyName,
            isPublicCompany: false, // OpenCorporates doesn't indicate this
          }))
      }
    }

    // Extract from sec_insider_search (indicates public company affiliation)
    if (toolName === "sec_insider_search") {
      const filings = resultObj.filings as Array<{
        companyName: string
        position?: string
      }> | undefined

      if (filings && filings.length > 0) {
        const existingRoles = dataPoints.businessRoles || []
        const secRoles = filings.map((f) => ({
          role: f.position || "Insider",
          companyName: f.companyName,
          isPublicCompany: true, // SEC filings = public company
        }))

        // Merge with existing, mark as public company
        dataPoints.businessRoles = [...existingRoles, ...secRoles]
      }
    }

    // Extract from yahoo_finance_profile
    if (toolName === "yahoo_finance_profile") {
      const executives = resultObj.executives as Array<{
        name: string
        title: string
      }> | undefined
      const companyName = resultObj.companyName as string | undefined

      if (executives && companyName) {
        const existingRoles = dataPoints.businessRoles || []
        const yahooRoles = executives.map((e) => ({
          role: e.title,
          companyName: companyName,
          isPublicCompany: true, // Yahoo Finance = public company
        }))
        dataPoints.businessRoles = [...existingRoles, ...yahooRoles]
      }
    }

    // Extract from fec_contributions
    if (toolName === "fec_contributions") {
      const totalAmount = resultObj.totalAmount as number | undefined
      if (typeof totalAmount === "number" && totalAmount > 0) {
        dataPoints.totalPoliticalGiving = totalAmount
      }
    }

    // Extract from propublica_nonprofit_search or nonprofit_affiliation_search
    if (toolName === "propublica_nonprofit_search" || toolName === "nonprofit_affiliation_search") {
      const organizations = resultObj.organizations as Array<{ name: string }> | undefined
      const affiliations = resultObj.affiliations as Array<{ organizationName: string }> | undefined

      if (organizations && organizations.length > 0) {
        dataPoints.foundationAffiliations = organizations.map((o) => o.name)
      } else if (affiliations && affiliations.length > 0) {
        dataPoints.foundationAffiliations = affiliations.map((a) => a.organizationName)
      }
    }

    // Extract from wikidata_entity
    if (toolName === "wikidata_entity") {
      const netWorth = resultObj.netWorth as number | undefined
      if (typeof netWorth === "number" && netWorth > 0) {
        dataPoints.publicNetWorth = netWorth
      }
    }

    // Extract from opensanctions_screening
    if (toolName === "opensanctions_screening") {
      const riskLevel = resultObj.riskLevel as "HIGH" | "MEDIUM" | "LOW" | "CLEAR" | undefined
      if (riskLevel) {
        dataPoints.sanctionsStatus = riskLevel
      }
    }
  }

  return dataPoints
}

/**
 * Calculate consistent RomyScore from tool results and cache it
 */
async function calculateConsistentRomyScore(
  prospect: ProspectInputData,
  toolResults: Array<{ toolName: string; result: unknown }>,
  aiExtractedMetrics: {
    estimated_net_worth?: number
    estimated_gift_capacity?: number
  }
): Promise<RomyScoreBreakdown> {
  // Extract structured data from tool results
  const extractedDataPoints = extractDataPointsFromToolResults(toolResults)

  // Also include AI-extracted metrics as fallback data points
  const dataPoints: Partial<RomyScoreDataPoints> = {
    ...extractedDataPoints,
  }

  // If we have AI-extracted net worth but no public net worth from tools
  if (aiExtractedMetrics.estimated_net_worth && !dataPoints.publicNetWorth) {
    // Don't use AI estimate for publicNetWorth - that's for verified public data only
    // But we can estimate property value if missing
    if (!dataPoints.propertyValue && aiExtractedMetrics.estimated_net_worth > 0) {
      // Rough estimate: property is often 20-40% of net worth for HNW individuals
      dataPoints.propertyValue = Math.round(aiExtractedMetrics.estimated_net_worth * 0.3)
    }
  }

  // Get cached score, merging with new data
  const breakdown = await getRomyScore(
    prospect.name,
    prospect.city,
    prospect.state,
    dataPoints
  )

  console.log(
    `[BatchProcessor] Consistent RomyScore for ${prospect.name}: ${breakdown.totalScore}/41 ` +
    `(${breakdown.tier.name}) - Confidence: ${breakdown.dataQuality.confidenceLevel}`
  )

  return breakdown
}

// ============================================================================
// MAIN REPORT GENERATION
// ============================================================================

/**
 * Generate a comprehensive prospect report using agentic AI with all available tools.
 * This mode gives the AI access to search, ProPublica, SEC, FEC, Wikidata, etc.
 * and lets it autonomously research the prospect using maxSteps.
 */
async function generateComprehensiveReportWithTools(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { prospect, apiKey } = options
  const startTime = Date.now()

  try {
    // Build the tools object - same tools as chat API
    const tools = buildBatchTools()
    const hasTools = Object.keys(tools).length > 0

    // Build prospect info for the prompt
    const prospectInfo = buildProspectQueryString(prospect)
    const additionalInfo = Object.entries(prospect)
      .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    // Build system prompt with tool descriptions
    let systemPrompt = COMPREHENSIVE_MODE_SYSTEM_PROMPT
    if (hasTools) {
      systemPrompt += "\n\n" + getToolDescriptions()
    }

    // User message for comprehensive research
    const userMessage = `Research this prospect and generate a comprehensive prospect research report:

**Prospect:** ${prospectInfo}
${additionalInfo ? `\n**Additional Information:**\n${additionalInfo}` : ""}

Use your research tools to gather data about this person:
1. Start with web search to find their professional background and affiliations
2. If you discover they're affiliated with foundations/nonprofits, search ProPublica for 990 data
3. If they're a public company executive, check SEC EDGAR for financial data
4. Check FEC for political contribution history
5. Use Wikidata for biographical details

After researching, produce the comprehensive report with all sections filled in based on your findings.`

    console.log(`[BatchProcessor] Starting comprehensive agentic research for: ${prospect.name}`)
    console.log(`[BatchProcessor] Available tools: ${Object.keys(tools).join(", ")}`)

    // Generate report using AI with tools
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })
    const model = openrouter.chat("x-ai/grok-4.1-fast")

    const result = await streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: hasTools ? tools : undefined,
      maxSteps: hasTools ? 25 : 1, // Allow 25 steps for thorough agentic research (8-12 searchWeb + data tools)
      maxTokens: 16000,
      temperature: 0.3,
    })

    // Collect the full response and track tool results
    let reportContent = ""
    const toolResults: Array<{ toolName: string; result: unknown }> = []

    for await (const chunk of result.textStream) {
      reportContent += chunk
    }

    // Get the full response to extract tool results for sources
    // Tool results are in steps from the AI SDK
    const steps = await result.steps
    for (const step of steps) {
      // Type-safe access to tool results - use type assertion since ToolSet is generic
      const stepToolResults = step.toolResults as Array<{
        toolName: string
        result: unknown
      }> | undefined
      if (stepToolResults && Array.isArray(stepToolResults)) {
        for (const toolResult of stepToolResults) {
          toolResults.push({
            toolName: toolResult.toolName,
            result: toolResult.result,
          })
        }
      }
    }

    // Extract sources from tool results
    const allSources = extractSourcesFromToolResults(toolResults)

    // Get usage stats
    const usage = await result.usage
    const tokensUsed = (usage?.promptTokens || 0) + (usage?.completionTokens || 0)

    // Extract AI-generated metrics from the report (for reference/fallback)
    const aiMetrics = extractMetricsFromReport(reportContent)

    // Calculate CONSISTENT RomyScore from tool results (deterministic)
    const romyBreakdown = await calculateConsistentRomyScore(
      prospect,
      toolResults,
      {
        estimated_net_worth: aiMetrics.estimated_net_worth,
        estimated_gift_capacity: aiMetrics.estimated_gift_capacity,
      }
    )

    const processingTime = Date.now() - startTime
    console.log(
      `[BatchProcessor] Comprehensive report generated for ${prospect.name} in ${processingTime}ms, ` +
        `tokens: ${tokensUsed}, tool calls: ${toolResults.length}, ` +
        `Consistent RōmyScore: ${romyBreakdown.totalScore}/41 (${romyBreakdown.tier.name})`
    )

    return {
      success: true,
      report_content: reportContent,
      // Use CONSISTENT scores from RomyScore system (not AI-extracted)
      romy_score: romyBreakdown.totalScore,
      romy_score_tier: romyBreakdown.tier.name,
      capacity_rating: romyBreakdown.tier.capacity,
      // Keep AI-extracted financial estimates (these are subjective anyway)
      estimated_net_worth: aiMetrics.estimated_net_worth,
      estimated_gift_capacity: aiMetrics.estimated_gift_capacity,
      recommended_ask: aiMetrics.recommended_ask,
      search_queries_used: toolResults.map((t) => `Tool: ${t.toolName}`),
      sources_found: allSources,
      tokens_used: tokensUsed,
    }
  } catch (error) {
    console.error("[BatchProcessor] Comprehensive report generation failed:", error)

    return {
      success: false,
      error_message: error instanceof Error ? error.message : "Report generation failed",
    }
  }
}

/**
 * Generate a standard report using tools + web search.
 * Uses all available research tools for comprehensive data gathering,
 * but produces a concise output format.
 */
async function generateStandardReport(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { prospect, apiKey } = options
  const startTime = Date.now()

  try {
    // Build the tools object - same tools as comprehensive mode
    const tools = buildBatchTools()
    const hasTools = Object.keys(tools).length > 0

    // Build prospect info for the prompt
    const prospectInfo = buildProspectQueryString(prospect)
    const additionalInfo = Object.entries(prospect)
      .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    // Build system prompt with tool descriptions
    // Use PROFESSIONAL_SUMMARY_PROMPT for better extraction compatibility
    let systemPrompt = PROFESSIONAL_SUMMARY_PROMPT
    if (hasTools) {
      systemPrompt += "\n\n" + getToolDescriptions()
    }

    const userMessage = `Research this prospect and generate a Professional Summary:

**Prospect:** ${prospectInfo}
${additionalInfo ? `\n**Additional Information:**\n${additionalInfo}` : ""}

Use your research tools to gather data:
1. Use searchWeb for property values, business ownership, and general background
2. Use propublica_nonprofit_search if you find foundation affiliations
3. Use fec_contributions for political giving history
4. Use yahoo_finance tools if they're a public company executive
5. Use sec_insider_search to verify board/officer positions at public companies

After researching, produce the concise prospect summary with ALL sections filled in. Include specific dollar amounts.`

    console.log(`[BatchProcessor] Starting standard research with tools for: ${prospect.name}`)
    console.log(`[BatchProcessor] Available tools: ${Object.keys(tools).join(", ")}`)

    // Generate report using AI with tools
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })
    const model = openrouter.chat("x-ai/grok-4.1-fast")

    const result = await streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: hasTools ? tools : undefined,
      maxSteps: hasTools ? 15 : 1, // Allow 15 steps for tool calls (fewer than comprehensive's 25)
      maxTokens: 4000,
      temperature: 0.3,
    })

    // Collect the full response and track tool results
    let reportContent = ""
    const toolResults: Array<{ toolName: string; result: unknown }> = []

    for await (const chunk of result.textStream) {
      reportContent += chunk
    }

    // Get tool results from steps
    const steps = await result.steps
    for (const step of steps) {
      const stepToolResults = step.toolResults as Array<{
        toolName: string
        result: unknown
      }> | undefined
      if (stepToolResults && Array.isArray(stepToolResults)) {
        for (const toolResult of stepToolResults) {
          toolResults.push({
            toolName: toolResult.toolName,
            result: toolResult.result,
          })
        }
      }
    }

    // Extract sources from tool results
    const allSources = extractSourcesFromToolResults(toolResults)

    // Get usage stats
    const usage = await result.usage
    const tokensUsed = (usage?.promptTokens || 0) + (usage?.completionTokens || 0)

    // Extract AI-generated metrics from the report
    const aiMetrics = extractMetricsFromReport(reportContent)

    console.log(`[BatchProcessor] Extracted metrics:`, {
      net_worth: aiMetrics.estimated_net_worth ?? "NOT FOUND",
      gift_capacity: aiMetrics.estimated_gift_capacity ?? "NOT FOUND",
      recommended_ask: aiMetrics.recommended_ask ?? "NOT FOUND",
    })

    // Calculate CONSISTENT RomyScore from tool results
    const romyBreakdown = await calculateConsistentRomyScore(
      prospect,
      toolResults,
      {
        estimated_net_worth: aiMetrics.estimated_net_worth,
        estimated_gift_capacity: aiMetrics.estimated_gift_capacity,
      }
    )

    const processingTime = Date.now() - startTime
    console.log(
      `[BatchProcessor] Standard report generated for ${prospect.name} in ${processingTime}ms, ` +
        `tokens: ${tokensUsed}, tool calls: ${toolResults.length}, ` +
        `RōmyScore: ${romyBreakdown.totalScore}/41 (${romyBreakdown.tier.name})`
    )

    return {
      success: true,
      report_content: reportContent,
      // Use CONSISTENT scores from RomyScore system
      romy_score: romyBreakdown.totalScore,
      romy_score_tier: romyBreakdown.tier.name,
      capacity_rating: romyBreakdown.tier.capacity,
      // Keep AI-extracted financial estimates
      estimated_net_worth: aiMetrics.estimated_net_worth,
      estimated_gift_capacity: aiMetrics.estimated_gift_capacity,
      recommended_ask: aiMetrics.recommended_ask,
      search_queries_used: toolResults.map((t) => `Tool: ${t.toolName}`),
      sources_found: allSources,
      tokens_used: tokensUsed,
    }
  } catch (error) {
    console.error("[BatchProcessor] Standard report generation failed:", error)

    return {
      success: false,
      error_message: error instanceof Error ? error.message : "Report generation failed",
    }
  }
}

/**
 * Main entry point for prospect report generation.
 * Routes to either standard (fast 2-search) or comprehensive (agentic with tools) mode.
 */
export async function generateProspectReport(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { searchMode = "standard" } = options

  // Route to appropriate generation mode
  if (searchMode === "comprehensive") {
    // Comprehensive mode: Full agentic research with all tools
    return generateComprehensiveReportWithTools(options)
  } else {
    // Standard mode: Fast 2-search approach (original implementation)
    return generateStandardReport(options)
  }
}

// ============================================================================
// PROCESS SINGLE BATCH ITEM
// ============================================================================

export async function processBatchItem(
  item: BatchProspectItem,
  settings: { enableWebSearch: boolean; generateRomyScore: boolean; searchMode?: BatchSearchMode },
  apiKey?: string
): Promise<GenerateReportResult> {
  const result = await generateProspectReport({
    prospect: item.input_data,
    enableWebSearch: settings.enableWebSearch,
    generateRomyScore: settings.generateRomyScore,
    searchMode: settings.searchMode || "standard",
    apiKey,
  })

  return result
}
