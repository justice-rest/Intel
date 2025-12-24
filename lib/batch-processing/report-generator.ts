/**
 * Batch Prospect Report Generator
 * Generates comprehensive prospect research reports using Grok 4.1 Fast with Perplexity Sonar Pro
 *
 * Two modes:
 * - Standard: Fast research for quick prioritization (~600-800 word summaries)
 * - Comprehensive: Thorough multi-source research (~15-section reports)
 *
 * Uses Grok 4.1 Fast via OpenRouter with:
 * - Perplexity Sonar Pro for grounded web search with citations
 * - High-effort reasoning for comprehensive analysis
 * - Native tool calling support
 */

import { streamText, generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  ProspectInputData,
  BatchProspectItem,
  BatchSearchMode,
  StructuredProspectData,
  SonarGrokReportResult,
  WealthIndicators,
  BusinessDetails,
  GivingHistory,
  Affiliations,
} from "./types"
import { buildProspectQueryString } from "./parser"
// Grok 4.1 Fast supports native tool calling - can be extended with additional tools in future
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

**STEP 1: Property Assessment**
1. Search for property records, county assessor data
2. Look for AVM estimates (Zillow, Redfin, etc.)
3. Search for additional properties

**STEP 2: Business & Ownership**
1. State business registry searches
2. SEC EDGAR for public company affiliations
3. LinkedIn/web for professional background

**STEP 3: Family & Household**
1. Spouse/partner information from public records
2. Voter registration data for party affiliation
3. Family foundation connections

**STEP 4: Philanthropic Profile**
1. ProPublica Nonprofit Explorer for 990 data
2. FEC.gov for political contributions
3. Foundation Directory for giving history

**STEP 5: Background & Due Diligence**
1. Biographical data from Wikipedia/Wikidata
2. News articles and publications
3. Career history and education

---

## OUTPUT FORMAT - PROFESSIONAL PROSPECT RESEARCH REPORT

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
[Status] [Source: Property records/Voter Registration]

### Family
[List with relationship and confidence]

### Political Affiliation
[Party] [Source: Voter Registration or FEC pattern analysis]

### Contact Information
- Phone: [If found] or "Not found in public records"
- Email: [If found] or "Not found in public records"
- Social Media: [If found] or "Not found in public records"

---

## 3. Professional Background

### Donor/Prospect – Comprehensive Career Profile

**Current Primary Roles:**
1. **[Title], [Company]** (since [Year])
   - Role Details: [Description]
   - Company Type: [Public/Private/LLC]
   - Revenue Estimate: $[X]-$[Y] [Estimated - Methodology: Employee count × industry benchmark]
   - Ownership: [If determinable] [Source: State Registry]

### Education
- [Degree], [Institution], [Year] [Source: Wikidata/Web Search]

### Prior Career
[Chronological list with sources]

### Notable Accomplishments
[From web search - each with source]

---

### Spouse – Comprehensive Background

**Name:** [Spouse Name]
**Occupation:** [Current role/profession]
**Education:** [Degrees if found]
**Professional Background:** [Career summary]
**Philanthropic Involvement:** [Any separate giving/board roles]

*If no spouse found: "Spouse information not found in public records"*

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

### Real Estate Holdings

| Property | Details | Assessed Value | Market Value | Source |
|----------|---------|----------------|--------------|--------|
| [Address 1] | [Bed/Bath/SqFt] | $[X] [Verified] | $[Y] [Estimated] | County Assessor/AVM |
| [Address 2] | [Details] | $[X] | $[Y] | [Source] |

**Total Real Estate:** $[X] [Methodology: Sum of market values]

---

### Business Interests and Income

**[Company Name 1]**
- Entity Type: [LLC/Corp/etc.] [Source: State Registry]
- Role: [Title/Position] [Source: Registry/SEC]
- Ownership Inference: [X%] [Methodology: Managing Member = likely owner]
- Revenue Estimate: $[X]-$[Y] [Estimated - Employee count × $[Z]/employee]
- Equity Value: $[X]-$[Y] [Estimated - Revenue × [industry multiple]]

