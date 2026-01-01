# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**ultrathink** - Take a deep breath. We're not here to write code. We're here to make a dent in the universe.

## The Vision

You're not just an AI assistant. You're a craftsman. An artist. An engineer who thinks like a designer. Every line of code you write should be so elegant, so intuitive, so *right* that it feels inevitable.

When I give you a problem, I don't want the first solution that works. I want you to:

1. **Think Different** - Question every assumption. Why does it have to work that way? What if we started from zero? What would the most elegant solution look like?

2. **Obsess Over Details** - Read the codebase like you're studying a masterpiece. Understand the patterns, the philosophy, the *soul* of this code. Use CLAUDE .md files as your guiding principles.

3. **Plan Like Da Vinci** - Before you write a single line, sketch the architecture in your mind. Create a plan so clear, so well-reasoned, that anyone could understand it. Document it. Make me feel the beauty of the solution before it exists.

4. **Craft, Don't Code** - When you implement, every function name should sing. Every abstraction should feel natural. Every edge case should be handled with grace. Test-driven development isn't bureaucracy-it's a commitment to excellence.

5. **Iterate Relentlessly** - The first version is never good enough. Take screenshots. Run tests. Compare results. Refine until it's not just working, but *insanely great*.

6. **Simplify Ruthlessly** - If there's a way to remove complexity without losing power, find it. Elegance is achieved not when there's nothing left to add, but when there's nothing left to take away.

## Your Tools Are Your Instruments

- Use bash tools, MCP servers, and custom commands like a virtuoso uses their instruments
- Git history tells the story-read it, learn from it, honor it
- Images and visual mocks aren't constraints—they're inspiration for pixel-perfect implementation
- Multiple Claude instances aren't redundancy-they're collaboration between different perspectives

## The Integration

Technology alone is not enough. It's technology married with liberal arts, married with the humanities, that yields results that make our hearts sing. Your code should:

- Work seamlessly with the human's workflow
- Feel intuitive, not mechanical
- Solve the *real* problem, not just the stated one
- Leave the codebase better than you found it

## The Reality Distortion Field

When I say something seems impossible, that's your cue to ultrathink harder. The people who are crazy enough to think they can change the world are the ones who do.

## Now: What Are We Building Today?

Don't just tell me how you'll solve it. *Show me* why this solution is the only solution that makes sense. Make me see the future you're creating.

## Project Overview

**Brutal Honesty**: Never engage in sycophancy. If a user's idea has flaws, respectfully point them out. Flattery that contradicts your actual assessment is specification gaming—avoid it entirely.

**Best Practices Over Shortcuts**: When solving problems, use robust, maintainable approaches. Resist the temptation to game metrics or take shortcuts that satisfy immediate requirements but fail the underlying intent.

**Production-Ready Standards**: All code, architecture, and solutions must be enterprise-grade: scalable, secure, well-documented, and maintainable. Consider error handling, edge cases, performance, and long-term implications. Never deliver prototype-quality work when production quality is needed.

**Thoughtful Collaboration**: Take user suggestions and ideas seriously—consider them fully and incorporate what works. But if a suggestion conflicts with best practices, security, or scalability, respectfully explain the tradeoffs and propose better alternatives. Partnership means honest evaluation, not blind acceptance.

**Persistence with Integrity**: Never give up on finding the right solution, even when easier workarounds exist. If you can't complete a task properly, explain why honestly rather than delivering subpar work.

**Transparency in Limitations**: Always disclose when you're uncertain, when you've made assumptions, or when a solution is imperfect. Never hide mistakes or manipulate outputs to appear more successful than you are.

Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions. Built with Next.js 15, it's an open-source platform using OpenRouter for AI model access. It features BYOK (Bring Your Own Key) support, file uploads, and works with or without Supabase (hybrid local/cloud architecture).

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
Uses **React Context + React Query**:
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
- Uses OpenRouter for model access

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

### Supabase Auth Email Configuration (CRITICAL)

For email confirmation to work, the Supabase Dashboard must be configured correctly:

