# Rōmy Data Sources & Research Capabilities

This document provides a comprehensive overview of all data sources integrated into Rōmy for prospect research and wealth screening. All sources are publicly available and comply with their respective terms of service.

---

## Table of Contents

1. [Government Data Sources](#1-government-data-sources)
2. [Financial & Securities Data](#2-financial--securities-data)
3. [Nonprofit & Philanthropy Research](#3-nonprofit--philanthropy-research)
4. [Real Estate & Property Data](#4-real-estate--property-data)
5. [Biographical & Professional Data](#5-biographical--professional-data)
6. [Web Search & Aggregation](#6-web-search--aggregation)
7. [Data Source Summary Table](#7-data-source-summary-table)

---

## 1. Government Data Sources

### 1.1 SEC EDGAR (Securities and Exchange Commission)

**Source:** [sec.gov/edgar](https://www.sec.gov/edgar)
**API Documentation:** [sec.gov/developer](https://www.sec.gov/developer)
**Cost:** FREE (no API key required)

**Data Available:**
- **Form 10-K/10-Q** - Annual and quarterly financial statements for public companies
- **Form 3/4/5** - Insider ownership and transaction filings (officers, directors, 10%+ owners)
- **DEF 14A** - Proxy statements listing all board members and executive compensation
- **Form 13F** - Institutional investment holdings

**Use Cases:**
- Verify board membership at public companies
- Research executive compensation
- Identify insider stock transactions
- Assess company financials for wealth estimation

**Tools in Rōmy:**
- `sec_edgar_filings` - Retrieve 10-K/10-Q financial data by ticker symbol
- `sec_insider_search` - Search Form 3/4/5 by person name to verify insider status
- `sec_proxy_search` - Search DEF 14A proxy statements by company name

---

### 1.2 FEC (Federal Election Commission)

**Source:** [fec.gov](https://www.fec.gov)
**API Documentation:** [api.open.fec.gov/developers](https://api.open.fec.gov/developers)
**Cost:** FREE (API key required - get at [api.data.gov/signup](https://api.data.gov/signup))

**Data Available:**
- Individual political contributions (federal level)
- Donor name, address, employer, occupation
- Contribution amounts and dates
- Recipient committees and candidates

**Use Cases:**
- Identify political giving patterns
- Wealth indicators from large contribution history
- Donor research for political affinity
- Employment verification from contribution records

**Tools in Rōmy:**
- `fec_contributions` - Search political contributions by individual name

---

### 1.3 USAspending (Federal Awards)

**Source:** [usaspending.gov](https://www.usaspending.gov)
**API Documentation:** [api.usaspending.gov](https://api.usaspending.gov)
**Cost:** FREE (no API key required)

**Data Available:**
- Federal contracts awarded to companies
- Federal grants to organizations
- Direct loans and loan guarantees
- Award amounts, dates, and awarding agencies

**Use Cases:**
- Research companies' government contract revenue
- Identify foundations receiving federal grants
- Business relationship with government agencies
- Revenue source verification for organizations

**Tools in Rōmy:**
- `us_gov_data` - Search federal awards by company/organization name

---

## 2. Financial & Securities Data

### 2.1 Yahoo Finance

**Source:** [finance.yahoo.com](https://finance.yahoo.com)
**Package:** [yahoo-finance2](https://www.npmjs.com/package/yahoo-finance2)
**Cost:** FREE (no API key required)

**Data Available:**
- Real-time and historical stock quotes
- Company profiles and business descriptions
- Executive officers and their compensation
- Insider holders and their positions
- Market capitalization and financial metrics

**Use Cases:**
- Research public company executives
- Estimate wealth from stock holdings
- Verify employment as officer/director
- Company background research

**Tools in Rōmy:**
- `yahoo_finance_quote` - Get current stock price and market data
- `yahoo_finance_search` - Search for companies by name
- `yahoo_finance_profile` - Get detailed company profile with executives

---

## 3. Nonprofit & Philanthropy Research

### 3.1 ProPublica Nonprofit Explorer

**Source:** [projects.propublica.org/nonprofits](https://projects.propublica.org/nonprofits)
**API Documentation:** [projects.propublica.org/nonprofits/api](https://projects.propublica.org/nonprofits/api)
**Cost:** FREE (no API key required)

**Data Available:**
- 1.8+ million tax-exempt organizations
- Form 990 financial data (revenue, expenses, assets)
- Organization address, NTEE category, tax status
- Historical filings going back many years
- Officer compensation percentages

**Use Cases:**
- Research foundation assets and giving capacity
- Identify nonprofit board affiliations
- Analyze foundation financials
- Verify nonprofit legitimacy

**Tools in Rōmy:**
- `propublica_nonprofit_search` - Search nonprofits by organization name
- `propublica_nonprofit_details` - Get full 990 financial data by EIN
- `nonprofit_affiliation_search` - **AUTOMATIC** person-to-nonprofit research (searches web → extracts org names → queries ProPublica)

**Important Note:** Use `nonprofit_affiliation_search` for researching a PERSON's nonprofit connections. It automates the entire workflow. The other tools (`propublica_nonprofit_search`, `propublica_nonprofit_details`) search by organization name only and are useful for direct lookups when you already know the org name.

---

## 4. Real Estate & Property Data

### 4.1 Property Valuation (via Linkup)

**Sources Searched:**
- Zillow (Zestimates, property details)
- Redfin (home values, comparable sales)
- Realtor.com (property listings)
- County assessor records (tax assessments)
- PropertyShark (ownership records)
- Blockshopper (recent sales)

**Cost:** Included with Linkup subscription (~$0.005/search)

**Data Available:**
- Property value estimates from multiple sources
- Property characteristics (beds, baths, sqft, lot size)
- Recent comparable sales in the area
- Tax assessment values
- Ownership history

**Use Cases:**
- Estimate prospect wealth from real estate holdings
- Research primary residence value
- Identify secondary homes or investment properties
- Verify property ownership claims

**Tools in Rōmy:**
- `property_valuation` - Automated valuation model (AVM) that aggregates multiple sources

---

## 5. Biographical & Professional Data

### 5.1 Wikidata

**Source:** [wikidata.org](https://www.wikidata.org)
**API Documentation:** [mediawiki.org/wiki/Wikibase/API](https://www.mediawiki.org/wiki/Wikibase/API)
**Cost:** FREE (no API key required)

**Data Available:**
- Educational background (schools attended, degrees)
- Employment history (employers, positions held)
- Board memberships and organization affiliations
- Net worth estimates (for notable individuals)
- Awards and recognition received
- Family relationships (spouse, children)
- Biographical dates and places

**Use Cases:**
- Research educational credentials
- Verify employment history
- Find board memberships
- Discover family connections
- Identify wealth indicators from awards/recognition

**Tools in Rōmy:**
- `wikidata_search` - Search for people or organizations by name
- `wikidata_entity` - Get detailed biographical data by Wikidata QID

---

## 6. Web Search & Aggregation

### 6.1 Linkup Search

**Source:** [linkup.so](https://www.linkup.so)
**Cost:** ~$0.005 per search (API key required)

**Description:**
Linkup provides synthesized web search results with source citations, searching across curated authoritative domains for prospect research.

**Curated Domain Categories:**

| Category | Example Domains | Data Type |
|----------|-----------------|-----------|
| **SEC & Securities** | sec.gov, finance.yahoo.com, marketwatch.com | Insider filings, stock data |
| **Political Contributions** | fec.gov, opensecrets.org, followthemoney.org | Federal and state donations |
| **Philanthropy** | guidestar.org, candid.org, projects.propublica.org | Foundation 990s, grants |
| **Real Estate** | zillow.com, redfin.com, realtor.com | Property values, sales |
| **Business Data** | linkedin.com, crunchbase.com, opencorporates.com | Company ownership, founders |
| **State Registries** | All 50 state SOS websites | LLC/Corp filings |
| **News Archives** | wsj.com, nytimes.com, bizjournals.com | Profiles, articles |
| **Court Records** | pacer.uscourts.gov, courtlistener.com | Civil cases, litigation |

**Tools in Rōmy:**
- `searchWeb` - Primary prospect research tool with synthesized answers

---

## 7. Data Source Summary Table

| Data Source | API Cost | API Key Required | Primary Use Case |
|-------------|----------|------------------|------------------|
| **SEC EDGAR** | FREE | No | Board verification, insider filings, financials |
| **FEC** | FREE | Yes (free key) | Political contribution history |
| **USAspending** | FREE | No | Federal contracts and grants |
| **Yahoo Finance** | FREE | No | Stock data, executive research |
| **ProPublica** | FREE | No | Nonprofit 990s, foundation research |
| **Wikidata** | FREE | No | Biographical data, education, employers |
| **Linkup** | ~$0.005/search | Yes (paid) | Aggregated web search across 100+ domains |

---

## Data Privacy & Compliance

All data sources used by Rōmy are:

1. **Publicly Available** - All information is from public records, regulatory filings, or publicly accessible websites
2. **API-Compliant** - All integrations follow the respective API terms of service
3. **Rate-Limited** - Requests are throttled to respect API limits (e.g., SEC: 10 req/sec)
4. **No Scraping** - Data is retrieved through official APIs or authorized search services

---

## Research Workflow Examples

### Example 1: Verify Board Membership (Public Company)

```
1. sec_insider_search("John Smith")
   → Returns Form 3/4/5 filings if person is insider

2. sec_proxy_search("Apple Inc")
   → Returns DEF 14A with full board list
```

### Example 2: Research Foundation Affiliation (Automatic)

```
1. nonprofit_affiliation_search("John Smith")
   → Automatically searches web for nonprofit connections
   → Extracts organization names from results
   → Queries ProPublica for each organization
   → Returns consolidated 990 financials
```

**Note:** This single tool automates the entire workflow. For manual control, you can still use:

```
1. searchWeb("John Smith foundation board nonprofit")
   → Discovers "Smith Family Foundation"

2. propublica_nonprofit_search("Smith Family Foundation")
   → Returns EIN and basic info

3. propublica_nonprofit_details("12-3456789")
   → Returns full 990 financials
```

### Example 3: Wealth Screening

```
1. yahoo_finance_profile("AAPL")
   → Get executive list with compensation

2. wikidata_entity("Q12345")
   → Get net worth, education, positions

3. property_valuation("123 Main St, Cupertino CA")
   → Get home value estimate

4. fec_contributions("John Smith", state="CA")
   → Get political giving history
```

---

## Contact & Support

For questions about data sources or API integrations, please refer to the official documentation links provided for each source.

---

*Document last updated: December 2024*