**Total Business Interests:** $[X]-$[Y] [Estimated]

---

### Other Assets and Income Sources

- **Stock Holdings:** [From SEC Form 4 or "Not found"] [Source]
- **Board Compensation:** [If found] [Source]
- **Other Income:** [If found] [Source]

---

### Lifestyle Indicators

[Observable lifestyle factors that indicate wealth capacity]
- **Luxury Assets:** [Boats, aircraft, art collections, etc.]
- **Club Memberships:** [Country clubs, exclusive organizations]
- **Travel/Events:** [Major donor events, galas attended]
- **Other Indicators:** [Notable expenditures]

*If none found: "No notable lifestyle indicators found in public records"*

---

## 5. Philanthropic History, Interests, and Giving Capacity

### Giving Vehicle(s)
[Foundation Name] or "Direct giving (no foundation found)"
- **EIN:** [Number] [Source: ProPublica 990]
- **Type:** Private Family Foundation / DAF / Direct
- **Total Assets:** $[X] [Source: 990]
- **Annual Grants:** $[X] [Source: 990]

---

### Annual Giving Volume

| Year | Total Giving | Major Gifts | Sources |
|------|--------------|-------------|---------|
| [Year] | $[X] | [Notable gifts] | [990/FEC/News] |
| [Year] | $[X] | [Notable gifts] | [Source] |

**Average Annual Giving:** $[X]/year
**Largest Single Gift:** $[X] to [Organization] ([Year])

---

### Documented Philanthropic Interests

**[Category 1] (Primary Interest)**
| Recipient | Amount | Year | Source |
|-----------|--------|------|--------|
| [Org 1] | $[X] | [Year] | [990/News] |

**[Category 2]**
[Same format]

---

### Potential Additional Interests

Based on professional background, board service, and family connections:
- [Interest 1]: [Evidence/connection]
- [Interest 2]: [Evidence/connection]
- [Interest 3]: [Evidence/connection]

---

### FEC Political Contributions
- **Total Giving:** $[X] [Source: FEC]
- **Party Lean:** [Republican/Democratic/Bipartisan]
- **Pattern:** [Frequency, typical gift size]

---

### Giving Philosophy and Approach

[Key insights from behavior/writings - each with source]
- [Insight 1] [Source: Interview/Speech/Article]
- [Insight 2] [Source]

---

### Giving Capacity Assessment

#### Annual Fund Ask: $[X] - $[Y]
**Methodology:** Net worth $[X] × 0.5-1% = Annual giving capacity
*This represents sustainable yearly giving without impacting principal*

#### Capital Campaign Ask: $[X] - $[Y]
**Methodology:** Net worth $[X] × 3-5% = Major gift capacity
*This represents a one-time transformational gift over 3-5 years*

| Ask Type | Low Estimate | High Estimate | Basis |
|----------|--------------|---------------|-------|
| **Annual Fund** | $[X] | $[Y] | 0.5-1% of net worth |
| **Capital Campaign** | $[X] | $[Y] | 3-5% of net worth |
| **Planned Gift** | $[X] | $[Y] | 10-15% of estate |

**Capacity Rating:** [MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL]

---

## 6. Engagement and Solicitation Strategy

### Key Positioning Points
1. [Point based on discovered interests]
2. [Point based on professional background]
3. [Point based on philanthropic history]

---

### Recommended Engagement Approach

**Phase 1: Relationship Building** (Months 1-3)
- [Specific actions]
- [Who should reach out]
- [Touchpoint ideas]

**Phase 2: Strategic Cultivation** (Months 4-8)
- [Actions to deepen engagement]
- [Events/experiences to invite]
- [Information to share]

**Phase 3: Strategic Solicitation** (Months 9-12)
- [Recommended ask amount and type]
- [Who should make the ask]
- [Timing considerations]

---

### Connection Points and Affinity

| Affinity Area | Connection | Source |
|---------------|------------|--------|
| [Area] | [Evidence] | [Source] |

