# Rōmy Developer Documentation

**Rōmy** helps small nonprofits find new major donors at a fraction of the cost of existing solutions.

Built with Next.js 15, powered by Grok 4.1 Fast via OpenRouter, with BYOK (Bring Your Own Key) support, file uploads, AI memory, 22 research tools, RAG document search, and subscriptions via Autumn.

**Live:** [intel.getromy.app](https://intel.getromy.app)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Architecture Overview](#architecture-overview)
5. [AI Provider Integration](#ai-provider-integration)
6. [AI Memory System](#ai-memory-system)
7. [RAG Document Search](#rag-document-search)
8. [Research Tools](#research-tools)
9. [Web Search (Linkup)](#web-search-linkup)
10. [Subscriptions (Autumn)](#subscriptions-autumn)
11. [Analytics (PostHog)](#analytics-posthog)
12. [API Routes Reference](#api-routes-reference)
13. [Development Commands](#development-commands)
14. [Common Pitfalls](#common-pitfalls)
15. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
git clone https://github.com/ibelick/romy.git
cd romy
npm install
echo "OPENROUTER_API_KEY=your-key" > .env.local
npm run dev
```

---

## Environment Setup

Create `.env.local` from `.env.example`:

```bash
# ===========================================
# REQUIRED
# ===========================================

# Security
CSRF_SECRET=                    # 32-byte hex: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=                 # 32-byte base64: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# AI Provider
OPENROUTER_API_KEY=             # Required - powers Grok 4.1 Fast model and embeddings

# ===========================================
# OPTIONAL - Full Features
# ===========================================

# Supabase (for auth, storage, persistence - app works without it)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE=

# Web Search & Research
LINKUP_API_KEY=                 # LinkUp prospect research ($0.005-$0.02/search)
FEC_API_KEY=                    # FEC political contributions (free at api.data.gov/signup)
DATA_GOV_API_KEY=               # Higher rate limits for gov APIs (free at api.data.gov/signup)
GOOGLE_AI_API_KEY=              # Gemini Grounded Search (beta, Scale plan only)

# Voice Input
GROQ_API_KEY=                   # Speech-to-Text via Whisper (free at console.groq.com)

# Notion Integration
NOTION_CLIENT_ID=               # Notion OAuth Client ID
NOTION_CLIENT_SECRET=           # Notion OAuth Client Secret

# Subscriptions
AUTUMN_SECRET_KEY=              # For billing (am_sk_test_... or am_sk_live_...)

# CAPTCHA Solving (for web crawl)
ROBOFLOW_API_KEY=               # Roboflow object detection for CAPTCHA solving

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=       # Defaults to https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_ENABLE_RECORDINGS=false

# Production
NEXT_PUBLIC_VERCEL_URL=         # Your production domain

# Development
ANALYZE=false                   # Set to true to analyze bundle size
```

---

## Database Setup

### Run Migrations

```bash
# Automated (recommended)
npm run migrate

# Manual: Run SQL from supabase/migrations/ in Supabase SQL Editor
```

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Profile, message counts, daily limits, system_prompt |
| `chats` | Chat metadata (title, model, pinned, system_prompt) |
| `messages` | Content, role, attachments (JSONB), parts (JSONB), model |
| `user_keys` | Encrypted BYOK API keys |
| `user_preferences` | UI settings (layout, hidden_models, beta_features_enabled) |
| `user_memories` | AI memory with pgvector embeddings (1536 dimensions) |
| `projects` | Chat/project organization |
| `chat_attachments` | File upload metadata |
| `feedback` | User feedback |
| `knowledge_profiles` | Knowledge profiles for organizations |
| `knowledge_facts` | Knowledge facts, strategies, examples |
| `knowledge_voice_configs` | Voice/tone configuration |
| `knowledge_documents` | Uploaded knowledge documents |
| `batch_jobs` | Batch prospect research jobs |
| `batch_items` | Individual items within batch jobs |
| `batch_reports` | Generated prospect reports |
| `batch_report_embeddings` | Report vector embeddings for search |
| `rag_documents` | Uploaded RAG documents |
| `rag_document_chunks` | Document chunks with vector embeddings |
| `crm_integrations` | CRM connection config per user |
| `crm_constituents` | Synced CRM constituent data |
| `crm_donations` | Synced CRM donation data |
| `romy_score_cache` | Cached prospect scores |
| `message_notes` | Message annotations |

### Post-Migration Steps

1. **Create Storage Buckets** in Supabase:
   - `chat-attachments` (public)
   - `avatars` (public)

2. **Enable Authentication**:
   - Google OAuth (configure in Supabase Auth > Providers)
   - Anonymous sign-ins (for guest users)

3. **Configure RLS Policies** (included in migration)

---

## Architecture Overview

### Directory Structure

```
/app                    # Next.js 15 app router
  /api                  # Backend API endpoints (41 route directories)
  /components           # App-specific components (chat, history, knowledge, layout, etc.)
/components            # Shared UI components (shadcn/ui, prompt-kit, motion-primitives)
/lib                   # Core business logic (50+ subdirectories)
  /batch-processing    # Bulk prospect research with checkpoints, dead letter, idempotency
  /batch-reports       # Report generation, storage, semantic search
  /chat-store          # Chat state (Context + IndexedDB + Supabase)
  /crm                 # CRM integrations (Bloomerang, Virtuous, Neon CRM, DonorPerfect)
  /discovery           # Prospect discovery/finding
  /gdpr, /consent      # Data deletion, export, consent logging
  /knowledge           # Knowledge profiles, facts, strategies, voice configs
  /memory              # AI memory system (extraction, retrieval, storage, embedding cache)
  /memory-store        # Memory state provider (React Context)
  /models              # AI model definitions (all via OpenRouter)
  /openproviders       # AI provider abstraction layer
  /posthog             # Analytics integration
  /rag                 # RAG document management, chunking, vector search
  /romy-score          # Proprietary prospect scoring with caching
  /subscription        # Autumn billing integration
  /supabase            # Database client configuration
  /tools               # 22 AI tools (research, SEC, FEC, CRM, capacity calculator, etc.)
  /web-crawl           # URL import and web crawling
  /workflows           # Batch research, CRM sync, memory extraction workflows
/supabase/migrations   # SQL migrations (20 migration files)
```

### Hybrid Architecture

Rōmy works with or without Supabase:

- **With Supabase**: Full persistence, auth, file storage
- **Without Supabase**: Local-only using IndexedDB, guest access

All database calls check `isSupabaseEnabled` before executing.

### State Management

Uses **React Context + React Query**:

- `UserPreferencesProvider` - UI settings
- `ModelProvider` - Available models, API key status
- `UserProvider` - User profile with realtime subscriptions
- `ChatsProvider` - Chat list with optimistic updates
- `MessagesProvider` - Messages for current chat
- `MemoryProvider` - User memories

---

## AI Provider Integration

### Default Model

Rōmy uses **Grok 4.1 Fast** via OpenRouter as the default AI model. This provides:
- Fast, intelligent responses
- Native web search capabilities (including X/Twitter)
- Tool invocations for all 22 research tools

A thinking variant (**Grok 4.1 Fast Thinking**) is used for deep research mode.

### BYOK (Bring Your Own Key)

Users can add their own API keys through Settings to access additional models. Keys are encrypted before storage using AES-256-GCM.

```typescript
// How BYOK works
const encryptedKey = encrypt(userApiKey, ENCRYPTION_KEY)
await supabase.from('user_keys').insert({
  user_id: userId,
  provider: 'openrouter',
  encrypted_key: encryptedKey,
  iv: initializationVector
})
```

### Streaming Flow

1. Validate user and check rate limits
2. Log user message to Supabase
3. Retrieve relevant memories (parallel)
4. Call `streamText()` from Vercel AI SDK
5. `onFinish` saves response and extracts memories
6. Return `toDataStreamResponse()` for streaming

---

## AI Memory System

The memory system enables personalized, context-aware conversations.

### Features

- **Automatic Extraction**: AI identifies and saves important facts
- **Explicit Commands**: "Remember that..." triggers manual save
- **Semantic Search**: Vector embeddings for intelligent retrieval
- **Auto-Injection**: Relevant memories injected into system prompt

### Configuration

```typescript
// /lib/memory/config.ts
MAX_MEMORIES_PER_USER = 1000
AUTO_INJECT_MEMORY_COUNT = 5
DEFAULT_SIMILARITY_THRESHOLD = 0.4  // Lowered to retrieve more candidates; scorer handles ranking
EXPLICIT_MEMORY_IMPORTANCE = 0.9
EMBEDDING_MODEL = "qwen/qwen3-embedding-8b"  // MTEB #1, 1536d via Matryoshka
MEMORY_RETRIEVAL_TIMEOUT_MS = 5000  // Safety net on Supabase RPC only
```

### Memory Categories

| Category | Importance | Example |
|----------|------------|---------|
| `user_info` | 0.95 | Name, personal details |
| `preferences` | 0.85 | Likes, communication style |
| `context` | 0.75 | Current projects, goals |
| `relationships` | 0.70 | People, organizations |
| `skills` | 0.65 | Expertise, abilities |
| `facts` | 0.70 | Specific information |

### Memory Flow

```
User sends message
  → Retrieve relevant memories (semantic search, parallel with other setup)
  → Inject top 7 memories into system prompt
  → AI generates response
  → Extract new facts from conversation (background)
  → Upsert to database with embeddings (updates if cosine > 0.9)
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/memories` | GET | List all memories |
| `/api/memories` | POST | Create memory |
| `/api/memories/:id` | GET/PUT/DELETE | Individual memory operations |
| `/api/memories/search` | POST | Semantic search |
| `/api/memories/timeline` | GET | Memory timeline view |
| `/api/memories/profile` | GET/POST/PUT | Memory profile management |

---

## RAG Document Search

RAG (Retrieval-Augmented Generation) allows users to upload documents and search them semantically during conversations.

### Features

- **Document Upload**: PDF, text, CSV, Excel, Word documents
- **Semantic Chunking**: Structure-aware chunking with sentence boundary preservation (384 target tokens)
- **Auto-Injection**: Top 3 relevant chunks (similarity > 0.65) injected into system prompt
- **Tool Access**: AI can explicitly call `rag_search` and `list_documents` tools
- **Vector Search**: Uses same embedding model as memory system (`qwen/qwen3-embedding-8b`, 1536d)

### Key Files

- `/lib/rag/` - Core RAG system (chunker, semantic-chunker, search, embeddings, config)
- `/lib/rag/pdf-processor.ts` - PDF text extraction
- `/lib/rag/office-processor.ts` - Office document processing
- `/app/api/rag/` - REST API endpoints (upload, documents, search, import-url, download)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/rag/upload` | POST | Upload document for RAG |
| `/api/rag/documents` | GET/DELETE/PATCH | Manage RAG documents |
| `/api/rag/search` | POST | Semantic search across documents |
| `/api/rag/import-url` | POST | Import URL content for RAG |
| `/api/rag/download/:id` | GET | Download original document |

---

## Research Tools

Romy integrates 22 AI tools for prospect research. See [DATA_SOURCES.md](./DATA_SOURCES.md) for the full list with competitive comparisons.

### Tool Categories

| Category | Tools | API Keys Required |
|----------|-------|-------------------|
| Web Search | `linkup_prospect_research`, `linkup_ultra_research`, `gemini_grounded_search`, `gemini_ultra_search` | LINKUP_API_KEY, GOOGLE_AI_API_KEY |
| Securities | `sec_edgar_filings`, `sec_insider_search`, `sec_proxy_search` | None (free) |
| Political | `fec_contributions`, `federal_lobbying` | FEC_API_KEY (free) |
| Government | `usaspending_awards`, `state_contracts` | None (free) |
| Nonprofit | `propublica_nonprofit_search`, `propublica_nonprofit_details` | None (free) |
| Healthcare | `npi_registry`, `cms_open_payments` | None (free) |
| Legal | `court_search` | None (free) |
| CRM | `crm_search` | User configures in Settings |
| Analysis | `giving_capacity_calculator` | None |
| Memory/RAG | `search_memory`, `search_prospects`, `rag_search`, `list_documents` | None |

### Tool Activation

Tools are conditionally enabled based on:
- **Search toggle**: Most research tools require user to enable search in the chat UI
- **Authentication**: Memory, RAG, and prospect search require authenticated user
- **CRM connection**: `crm_search` requires user to have connected a CRM
- **Beta features**: Gemini and ultra-research tools require beta features enabled + Scale plan

---

## Web Search (Linkup)

Linkup provides pre-synthesized answers with source citations, preventing AI from getting stuck processing raw results.

### Linkup Search Tool

The primary tool is `linkup_prospect_research` which executes 5 parallel targeted queries covering real estate, business ownership, philanthropy, securities, and biography.

### Configuration

```bash
LINKUP_API_KEY=your_linkup_key  # Get free at https://app.linkup.so
```

Search is enabled when:
- User toggles search button in chat
- `LINKUP_API_KEY` is configured

---

## Subscriptions (Autumn)

Rōmy uses [Autumn](https://useautumn.com) for billing over Stripe.

### Setup

1. Get API key from [Autumn Dashboard](https://app.useautumn.com/sandbox/dev)
2. Add to environment:
   ```bash
   AUTUMN_SECRET_KEY=am_sk_test_your_key_here
   ```
3. Create products in Autumn:
   - `basic` - $29/month, 100 messages
   - `premium` - $89/month, unlimited
   - `pro` - $200/month, unlimited + consultation

### Integration

```typescript
// Check message access
const hasAccess = await checkMessageAccess(userId)

// Track usage
await trackMessageUsage(userId)

// Checkout
import { useCustomer } from "autumn-js/react"
const { checkout, openBillingPortal } = useCustomer()
await checkout({ productId: "premium" })
```

### Subscription Statuses

| Status | Description |
|--------|-------------|
| `active` | Paid and active |
| `trialing` | In trial period |
| `past_due` | Payment failed |
| `expired` | Cancelled/ended |
| `scheduled` | Plan change pending |

### Fallback Behavior

Without Autumn configured:
- Subscription features disabled
- Existing rate limits still apply
- App works normally

---

## Analytics (PostHog)

Privacy-first analytics with automatic pageview tracking.

### Setup

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # optional
```

### Usage

```typescript
// Event functions
import { trackChatCreated, trackMessageSent } from '@/lib/posthog'
trackChatCreated(chatId, model)
trackMessageSent({ chatId, model, hasAttachments: true })

// React hook
import { useAnalytics } from '@/lib/posthog'
const { track, identify, isAvailable } = useAnalytics()

// Feature flags
import { useIsFeatureEnabled } from '@/lib/posthog'
const showNewFeature = useIsFeatureEnabled('new_feature')
```

### Available Events

| Category | Events |
|----------|--------|
| Chat | `chat_created`, `message_sent`, `chat_deleted`, `chat_pinned` |
| Model | `model_selected`, `model_switched` |
| Files | `file_uploaded`, `file_upload_failed` |
| Search | `search_toggled`, `search_used` |
| Auth | `user_signed_in`, `user_signed_out` |
| Subscription | `subscription_started`, `subscription_cancelled` |

---

## API Routes Reference

### Core Chat & Auth

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Stream AI responses via Vercel AI SDK |
| `/api/create-chat` | POST | Create new chat with optimistic updates |
| `/api/create-guest` | POST | Create anonymous user |
| `/api/csrf` | GET | Get CSRF token |
| `/api/health` | GET | Health check endpoint |

### Models & Settings

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/models` | GET/POST | Get available models / Refresh model cache |
| `/api/user-preferences` | GET/PUT | User settings (synced to DB + localStorage) |
| `/api/user-preferences/favorite-models` | GET/POST | Favorite models |
| `/api/user-key-status` | GET | Check which providers have user keys |
| `/api/user-keys` | POST/DELETE | Manage encrypted BYOK keys |
| `/api/user-plan` | GET | Get user subscription plan info |
| `/api/voice-features` | GET | Check voice feature availability (STT) |

### Chat Management

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/toggle-chat-pin` | POST | Pin/unpin chat |
| `/api/update-chat-model` | POST | Change chat's default model |
| `/api/update-chat-instructions` | POST | Update chat-level instructions |
| `/api/chat-config` | GET/PUT | Chat configuration (knowledge profile, system prompt) |
| `/api/chat-knowledge` | GET/POST | Chat-scoped knowledge profiles |
| `/api/chats/:chatId/project` | POST | Assign chat to project |
| `/api/chats/:chatId/publish` | POST | Publish chat |
| `/api/message-notes` | GET/POST/DELETE | Message annotations |
| `/api/share/:chatId` | GET | Share chat publicly |
| `/api/share-email` | POST | Share chat via email |
| `/api/projects` | GET/POST | Project management |
| `/api/projects/:projectId` | GET/PUT/DELETE | Individual project operations |

### Memory & Knowledge

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/memories` | GET/POST | Memory CRUD |
| `/api/memories/:id` | GET/PUT/DELETE | Individual memory operations |
| `/api/memories/search` | POST | Semantic memory search |
| `/api/memories/timeline` | GET | Memory timeline view |
| `/api/memories/profile` | GET/POST/PUT | Memory profile management |
| `/api/knowledge/profile` | GET/POST | Knowledge profile CRUD |
| `/api/knowledge/profile/:id` | GET/PUT/DELETE | Individual knowledge profile |
| `/api/knowledge/facts` | GET/POST/PUT/DELETE | Knowledge facts |
| `/api/knowledge/strategy` | GET/POST/PUT/DELETE | Knowledge strategies |
| `/api/knowledge/examples` | GET/POST/PUT/DELETE | Knowledge examples |
| `/api/knowledge/voice` | GET/POST/PUT/DELETE | Voice/tone configuration |
| `/api/knowledge/documents` | GET/POST | Knowledge documents |
| `/api/knowledge/documents/:id` | GET/PUT/DELETE | Individual knowledge document |
| `/api/knowledge/documents/analyze` | POST | Analyze knowledge document |
| `/api/knowledge/documents/import-url` | POST | Import URL as knowledge document |

### RAG (Document Search)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/rag/upload` | POST | Upload document for RAG |
| `/api/rag/documents` | GET/DELETE/PATCH | Manage RAG documents |
| `/api/rag/search` | POST | Semantic search across documents |
| `/api/rag/import-url` | POST | Import URL content for RAG |
| `/api/rag/download/:id` | GET | Download original document |

### Batch Processing

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/batch-prospects` | POST/GET | Create/list batch research jobs |
| `/api/batch-prospects/limits` | GET | Check batch processing limits |
| `/api/batch-prospects/preflight` | POST | Pre-flight validation for batch job |
| `/api/batch-prospects/enrich` | POST | Enrich batch data |
| `/api/batch-prospects/:jobId` | GET/PATCH/DELETE | Manage individual batch job |
| `/api/batch-prospects/:jobId/process` | POST | Process batch job |
| `/api/batch-prospects/:jobId/process-batch` | POST | Process batch in bulk |
| `/api/batch-prospects/:jobId/export` | GET | Export batch results |
| `/api/batch-prospects/:jobId/enrich-stream` | POST | Stream enrichment results |
| `/api/batch-prospects/:jobId/items/:itemId/retry` | POST | Retry failed batch item |
| `/api/batch-reports` | GET | Batch report management |

### CRM Integrations

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/crm-integrations` | GET/POST | List/connect CRM integrations |
| `/api/crm-integrations/:provider` | GET/DELETE | Get/disconnect specific CRM |
| `/api/crm-integrations/:provider/sync` | GET/POST | Sync CRM data |
| `/api/crm-integrations/:provider/validate` | POST | Validate CRM credentials |

### Other Features

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/subscription/plan` | GET | Subscription plan info |
| `/api/autumn/[...all]` | ALL | Autumn billing proxy |
| `/api/export-pdf` | POST | Export chat as PDF |
| `/api/prospect-pdf` | POST/GET | Generate prospect research PDF |
| `/api/pdf-branding` | GET/PUT | Custom PDF branding |
| `/api/speech-to-text` | POST | Voice input (Groq Whisper) |
| `/api/discovery` | POST/GET | Prospect discovery |
| `/api/notion-integration` | GET/DELETE | Notion integration management |
| `/api/quiz` | GET/POST | Quiz and rewards |
| `/api/consent` | GET/POST | GDPR consent management |
| `/api/user/account` | GET/DELETE | Account management/deletion |
| `/api/user/export` | POST | GDPR data export |
| `/api/truencoa/validate` | POST | Address validation |
| `/api/rate-limits` | GET | Rate limit info |
| `/api/link-preview` | GET | URL link preview |

---

## Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Production build
npm run start            # Production server
npm run lint             # ESLint
npm run type-check       # TypeScript type checking without emit

# Testing
npm run test             # Run vitest tests
npm run test:watch       # Run vitest in watch mode

# Database
npm run migrate          # Run migrations via supabase db push
npm run migrate:manual   # Get manual instructions

# Docker
docker build -t romy .   # Build production image

# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"     # CSRF_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # ENCRYPTION_KEY
```

---

## Common Pitfalls

1. **Always check `isSupabaseEnabled`** before database calls.

2. **Use optimistic updates** for UX, but always revert on error.

3. **File uploads require Supabase** - No local fallback.

4. **CSRF tokens required** for POST/PUT/DELETE - Frontend fetches from `/api/csrf`.

5. **Message parts are complex** - Contains text, tool invocations, reasoning.

6. **Model IDs must match exactly** - Check `model.id` in definitions.

7. **Encryption key must be 32 bytes** - Base64-encoded.

8. **Autumn uses `expired` not `canceled`** for cancelled subscriptions.

---

## Troubleshooting

### Supabase Connection Fails

- Verify URL and keys in `.env.local`
- Check IP allowlist in Supabase dashboard
- Ensure RLS policies exist

### Models Not Responding

- Verify API keys are set
- Check model IDs match exactly
- Review server logs for errors

### Memory Not Working

- Verify `OPENROUTER_API_KEY` is set (for embeddings)
- Check pgvector extension is enabled
- Run `supabase db push` or check `supabase/migrations/` for memory schema

### Subscription Issues

- Verify `AUTUMN_SECRET_KEY` is set
- Check Stripe connection in Autumn dashboard
- Review webhook configuration

### Docker Container Exits

- Check logs: `docker logs <container_id>`
- Verify all required env vars are set
- Ensure ports aren't in use

### Type Errors

```bash
npm run type-check
# Fix errors in app/, lib/, components/
```

---

## License

Apache License 2.0

---

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/ibelick/romy/issues)
- Autumn Docs: [docs.useautumn.com](https://docs.useautumn.com)
- PostHog Docs: [posthog.com/docs](https://posthog.com/docs)
