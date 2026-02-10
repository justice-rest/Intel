# Romy Data Sources

**Comprehensive prospect research data from FREE government and public APIs.**

This document lists all data sources integrated into Romy, their purpose, and the competitive advantage they provide over expensive alternatives like WealthEngine ($25K+/yr), DonorSearch ($4K+/yr), and iWave ($4K+/yr).

---

## Quick Stats

| Metric | Value |
|--------|-------|
| **Total AI Tools** | 22 (implemented) |
| **API Keys Required** | 5 optional for tools (FEC, LinkUp, LDA, Socrata, Google AI) |
| **Annual Cost** | $0 for government APIs (LinkUp has per-search cost) |

> **Note:** Tools marked with ✅ are implemented as AI tool functions in `/lib/tools/`. Tools marked with 🔍 indicate data points covered by the LinkUp prospect research tool's comprehensive web search. Tools marked with 📋 are planned/aspirational.

---

## Core Research Tools

### Web Search & AI

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `linkup_prospect_research` | ✅ | LinkUp deep search with curated prospect domains | AI-synthesized answers with source citations |
| `linkup_ultra_research` | ✅ | LinkUp ultra-deep multi-query research | Comprehensive 10+ query deep dive |
| `search_memory` | ✅ | Personal memory recall from past conversations | Contextual research continuity |
| `search_prospects` | ✅ | Search previously generated prospect reports | Instant recall of prior research |
| `list_documents` | ✅ | List uploaded documents | Document library management |
| `rag_search` | ✅ | Semantic search across uploaded documents | AI-powered document Q&A |

---

## Wealth Indicators

### Securities & Public Companies

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `sec_edgar_filings` | ✅ | SEC 10-K, 10-Q, proxy statements | Public company financials, executive comp |
| `sec_insider_search` | ✅ | Form 3/4/5 insider transactions | Verify officer/director status at public companies |
| `sec_proxy_search` | ✅ | DEF 14A proxy statements | Complete board composition, executive pay |

### Real Estate

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| Property valuation | 🔍 | Covered via LinkUp prospect research | Multi-source property estimates |
| County assessor data | 🔍 | Covered via LinkUp prospect research | Official property records |

### Business Ownership

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| Business registries | 🔍 | Covered via LinkUp prospect research | Officer/director positions |
| Business revenue | 🔍 | Referenced in giving capacity calculator | Employee count × industry benchmarks |

---

## Political & Government Connections

### Campaign Finance

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `fec_contributions` | ✅ | Federal campaign contributions | Presidential, Congressional donations |

### Lobbying & Government

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `federal_lobbying` | ✅ | LDA filings by registrant/client/lobbyist | Lobbying firm relationships |
| `state_contracts` | ✅ | Government contracts | Business-government relationships |
| `usaspending_awards` | ✅ | Federal contracts, grants, loans | USAspending.gov - all federal funding |

---

## Professional Credentials

### Healthcare

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `npi_registry` | ✅ | CMS NPI Registry - 7.5M providers | Authoritative healthcare credentials |
| `cms_open_payments` | ✅ | Sunshine Act physician payments | Pharma/device company payments to MDs |

---

## Nonprofit & Philanthropy

### Foundation Research

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `propublica_nonprofit_search` | ✅ | Nonprofit Explorer - 990 data | EIN lookup, revenue, assets |
| `propublica_nonprofit_details` | ✅ | Detailed 990 analysis | Officer compensation, grants made |

---

## Court & Compliance

### Legal Records

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `court_search` | ✅ | Federal court records (CourtListener) | Litigation, bankruptcy, disputes |

---

## Biographical & Reference

### Biographical & Reference

Biographical data, household, and family information are covered through the LinkUp prospect research tool's comprehensive web search capabilities.

---

## CRM Integrations

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `crm_search` | ✅ | Search connected CRM data | Bloomerang, Virtuous, Neon CRM, DonorPerfect |

---

## Analysis Tools

| Tool | Status | Description | Advantage |
|------|--------|-------------|-----------|
| `giving_capacity_calculator` | ✅ | TFG Research formulas (GS, EGS, Snapshot) | Industry-standard capacity ratings (A/B/C/D) |
| `gemini_grounded_search` | ✅ | Gemini grounded search (Scale plan) | Google-grounded web search with citations |
| `gemini_ultra_search` | ✅ | Gemini deep research (Scale plan, beta) | Deep multi-angle investigation via Gemini 3 Pro |