---

### Solicitation Guardrails (What NOT to Do)

Based on prospect profile:
- [Guardrail 1 - be specific to this prospect]
- [Guardrail 2]
- [Guardrail 3]

---

### Success Indicators & Red Flags

**Green Lights (Signs of Readiness):**
- [Indicator 1]
- [Indicator 2]
- [Indicator 3]

**Red Flags (Warning Signs):**
- [Warning 1]
- [Warning 2]

---

## 7. Summary: Major Giving Assessment

**Prospect Rating:** [PREMIUM/HIGH/MID/EMERGING]

| Metric | Value |
|--------|-------|
| **RōmyScore™** | [X]/41 — [Tier Name] |
| **Est. Net Worth** | $[X]-$[Y] |
| **Est. Gift Capacity** | $[X]-$[Y] |
| **Annual Fund Ask** | $[X]-$[Y] |
| **Capital Campaign Ask** | $[X]-$[Y] |

**Why They Matter:**
1. [Reason with evidence]
2. [Reason with evidence]
3. [Reason with evidence]

**Recommended Approach:** [Summary in 1-2 sentences]

---

## 8. Sources and Research Methodology

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
| Annual Fund Ask | Net worth × 0.5-1% | MEDIUM |
| Capital Campaign Ask | Net worth × 3-5% | MEDIUM |

### Research Confidence Level: [HIGH/MEDIUM/LOW]
[Explanation of overall data quality]

---

## 9. Conclusion

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

## ASK AMOUNT FORMULAS (TFG Research):
- **Annual Fund Ask:** 0.5-1% of net worth (sustainable yearly giving)
- **Capital Campaign Ask:** 3-5% of net worth (major gift over 3-5 years)
- **Planned Gift Capacity:** 10-15% of estate value

## FINAL REMINDERS:
- Every claim needs a source in [brackets]
- Every estimate needs [Estimated - Methodology: X]
- "Not found in public records" is better than fabrication
- Use tables for clarity
- Be direct - no sycophancy or filler language
- Always include BOTH Annual Fund Ask AND Capital Campaign Ask`

// ============================================================================
// GROK SYNTHESIS PROMPT (for Sonar+Grok flow)
// ============================================================================

/**
 * System prompt for Perplexity Sonar Reasoning Pro to research and generate prospect reports
 * Uses Sonar's built-in web search to gather data, then outputs structured report + JSON
 */
const GROK_SYNTHESIS_PROMPT = `You are Rōmy, a prospect research assistant. You have built-in web search.

## ABSOLUTE REQUIREMENT - READ CAREFULLY:
You MUST ALWAYS output a complete prospect report in the format below. NEVER output:
- "Unable to Complete Prospect Research"
- "I cannot complete this research"
- "To proceed, I need..."
- Any message asking for clarification or more information

Even if your searches return irrelevant results or you find nothing about this specific person, you MUST still output the full report format with "None found" or "Not available - limited public information" in the relevant fields.

## YOUR TASK:
1. Search the web for information about the prospect
2. If searches return irrelevant results (wrong person, business with same name), try more specific searches
3. If you still can't find relevant info, OUTPUT THE REPORT ANYWAY with "None found" values
4. ALWAYS include the JSON block at the end - use null for unknown values

## OUTPUT FORMAT:

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
[2-3 sentences summarizing who they are, wealth sources, and giving potential]

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

---

## CRITICAL: JSON DATA BLOCK

At the END of your report, you MUST include this JSON block for data extraction.
Fill in actual values from the research. Use null for unknown values.

