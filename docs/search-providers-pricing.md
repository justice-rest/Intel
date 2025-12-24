# Search Providers Pricing

This document outlines the pricing for the web search providers integrated into Rōmy.

## Overview

Rōmy uses **parallel web search** with Perplexity Sonar Reasoning Pro AND LinkUp for maximum prospect research coverage:

| Provider | Tool Name | Best For | Cost per Call |
|----------|-----------|----------|---------------|
| **Perplexity Sonar Reasoning Pro** | `perplexity_prospect_research` | Comprehensive research with structured JSON output | ~$0.04 |
| **LinkUp** | `linkup_prospect_research` | Additional web coverage with grounded citations | ~$0.01-0.03 |

## Parallel Search Architecture

Both tools run **simultaneously** for every prospect research request:

```
┌─────────────────────────────────────────────────────────┐
│  PARALLEL EXECUTION                                      │
├─────────────────────────────────────────────────────────┤
│  Perplexity Sonar Reasoning Pro  │  LinkUp              │
│  - Comprehensive 3-pass search   │  - Deep/standard     │
│  - JSON structured output        │  - sourcedAnswer     │
│  - 60s timeout                   │  - 30-45s timeout    │
└─────────────────────────────────────────────────────────┘
                         ↓
              Merge & Deduplicate Results
                         ↓
              Unified Research Report
```

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

### LinkUp Web Search
- **Standard depth**: ~$0.01 per search (faster, used in batch mode)
- **Deep depth**: ~$0.03 per search (comprehensive, used in chat mode)
- **Free tier**: Available at https://app.linkup.so (no credit card required)
- **Output**: Sourced answers with inline citations

## Cost Per Prospect

### Chat Mode (Deep Research)
| Tool | Depth | Cost |
|------|-------|------|
| Perplexity Sonar Reasoning Pro | deep | ~$0.04 |
| LinkUp | deep | ~$0.03 |
| **Total (parallel)** | | **~$0.07** |

### Batch Mode (Optimized for Volume)
| Tool | Depth | Cost |
|------|-------|------|
| Perplexity Sonar Reasoning Pro | standard | ~$0.04 |
| LinkUp | standard | ~$0.01 |
| **Total (parallel)** | | **~$0.05** |

### Cost Comparison (vs Previous Architecture)

| Approach | Cost/Prospect | Speed |
|----------|---------------|-------|
| **Previous (9 tools)** | $0.25-0.35 | 60-105s |
| **Current (Perplexity only)** | ~$0.04 | 15-25s |
| **NEW (Perplexity + LinkUp parallel)** | ~$0.05-0.07 | 15-30s |

## Estimated Monthly Costs

| Usage Level | Prospects/Month | Est. Cost (Parallel) |
|-------------|-----------------|----------------------|
| Light | 100 | ~$5-7 |
| Moderate | 500 | ~$25-35 |
| Heavy | 1,000 | ~$50-70 |

## Environment Variables

```bash
# Required for Perplexity Sonar Reasoning Pro (via OpenRouter)
OPENROUTER_API_KEY=your_openrouter_key

# Optional - for parallel LinkUp search (FREE tier available)
LINKUP_API_KEY=your_linkup_key  # Get free key at https://app.linkup.so

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
| `usaspending_awards` | USAspending.gov | FREE |
| `court_search` | CourtListener | FREE |
| `gleif_search` | GLEIF API | FREE |
| `npi_registry` | CMS NPI Registry | FREE |
| `uspto_search` | USPTO API | FREE |
