# Rōmy Research Cost Analysis

> Last Updated: December 30, 2025
>
> This document provides a comprehensive breakdown of costs for all research modes.
> **v3.0 Update:** Migrated to LinkUp for all web research (80-90% cost savings)

---

## Executive Summary

| Mode | Cost Per Report/Row | 100 Reports | 500 Reports | 1,000 Reports |
|------|---------------------|-------------|-------------|---------------|
| **Research (Standard)** | $0.01 - $0.03 | $1 - $3 | $5 - $15 | $10 - $30 |
| **Deep Research** | $0.02 - $0.05 | $2 - $5 | $10 - $25 | $20 - $50 |
| **Batch Research** | $0.005 - $0.015 | $0.50 - $1.50 | $2.50 - $7.50 | $5 - $15 |

### LinkUp Migration - Cost Savings

| Mode | BEFORE (Perplexity + LinkUp) | AFTER (LinkUp) | Savings |
|------|------------------------------|---------------------|---------|
| **Standard Research** | $0.08 - $0.15 | $0.01 - $0.03 | **80-87%** |
| **Deep Research** | $0.15 - $0.30 | $0.02 - $0.05 | **83-87%** |
| **Batch Research** | $0.06 - $0.12 | $0.005 - $0.015 | **88-92%** |

---

## API Pricing Reference

### AI Models (via Google)

| Model | Model ID | Input Cost | Output Cost | Use Case |
|-------|----------|------------|-------------|----------|
| **Gemini 3 Flash** | `gemini-3-flash-preview` | $0.50/1M tokens | $3.00/1M tokens | Research mode orchestration |
| **Gemini 3 Pro** | `gemini-3-pro-preview` | $2.00/1M tokens | $12.00/1M tokens | Deep Research orchestration |

### Search APIs

| API | Cost | Use Case |
|-----|------|----------|
| **LinkUp Search** | $0.005/request (Standard) / $0.02/request (Deep) | Web research |
| **SEC EDGAR** | FREE | Insider filings, proxy statements |
| **FEC** | FREE | Political contributions |
| **ProPublica** | FREE | Nonprofit 990 data |
| **USAspending** | FREE | Federal contracts/grants |

### Embeddings (RAG)

| Model | Cost | Use Case |
|-------|------|----------|
| **OpenAI text-embedding-3-large** | $0.13/1M tokens | Document embeddings |

---

## Research Mode: Standard

**When Used:** Toggle "Research" button in chat, or research queries

**Models & Tools:**
1. **Gemini 3 Flash** - Primary reasoning
2. **LinkUp Search** - Comprehensive web research ($0.005/call)
3. **Google Search Grounding** - Real-time web search ($0.014/call)
4. **Free APIs** - SEC, FEC, ProPublica verification

### Token Breakdown Per Report

| Component | Input Tokens | Output Tokens | Cost |
|-----------|--------------|---------------|------|
| Gemini 3 Flash (orchestration) | 2,000 | 1,500 | $0.0055 |
| LinkUp Search | - | - | $0.005 |
| Free verification APIs | 500 | 500 | $0.00035 |
| **Total** | **2,500** | **2,000** | **$0.011** |

### Actual Cost Range

Due to research depth variability:
- **Light research** (quick lookups): $0.01 - $0.015
- **Standard research** (full profile): $0.015 - $0.025
- **Complex research** (multiple searches): $0.025 - $0.03

### Scaling Calculations

| Volume | Min Cost | Max Cost | Avg Cost |
|--------|----------|----------|----------|
| 100 reports | $1.00 | $3.00 | $1.80 |
| 500 reports | $5.00 | $15.00 | $9.00 |
| 1,000 reports | $10.00 | $30.00 | $18.00 |

---

## Deep Research Mode

**When Used:** Toggle "Deep Research" in chat, complex wealth screening