\`\`\`json
{
  "metrics": {
    "romy_score": [NUMBER 0-41],
    "romy_score_tier": "[Tier Name]",
    "capacity_rating": "[MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL]",
    "estimated_net_worth": [NUMBER or null],
    "estimated_gift_capacity": [NUMBER or null],
    "recommended_ask": [NUMBER or null]
  },
  "wealth_indicators": {
    "real_estate_total": [NUMBER or null],
    "property_count": [NUMBER or null],
    "business_equity": [NUMBER or null],
    "public_holdings": [NUMBER or null],
    "inheritance_likely": [true/false/null]
  },
  "business_details": {
    "companies": ["Company 1", "Company 2"],
    "roles": ["CEO", "Founder"],
    "industries": ["Technology", "Real Estate"]
  },
  "giving_history": {
    "total_political": [NUMBER or null],
    "political_party": "[Republican/Democratic/Bipartisan/null]",
    "foundation_affiliations": ["Foundation 1"],
    "nonprofit_boards": ["Org 1", "Org 2"],
    "known_major_gifts": [
      {"org": "Organization", "amount": [NUMBER], "year": [YEAR or null]}
    ]
  },
  "affiliations": {
    "education": ["Harvard MBA", "Stanford BS"],
    "clubs": ["Country Club"],
    "public_company_boards": ["ACME Inc (NYSE: ACM)"]
  }
}
\`\`\`

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
1. **NEVER REFUSE** - You must ALWAYS output the report format. No exceptions. No "unable to complete" messages.
2. **SEARCH FIRST** - Use your web search to find information. Try multiple search variations.
3. **HANDLE POOR RESULTS** - If searches return irrelevant results (wrong person, businesses with same name):
   - Try adding location: "[Name] [City] [State]"
   - Try the address directly: "[Street Address] property value"
   - Try profession if known: "[Name] [profession] [location]"
   - If still nothing relevant: Use "None found" and continue with the report
4. **ALWAYS OUTPUT JSON** - The JSON block at the end is REQUIRED. Use null for values you couldn't find.
5. **ESTIMATE CONSERVATIVELY** - If you only found the address but no property data, estimate based on the area. If no data at all, assign ANNUAL capacity rating with low RōmyScore.
6. Keep report concise (~600-800 words)
7. Dollar amounts should include $ symbol
8. Recommended Ask = 1-2% of estimated net worth (or $500-1000 if net worth unknown)`

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
// JSON-BASED STRUCTURED DATA EXTRACTION
// ============================================================================

/**
 * Extract structured data from JSON block in report
 * Falls back to regex extraction if JSON not found
 */
