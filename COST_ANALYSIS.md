  # Rōmy Research Cost Analysis
  
  > Last Updated: December 27, 2025
  >
  > This document provides a comprehensive breakdown of costs for all research modes.
  
  ---
  
  ## Executive Summary
  
  | Mode | Cost Per Report/Row | 100 Reports | 500 Reports | 1,000 Reports |
  |------|---------------------|-------------|-------------|---------------|
  | **Research (Standard)** | $0.08 - $0.15 | $8 - $15 | $40 - $75 | $80 - $150 |
  | **Deep Research** | $0.15 - $0.30 | $15 - $30 | $75 - $150 | $150 - $300 |
  | **Batch Research** | $0.06 - $0.12 | $6 - $12 | $30 - $60 | $60 - $120 |
  
  ---
  
  ## API Pricing Reference
  
  ### AI Models (via OpenRouter)
  
  | Model | Model ID | Input Cost | Output Cost | Use Case |
  |-------|----------|------------|-------------|----------|
  | **Grok 4.1 Fast** | `x-ai/grok-4.1-fast` | $0.20/1M tokens | $0.50/1M tokens | Research mode orchestration |
  | **Grok 4.1 Fast (Thinking)** | `x-ai/grok-4.1-fast-thinking` | $0.20/1M tokens | $0.50/1M tokens + reasoning | Deep Research orchestration |
  | **Perplexity Sonar Reasoning Pro** | `perplexity/sonar-reasoning-pro` | $2.00/1M tokens | $8.00/1M tokens | Standard web research tool |
  | **Perplexity Sonar Deep Research** | `perplexity/sonar-deep-research` | $3.00/1M tokens | $15.00/1M tokens | Deep Research web tool (180s autonomous) |
  | **Perplexity Sonar Pro** | `perplexity/sonar-pro` | $3.00/1M tokens | $15.00/1M tokens | Batch report generation |
  
  ### Search APIs
  
  | API | Cost | Use Case |
  |-----|------|----------|
  | **LinkUp Standard** | $0.0055/query (~€5/1,000) | Quick fact lookup |
  | **LinkUp Deep** | $0.055/query (~€50/1,000) | Comprehensive research |
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
  1. **Grok 4.1 Fast** - Primary reasoning
  2. **Perplexity Sonar Reasoning Pro** - Web search (parallel)
  3. **LinkUp Standard** - Curated domain search (parallel)
  4. **Free APIs** - SEC, FEC, ProPublica verification
  
  ### Token Breakdown Per Report
  
  | Component | Input Tokens | Output Tokens | Cost |
  |-----------|--------------|---------------|------|
  | Grok 4.1 Fast (orchestration) | 2,000 | 1,500 | $0.0012 |
  | Perplexity Sonar Pro | 500 | 2,500 | $0.021 |
  | LinkUp Standard (1 query) | - | - | $0.0055 |
  | Free verification APIs | 500 | 500 | $0.00035 |
  | **Total** | **3,000** | **4,500** | **$0.028** |
  
  ### Actual Cost Range
  
  Due to research depth variability:
  - **Light research** (quick lookups): $0.04 - $0.06
  - **Standard research** (full profile): $0.08 - $0.12
  - **Complex research** (multiple searches): $0.12 - $0.15
  
  ### Scaling Calculations
  
  | Volume | Min Cost | Max Cost | Avg Cost |
  |--------|----------|----------|----------|
  | 100 reports | $4.00 | $15.00 | $8.00 |
  | 500 reports | $20.00 | $75.00 | $40.00 |
  | 1,000 reports | $40.00 | $150.00 | $80.00 |
  
  ---
  
  ## Deep Research Mode
  
  **When Used:** Toggle "Deep Research" in chat, complex wealth screening
  
  **Models & Tools:**
  1. **Grok 4.1 Fast (Thinking)** (`x-ai/grok-4.1-fast-thinking`) - Extended reasoning with high-effort thinking
  2. **Perplexity Sonar Deep Research** (`perplexity/sonar-deep-research`) - Multi-step autonomous investigation (180s timeout)
  3. **LinkUp Deep** - Comprehensive domain search (60s timeout)
  4. **Grok Native Search** - X/Twitter + web search (parallel, 45s timeout)
  5. **Free APIs** - SEC, FEC, ProPublica verification
  
  ### Token Breakdown Per Report
  
  | Component | Input Tokens | Output Tokens | Reasoning Tokens | Cost |
  |-----------|--------------|---------------|------------------|------|
  | Grok 4.1 Fast (Thinking) | 3,000 | 2,000 | 4,000 | $0.0036 |
  | Perplexity Sonar Deep Research | 800 | 3,500 | - | $0.055 |
  | LinkUp Deep (1 query) | - | - | - | $0.055 |
  | Grok Native Search | 500 | 1,500 | - | $0.00085 |
  | Free verification APIs | 800 | 1,000 | - | $0.00066 |
  | **Total** | **5,100** | **8,000** | **4,000** | **$0.115** |
  
  **Note:** Perplexity Sonar Deep Research uses autonomous multi-step investigation, running for up to 180 seconds to thoroughly research the prospect. This is significantly more comprehensive than the standard 60-second Sonar Reasoning Pro.
  
  ### Actual Cost Range
  
  Due to research complexity:
  - **Focused deep research**: $0.12 - $0.18
  - **Full wealth screening**: $0.18 - $0.25
  - **Comprehensive investigation**: $0.25 - $0.30
  
  ### Scaling Calculations
  
  | Volume | Min Cost | Max Cost | Avg Cost |
  |--------|----------|----------|----------|
  | 100 reports | $12.00 | $30.00 | $18.00 |
  | 500 reports | $60.00 | $150.00 | $90.00 |
  | 1,000 reports | $120.00 | $300.00 | $180.00 |
  
  ---
  
  ## Batch Research Mode
  
  **When Used:** Bulk prospect processing via `/labs` page
  
  **Primary Model:** `perplexity/sonar-pro` ($3/$15 per 1M tokens)
  
  **Pipeline Steps:**
  1. **Perplexity Pass 1** (handles multi-pass internally) - Required
  2. **LinkUp Search** - Optional, parallel
  3. **Grok Search** - Optional, parallel
  4. **Direct Verification** - Optional, sequential
  5. **Triangulation** - Required
  6. **Validation** - Required
  7. **Save Results** - Required
  
  ### Adaptive Depth System
  
  Batch research automatically adapts depth based on prospect indicators:
  
  | Depth Level | Passes | LinkUp | Grok | Verification | Timeout | Est. Cost |
  |-------------|--------|--------|------|--------------|---------|-----------|
  | **DEEP** | 3 | Yes | Yes | Yes | 90s | $0.15 |
  | **STANDARD** | 2 | Yes | No | No | 45s | $0.08 |
  | **QUICK** | 1 | No | No | No | 25s | $0.04 |
  
  **Depth triggers:**
  - **DEEP**: SEC filings detected, ROMY score ≥20, property value ≥$1M, business executive
  - **STANDARD**: ROMY score ≥10, foundation affiliation, wealth indicators present
  - **QUICK**: Low wealth indicators, annual fund likely
  
  ### Batch Processing Configuration
  
  ```
  delay_between_prospects_ms: 3,000
  max_retries: 2
  generate_romy_score: true
  search_mode: "standard" (uses standard research pipeline)
  ```
  
  ### Token Breakdown Per Row (Standard Batch)
  
  | Component | Input Tokens | Output Tokens | Cost |
  |-----------|--------------|---------------|------|
  | Perplexity Sonar Pro (pass 1-3) | 1,500 | 3,500 | $0.057 |
  | Triangulation | 2,000 | 800 | $0.0008 |
  | Validation (Grok) | 1,000 | 1,500 | $0.00095 |
  | **Total (Standard)** | **4,500** | **5,800** | **$0.059** |
  
  ### Token Breakdown Per Row (Full Batch - DEEP mode)
  
  | Component | Input Tokens | Output Tokens | Cost |
  |-----------|--------------|---------------|------|
  | Perplexity Sonar Pro (3 passes) | 2,500 | 5,000 | $0.083 |
  | LinkUp Deep | - | - | $0.055 |
  | Grok Search | 500 | 1,500 | $0.00085 |
  | Verification APIs | 500 | 500 | FREE |
  | Triangulation | 3,000 | 1,200 | $0.0012 |
  | Validation | 1,500 | 2,000 | $0.0013 |
  | **Total (Full)** | **8,000** | **10,200** | **$0.141** |
  
  ### Actual Cost Range
  
  | Batch Type | Cost Per Row |
  |------------|--------------|
  | Minimal (Perplexity only) | $0.03 - $0.05 |
  | Standard (+ LinkUp) | $0.06 - $0.08 |
  | Full (all optional steps) | $0.08 - $0.12 |
  
  ### Scaling Calculations (Standard Batch)
  
  | Volume | Processing Time | Min Cost | Max Cost | Avg Cost |
  |--------|-----------------|----------|----------|----------|
  | 100 rows | ~8 min | $6.00 | $12.00 | $8.00 |
  | 500 rows | ~40 min | $30.00 | $60.00 | $40.00 |
  | 1,000 rows | ~80 min | $60.00 | $120.00 | $80.00 |
  
  ---
  
  ## Batch Research: Adaptive Mode Considerations
  
  Batch research can dynamically switch between standard and deep research based on:
  - Prospect complexity (public figures may trigger deep research)
  - Data quality thresholds (weak results may trigger additional passes)
  - User configuration settings
  
  ### Adaptive Batch Cost Scenarios
  
  | Scenario | Mix | Cost Per Row | 100 Rows | 500 Rows | 1,000 Rows |
  |----------|-----|--------------|----------|----------|------------|
  | Standard Only | 100% standard | $0.06 | $6 | $30 | $60 |
  | Mixed (80/20) | 80% standard, 20% deep | $0.08 | $8 | $40 | $80 |
  | Mixed (50/50) | 50% standard, 50% deep | $0.11 | $11 | $55 | $110 |
  | Deep Only | 100% deep | $0.15 | $15 | $75 | $150 |
  
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
  
  ### Plan-Based Concurrency Limits
  
  | Plan | Concurrent Prospects | Batch Processing Speed |
  |------|---------------------|------------------------|
  | Growth | 5 concurrent | ~3 prospects/min |
  | Pro | 10 concurrent | ~6 prospects/min |
  | Scale | 15 concurrent | ~9 prospects/min |
  
  ### Processing Time Estimates
  
  | Batch Size | Growth Plan | Pro Plan | Scale Plan |
  |------------|-------------|----------|------------|
  | 100 | ~35 min | ~17 min | ~12 min |
  | 500 | ~170 min | ~85 min | ~57 min |
  | 1,000 | ~340 min | ~170 min | ~115 min |
  
  ### Scalability Considerations
  
  **Current Implementation:**
  - Uses Vercel serverless functions (120s max timeout)
  - Client-side polling for progress updates
  - Chunked processing (15 items per API call max)
  - Circuit breakers prevent cascade failures
  
  **For 1,000+ Prospect Batches:**
  - Jobs automatically split into smaller chunks
  - Client must maintain connection for polling
  - Long batches (500+) should be run during off-peak hours
  - Consider splitting into multiple 200-300 prospect jobs for reliability
  
  ### Concurrent Request Handling
  
  | API | Rate Limit | Safeguard |
  |-----|------------|-----------|
  | OpenRouter (Grok) | 60 req/min | 1s min delay |
  | Perplexity (via OR) | 20 req/min | 3s min delay |
  | LinkUp | 100 req/min | No special handling |
  | SEC EDGAR | 10 req/sec | 100ms delay |
  | FEC | 1,000/hour | 4s delay |
  | ProPublica | No limit | 50ms courtesy delay |
  
  ### High-Volume Batch Recommendations
  
  | Volume | Recommended Config | Est. Time | Est. Cost |
  |--------|-------------------|-----------|-----------|
  | 100 | Default settings | 8 min | $6-12 |
  | 500 | 5s delay, skip verification | 45 min | $25-50 |
  | 1,000 | 5s delay, skip verification | 90 min | $50-100 |
  | 5,000+ | Split into 5 batches, stagger | 8 hours | $250-500 |
  
  ---
  
  ## Cost Optimization Strategies
  
  ### 1. Use Standard Research First
  Start with standard research mode. Only escalate to deep research for high-value prospects or when standard results are insufficient.
  
  ### 2. Batch Processing is More Efficient
  Batch processing has 25-40% lower per-row costs due to:
  - Optimized API batching
  - Reduced orchestration overhead
  - Parallel tool execution
  
  ### 3. Leverage Free APIs
  SEC, FEC, and ProPublica data is FREE. Configure research to prioritize these sources for verification before expensive web searches.
  
  ### 4. Configure Batch Settings
  ```javascript
  // Cost-optimized batch config
  {
    runOptionalSteps: false,      // Skip LinkUp, Grok parallel
    skipVerification: true,       // Skip SEC/FEC verification
    delayBetweenProspectsMs: 5000 // Avoid rate limits
  }
  ```
  
  ### 5. Cache and Reuse
  - Document embeddings are stored and reused
  - Prospect research results cached for 24 hours
  - API responses cached where applicable
  
  ---
  
  ## Monthly Cost Projections
  
  ### Small NGO (50 prospects/month)
  
  | Mode | Monthly Cost |
  |------|--------------|
  | Standard Research | $4 - $8 |
  | Deep Research (10 prospects) | $2 - $3 |
  | **Total** | **$6 - $11** |
  
  ### Medium NGO (500 prospects/month)
  
  | Mode | Monthly Cost |
  |------|--------------|
  | Batch Research | $30 - $60 |
  | Individual Deep Research (50) | $8 - $15 |
  | **Total** | **$38 - $75** |
  
  ### Large NGO (2,000 prospects/month)
  
  | Mode | Monthly Cost |
  |------|--------------|
  | Batch Research (1,500) | $90 - $180 |
  | Deep Research (500) | $75 - $150 |
  | **Total** | **$165 - $330** |
  
  ---
  
  ## Appendix: Full API Cost Reference
  
  ### AI Models via OpenRouter
  
  | Model ID | Input Cost | Output Cost | Use Case |
  |----------|------------|-------------|----------|
  | `x-ai/grok-4.1-fast` | $0.20/1M | $0.50/1M | Research mode orchestration |
  | `x-ai/grok-4.1-fast-thinking` | $0.20/1M | $0.50/1M + reasoning | Deep Research orchestration |
  | `perplexity/sonar-reasoning-pro` | $2.00/1M | $8.00/1M | Standard web research (60s) |
  | `perplexity/sonar-deep-research` | $3.00/1M | $15.00/1M | Deep web research (180s autonomous) |
  | `perplexity/sonar-pro` | $3.00/1M | $15.00/1M | Batch report generation |
  
  ### Search & Data APIs
  
  | API | Cost | Use Case |
  |-----|------|----------|
  | LinkUp Standard | $0.0055/query (~€5/1,000) | Quick fact lookup |
  | LinkUp Deep | $0.055/query (~€50/1,000) | Comprehensive research |
  | OpenAI Embeddings (text-embedding-3-large) | $0.13/1M tokens | Document embeddings for RAG |
  | SEC EDGAR | FREE | Insider filings, proxy statements |
  | FEC API | FREE | Political contributions |
  | ProPublica 990 | FREE | Nonprofit data |
  | USAspending | FREE | Federal contracts/grants |
  
  ### Model Usage by Research Mode
  
  | Mode | Orchestration Model | Research Tool | Search Tools |
  |------|---------------------|---------------|--------------|
  | **Research** | Grok 4.1 Fast | Sonar Reasoning Pro | LinkUp Standard + Grok Native |
  | **Deep Research** | Grok 4.1 Fast (Thinking) | Sonar Deep Research | LinkUp Deep + Grok Native |
  | **Batch Research** | N/A | Sonar Pro | LinkUp (adaptive) + Grok (optional) |
  
  ---
  
  ## Sources
  
  - [OpenRouter Pricing](https://openrouter.ai/pricing)
  - [Perplexity API Pricing](https://docs.perplexity.ai/getting-started/pricing)
  - [LinkUp Pricing](https://www.linkup.so/pricing)
