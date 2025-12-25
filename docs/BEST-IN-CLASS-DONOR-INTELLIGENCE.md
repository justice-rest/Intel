# Rōmy: Best-in-Class Donor Intelligence Platform

## Executive Summary

This document outlines the strategy to make Rōmy's donor research system **the definitive standard for nonprofit prospect intelligence** — surpassing iWave, DonorSearch, WealthEngine, and Blackbaud.

### The Vision
**From "good enough" to "the source of truth"** — every data point verified, every source cited, every estimate explained.

---

## Competitive Landscape Analysis

### Current Industry Leaders

| Platform | Strengths | Weaknesses | Pricing |
|----------|-----------|------------|---------|
| **iWave** | 38+ databases, VeriGift verified giving, PRO scoring | Static quarterly updates, expensive, black-box scoring | $6K-$25K/year |
| **DonorSearch** | 90% accuracy (with manual review), largest philanthropic database | Manual verification costs extra, 70% base accuracy | $4K-$15K/year |
| **WealthEngine** | Strong wealth modeling, predictive analytics | Limited philanthropic data, expensive | $10K-$50K/year |
| **Blackbaud** | CRM integration, comprehensive ecosystem | Slow innovation, vendor lock-in | $15K-$100K/year |

### Why We Can Beat Them

| Their Weakness | Our Advantage |
|----------------|---------------|
| Static quarterly/annual data updates | **Real-time AI synthesis** with live web search |
| Black-box "trust us" scores | **Full provenance** — every claim cites its source |
| 70% machine accuracy | **Multi-source triangulation** — cross-reference 3+ sources |
| $6K-$50K annual contracts | **BYOK model** — pay only for what you use (~$0.10/prospect) |
| No transparency on methodology | **Open-source scoring** — anyone can audit the algorithm |
| Limited API access | **Direct verification** from SEC, FEC, ProPublica FREE |

---

## Data Source Strategy

### Tier 1: Official Government Sources (FREE, Authoritative)

| Source | Data Available | API Cost | Authority Score |
|--------|---------------|----------|-----------------|
| **SEC EDGAR** | Insider filings (Form 3/4/5), proxy statements (DEF 14A), stock holdings | FREE | 1.0 |
| **FEC.gov** | Political contributions, party affiliation, employer data | FREE | 1.0 |
| **ProPublica Nonprofit Explorer** | 990 data, foundation boards, executive compensation | FREE | 1.0 |
| **OpenSecrets** | Aggregated political giving, PAC contributions | FREE | 0.95 |
| **USAspending.gov** | Federal contracts, grants (corporate/foundation) | FREE | 1.0 |

**Current Status:** ✅ SEC, FEC, ProPublica implemented
**Gap:** OpenSecrets API not yet integrated

### Tier 2: Property & Real Estate (Critical for Wealth Assessment)

| Source | Data Available | Cost | Authority Score |
|--------|---------------|------|-----------------|
| **ATTOM Data** | 158M properties, AVM valuations, ownership, liens, mortgages | ~$500/mo | 0.95 |
| **RentCast** | Property values, rent estimates, 140M+ records | 50 free/mo | 0.85 |
| **Zillow Research** | Zestimates, historical sales (academic/nonprofit access) | Invite-only | 0.85 |
| **County Assessor Records** | Tax assessments, ownership records | Varies by county | 1.0 |

**Current Status:** ❌ No direct real estate API
**Critical Gap:** Property values rely on LLM extraction (unreliable)

**Recommendation:** Integrate RentCast (free tier for testing) → ATTOM (production)

### Tier 3: Business Intelligence

| Source | Data Available | Cost | Authority Score |
|--------|---------------|------|-----------------|
| **Secretary of State APIs** | Business registrations, officers, status | ~$2,400/year (Iowa) | 0.95 |
| **iDenfy SOS API** | All 50 states, ownership structure | Subscription | 0.9 |
| **D&B (Dun & Bradstreet)** | Business revenues, employee counts, credit | Enterprise pricing | 0.9 |
| **OpenCorporates** | 200M+ companies globally, free tier | Free tier available | 0.85 |