**Models & Tools:**
1. **Gemini 3 Pro** (`gemini-3-pro-preview`) - Extended reasoning with high-effort thinking
2. **LinkUp Search (one-shot mode)** - Comprehensive multi-step search ($0.005-$0.009)
3. **Google Search Grounding** - Real-time web search ($0.014/call)
4. **Free APIs** - SEC, FEC, ProPublica verification

### Token Breakdown Per Report

| Component | Input Tokens | Output Tokens | Cost |
|-----------|--------------|---------------|------|
| Gemini 3 Pro (orchestration) | 3,000 | 2,000 | $0.030 |
| LinkUp Search (one-shot) | - | - | $0.009 |
| Google Search Grounding | - | - | $0.014 |
| Free verification APIs | 800 | 1,000 | $0.00066 |
| **Total** | **3,800** | **3,000** | **$0.054** |

**Note:** LinkUp in "one-shot" mode provides comprehensive, multi-step research similar to the previous Perplexity Deep Research but at ~95% lower cost.

### Actual Cost Range

Due to research complexity:
- **Focused deep research**: $0.02 - $0.03
- **Full wealth screening**: $0.03 - $0.04
- **Comprehensive investigation**: $0.04 - $0.05

### Scaling Calculations

| Volume | Min Cost | Max Cost | Avg Cost |
|--------|----------|----------|----------|
| 100 reports | $2.00 | $5.00 | $3.50 |
| 500 reports | $10.00 | $25.00 | $17.50 |
| 1,000 reports | $20.00 | $50.00 | $35.00 |

---

## Batch Research Mode

**When Used:** Bulk prospect processing via `/labs` page

**Primary Tool:** LinkUp Search ($0.005 per prospect)

**Pipeline Steps:**
1. **LinkUp Search** - Primary research (required)
2. **Google Search** - Additional web data (optional)
3. **Direct Verification** - SEC, FEC, ProPublica (optional)
4. **Triangulation** - Merge and score data
5. **RōmyScore Calculation** - Wealth scoring
6. **Save Results** - Persist to database

### Token Breakdown Per Row (Standard Batch)

| Component | Cost |
|-----------|------|
| LinkUp Search | $0.005 |
| RōmyScore calculation | $0.0005 |
| **Total (Standard)** | **$0.0055** |

### Token Breakdown Per Row (Full Batch - with optional steps)

| Component | Cost |
|-----------|------|
| LinkUp Search | $0.005 |
| Google Search Grounding | $0.014 |
| Verification APIs | FREE |
| RōmyScore calculation | $0.0005 |
| **Total (Full)** | **$0.020** |

### Actual Cost Range

| Batch Type | Cost Per Row |
|------------|--------------|
| Minimal (LinkUp only) | $0.005 - $0.006 |
| Standard (+ Google) | $0.019 - $0.025 |
| Full (all optional steps) | $0.025 - $0.035 |

### Scaling Calculations (Standard Batch)

| Volume | Processing Time | Min Cost | Max Cost | Avg Cost |
|--------|-----------------|----------|----------|----------|
| 100 rows | ~8 min | $0.50 | $1.50 | $0.80 |
| 500 rows | ~40 min | $2.50 | $7.50 | $4.00 |
| 1,000 rows | ~80 min | $5.00 | $15.00 | $8.00 |

---

## RAG Document Indexing Costs

For Google Drive document processing:

| Document Type | Avg Chunks | Embedding Tokens | Cost |
|---------------|------------|------------------|------|
| 1-page doc | 3-5 | 1,500 | $0.0002 |
| 10-page doc | 25-40 | 15,000 | $0.002 |
| 50-page doc | 100-150 | 60,000 | $0.008 |
| 100-page doc | 200-300 | 120,000 | $0.016 |

**Note:** Document indexing is a one-time cost per document. Retrieval during chat uses minimal tokens.

---

## System Scalability Analysis

### Batch Processing Capacity