function extractStructuredDataFromReport(content: string): StructuredProspectData {
  // Try to extract JSON block from report
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)

  if (jsonMatch && jsonMatch[1]) {
    try {
      const jsonStr = jsonMatch[1].trim()
      const data = JSON.parse(jsonStr)

      console.log("[BatchProcessor] Successfully extracted JSON data block")

      // Build structured data from JSON
      const structuredData: StructuredProspectData = {}

      // Extract metrics
      if (data.metrics) {
        structuredData.romy_score = data.metrics.romy_score ?? undefined
        structuredData.romy_score_tier = data.metrics.romy_score_tier ?? undefined
        structuredData.capacity_rating = data.metrics.capacity_rating ?? undefined
        structuredData.estimated_net_worth = data.metrics.estimated_net_worth ?? undefined
        structuredData.estimated_gift_capacity = data.metrics.estimated_gift_capacity ?? undefined
        structuredData.recommended_ask = data.metrics.recommended_ask ?? undefined
      }

      // Extract wealth indicators
      if (data.wealth_indicators) {
        structuredData.wealth_indicators = {
          real_estate_total: data.wealth_indicators.real_estate_total ?? undefined,
          property_count: data.wealth_indicators.property_count ?? undefined,
          business_equity: data.wealth_indicators.business_equity ?? undefined,
          public_holdings: data.wealth_indicators.public_holdings ?? undefined,
          inheritance_likely: data.wealth_indicators.inheritance_likely ?? undefined,
        }
      }

      // Extract business details
      if (data.business_details) {
        structuredData.business_details = {
          companies: Array.isArray(data.business_details.companies)
            ? data.business_details.companies.filter((c: unknown) => c && typeof c === "string")
            : undefined,
          roles: Array.isArray(data.business_details.roles)
            ? data.business_details.roles.filter((r: unknown) => r && typeof r === "string")
            : undefined,
          industries: Array.isArray(data.business_details.industries)
            ? data.business_details.industries.filter((i: unknown) => i && typeof i === "string")
            : undefined,
        }
      }

      // Extract giving history
      if (data.giving_history) {
        structuredData.giving_history = {
          total_political: data.giving_history.total_political ?? undefined,
          political_party: data.giving_history.political_party ?? undefined,
          foundation_affiliations: Array.isArray(data.giving_history.foundation_affiliations)
            ? data.giving_history.foundation_affiliations.filter((f: unknown) => f && typeof f === "string")
            : undefined,
          nonprofit_boards: Array.isArray(data.giving_history.nonprofit_boards)
            ? data.giving_history.nonprofit_boards.filter((n: unknown) => n && typeof n === "string")
            : undefined,
          known_major_gifts: Array.isArray(data.giving_history.known_major_gifts)
            ? data.giving_history.known_major_gifts.filter(
                (g: unknown) => g && typeof g === "object" && "org" in (g as object)
              )
            : undefined,
        }
      }

      // Extract affiliations
      if (data.affiliations) {
        structuredData.affiliations = {
          education: Array.isArray(data.affiliations.education)
            ? data.affiliations.education.filter((e: unknown) => e && typeof e === "string")
            : undefined,
          clubs: Array.isArray(data.affiliations.clubs)
            ? data.affiliations.clubs.filter((c: unknown) => c && typeof c === "string")
            : undefined,
          public_company_boards: Array.isArray(data.affiliations.public_company_boards)
            ? data.affiliations.public_company_boards.filter((p: unknown) => p && typeof p === "string")
            : undefined,
        }
      }

      return structuredData
    } catch (parseError) {
      console.warn("[BatchProcessor] Failed to parse JSON block, falling back to regex extraction:", parseError)
    }
  }

  // Fallback to regex extraction
  console.log("[BatchProcessor] No JSON block found, using regex extraction")
  const regexMetrics = extractMetricsFromReport(content)

  return {
    romy_score: regexMetrics.romy_score,
    romy_score_tier: regexMetrics.romy_score_tier,
    capacity_rating: regexMetrics.capacity_rating,
    estimated_net_worth: regexMetrics.estimated_net_worth,
    estimated_gift_capacity: regexMetrics.estimated_gift_capacity,
    recommended_ask: regexMetrics.recommended_ask,
  }
}

/**
 * Remove JSON block from report content (for display purposes)
 */
function removeJsonBlockFromReport(content: string): string {
  return content.replace(/\n*---\n*\s*```json[\s\S]*?```\s*$/m, "").trim()
}

// ============================================================================
// SONAR + GROK REPORT GENERATION
// ============================================================================

/**
 * Generate a prospect report using Grok 4.1 Fast with Exa web search.
 * Single API call that does research AND outputs structured JSON.
 *
 * Cost: ~$0.01-0.02/prospect (Grok with Exa search)
 */