**Current Status:** ❌ No business registry integration
**Gap:** Business ownership claims not verified against official records

### Tier 4: Professional/Biographical

| Source | Data Available | Cost | Authority Score |
|--------|---------------|------|-----------------|
| **Proxycurl** | LinkedIn data, employment history | ~$0.01/profile | 0.8 |
| **People Data Labs** | 1.5B profiles, employment, education | Pay-per-use | 0.75 |
| **Clearbit** | Company/person enrichment | Enterprise | 0.8 |

**Current Status:** ❌ No LinkedIn/professional data API
**Gap:** Employment/title claims not verified

### Tier 5: Philanthropic Giving (The Key Differentiator)

| Source | Data Available | Cost | Authority Score |
|--------|---------------|------|-----------------|
| **ProPublica 990** | Foundation grants, board members | FREE | 1.0 |
| **Candid/GuideStar** | 1.8M nonprofits, 990 data, board members | Premium required | 0.95 |
| **FEC Individual** | Political contributions ($200+) | FREE | 1.0 |
| **State charity registrations** | Charitable solicitation registrations | Varies | 0.9 |

**Current Status:** ✅ FEC, ProPublica partial
**Gap:** Candid API not integrated, state charity data missing

---

## Accuracy & Verification Strategy

### The 90%+ Accuracy Standard

DonorSearch achieves 90% accuracy through manual verification. We can match or exceed this through **automated multi-source triangulation**.

#### Confidence Scoring Framework

```
VERIFIED (100% confidence)
├── Direct API match from official source (SEC, FEC, County Records)
├── Document-backed (linked to actual filing)
└── Example: "John Smith filed SEC Form 4 for Apple Inc on 2024-03-15"

CORROBORATED (85-95% confidence)
├── 2+ independent sources agree within 20% variance
├── At least one source with authority ≥0.8
└── Example: "Net worth $2-3M" from Zillow ($2.1M) + Perplexity ($2.5M) + LinkUp ($2.8M)

SINGLE_SOURCE (60-75% confidence)
├── One reputable source, no corroboration
├── Source authority determines confidence
└── Example: "CEO of XYZ Corp" from LinkedIn only

ESTIMATED (40-60% confidence)
├── Calculated from proxies/indicators
├── Methodology disclosed
└── Example: "Gift capacity $25K-50K based on $1.5M property + executive role"

CONFLICTED (<40% confidence)
├── Sources disagree by >30%
├── Flagged for manual review
└── Example: "Property value: Zillow says $800K, Perplexity says $2M"
```

### Name Disambiguation Strategy

**The Problem:** "John Smith" returns thousands of results
**The Solution:** Multi-factor matching

```
Match Score = Σ(factor_weight × match_quality)

Factors:
├── Exact name match: 30%
├── Address/location match: 25%
├── Employer match: 20%
├── Age/birth year match: 10%
├── Spouse name match: 10%
└── Historical activity pattern: 5%

Threshold: Only accept matches with score ≥ 75%
Below threshold: Flag for manual review or skip
```

---

## Scoring System Enhancements

### Current RŌMY Score (0-41 points)
Good foundation, but needs refinement.

### Proposed RŌMY Score 2.0 (0-100 points)

#### Wealth Capacity (40 points max)

| Indicator | Points | Source | Verification |
|-----------|--------|--------|--------------|
| Real estate $5M+ | 15 | ATTOM/County | Direct API |
| Real estate $2-5M | 12 | ATTOM/County | Direct API |
| Real estate $1-2M | 9 | ATTOM/County | Direct API |
| Real estate $500K-1M | 6 | ATTOM/County | Direct API |
| Real estate $250-500K | 3 | ATTOM/County | Direct API |
| SEC insider (public company) | 10 | SEC EDGAR | Direct API |
| Business owner ($10M+ revenue) | 8 | D&B/SOS | Direct API |
| Business owner ($1-10M revenue) | 5 | D&B/SOS | Direct API |
| C-suite/VP at Fortune 500 | 7 | LinkedIn/Proxycurl | API verified |

