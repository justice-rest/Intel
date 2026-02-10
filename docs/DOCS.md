# Rōmy Developer Documentation

**Rōmy** helps small nonprofits find new major donors at a fraction of the cost of existing solutions.

Built with Next.js 15, powered by Grok via OpenRouter, with BYOK (Bring Your Own Key) support, file uploads, AI memory, web search, and subscriptions via Autumn.

**Live:** [intel.getromy.app](https://intel.getromy.app)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Architecture Overview](#architecture-overview)
5. [AI Provider Integration](#ai-provider-integration)
6. [AI Memory System](#ai-memory-system)
7. [Web Search (Linkup)](#web-search-linkup)
8. [Subscriptions (Autumn)](#subscriptions-autumn)
9. [Analytics (PostHog)](#analytics-posthog)
10. [API Routes Reference](#api-routes-reference)
11. [Development Commands](#development-commands)
12. [Common Pitfalls](#common-pitfalls)
13. [Troubleshooting](#troubleshooting)

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
OPENROUTER_API_KEY=             # Required - powers Grok model

# ===========================================
# OPTIONAL - Full Features
# ===========================================

# Supabase (for auth, storage, persistence)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE=

# Web Search
LINKUP_API_KEY=                 # For enhanced web search (free at app.linkup.so)

# Subscriptions
AUTUMN_SECRET_KEY=              # For billing (am_sk_test_... or am_sk_live_...)

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=       # Defaults to https://us.i.posthog.com

# Production
NEXT_PUBLIC_VERCEL_URL=
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
| `chats` | Chat metadata (title, model, pinned) |
| `messages` | Content, role, attachments, parts |
| `user_keys` | Encrypted BYOK API keys |
| `user_preferences` | UI settings (layout, hidden_models) |
| `user_memories` | AI memory with vector embeddings |
| `projects` | Chat organization |
| `chat_attachments` | File upload metadata |
| `feedback` | User feedback |

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
  /api                  # Backend API endpoints
  /components           # App-specific components
/components            # Shared UI components (shadcn/ui)
/lib                   # Core business logic
  /chat-store          # Chat state (Context + IndexedDB + Supabase)
  /memory              # AI memory system
  /models              # AI model definitions
  /openproviders       # Provider abstraction
  /posthog             # Analytics
  /subscription        # Autumn billing
  /supabase            # Database client
  /tools               # AI tools (search, memory, RAG)
/supabase/migrations   # SQL migrations (managed by Supabase CLI)
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

Rōmy uses **Grok** via OpenRouter as the default AI model. This provides:
- Fast, intelligent responses
- Web search capabilities
- Tool invocations

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
| `/api/memories/:id` | PUT | Update memory |
| `/api/memories/:id` | DELETE | Delete memory |
| `/api/memories/search` | POST | Semantic search |

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

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Stream AI responses |
| `/api/create-chat` | POST | Create new chat |
| `/api/models` | GET | Get available models |
| `/api/user-preferences` | GET/PUT | User settings |
| `/api/user-preferences/favorite-models` | PUT | Save favorites |
| `/api/user-key-status` | GET | Check BYOK keys |
| `/api/user-keys` | POST/DELETE | Manage API keys |
| `/api/toggle-chat-pin` | POST | Pin/unpin chat |
| `/api/update-chat-model` | POST | Change chat model |
| `/api/csrf` | GET | Get CSRF token |
| `/api/create-guest` | POST | Create anonymous user |
| `/api/memories` | GET/POST | Memory CRUD |
| `/api/memories/:id` | PUT/DELETE | Memory operations |
| `/api/autumn/[...all]` | ALL | Autumn billing proxy |

---

## Development Commands

```bash
# Development
npm run dev              # Start with Turbopack
npm run build            # Production build
npm run start            # Production server
npm run lint             # ESLint
npm run type-check       # TypeScript check

# Database
npm run migrate          # Run migrations
npm run migrate:manual   # Get manual instructions

# Docker
docker build -t romy .                            # Build image

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