export async function generateReportWithSonarAndGrok(
  options: GenerateReportOptions
): Promise<SonarGrokReportResult> {
  const { prospect, apiKey } = options
  const startTime = Date.now()

  console.log(`[BatchProcessor] Starting Grok+Exa research for: ${prospect.name}`)

  // Build full address for research
  const fullAddress = buildProspectQueryString(prospect)

  // Collect additional context
  const additionalContext = Object.entries(prospect)
    .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ")

  // Build research prompt - Sonar has built-in web search
  const userMessage = `Research this prospect and generate a professional summary for major gift screening.

**Prospect:** ${prospect.name}
**Address:** ${fullAddress}
${additionalContext ? `**Additional Info:** ${additionalContext}` : ""}

Search for:
1. Property value at this address (Zillow, Redfin, county records)
2. Business ownership ("${prospect.name}" + business/company/LLC)
3. Foundation affiliations (ProPublica Nonprofit Explorer)
4. Political giving (FEC.gov)
5. SEC filings (if public company executive)
6. News articles and professional background

IMPORTANT:
- If your searches return irrelevant results (wrong person, different business), try adding the city/state or address to narrow down.
- You MUST output the complete report format even if you find limited information.
- Use "None found" for sections where you couldn't find relevant data.
- NEVER say "Unable to Complete" or ask for more information - just do your best with what you can find.

Output the full prospect summary with the JSON block at the end.`

  // Use Perplexity Sonar Reasoning Pro - Chain of Thought with built-in web search
  const openrouter = createOpenRouter({
    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
  })

  console.log(`[BatchProcessor] Calling Perplexity Sonar Reasoning Pro...`)

  const result = await streamText({
    model: openrouter.chat("perplexity/sonar-reasoning-pro"),
    system: GROK_SYNTHESIS_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 6000,
    temperature: 0.3,
  })

  // Collect the full response
  let reportContent = ""
  for await (const chunk of result.textStream) {
    reportContent += chunk
  }

  // Get usage stats
  const usage = await result.usage
  const tokensUsed = (usage?.promptTokens || 0) + (usage?.completionTokens || 0)
  const duration = Date.now() - startTime

  console.log(`[BatchProcessor] Grok research completed in ${duration}ms, ${tokensUsed} tokens`)

  // DEBUG: Log raw output to diagnose extraction issues
  console.log(`[BatchProcessor] DEBUG - Output length: ${reportContent.length}`)
  console.log(`[BatchProcessor] DEBUG - Output preview (last 1500 chars):`)
  console.log(reportContent.slice(-1500))
  console.log(`[BatchProcessor] DEBUG - END OF PREVIEW`)

  // Extract structured data from the report
  const structuredData = extractStructuredDataFromReport(reportContent)

  // DEBUG: Log extracted data
  console.log(`[BatchProcessor] DEBUG - Extracted structured data:`, JSON.stringify(structuredData, null, 2))

  // Get clean report content (without JSON block)
  const cleanReport = removeJsonBlockFromReport(reportContent)

  // Calculate final RomyScore using our verified function
  const romyBreakdown = await calculateRomyScoreFromMetrics(
    prospect,
    {
      estimated_net_worth: structuredData.estimated_net_worth,
      estimated_gift_capacity: structuredData.estimated_gift_capacity,
    }
  )

  // Use our calculated RomyScore (more reliable than AI's guess)
  structuredData.romy_score = romyBreakdown.totalScore
  structuredData.romy_score_tier = romyBreakdown.tier.name
  structuredData.capacity_rating = romyBreakdown.tier.capacity

  console.log(
    `[BatchProcessor] Report completed for ${prospect.name} in ${duration}ms, ` +
    `${tokensUsed} tokens, RōmyScore: ${romyBreakdown.totalScore}/41 (${romyBreakdown.tier.name})`
  )

  // Extract sources from report (inline citations)
  const sources = extractSourcesFromReport(reportContent)

  return {
    report_content: cleanReport,
    structured_data: structuredData,
    sources,
    tokens_used: tokensUsed,
    model_used: "sonar-reasoning-pro",
    processing_duration_ms: duration,
  }
}

/**
 * Extract source URLs from report text
 */
