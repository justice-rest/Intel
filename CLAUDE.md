# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions. Built with Next.js 15, it's an open-source platform supporting OpenAI, Anthropic (Claude), Google (Gemini), Mistral, Perplexity, XAI (Grok), OpenRouter, and local Ollama models. It features BYOK (Bring Your Own Key) support, file uploads, and works with or without Supabase (hybrid local/cloud architecture).

## Common Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Build production bundle
npm run start            # Start production server
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking without emit

# Environment Setup
cp .env.example .env.local    # Copy environment template
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # Generate CSRF_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # Generate ENCRYPTION_KEY

# Docker
docker-compose -f docker-compose.ollama.yml up    # Run with Ollama locally
docker build -t romy .                            # Build production image
```

## Architecture Overview

### Directory Structure
- `/app` - Next.js 15 app router (pages, API routes, auth flows)
- `/app/api` - Backend API endpoints for chat streaming, models, preferences, etc.
- `/lib` - Core business logic (27+ subdirectories)
  - `/chat-store` - Chat and message state management (Context + IndexedDB + Supabase)
  - `/model-store`, `/user-store`, `/user-preference-store` - State providers
  - `/models` - Model definitions per provider (OpenAI, Claude, etc.)
  - `/openproviders` - AI provider abstraction layer
  - `/supabase` - Supabase client configuration
- `/components` - Shared UI components (shadcn/ui + Radix)
- `/utils` - Global utilities

### Hybrid Architecture Pattern
Rōmy works with or without Supabase:
- **With Supabase**: Full persistence, authentication, file storage
- **Without Supabase**: Local-only mode using IndexedDB, guest access only
- All database calls check `isSupabaseEnabled` flag before executing
- Fallback pattern: Try Supabase → fallback to IndexedDB cache

### State Management
Uses **React Context + React Query** (NOT Zustand despite dependency):
- `UserPreferencesProvider` - UI settings (layout, prompt suggestions, hidden models)
- `ModelProvider` - Available models, user key status, favorite models
- `UserProvider` - User profile with realtime subscriptions
- `ChatsProvider` - Chat list with optimistic updates
- `MessagesProvider` - Messages for current chat
- `ChatSessionProvider` - Current chat ID from URL

All providers use:
1. React Context for state
2. React Query (`useQuery`/`useMutation`) for server state caching
3. IndexedDB for client-side persistence
4. Supabase for cloud sync (when enabled)

### AI Model Integration

**Model Configuration**: `/lib/models/index.ts` and `/lib/models/data/*.ts`
- Each model defined with capabilities (vision, tools, audio, reasoning, webSearch)
- Performance ratings (speed, intelligence)
- Pricing (inputCost, outputCost per 1M tokens)
- `apiSdk` function returns `LanguageModelV1` instance

**Provider Abstraction**: `/lib/openproviders/index.ts`
- `openproviders(modelId, apiKey)` routes to appropriate AI SDK provider
- Handles environment keys vs user-provided keys
- Supports 8 providers + Ollama local models

**Streaming Flow**: `/app/api/chat/route.ts`
1. Validate user, chat, model
2. Check rate limits (`checkUsageByModel`)
3. Log user message to Supabase
4. Delete newer messages if editing (via `editCutoffTimestamp`)
5. Call `streamText()` from Vercel AI SDK
6. `onFinish` callback saves assistant response with parts (text, tool invocations, reasoning)
7. Return `toDataStreamResponse()` for streaming

### Database Schema (Supabase)
**Tables**:
- `users` - Profile, message counts, daily limits, premium status, system_prompt
- `chats` - Chat metadata (title, model, created_at, pinned, system_prompt)
- `messages` - Content, role, experimental_attachments (JSONB), parts (JSONB), message_group_id, model
- `user_keys` - Encrypted API keys (BYOK feature)
- `user_preferences` - Layout, prompt_suggestions, show_tool_invocations, hidden_models
- `projects` - Project organization
- `chat_attachments` - File metadata
- `feedback` - User feedback

**Storage Buckets**: `chat-attachments`, `avatars`

See `INSTALL.md` for full SQL schema with RLS policies.

### File Uploads
**File**: `/lib/file-handling.ts`
- Max 10MB per file
- Allowed types: Images (JPEG/PNG/GIF), PDFs, text, JSON, CSV, Excel
- File type validation via `file-type` library (magic bytes check)
- Uploads to Supabase `chat-attachments` bucket
- Stored in `messages.experimental_attachments` as JSONB
- Daily limit: 5 files per authenticated user

### Rate Limiting
**File**: `/lib/usage.ts`, `/lib/config.ts`
- Unauthenticated: 5 messages/day (only `gpt-4.1-nano`)
- Authenticated: 1000 messages/day
- Pro models: 500 calls total per user
- File uploads: 5/day
- Tracking via `users.daily_message_count` with daily reset at UTC midnight

### Security Features
- **CSRF Protection**: Middleware validates tokens on POST/PUT/DELETE (see `/middleware.ts`, `/lib/csrf.ts`)
- **API Key Encryption**: User keys encrypted before storage (see `/lib/encryption.ts`)
- **CSP Headers**: Configured in middleware (stricter in production)
- **Input Sanitization**: `sanitizeUserInput()` before saving
- **Auth Verification**: All protected endpoints check session
- **RLS**: Supabase Row Level Security policies (must be configured)

## Key API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Stream AI responses via Vercel AI SDK |
| `/api/create-chat` | POST | Create new chat with optimistic updates |
| `/api/models` | GET | Get available models with access flags |
| `/api/models` | POST | Refresh model cache |
| `/api/user-preferences` | GET/PUT | User settings (synced to DB + localStorage) |
| `/api/user-preferences/favorite-models` | PUT | Save favorite models |
| `/api/user-key-status` | GET | Check which providers have user keys |
| `/api/user-keys` | POST/DELETE | Manage encrypted BYOK keys |
| `/api/toggle-chat-pin` | POST | Pin/unpin chat |
| `/api/update-chat-model` | POST | Change chat's default model |
| `/api/csrf` | GET | Get CSRF token |
| `/api/create-guest` | POST | Create anonymous user |

## Important Implementation Patterns

### Adding a New AI Provider
1. Create model definitions in `/lib/models/data/[provider].ts`
2. Add provider mapping in `/lib/openproviders/provider-map.ts`
3. Update `openproviders()` function to handle new provider
4. Add API key environment variable and update `getEffectiveApiKey()` in `/lib/user-keys.ts`
5. Update `.env.example` with new key

### Adding a New User Setting
1. Update `user_preferences` table schema in Supabase
2. Add property to `UserPreferences` type in `/lib/user-preference-store/types.ts`
3. Update `UserPreferencesProvider` in `/lib/user-preference-store/provider.tsx`
4. Update `/api/user-preferences` GET/PUT handlers
5. Add UI controls in settings component

### Message Editing Flow
When user edits a message:
1. Frontend sends `editCutoffTimestamp` in `/api/chat` request
2. Backend deletes all messages `WHERE created_at >= editCutoffTimestamp`
3. Logs new user message
4. Streams new assistant response
5. Old conversation branch is permanently deleted

### Optimistic Updates Pattern
Used throughout for better UX:
```typescript
// Example from ChatsProvider
setChats(prev => [...prev, optimisticChat])  // Immediate UI update
try {
  const realChat = await createChatInDb(...)
  setChats(prev => prev.map(c => c.id === tempId ? realChat : c))  // Replace with real data
} catch (error) {
  setChats(prev => prev.filter(c => c.id !== tempId))  // Revert on error
}
```

### IndexedDB Persistence Pattern
All chat state cached locally:
```typescript
// Fetch from Supabase
const chats = await fetchChatsFromSupabase(userId)
// Cache to IndexedDB
await writeToIndexedDB('chats', chats)
// On offline/error, read from cache
const cached = await readFromIndexedDB('chats')
```

### Ollama Integration
**File**: `/lib/models/data/ollama.ts`
- Polls `http://localhost:11434/api/tags` for available models
- Caches for 5 minutes
- Pattern-based detection (llama, qwen, deepseek, etc.)
- Auto-disabled in production (unless `OLLAMA_BASE_URL` set)
- Can be disabled in dev with `DISABLE_OLLAMA=true`

### Multi-Model Conversations
Each message stores its `model` field:
- Users can switch models mid-conversation
- UI shows which model generated each response
- Model stored in `messages.model` column

### PostHog Analytics Integration
**Files**: `/lib/posthog/*`
- Integrated following PostHog's official Next.js 15 app router best practices
- Automatic pageview tracking on route changes
- Privacy-first: `person_profiles: 'identified_only'` - only creates profiles for logged-in users
- Autocapture limited to clicks/submits on buttons/links
- Session recordings disabled by default (enable with `NEXT_PUBLIC_POSTHOG_ENABLE_RECORDINGS=true`)

**Usage**:
```typescript
// Import event tracking functions
import { trackChatCreated, trackMessageSent, trackModelSelected } from '@/lib/posthog'

trackChatCreated(chatId, model)
trackMessageSent({ chatId, model, hasAttachments: true, hasSearch: false })

// Or use the hook in React components
import { useAnalytics } from '@/lib/posthog'
const { track, identify, isAvailable } = useAnalytics()
```

**Key Features**:
- Pre-built tracking functions for all major user actions (chat, model, settings, files, search, auth, subscriptions)
- React hooks for component usage (`useAnalytics`, `useFeatureFlag`, `useIsFeatureEnabled`)
- Feature flags support for A/B testing
- Graceful degradation when PostHog is not configured
- Debug mode automatically enabled in development

**Configuration**: See `/lib/posthog/README.md` for complete documentation

### AI Memory System Integration
**Dual Implementation Strategy** for personalized, context-aware conversations:

**1. Automatic Memory Extraction** (`/lib/memory/extractor.ts`)
- AI analyzes conversations and extracts important facts
- Stores user preferences, personal details, and context
- Two types: explicit ("remember that...") and automatic
- Features:
  - **Pattern detection**: Recognizes memory commands
  - **AI-powered extraction**: Uses GPT-4o-mini to identify facts
  - **Category classification**: Organizes into user_info, preferences, context, etc.
  - **Importance scoring**: Ranks memories by relevance (0-1 scale)

**2. Hybrid Memory Retrieval** (`/lib/memory/retrieval.ts`)
- Auto-injection: Retrieves relevant memories and injects into system prompt
- Tool-based search: AI can explicitly search memories with `search_memory` tool
- Semantic search using vector embeddings (1536 dimensions)
- Features:
  - **Context building**: Analyzes recent conversation for relevant memories
  - **Vector similarity**: Uses pgvector for semantic search
  - **Deduplication**: Prevents storing redundant information
  - **Access tracking**: Monitors which memories are frequently used

**3. Memory Storage** (`/lib/memory/storage.ts`)
- Database table: `user_memories` with pgvector extension
- CRUD operations with RLS policies
- Features:
  - **Vector embeddings**: Uses OpenRouter for embedding generation
  - **Importance decay**: Older, unused memories become less relevant
  - **Pruning**: Auto-removes low-value memories when limit reached
  - **Statistics**: Tracks total memories, avg importance, etc.

**Memory Flow**:
```
User sends message
  → Retrieve relevant memories (semantic search)
  → Inject top 5 memories into system prompt
  → AI generates response with memory context
  → Extract new facts from conversation
  → Save to database with embeddings
  → Track access patterns
```

**Memory Management UI** (`/app/components/memory/`):
- Settings → Memory tab shows all user memories
- Features: search, add, edit, delete memories
- Components: MemoryList, MemoryCard, MemoryForm, MemoryStats
- State: MemoryProvider with React Query caching

**Configuration** (`/lib/memory/config.ts`):
- `MAX_MEMORIES_PER_USER`: 1000 memories per user
- `AUTO_INJECT_MEMORY_COUNT`: 5 memories injected per request
- `DEFAULT_SIMILARITY_THRESHOLD`: 0.5 (0-1 scale)
- `EXPLICIT_MEMORY_IMPORTANCE`: 0.9 for user-requested memories

**Key Files**:
- `/lib/memory/` - Core memory system (extraction, storage, retrieval, scoring)
- `/lib/tools/memory-tool.ts` - AI tool for searching memories
- `/app/api/chat/route.ts` - Integration point (lines 119-151, 229-310)
- `/app/api/memories/` - REST API endpoints for memory CRUD
- `/migrations/006_add_memory_system.sql` - Database schema

### Web Search Integration
**Dual-Mode Search Architecture** with clean separation:

| Mode | When | Search Method | Use Case |
|------|------|---------------|----------|
| Tool-based | `enableSearch=true` | Linkup tool (`searchWeb`) | Prospect research with curated domains |
| Native | `enableSearch=false` | OpenRouter `:online` suffix (Exa) | General web grounding for any query |

**How It Works:**
- When tools are enabled, the model uses `searchWeb` (Linkup) for targeted prospect research
- When tools are disabled, the model uses native Exa via OpenRouter's `:online` suffix for general grounding
- This prevents conflicts between tool-based and native search

**Linkup Search Tool** (`/lib/tools/linkup-search.ts`)
- Uses `linkup-sdk` package with `sourcedAnswer` output mode
- Returns pre-synthesized answers with source citations
- Searches curated domains (SEC, FEC, foundation 990s, property records, etc.)
- 60-second timeout, deep search by default

**Native Exa via OpenRouter** (`/lib/models/data/openrouter.ts`)
- Automatically enabled when `enableSearch=false`
- Uses `:online` suffix on model ID (e.g., `x-ai/grok-4.1-fast:online`)
- Provides broad web grounding for general queries
- No additional API key required (uses OpenRouter's Exa integration)

**Search Flow**:
```
enableSearch=true (Prospect Research):
  → Regular model + Linkup tool
  → AI calls searchWeb for curated domain search
  → Sources displayed in SourcesList

enableSearch=false (General Queries):
  → Model with :online suffix
  → Native Exa provides web grounding
  → No tool calls needed
```

**Person-to-Nonprofit Research Workflow**:
```
1. searchWeb("John Smith foundation board nonprofit")
   → Discovers: "Smith Family Foundation", board at "XYZ Charity"

2. Extract organization names and EINs from results

3. propublica_nonprofit_search(query="XYZ Charity")
   → propublica_nonprofit_details(ein="12-3456789")

4. Return detailed 990 data (revenue, assets, officer compensation)
```

**Key Files**:
- `/lib/tools/linkup-search.ts` - Linkup tool (prospect research)
- `/lib/models/data/openrouter.ts` - Model config with `:online` suffix logic
- `/lib/linkup/config.ts` - Linkup API key and defaults
- `/app/api/chat/route.ts` - Tool integration

### USAspending Awards Tool
**Search federal contracts, grants, and loans by company/organization name** - FREE, no API key required:

| Tool | API | Best For |
|------|-----|----------|
| `usaspending_awards` | USAspending.gov | Federal contracts, grants, loans - which companies/orgs receive government funding |

**USAspending Awards Tool** (`/lib/tools/us-gov-data.ts`)
- Search by COMPANY or ORGANIZATION name (e.g., "Microsoft", "Gates Foundation", "Lockheed Martin")
- Filter by award type: contracts, grants, loans, IDVs, direct payments, or all
- 30-second timeout, graceful error handling
- Returns formatted `rawContent` for AI analysis + `sources` for UI display
- **NOT for individual donor research** - use Yahoo Finance, FEC, SEC Edgar, ProPublica, or Wikidata for individuals

**Usage Examples**:
```typescript
// Search federal awards for a company
usaspending_awards({ query: "Lockheed Martin", awardType: "contracts" })

// Search grants for a foundation
usaspending_awards({ query: "Gates Foundation", awardType: "grants" })

// Search all award types
usaspending_awards({ query: "Microsoft", awardType: "all" })
```

**Configuration** (`/lib/data-gov/config.ts`):
- `US_GOV_API_URLS` - Base URL for USAspending API
- `US_GOV_DEFAULTS` - Default limit (10), timeout (30s)

**Key Files**:
- `/lib/tools/us-gov-data.ts` - Tool implementation
- `/lib/data-gov/config.ts` - Configuration
- `/app/api/chat/route.ts` - Tool registration

### Wikidata Tool
**Biographical research from Wikidata knowledge graph** - FREE, no API key required:

| Tool | Purpose | Best For |
|------|---------|----------|
| `wikidata_search` | Search for people/orgs by name | Finding Wikidata QIDs for entities |
| `wikidata_entity` | Get detailed entity data by QID | Biographical data, education, employers, net worth |

**Wikidata Search Tool** (`/lib/tools/wikidata.ts`)
- Uses MediaWiki `wbsearchentities` API
- Filters by type: "person", "organization", or "any"
- Returns QIDs, labels, descriptions

**Wikidata Entity Tool** (`/lib/tools/wikidata.ts`)
- Uses MediaWiki `wbgetentities` API
- Resolves entity IDs to labels automatically
- Extracts key properties for prospect research:
  - P106: occupation
  - P108: employer
  - P39: position held
  - P69: educated at
  - P2218: net worth
  - P166: awards received
  - P463: member of

**Usage Examples**:
```typescript
// Search for a person
wikidata_search({ query: "Elon Musk", type: "person" })
// Returns: [{ id: "Q317521", label: "Elon Musk", description: "..." }]

// Get full biographical data
wikidata_entity({ entityId: "Q317521" })
// Returns: education, employers, positions, net worth, awards, etc.
```

**Key Files**:
- `/lib/tools/wikidata.ts` - Both search and entity tools
- `/app/api/chat/route.ts` - Tool registration

## Environment Variables

Required for full functionality:
```bash
# Supabase (optional - app works without it)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE=

# Security (required)
CSRF_SECRET=                    # 32-byte hex (use crypto.randomBytes)
ENCRYPTION_KEY=                 # 32-byte base64 (for BYOK)

# AI Model API Key (required)
OPENROUTER_API_KEY=             # Required for Grok 4.1 Fast model

# Linkup Search (optional - prospect research with curated domains)
# Get your free API key at https://app.linkup.so (no credit card required)
LINKUP_API_KEY=                 # Optional - enables Linkup prospect research
# Note: Native Exa web search is included via OpenRouter (no separate key needed)

# USAspending API (no API key required - FREE)
# Federal contracts, grants, loans data - works without a key

# PostHog Analytics (optional - for product analytics)
# Get your API key at https://posthog.com
NEXT_PUBLIC_POSTHOG_KEY=        # Optional - enables analytics tracking
NEXT_PUBLIC_POSTHOG_HOST=       # Optional - defaults to https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_ENABLE_RECORDINGS=false  # Optional - enable session recordings

# Production Configuration (optional)
NEXT_PUBLIC_VERCEL_URL=         # Your production domain

# Development Tools (optional)
ANALYZE=false                   # Set to true to analyze bundle size
```

## Development Tips

### Testing Different Models
Models are defined in `/lib/models/data/[provider].ts` with metadata:
- Check `isPro` flag for rate limit tier
- `capabilities` object determines UI features (vision, tools, etc.)
- `speed` and `intelligence` affect model recommendations

### Debugging State Issues
State flows through multiple layers:
1. Check React Context Provider (e.g., `ChatsProvider`)
2. Check IndexedDB cache (browser DevTools → Application → IndexedDB)
3. Check Supabase tables (if enabled)
4. Check API route logs for errors

### Local Development Without Supabase
Remove Supabase env vars from `.env.local`:
- App falls back to IndexedDB-only mode
- Guest user automatically created
- No auth, file storage, or sync features
- Useful for testing offline functionality

### Working with the AI SDK
Streaming uses Vercel AI SDK (`ai` package):
- `streamText()` for chat responses
- `useChat()` hook in components for streaming state
- `Message` type from `ai` package (not custom type)
- Tool invocations stored in `message.parts` array

### Rate Limit Testing
Adjust limits in `/lib/config.ts`:
```typescript
export const DAILY_MESSAGE_LIMIT = 1000        // Authenticated users
export const GUEST_DAILY_MESSAGE_LIMIT = 5    // Guest users
export const DAILY_FILE_UPLOAD_LIMIT = 5
export const PRO_MODEL_LIMIT = 500            // Lifetime for pro models
```

## Common Pitfalls

1. **Don't use Zustand** - It's a dependency but not actively used. Use React Context.
2. **Always check `isSupabaseEnabled`** before database calls
3. **Use optimistic updates** for better UX, but always revert on error
4. **File uploads require Supabase** - No local-only fallback
5. **CSRF tokens required** for POST/PUT/DELETE - Frontend must fetch from `/api/csrf`
6. **Message parts are complex** - Contains text, tool invocations, reasoning (see `/app/api/chat/db.ts`)
7. **Model IDs must match exactly** - Check `model.id` in model definitions
8. **Encryption key must be 32 bytes** - Base64-encoded for BYOK feature

## Testing & Building

```bash
# Type check before committing
npm run type-check

# Build and test production bundle locally
npm run build
npm start

# Analyze bundle size
npm run build -- --analyze
```

## Additional Resources

- See `INSTALL.md` for complete setup instructions
- See `README.md` for feature overview
- Model definitions: `/lib/models/data/*.ts`
- API route handlers: `/app/api/**/route.ts`
- Type definitions: `/app/types/*` and `/lib/*/types.ts`