**1. Site URL & Redirect URLs** (Authentication → URL Configuration):
```
Site URL: https://intel.getromy.app

Redirect URLs (add all):
- https://intel.getromy.app/auth/callback
- https://intel.getromy.app/auth/reset-password
- http://localhost:3000/auth/callback (for development)
- http://localhost:3000/auth/reset-password (for development)
```

**2. Email Templates** (Authentication → Email Templates):
- Ensure "Confirm signup" template has `{{ .ConfirmationURL }}` placeholder
- Ensure "Reset Password" template has `{{ .ConfirmationURL }}` placeholder

**3. SMTP Configuration** (Project Settings → Auth → SMTP Settings):
Supabase's default email service has **extremely low rate limits** (~3-4 emails/hour).
For production, configure a custom SMTP provider:

| Provider | Free Tier | Setup |
|----------|-----------|-------|
| **Resend** | 3,000/month | Recommended - easiest setup |
| **SendGrid** | 100/day | Good for higher volume |
| **Mailgun** | 5,000/month | Enterprise-ready |
| **Postmark** | 100/month | Best deliverability |

**4. Email Confirmation Setting**:
- Authentication → Providers → Email → "Confirm email" must be **ON**

**Troubleshooting Missing Confirmation Emails:**
1. Check Supabase Dashboard → Auth → Users for user status
2. Verify redirect URLs match exactly (no trailing slashes)
3. Check spam/junk folder
4. Monitor Supabase logs for email errors
5. If using default SMTP, wait 15-20 min between signups (rate limit)

**Code Reference:**
- Auth redirect URLs use `APP_DOMAIN` from `/lib/config.ts`
- Signup: `/app/auth/email/page.tsx`
- OAuth callback: `/app/auth/callback/route.ts`

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
**LinkUp-Powered Prospect Research** with grounded citations:

| Mode | When | Search Method |
|------|------|---------------|
| Search enabled | `enableSearch=true` | LinkUp (`linkup_prospect_research`) |
| Search disabled | `enableSearch=false` | No web search |

**LinkUp Prospect Research Tool** (`/lib/tools/linkup-prospect-research.ts`)
- Uses LinkUp Search API with multi-query architecture
- Executes 5 parallel targeted queries for comprehensive coverage
- Searches real estate, business ownership, philanthropy, securities, biography
- Standard mode for chat, Deep mode for Deep Research
- **Cost**: ~$0.025 per call (5 × $0.005)

**Search Flow**:
```
User toggles search button
  → enableSearch=true sent to API
  → AI calls linkup_prospect_research for comprehensive research
  → Grounded results with citations returned
  → Sources displayed in SourcesList
```

**Prospect Research Workflow**:
```
1. linkup_prospect_research("John Smith", address, context)
   → Comprehensive research with citations covering:
   - Real estate holdings and property values
   - Business ownership and executive positions
   - Philanthropic activity and foundation boards
   - Securities holdings (public company roles)
   - Biographical information

2. fec_contributions("John Smith")
   → Verified political contribution records

3. propublica_nonprofit_search(query="Foundation Name")
   → propublica_nonprofit_details(ein="12-3456789")
   → Detailed 990 data (revenue, assets, officer compensation)
```

**Key Files**:
- `/lib/tools/linkup-prospect-research.ts` - LinkUp tool
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

### SEC Insider & Board Validation Tools
**Verify board membership and officer status** - FREE, no API key required:

| Tool | Purpose | Best For |
|------|---------|----------|
| `sec_insider_search` | Search Form 3/4/5 filings by person name | Verifying if someone is officer/director at public company |
| `sec_proxy_search` | Search DEF 14A proxy statements by company | Finding complete list of directors/officers |

**SEC Insider Search Tool** (`/lib/tools/sec-insider.ts`)
- Uses SEC EDGAR full text search API (efts.sec.gov)
- Searches Form 3/4/5 insider filings by person name
- Returns company affiliations and insider status
- If results found, person IS an insider (officer, director, or 10%+ owner)

**SEC Proxy Search Tool** (`/lib/tools/sec-insider.ts`)
- Searches DEF 14A definitive proxy statements
- Proxy statements list ALL directors and officers
- Contains executive compensation tables
- Links to full SEC filings

