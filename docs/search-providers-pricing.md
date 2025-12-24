# Search Providers Pricing

This document outlines the pricing for the web search providers integrated into Rōmy.

## Overview

Rōmy uses Perplexity Sonar Reasoning Pro as the primary search provider for prospect research:

| Provider | Tool Name | Best For | Cost per Call |
|----------|-----------|----------|---------------|
| **Perplexity Sonar Reasoning Pro** | `perplexity_prospect_research` | Comprehensive prospect research with citations | ~$0.04 |

## Detailed Pricing

### Perplexity Sonar Reasoning Pro (via OpenRouter)
- **Input tokens**: $2 per million tokens
- **Output tokens**: $8 per million tokens
- **Web search fee**: $5 per 1,000 searches ($0.005/search)
- **Context window**: 200K tokens
- **Max output**: 8K tokens

**Per-Query Cost Estimate** (2K input, 4K output):
- Input: 2,000 × $2/1M = $0.004
- Output: 4,000 × $8/1M = $0.032
- Web search: $0.005
- **Total: ~$0.04 per call**

### Cost Comparison (vs Previous Architecture)

| Approach | Cost/Prospect | Speed |
|----------|---------------|-------|
| **Previous (9 tools + Linkup)** | $0.25-0.35 | 60-105s |
| **Current (Perplexity + FEC + ProPublica)** | ~$0.04-0.08 | 15-25s |

## Estimated Monthly Costs

| Usage Level | Prospects/Month | Est. Cost |
|-------------|-----------------|-----------|
| Light | 100 | ~$4-8 |
| Moderate | 500 | ~$20-40 |
| Heavy | 1,000 | ~$40-80 |

## Environment Variables

```bash
# Required for Perplexity Sonar Reasoning Pro (via OpenRouter)
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
| `sec_insider_search` | SEC EDGAR | FREE |
| `sec_edgar_filings` | SEC EDGAR | FREE |