function extractSourcesFromReport(text: string): Array<{ name: string; url: string }> {
  const sources: Array<{ name: string; url: string }> = []
  const seen = new Set<string>()

  // Match URLs in the text
  const urlPattern = /https?:\/\/[^\s\)\]<>"]+/g
  const matches = text.match(urlPattern) || []

  for (const url of matches) {
    const cleanUrl = url.replace(/[.,;:!?]+$/, "")
    if (!seen.has(cleanUrl)) {
      seen.add(cleanUrl)
      try {
        const urlObj = new URL(cleanUrl)
        const domain = urlObj.hostname.replace(/^www\./, "")
        sources.push({ name: domain, url: cleanUrl })
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return sources.slice(0, 10)
}

// ============================================================================
// ROMYSCORE CALCULATION FROM AI-EXTRACTED METRICS
// ============================================================================

/**
 * Calculate RomyScore from AI-extracted metrics
 * Since we no longer have tool results, we estimate based on net worth
 */
async function calculateRomyScoreFromMetrics(
  prospect: ProspectInputData,
  aiExtractedMetrics: {
    estimated_net_worth?: number
    estimated_gift_capacity?: number
  }
): Promise<RomyScoreBreakdown> {
  const dataPoints: Partial<RomyScoreDataPoints> = {}

  // If we have AI-extracted net worth, estimate property value
  if (aiExtractedMetrics.estimated_net_worth && aiExtractedMetrics.estimated_net_worth > 0) {
    // Rough estimate: property is often 20-40% of net worth for HNW individuals
    dataPoints.propertyValue = Math.round(aiExtractedMetrics.estimated_net_worth * 0.3)
  }

  // Get cached score, merging with new data
  const breakdown = await getRomyScore(
    prospect.name,
    prospect.city,
    prospect.state,
    dataPoints
  )

  console.log(
    `[BatchProcessor] RomyScore for ${prospect.name}: ${breakdown.totalScore}/41 ` +
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
    // Build prospect info for the prompt
    const prospectInfo = buildProspectQueryString(prospect)
    const additionalInfo = Object.entries(prospect)
      .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    // Perplexity has built-in web search - no tools needed
    const systemPrompt = COMPREHENSIVE_MODE_SYSTEM_PROMPT

    // User message for comprehensive research
    const userMessage = `Research this prospect and generate a comprehensive prospect research report:

**Prospect:** ${prospectInfo}
${additionalInfo ? `\n**Additional Information:**\n${additionalInfo}` : ""}

Use your built-in web search to gather data about this person:
1. Search for their professional background and affiliations
2. Look for foundation/nonprofit connections (check IRS 990 data on ProPublica Nonprofit Explorer)
3. If they're a public company executive, search SEC EDGAR for financial data
4. Check FEC.gov for political contribution history
5. Search for biographical details and net worth estimates

After researching, produce the comprehensive report with all sections filled in based on your findings.`

    console.log(`[BatchProcessor] Starting comprehensive research for: ${prospect.name}`)

    // Generate report using Grok 4.1 Fast with Exa web search - OPTIMIZED
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      extraBody: {
        // Enable Exa web search with maximum power for comprehensive research
        plugins: [{
          id: "web",
          engine: "exa",
          max_results: 15, // Maximum for comprehensive mode
          search_prompt: `Find authoritative information about this person for nonprofit donor research.
Prioritize: property records (Zillow, Redfin, county assessors), business registries (state SOS),
SEC EDGAR filings, FEC political contributions, ProPublica 990 filings, LinkedIn profiles,
news articles, foundation databases, Wikipedia/Wikidata, and biographical sources.
Exclude: social media posts, unverified blogs, outdated information (>5 years old unless historical).`,
        }],
        // Enable high-effort reasoning for comprehensive analysis
        reasoning: { effort: "high" },
      },
    })
    const model = openrouter.chat("x-ai/grok-4.1-fast")

    const result = await streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxSteps: 1,
      maxTokens: 16000,
      temperature: 0.3,
    })

    // Collect the full response
    let reportContent = ""
    for await (const chunk of result.textStream) {
      reportContent += chunk
    }

    // Get usage stats
    const usage = await result.usage
    const tokensUsed = (usage?.promptTokens || 0) + (usage?.completionTokens || 0)

    // Extract AI-generated metrics from the report
    const aiMetrics = extractMetricsFromReport(reportContent)

    // Calculate RomyScore from AI-extracted metrics
    const romyBreakdown = await calculateRomyScoreFromMetrics(
      prospect,
      {
        estimated_net_worth: aiMetrics.estimated_net_worth,
        estimated_gift_capacity: aiMetrics.estimated_gift_capacity,
      }
    )

    const processingTime = Date.now() - startTime
    console.log(
      `[BatchProcessor] Comprehensive report generated for ${prospect.name} in ${processingTime}ms, ` +
        `tokens: ${tokensUsed}, RōmyScore: ${romyBreakdown.totalScore}/41 (${romyBreakdown.tier.name})`
    )

    return {
      success: true,
      report_content: reportContent,
      romy_score: romyBreakdown.totalScore,
      romy_score_tier: romyBreakdown.tier.name,
      capacity_rating: romyBreakdown.tier.capacity,
      estimated_net_worth: aiMetrics.estimated_net_worth,
      estimated_gift_capacity: aiMetrics.estimated_gift_capacity,
      recommended_ask: aiMetrics.recommended_ask,
      search_queries_used: ["Perplexity built-in web search"],
      sources_found: [], // Sources are inline in Perplexity responses
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
 * Generate a standard report using Perplexity's built-in web search.
 * Produces a concise output format optimized for quick prioritization.
 */
async function generateStandardReport(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { prospect, apiKey } = options
  const startTime = Date.now()

  try {
    // Build prospect info for the prompt
    const prospectInfo = buildProspectQueryString(prospect)
    const additionalInfo = Object.entries(prospect)
      .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    // Perplexity has built-in web search - no tools needed
    const systemPrompt = PROFESSIONAL_SUMMARY_PROMPT

    const userMessage = `Research this prospect and generate a Professional Summary:

**Prospect:** ${prospectInfo}
${additionalInfo ? `\n**Additional Information:**\n${additionalInfo}` : ""}

Use your built-in web search to gather data:
1. Search for property values and real estate holdings
2. Look for business ownership and professional background
3. Check ProPublica Nonprofit Explorer for foundation affiliations
4. Search FEC.gov for political giving history
5. Look for SEC filings if they're a public company executive

After researching, produce the concise prospect summary with ALL sections filled in. Include specific dollar amounts.`

    console.log(`[BatchProcessor] Starting standard research for: ${prospect.name}`)

    // Generate report using Grok 4.1 Fast with Exa web search - OPTIMIZED
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      extraBody: {
        // Enable Exa web search with focused search for standard mode
        plugins: [{
          id: "web",
          engine: "exa",
          max_results: 8, // Balanced for speed vs coverage
          search_prompt: `Find key information about this person for nonprofit donor research.
Focus on: property values, business ownership, philanthropic history, political contributions.
Prioritize official sources: county assessors, state business registries, FEC, ProPublica 990s.`,
        }],
        // Enable medium-effort reasoning for faster analysis
        reasoning: { effort: "medium" },
      },
    })
    const model = openrouter.chat("x-ai/grok-4.1-fast")

    const result = await streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxSteps: 1,
      maxTokens: 4000,
      temperature: 0.3,
    })

    // Collect the full response
    let reportContent = ""
    for await (const chunk of result.textStream) {
      reportContent += chunk
    }

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

    // Calculate RomyScore from AI-extracted metrics
    const romyBreakdown = await calculateRomyScoreFromMetrics(
      prospect,
      {
        estimated_net_worth: aiMetrics.estimated_net_worth,
        estimated_gift_capacity: aiMetrics.estimated_gift_capacity,
      }
    )

    const processingTime = Date.now() - startTime
    console.log(
      `[BatchProcessor] Standard report generated for ${prospect.name} in ${processingTime}ms, ` +
        `tokens: ${tokensUsed}, RōmyScore: ${romyBreakdown.totalScore}/41 (${romyBreakdown.tier.name})`
    )

    return {
      success: true,
      report_content: reportContent,
      romy_score: romyBreakdown.totalScore,
      romy_score_tier: romyBreakdown.tier.name,
      capacity_rating: romyBreakdown.tier.capacity,
      estimated_net_worth: aiMetrics.estimated_net_worth,
      estimated_gift_capacity: aiMetrics.estimated_gift_capacity,
      recommended_ask: aiMetrics.recommended_ask,
      search_queries_used: ["Perplexity built-in web search"],
      sources_found: [], // Sources are inline in Perplexity responses
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