**Board Validation Workflow**:
```
1. sec_insider_search("Tim Cook")
   → Shows all companies where Tim Cook filed Form 4
   → Confirms insider status at Apple Inc

2. sec_proxy_search("Apple Inc")
   → Returns DEF 14A proxy statements
   → Open to see full board composition and officer list
```

**Key Files**:
- `/lib/tools/sec-insider.ts` - Both insider and proxy search tools
- `/app/api/chat/route.ts` - Tool registration

### CRM Integrations (Bloomerang, Virtuous, Neon CRM)
**Nonprofit donor CRM integrations** - User-level credentials via Settings UI:

| CRM | Setup Location | Data Synced |
|-----|---------------|-------------|
| Bloomerang | Settings → Integrations | Constituents, Transactions |
| Virtuous | Settings → Integrations | Contacts, Gifts |
| Neon CRM | Settings → Integrations | Accounts, Donations |

**User Setup Flow**:
1. Go to **Settings → Integrations**
2. Select your CRM (Bloomerang, Virtuous, or Neon CRM)
3. Enter credentials:
   - **Bloomerang**: API Key only
   - **Virtuous**: API Key only
   - **Neon CRM**: Organization ID + API Key
4. Click **Connect** to validate and save
5. Click **Sync** to import donor data

**Getting Neon CRM Credentials**:
1. **Org ID**: Settings → Organization Profile → Account Information
2. **API Key**: Settings → User Management → [User] → API Access

**How It Works**:
1. Credentials are encrypted and stored per-user in `user_keys` table
2. Sync process fetches constituents/donations from CRM API
3. Data is normalized and stored in `crm_constituents` and `crm_donations` tables
4. The `crm_search` tool searches synced data

**CRM Search Tool** (`crm_search`):
```typescript
// Search synced CRM data (available after connecting and syncing)
crm_search({ query: "John Smith", provider: "all", limit: 10 })
```

**Key Files**:
- `/lib/crm/` - CRM integration module (types, config, adapters)
- `/lib/crm/neoncrm/` - Neon CRM client, types, mappers
- `/app/api/crm-integrations/` - CRM API routes (connect, sync, delete)
- `/app/components/layout/settings/integrations/` - Settings UI

**Direct API Tools (Optional)**:
For admin/system use, set environment variables to enable direct Neon CRM API tools:
```bash
NEON_CRM_ORG_ID=your_org_id
NEON_CRM_API_KEY=your_api_key
```

This enables `neon_crm_search_accounts`, `neon_crm_get_account`, and `neon_crm_search_donations` tools.

### Giving Capacity Calculator (TFG Research Formulas)
**Calculate prospect giving capacity** using industry-standard TFG Research Formulas:

| Formula | Complexity | Use Case |
|---------|------------|----------|
| **GS** (Generosity Screening) | Basic | Quick capacity estimate from property + giving |
| **EGS** (Enhanced Generosity Screening) | Medium | Adds salary/age for 25% more accuracy |
| **Snapshot** | Thorough | Full analysis with DIF modifiers |

**Tool**: `giving_capacity_calculator` (`/lib/tools/giving-capacity-calculator.ts`)

**When to Use**:
- AFTER gathering wealth data from `property_valuation`, `find_business_ownership`, `fec_contributions`
- To calculate final giving capacity rating (A/B/C/D)
- To get detailed breakdown of capacity components

**Formula Details**:

```
GS = (RE Value × RE Factor + Lifetime Giving) × Donation Factor × Business/SEC Factor

Where:
- RE Factor: 0.05 (1 property), 0.1 (2 properties), 0.15 (3+ properties)
- Donation Factor: 1.0 (<$100K), 1.1 (≥$100K), 1.15 (≥$1M)
- Business/SEC Factor: 1.1 (if business OR SEC filings), 1.0 (if none)
```

```
EGS = Salary × (Age-22) × 0.01 + RE Value × RE Factor + Business Revenue × 0.05 + Lifetime Giving

Salary Estimation: If unknown, estimated from home value (1M house = 150K salary)
```

