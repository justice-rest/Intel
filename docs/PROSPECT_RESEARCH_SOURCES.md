# Prospect Research Data Sources

This document outlines all data sources integrated into Rōmy for prospect research and wealth screening.

---

## Direct API Integrations (Tools)

### Yahoo Finance (No API Key Required)
- **Package:** [yahoo-finance2](https://www.npmjs.com/package/yahoo-finance2)
- **GitHub:** https://github.com/gadicc/node-yahoo-finance2
- **Data Available:**
  - Real-time stock quotes and market cap
  - Company profiles and executive information
  - Insider holdings and transactions
  - Institutional ownership percentages
  - SEC filings references

| Tool | Purpose |
|------|---------|
| `yahoo_finance_quote` | Stock price, market cap, basic info |
| `yahoo_finance_search` | Find ticker symbols by company name |
| `yahoo_finance_profile` | Executives, insider holdings, institutional ownership |

---

### ProPublica Nonprofit Explorer (No API Key Required)
- **API Docs:** https://projects.propublica.org/nonprofits/api
- **Website:** https://projects.propublica.org/nonprofits/
- **Data Available:**
  - 1.8M+ tax-exempt organizations
  - Form 990/990-EZ/990-PF financial data
  - Revenue, expenses, assets, liabilities
  - Officer compensation percentages
  - NTEE category classifications
  - Links to GuideStar profiles and 990 PDFs

| Tool | Purpose |
|------|---------|
| `propublica_nonprofit_search` | Search nonprofits by name, state, category |
| `propublica_nonprofit_details` | 990 financials, revenue, assets, officer comp |

---

### OpenCorporates (API Key Required)
- **API Docs:** https://api.opencorporates.com/documentation/API-Reference
- **Website:** https://opencorporates.com/
- **Get API Key:** https://opencorporates.com/api_accounts/new
- **Rate Limits:** 200 requests/month, 50 requests/day (free tier)
- **Data Available:**
  - 220M+ companies across 140+ jurisdictions
  - Company registration details and status
  - Officer/director names and positions
  - Incorporation dates and registered addresses
  - Corporate registry links

| Tool | Purpose |
|------|---------|
| `opencorporates_company_search` | Search companies by name, jurisdiction |
| `opencorporates_officer_search` | Find board memberships, directorships |
| `opencorporates_company_details` | Full company details with officers |

---

### Linkup Web Search (API Key Required)
- **Website:** https://www.linkup.so/
- **Get API Key:** https://app.linkup.so (free, no credit card)
- **Data Available:**
  - Pre-synthesized answers with source citations
  - Searches across 100+ curated prospect research domains
  - Standard and deep search modes

| Tool | Purpose |
|------|---------|
| `searchWeb` | Web search with curated domains for prospect research |

---

## Linkup Curated Domains (100+)

### SEC & Securities Data
| Domain | Description |
|--------|-------------|
| sec.gov | EDGAR filings, insider transactions, Form 3/4/5 |
| finance.yahoo.com | Stock data, insider ownership |
| marketwatch.com | Financial news, executive profiles |

### Political Contributions (FEC & State)
| Domain | Description |
|--------|-------------|
| fec.gov | Federal Election Commission |
| opensecrets.org | Political donations, donor lookup |
| followthemoney.org | State political contributions |

### Foundation & Philanthropy (990s, Board Memberships)
| Domain | Description |
|--------|-------------|
| guidestar.org | Candid nonprofit/foundation data |
| candid.org | Foundation 990s, grants data |
| app.candid.org | 990 Finder - board members, grants |
| projects.propublica.org | ProPublica Nonprofit Explorer |
| philanthropy.com | Chronicle of Philanthropy |
| insidephilanthropy.com | Major gifts, foundation news |
| givingpledge.org | Billionaire philanthropy commitments |
| cof.org | Council on Foundations |
| boardsource.org | Nonprofit board governance |
| instrumentl.com | Foundation directory, 990 finder |

### Real Estate, Property Records & Home Valuations
| Domain | Description |
|--------|-------------|
| zillow.com | Property values, Zestimates, home valuations |
| redfin.com | Real estate data, home values, estimates |
| realtor.com | Property listings, valuations |
| trulia.com | Home valuations, neighborhood data |
| homes.com | Property values, home estimates |
| homelight.com | Home value estimator |
| eppraisal.com | Free home valuations |
| chase.com | Chase Home Value Estimator |
| bankofamerica.com | Home value tools |
| publicrecords.netronline.com | County property records directory |
| propertyshark.com | Property data, ownership records |
| blockshopper.com | Recent home sales, property transfers |

### Business & Corporate Data
| Domain | Description |
|--------|-------------|
| linkedin.com | Professional backgrounds, career history |
| crunchbase.com | Business ownership, founders, investors |
| opencorporates.com | Corporate registry, company data (140+ jurisdictions) |
| bloomberg.com | Business news, billionaires index |
| forbes.com | Forbes 400, rich lists, executive profiles |
| pitchbook.com | Private company data, investors |
| dnb.com | Dun & Bradstreet business directory |
| zoominfo.com | Business contacts, company info |

### State Business Registries (All 50 States + DC)
| State | Domain |
|-------|--------|
| Alabama | sos.alabama.gov |
| Alaska | commerce.alaska.gov |
| Arizona | azsos.gov |
| Arkansas | sos.arkansas.gov |
| California | sos.ca.gov |
| Colorado | sos.state.co.us |
| Connecticut | portal.ct.gov |
| Delaware | delaware.gov |
| District of Columbia | os.dc.gov |
| Florida | dos.myflorida.com |
| Georgia | sos.ga.gov |
| Hawaii | portal.ehawaii.gov |
| Idaho | sos.idaho.gov |
| Illinois | ilsos.gov |
| Indiana | in.gov |
| Iowa | sos.iowa.gov |
| Kansas | sos.kansas.gov |
| Kentucky | sos.ky.gov |
| Louisiana | sos.la.gov |
| Maine | maine.gov |
| Maryland | sos.maryland.gov |
| Massachusetts | sec.state.ma.us |
| Michigan | michigan.gov |
| Minnesota | sos.state.mn.us |
| Mississippi | sos.ms.gov |
| Missouri | sos.mo.gov |
| Montana | sosmt.gov |
| Nebraska | sos.ne.gov |
| Nevada | nvsos.gov |
| New Hampshire | sos.nh.gov |
| New Jersey | state.nj.us |
| New Mexico | sos.state.nm.us |
| New York | dos.ny.gov |
| North Carolina | sosnc.gov |
| North Dakota | sos.nd.gov |
| Ohio | sos.state.oh.us |
| Oklahoma | sos.ok.gov |
| Oregon | sos.oregon.gov |
| Pennsylvania | dos.pa.gov |
| Rhode Island | sos.ri.gov |
| South Carolina | sos.sc.gov |
| South Dakota | sdsos.gov |
| Tennessee | sos.tn.gov |
| Texas | sos.state.tx.us |
| Utah | corporations.utah.gov |
| Vermont | sos.vermont.gov |
| Virginia | virginia.gov |
| Washington | sos.wa.gov |
| West Virginia | sos.wv.gov |
| Wisconsin | sos.wi.gov |
| Wyoming | sos.wyo.gov |

Source: https://www.llcuniversity.com/50-secretary-of-state-sos-business-entity-search/

### News & Media Archives
| Domain | Description |
|--------|-------------|
| wsj.com | Wall Street Journal |
| nytimes.com | New York Times |
| bizjournals.com | Regional business journals, 40 Under 40 |
| wikipedia.org | Biographical information |
| reuters.com | Business news |
| apnews.com | Associated Press |
| cnbc.com | Business & financial news |
| fortune.com | Fortune 500, executive profiles |

### Court Records
| Domain | Description |
|--------|-------------|
| pacer.uscourts.gov | Federal court records, civil cases |
| courtlistener.com | RECAP archive, court documents |

---

## Environment Variables

```bash
# Required for Linkup web search
LINKUP_API_KEY=your_linkup_api_key

# Optional - for OpenCorporates business/officer lookup
OPENCORPORATES_API_KEY=your_opencorporates_api_key

# No API key needed for:
# - Yahoo Finance (stock data, executives)
# - ProPublica Nonprofit Explorer (990s, foundation data)
```

---

## How Tools & Domains Work Together

| Data Source | Tool (Direct API) | Linkup Domain (Web Search) |
|-------------|-------------------|---------------------------|
| OpenCorporates | Structured company/officer data | Web pages, additional context |
| ProPublica | 990 financials, EINs | Web articles, reports |
| Yahoo Finance | Real-time stock data | News, analysis articles |
| SEC | Via Yahoo Finance tools | sec.gov direct access |
| FEC | — | fec.gov, opensecrets.org |
| Property Records | — | zillow.com, redfin.com, county sites |

**Tools** provide precise, structured data via direct API calls.
**Linkup domains** enable broader web search with additional context.

---

## Additional Resources

- [Candid 990 Finder](https://candid.org/research-and-verify-nonprofits/990-finder)
- [OpenSecrets Donor Lookup](https://www.opensecrets.org/donor-lookup)
- [Bloomberg Billionaires Index](https://www.bloomberg.com/billionaires/)
- [Forbes 400](https://www.forbes.com/forbes-400/)
- [Chronicle of Philanthropy](https://www.philanthropy.com/)
- [Inside Philanthropy](https://www.insidephilanthropy.com/)
- [The Giving Pledge](https://givingpledge.org/)