| Metric | Value | Notes |
|--------|-------|-------|
| Max batch size | 1,000 prospects | Hard limit per job |
| Processing rate | ~12 prospects/min | With 3s delay |
| Max concurrent batches | 10 | Per Vercel instance |
| API rate limits respected | Yes | Circuit breakers + backoff |

### Processing Time Estimates

| Batch Size | Estimated Time |
|------------|----------------|
| 100 | ~8 min |
| 500 | ~40 min |
| 1,000 | ~80 min |

### Concurrent Request Handling

| API | Rate Limit | Safeguard |
|-----|------------|-----------|
| Google Gemini | 60 req/min | 1s min delay |
| LinkUp | High throughput | Built-in rate limiting |
| SEC EDGAR | 10 req/sec | 100ms delay |
| FEC | 1,000/hour | 4s delay |
| ProPublica | No limit | 50ms courtesy delay |

---

## Cost Optimization Strategies

### 1. Use Standard Research First
Start with standard research mode. Only escalate to deep research for high-value prospects or when standard results are insufficient.

### 2. Batch Processing is Most Cost-Effective
Batch processing has the lowest per-row costs:
- $0.005-$0.015 per prospect with LinkUp
- Optimized API batching
- Parallel tool execution

### 3. Leverage Free APIs
SEC, FEC, and ProPublica data is FREE. These are automatically used for verification.

### 4. Cache and Reuse
- Document embeddings are stored and reused
- Prospect research results cached for 24 hours
- API responses cached where applicable

---

## Monthly Cost Projections

### Small NGO (50 prospects/month)

| Mode | Monthly Cost |
|------|--------------|
| Standard Research | $0.50 - $1.50 |
| Deep Research (10 prospects) | $0.20 - $0.50 |
| **Total** | **$0.70 - $2.00** |

### Medium NGO (500 prospects/month)

| Mode | Monthly Cost |
|------|--------------|
| Batch Research | $2.50 - $7.50 |
| Individual Deep Research (50) | $1 - $2.50 |
| **Total** | **$3.50 - $10.00** |

### Large NGO (2,000 prospects/month)

| Mode | Monthly Cost |
|------|--------------|
| Batch Research (1,500) | $7.50 - $22.50 |
| Deep Research (500) | $10 - $25 |
| **Total** | **$17.50 - $47.50** |

---

## Appendix: Full API Cost Reference

### AI Models via Google

| Model ID | Input Cost | Output Cost | Use Case |
|----------|------------|-------------|----------|
| `gemini-3-flash-preview` | $0.50/1M | $3.00/1M | Research mode orchestration |
| `gemini-3-pro-preview` | $2.00/1M | $12.00/1M | Deep Research orchestration |

### Search & Data APIs

| API | Cost | Use Case |
|-----|------|----------|
| Google Search Grounding | $0.014/request | Real-time web search |
| LinkUp Search | $0.005/request | All web research |
| Exa Websets | Varies | Prospect discovery |
| OpenAI Embeddings (text-embedding-3-large) | $0.13/1M tokens | Document embeddings for RAG |
| SEC EDGAR | FREE | Insider filings, proxy statements |
| FEC API | FREE | Political contributions |
| ProPublica 990 | FREE | Nonprofit data |
| USAspending | FREE | Federal contracts/grants |

### Model Usage by Research Mode

| Mode | Orchestration Model | Research Tool | Additional |
|------|---------------------|---------------|------------|
| **Research** | Gemini 3 Flash | LinkUp (agentic) | Google Search Grounding |
| **Deep Research** | Gemini 3 Pro | LinkUp (one-shot) | Google Search Grounding |
| **Batch Research** | N/A | LinkUp | Google Search (optional) |

---

## Sources

- [Google AI Pricing](https://ai.google.dev/pricing)
- [LinkUp Pricing](https://linkup.so/pricing)
- [LinkUp Docs](https://docs.linkup.so)