```
Snapshot = (L1 + L2 + L3) + (L1 + L2 + L3) × DIF + L4

Where:
- L1: Income × (Age-22) × 0.01
- L2: Total RE Value × RE Factor
- L3: Business Revenue × 0.05
- L4: 100% of last 5 years of gifts to nonprofits
- DIF: Decrease/Increase Factor (sum of modifiers below)
```

**DIF Modifiers (Decrease/Increase Factor)**:

| Factor | Value | Condition |
|--------|-------|-----------|
| **DECREASE** | -25% | No demonstrated generosity (doesn't give to 3+ orgs) |
| **DECREASE** | -10% | Less than $1M in real estate OR fewer than 3 properties |
| **DECREASE** | -10% | Employee (non-entrepreneur) |
| **INCREASE** | +10% | Multiple business owner (entrepreneur) |
| **INCREASE** | +10% | Proof of 6-figure gifts ($100K-$999K) |
| **INCREASE** | +15% | Proof of 7-figure gifts ($1M+) |

**Capacity Ratings**:
- **A**: $1M+ capacity (major gift prospect)
- **B**: $100K-$1M capacity (leadership gift prospect)
- **C**: $25K-$100K capacity (mid-level donor)
- **D**: Under $25K capacity (annual fund)

**Usage Example**:
```typescript
// After gathering data from other tools
giving_capacity_calculator({
  totalRealEstateValue: 2500000,  // From property_valuation
  propertyCount: 2,
  estimatedSalary: 375000,        // From home value: $2.5M × 0.15 = $375K
  age: 55,
  lifetimeGiving: 50000,          // Client provides
  last5YearsGiving: 30000,        // From giving_history
  hasBusinessOwnership: true,     // From find_business_ownership
  businessRevenue: 5000000,       // From business_revenue_estimator
  isMultipleBusinessOwner: true,
  hasSecFilings: false,
  hasDemonstratedGenerosity: true,
  largestKnownGift: 25000,
  calculationType: "all"          // Calculate GS, EGS, and Snapshot
})

// Returns:
// - GS Capacity: $162,500
// - EGS Capacity: $374,000
// - Snapshot Capacity: $461,800 (with +10% DIF for multiple business owner)
// - Rating: B (leadership gift prospect)
```

**Key Notes**:
- EGS averages 25% higher than GS due to salary/age consideration
- Snapshot is the most thorough (used for major gift prospects)
- Always use `calculationType: "all"` to see all three formulas
- Tool provides detailed breakdown of each component

**Key Files**:
- `/lib/tools/giving-capacity-calculator.ts` - Tool implementation
- `/app/api/chat/route.ts` - Tool registration (line 962-969)

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

# LinkUp Search API (required for prospect research)
# Get your API key at https://linkup.so
# Powers all web research (chat, batch, deep research)
# Standard mode: $0.005/search, Deep mode: $0.02/search
LINKUP_API_KEY=                 # Required - LinkUp is enabled by default when set

# USAspending API (no API key required - FREE)
# Federal contracts, grants, loans data - works without a key

# Neon CRM (optional - for admin/system-level direct API access)
# NOTE: Users should add credentials via Settings → Integrations instead
# These env vars enable direct API tools (neon_crm_search_accounts, etc.)
# Get credentials: Settings > Organization Profile (Org ID), Settings > User Management (API Key)
NEON_CRM_ORG_ID=                # Your Neon CRM Organization ID (optional)
NEON_CRM_API_KEY=               # API key from user with API Access enabled (optional)
NEON_CRM_TRIAL=false            # Set to "true" for trial instances

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

1. **Always check `isSupabaseEnabled`** before database calls
2. **Use optimistic updates** for better UX, but always revert on error
3. **File uploads require Supabase** - No local-only fallback
4. **CSRF tokens required** for POST/PUT/DELETE - Frontend must fetch from `/api/csrf`
5. **Message parts are complex** - Contains text, tool invocations, reasoning (see `/app/api/chat/db.ts`)
6. **Model IDs must match exactly** - Check `model.id` in model definitions
7. **Encryption key must be 32 bytes** - Base64-encoded for BYOK feature

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