#### Philanthropic Affinity (35 points max)

| Indicator | Points | Source | Verification |
|-----------|--------|--------|--------------|
| Foundation board member | 10 | ProPublica 990 | Direct API |
| Nonprofit board (3+) | 8 | ProPublica 990 | Direct API |
| Political giving $100K+ | 7 | FEC | Direct API |
| Political giving $25-100K | 5 | FEC | Direct API |
| Political giving $5-25K | 3 | FEC | Direct API |
| Known major gift ($100K+) | 10 | VeriGift/990 | Document-backed |
| Known major gift ($25-100K) | 7 | VeriGift/990 | Document-backed |
| DAF account holder | 5 | Donor reporting | Self-reported |

#### Engagement Signals (25 points max)

| Indicator | Points | Source | Verification |
|-----------|--------|--------|--------------|
| Prior donor to your org | 10 | CRM | Internal |
| Attended your events (3+) | 5 | CRM | Internal |
| Connected to current major donors | 5 | Network analysis | Calculated |
| Geographic proximity to mission | 3 | Address match | Calculated |
| Demographic alignment | 2 | Profile analysis | Calculated |

### Capacity Rating Refinement

```
Gift Capacity = f(liquid_wealth, income, age, giving_history, liabilities)

Liquid Wealth Estimate:
├── 30% of real estate value (equity)
├── 35% of stock holdings (if known)
├── 10% of business value (illiquid)
└── 25% other assets (estimated from lifestyle indicators)

Annual Giving Capacity:
├── Conservative: 1-2% of liquid wealth
├── Moderate: 2-3% of liquid wealth
├── Aggressive: 3-5% of liquid wealth (for proven major donors)

Capacity Tiers:
├── PRINCIPAL: $1M+ single gift capacity
├── MAJOR: $100K-$1M capacity
├── LEADERSHIP: $25K-$100K capacity
├── ANNUAL: $1K-$25K capacity
└── DISCOVERY: Insufficient data
```

---

## Technical Implementation Roadmap

### Phase 1: Data Source Expansion (Critical)

#### 1.1 Real Estate API Integration
```typescript
// Priority: HIGH
// Cost: ~$500/month (ATTOM) or free (RentCast tier)

interface PropertyVerification {
  source: "ATTOM" | "RentCast" | "CountyRecords"
  address: string
  avm_value: number
  avm_confidence: number // 0-1
  assessed_value: number
  last_sale_price: number
  last_sale_date: Date
  owner_name: string
  mortgage_balance?: number
  equity_estimate?: number
}

// Use for:
// 1. Verify property ownership claims from LLM
// 2. Get accurate valuations (not LLM estimates)
// 3. Calculate equity (wealth indicator)
```

#### 1.2 Enhanced FEC Integration
```typescript
// Priority: HIGH
// Cost: FREE

// Current: Basic contribution search
// Enhanced:
// - Aggregate lifetime giving
// - Track giving trends over time
// - Identify PAC affiliations
// - Extract employer data for employment verification
```

#### 1.3 ProPublica Person Search
```typescript
// Priority: HIGH
// Cost: FREE

// Current: Organization lookup only
// Enhanced: Use person search endpoint
// https://projects.propublica.org/nonprofits/api#people

interface PersonNonprofitData {
  name: string
  organizations: Array<{
    ein: string
    name: string
    role: "Officer" | "Director" | "Trustee" | "Key Employee"
    compensation: number
    fiscal_year: number
  }>
}
```

### Phase 2: Verification Layer