---

## API Configuration

### Optional API Keys (for tools)

| API | Environment Variable | How to Get | Cost |
|-----|---------------------|------------|------|
| LinkUp | `LINKUP_API_KEY` | [app.linkup.so](https://app.linkup.so) | $0.005-$0.02/search |
| FEC | `FEC_API_KEY` | [api.data.gov/signup](https://api.data.gov/signup) | FREE |
| Senate LDA | `LDA_API_KEY` | [lda.senate.gov/api](https://lda.senate.gov/api) | FREE |
| Google AI | `GOOGLE_AI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | ~$0.50/1M input tokens |
| Data.gov | `DATA_GOV_API_KEY` | [api.data.gov/signup](https://api.data.gov/signup) | FREE |

### Optional (Enhanced Rate Limits)

| API | Environment Variable | Purpose |
|-----|---------------------|---------|
| Socrata App Token | `SOCRATA_APP_TOKEN` | Higher rate limits for state contracts (1000/hr vs 60/hr) |

---

## Competitive Comparison

| Feature | WealthEngine | DonorSearch | iWave | Romy |
|---------|--------------|-------------|-------|------|
| **Annual Cost** | $25,000+ | $4,000+ | $4,150+ | **$0** |
| Real Estate | Paid data | Yes | Yes | **FREE (LinkUp prospect research)** |
| Stock Ownership | Paid data | Yes | Yes | **FREE (SEC EDGAR)** |
| Political Donations | Paid data | Yes | Yes | **FREE (FEC)** |
| Nonprofit Giving | Paid data | Yes | Yes | **FREE (ProPublica 990s)** |
| Board Memberships | Paid data | Yes | Yes | **FREE (SEC + 990s)** |
| Business Ownership | Paid data | Yes | Yes | **FREE (LinkUp)** |
| Physician Payments | No | No | No | **FREE (CMS Sunshine)** |
| Federal Lobbying | No | No | No | **FREE (Senate LDA)** |
| Court Records | No | No | No | **FREE (CourtListener)** |
| State Contracts | No | No | No | **FREE (Socrata)** |
| Federal Awards | No | No | No | **FREE (USAspending)** |

---

## Data Quality Tiers

### Tier 1: Official Government Records (Highest Confidence)

| Source | Update Frequency | Notes |
|--------|------------------|-------|
| SEC EDGAR | Real-time | Gold standard for public companies |
| FEC | Daily | Official federal campaign finance |
| NPI Registry | Weekly | CMS official healthcare providers |
| IRS 990 (ProPublica) | Monthly | 60%+ of nonprofits |
| USAspending | Daily | Federal contracts, grants, loans |

### Tier 2: Aggregated Official Data (High Confidence)

| Source | Coverage | Notes |
|--------|----------|-------|
| Socrata | 8 US states | State government contracts |
| CourtListener | Federal courts | Litigation and bankruptcy records |
| CMS Open Payments | National | Physician industry payments |

### Tier 3: Web/AI Sources (Medium Confidence)

| Source | Use Case | Notes |
|--------|----------|-------|
| LinkUp | Comprehensive research | AI-synthesized web search with citations |
| Gemini Grounded | Supplemental search | Google-grounded web search (Scale plan) |

---

## Rate Limits Summary

| API | Without Token | With Token | Cost |
|-----|---------------|------------|------|
| Socrata | 60/hour | 1,000/hour | FREE |
| FEC | 1,000/hour | - | FREE |
| NPI Registry | Unlimited | - | FREE |
| SEC EDGAR | 10/second | - | FREE |
| ProPublica | Reasonable use | - | FREE |
| CourtListener | 5,000/hour | - | FREE |
| USAspending | Reasonable use | - | FREE |
| Senate LDA | Reasonable use | With key | FREE |

---

## Regional Coverage

### State Contracts via Socrata (8 states = 50% US population)

CA, NY, TX, FL, IL, OH, CO, MA

---

*Last updated: February 2026*
