# Search Providers Pricing

This document outlines the pricing for the web search providers integrated into Rōmy.

## Overview

Rōmy uses four search providers, each optimized for different use cases:

| Provider | Tool Name | Best For | Cost per Search |
|----------|-----------|----------|-----------------|
| **Linkup** | `searchWeb` | Prospect research (SEC, FEC, 990s, real estate) | ~$0.005 |
| **Exa** | `exaSearch` | Semantic/neural search, finding similar content | ~$0.01 |
| **Tavily** | `tavilySearch` | News, current events, real-time facts | ~$0.008 (1 credit) |
| **Firecrawl** | `firecrawlSearch` | Web scraping, full page content | 2 credits/10 results |

## Detailed Pricing

### Linkup
- **Pricing**: ~$0.005 per search
- **Mode**: `sourcedAnswer` (pre-synthesized answers)
- **Free tier**: Free API key at [app.linkup.so](https://app.linkup.so)
- **Features**: Curated domains for prospect research, built-in citations

### Exa
- **Pricing**: $5 per 1,000 searches (1-25 results)
- **Content retrieval**: +$5 per 1,000 pages
- **Free tier**: $10 free credits at [dashboard.exa.ai](https://dashboard.exa.ai)
- **Features**: Neural/semantic search, autoprompt optimization

### Tavily
- **Pricing**:
  - Basic search: 1 credit (~$0.008)
  - Advanced search: 2 credits (~$0.016)
- **Free tier**: 1,000 credits/month at [tavily.com](https://tavily.com)
- **Plans**:
  - Free: 1,000 credits/month
  - Project: $30/month for 4,000 credits
  - Add-on: $100 one-time for 8,000 credits (no expiration)

### Firecrawl
- **Pricing**:
  - Search only: 2 credits per 10 results
  - With scraping: +1 credit per page
- **Free tier**: 500 free pages at [firecrawl.dev](https://firecrawl.dev)
- **Plans**:
  - Hobby: $16/month
  - Standard: $83/month
  - Growth: $333/month (500,000 credits)

## Cost Optimization

Our implementation uses cost-efficient defaults:

1. **Low result counts**: 5 results by default (not 10-25)
2. **Basic search depth**: Tavily uses "basic" (1 credit vs 2 for "advanced")
3. **No scraping by default**: Firecrawl searches without scraping unless requested
4. **15-second timeouts**: Fast failures prevent hanging and wasted credits

## Estimated Monthly Costs

| Usage Level | Searches/Month | Est. Cost |
|-------------|----------------|-----------|
| Light | 100 | ~$1-2 |
| Moderate | 1,000 | ~$10-20 |
| Heavy | 10,000 | ~$100-200 |

*Note: Actual costs depend on which providers are used. The AI chooses the most appropriate tool based on query type.*

## Environment Variables

```bash
# Required for each provider (all optional - app works without them)
LINKUP_API_KEY=your_linkup_key
EXA_API_KEY=your_exa_key
TAVILY_API_KEY=your_tavily_key
FIRECRAWL_API_KEY=your_firecrawl_key
```