#### 2.1 Cross-Reference Verification
```typescript
// For every claim, attempt verification:

async function verifyClaim(claim: DataClaim): Promise<VerificationResult> {
  const verifications = await Promise.allSettled([
    verifyWithSEC(claim),      // If company/stock related
    verifyWithFEC(claim),      // If political giving
    verifyWithProPublica(claim), // If nonprofit board
    verifyWithPropertyAPI(claim), // If real estate
    verifyWithSOS(claim),      // If business ownership
  ])

  return {
    claim,
    verified: verifications.filter(v => v.status === 'fulfilled').length,
    total_sources: verifications.length,
    confidence: calculateConfidence(verifications),
    sources: extractSources(verifications),
  }
}
```

#### 2.2 Hallucination Detection
```typescript
// Compare LLM claims against direct API results

async function detectHallucination(
  llmClaim: string,
  directApiResult: unknown
): Promise<HallucinationCheck> {
  // Example: LLM says "SEC insider at Apple"
  // SEC API returns no filings
  // → Flag as potential hallucination

  if (llmClaim && !directApiResult) {
    return {
      status: "UNVERIFIED",
      confidence: 0.3,
      note: "LLM claim not confirmed by official source"
    }
  }

  return {
    status: "VERIFIED",
    confidence: 0.95,
    source: directApiResult
  }
}
```

### Phase 3: Scoring & Intelligence

#### 3.1 Network Analysis
```typescript
// Identify connections between prospects

interface NetworkNode {
  person_id: string
  connections: Array<{
    person_id: string
    relationship: "spouse" | "business_partner" | "board_colleague" | "donor_peer"
    strength: number // 0-1
  }>
}

// Use for:
// 1. "John Smith serves on board with your current donor Jane Doe"
// 2. Peer-to-peer solicitation recommendations
// 3. Wealth by association indicators
```

#### 3.2 Trend Analysis
```typescript
// Track prospect activity over time

interface ProspectTrend {
  person_id: string
  political_giving_trend: "increasing" | "stable" | "decreasing"
  real_estate_acquisitions: PropertyTransaction[]
  sec_activity: SecFiling[]
  nonprofit_involvement_trend: "more_active" | "stable" | "less_active"

  signals: Array<{
    type: "wealth_event" | "life_event" | "giving_event"
    description: string
    date: Date
    source: string
  }>
}
```

### Phase 4: Quality Assurance

#### 4.1 Automated QA Pipeline
```typescript
// Every research result goes through QA

interface QAResult {
  overall_quality: number // 0-100

  checks: {
    name_confidence: number      // Is this the right person?
    data_completeness: number    // How many fields populated?
    source_diversity: number     // Multiple independent sources?
    verification_rate: number    // % of claims verified?
    recency: number              // How current is the data?
  }

  flags: Array<{
    severity: "critical" | "warning" | "info"
    message: string
    field: string
  }>
}
```

#### 4.2 Human Review Integration
```typescript
// Flag items for manual review

interface ReviewQueue {
  item_id: string
  priority: "high" | "medium" | "low"

  reason:
    | "name_ambiguity"      // Common name, low confidence
    | "conflicting_data"    // Sources disagree
    | "high_value_prospect" // Score > 80, verify before outreach
    | "unusual_pattern"     // Anomaly detected

  suggested_action: string
  estimated_review_time: number // minutes
}
```

---

## Competitive Advantages Summary

### Why Rōmy Will Be THE BEST

| Dimension | Industry Standard | Rōmy Approach | Advantage |
|-----------|-------------------|---------------|-----------|
| **Data Freshness** | Quarterly updates | Real-time web synthesis | 3 months faster |
| **Transparency** | Black-box scores | Full provenance for every claim | Complete auditability |
| **Accuracy** | 70% machine / 90% with manual | 85%+ through triangulation | Better than machine, cheaper than manual |
| **Cost** | $6K-$50K/year | ~$0.10/prospect BYOK | 10-100x cheaper |
| **Customization** | Fixed scoring models | Open-source, configurable | Fits any org's priorities |
| **Speed** | Days/weeks for screening | Minutes per prospect | Immediate insights |
| **Sources** | Proprietary databases | Open APIs + AI synthesis | Verifiable, not black-box |

