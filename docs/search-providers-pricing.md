# Search Providers Pricing

This document outlines the pricing for the web search providers integrated into Rōmy.

## Overview

Rōmy uses Perplexity Sonar Pro as the primary search provider for prospect research:

| Provider | Tool Name | Best For | Cost per Call |
|----------|-----------|----------|---------------|
| **Perplexity Sonar Pro** | `perplexity_prospect_research` | Comprehensive prospect research with citations | ~$0.10 |

## Detailed Pricing

### Perplexity Sonar Pro (via OpenRouter)
- **Input tokens**: $3 per million tokens
- **Output tokens**: $15 per million tokens
- **Per-request fee**: $0.018
- **Web search**: ~$0.018 per request
- **Context window**: 200K tokens
- **Max output**: 8K tokens

**Per-Query Cost Estimate** (2K input, 4K output):
- Input: $0.006
- Output: $0.060
- Request fee: $0.018
- Web search: $0.018
- **Total: ~$0.10 per call**

### Cost Comparison (vs Previous Architecture)

| Approach | Cost/Prospect | Speed |
|----------|---------------|-------|
| **Previous (9 tools + Linkup)** | $0.25-0.35 | 60-105s |
| **Current (Perplexity + FEC + ProPublica)** | $0.10-0.15 | 15-25s |

## Estimated Monthly Costs

| Usage Level | Prospects/Month | Est. Cost |
|-------------|-----------------|-----------|
| Light | 100 | ~$10-15 |
| Moderate | 500 | ~$50-75 |
| Heavy | 1,000 | ~$100-150 |

## Environment Variables

```bash
# Required for Perplexity Sonar Pro (via OpenRouter)
OPENROUTER_API_KEY=your_openrouter_key

# Optional - for structured data tools (FREE)
FEC_API_KEY=your_fec_key  # Free from api.data.gov
```

## Retained FREE Tools

These structured data tools are retained and cost nothing:

| Tool | Source | Cost |
|------|--------|------|
| `fec_contributions` | OpenFEC API | FREE |
| `propublica_nonprofit_*` | ProPublica API | FREE |
| `yahoo_finance_*` | Yahoo Finance | FREE |
| `sec_insider_search` | SEC EDGAR | FREE |
| `sec_edgar_filings` | SEC EDGAR | FREE |