### The Rōmy Promise

1. **Every claim has a source** — No black-box "we think" statements
2. **Direct verification when possible** — SEC, FEC, ProPublica before LLM
3. **Confidence levels are honest** — "We're 85% sure" not "definitely"
4. **Methodology is open** — Anyone can audit the scoring algorithm
5. **Cost is transparent** — Pay for what you use, no hidden fees

---

## Implementation Priority Matrix

### Immediate (This Week)
- [ ] Integrate RentCast free tier for property verification
- [ ] Implement ProPublica person search endpoint
- [ ] Add OpenSecrets API for aggregated political data
- [ ] Create verification layer that runs AFTER LLM synthesis

### Short-term (This Month)
- [ ] Integrate Secretary of State API (start with OpenCorporates free tier)
- [ ] Build name disambiguation scoring system
- [ ] Implement cross-reference verification for all claims
- [ ] Add hallucination detection comparing LLM vs API results

### Medium-term (This Quarter)
- [ ] Upgrade to ATTOM for comprehensive property data
- [ ] Add Proxycurl for LinkedIn verification
- [ ] Implement network analysis (board/donor connections)
- [ ] Build trend tracking for prospect activity

### Long-term (This Year)
- [ ] Partner with Candid for enhanced nonprofit data
- [ ] Build proprietary "VeriGift" equivalent through 990 mining
- [ ] Create peer comparison benchmarking
- [ ] Develop predictive giving models

---

## Success Metrics

### Data Quality Metrics
- **Verification Rate**: % of claims verified by direct API (target: >70%)
- **Source Diversity**: Average sources per prospect (target: >4)
- **Accuracy Rate**: Compared to manual review (target: >85%)
- **Hallucination Rate**: LLM claims contradicted by APIs (target: <5%)

### User Value Metrics
- **Actionable Prospects**: % with sufficient data for outreach (target: >80%)
- **Major Gift Identification**: % accuracy on $25K+ capacity (target: >90%)
- **Time to Insight**: Minutes from input to complete profile (target: <3 min)
- **Cost per Prospect**: All-in research cost (target: <$0.15)

### Competitive Metrics
- **Completeness vs iWave**: Fields populated comparison
- **Accuracy vs DonorSearch**: Verified data points comparison
- **Speed vs Manual**: Time savings factor (target: 50x faster)
- **Cost vs Competitors**: Price comparison (target: 10x cheaper)

---

## Conclusion

The path to becoming THE BEST donor intelligence platform is clear:

1. **Verify, don't trust** — Always cross-reference LLM synthesis with direct APIs
2. **Transparency wins** — Show your sources, explain your scores
3. **Real-time beats static** — Fresh data trumps quarterly dumps
4. **Open beats closed** — Let users audit and customize
5. **Affordable beats exclusive** — Democratize access to quality data

The competitors have built empires on proprietary databases and black-box algorithms. We will build something better: **a transparent, verifiable, affordable platform that any nonprofit can trust.**

---

## Sources

- [DonorSearch Data Accuracy](https://www.donorsearch.net/our-data/)
- [iWave Wealth Indicators](https://support.iwave.com/s/article/Wealth-Indicators)
- [SEC EDGAR Insider Data](https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets)
- [FEC Individual Contributions](https://www.fec.gov/data/browse-data/)
- [ProPublica Nonprofit API](https://projects.propublica.org/nonprofits/api)
- [ATTOM Property API](https://www.attomdata.com/solutions/property-data-api/)
- [Wealth Screening Best Practices](https://www.donorsearch.net/wealth-screening-best-practices/)
