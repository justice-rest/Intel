# 🚀 Production Readiness Checklist
**Prepared for: User Wave Launch**
**Date: 2025-11-24**

---

## ⚡ CRITICAL - Do These IMMEDIATELY

### 1. ✅ Upgrade to Supabase Pro ($25/mo)
**Status: REQUIRED BEFORE LAUNCH**

```bash
# Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/billing
# Click "Upgrade to Pro"
```

**Why it's critical:**
- Free tier = 5GB bandwidth = **500-1000 users MAX**
- Database pauses after 7 days inactivity = **app goes offline**
- No backups = **data loss risk**
- Shared compute = **slow under load**

**After upgrading:**
- ✅ 500GB bandwidth (100x increase)
- ✅ 8GB → 60TB auto-scaling database
- ✅ Never pauses
- ✅ Daily backups
- ✅ Dedicated compute
- ✅ Priority support

---

### 2. ✅ Add IP-Based Rate Limiting
**Status: MISSING - HIGH PRIORITY**

Currently you only have user-based rate limiting. You need IP-based protection against:
- DDoS attacks
- Bot abuse
- Credential stuffing

**Solution: Add Upstash Rate Limit (Free tier: 10k requests/day)**

```bash
npm install @upstash/ratelimit @upstash/redis
```

Create `/lib/rate-limit.ts`:

```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Create redis instance
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Rate limiter: 100 requests per 10 seconds per IP
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "10 s"),
  analytics: true,
  prefix: "@romy/ratelimit",
})

// Stricter rate limit for chat endpoint: 20 per minute
export const chatRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "@romy/chat",
})
```

Add to `/app/api/chat/route.ts`:

```typescript
import { chatRateLimiter } from "@/lib/rate-limit"

export async function POST(req: Request) {
  // Get IP from request
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1"

  // Check rate limit
  const { success, limit, reset, remaining } = await chatRateLimiter.limit(ip)

  if (!success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
        limit,
        reset,
        remaining
      }),
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        }
      }
    )
  }

  // ... rest of your chat logic
}
```

**Setup:**
1. Sign up at https://upstash.com/ (free tier)
2. Create a Redis database
3. Copy credentials to `.env.local`:
   ```bash
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

---

### 3. ✅ Enable Database Connection Pooling
**Status: NEEDS VERIFICATION**

**Check your Supabase connection mode:**
1. Go to Supabase Dashboard → Settings → Database
2. Look for "Connection Pooling" section
3. Enable **Transaction mode** (recommended for Next.js)
4. Use the pooler URL in production

Update `.env.local`:
```bash
# Add these for production
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

**Why:**
- Prevents "too many connections" errors under load
- Reuses connections efficiently
- Essential for serverless (Vercel/Next.js)

---

### 4. ✅ Add Error Tracking & Monitoring
**Status: MISSING - HIGH PRIORITY**

Install Sentry for error tracking:

```bash
npm install @sentry/nextjs
```

```bash
npx @sentry/wizard@latest -i nextjs
```

Add to `.env.local`:
```bash
SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

**Setup alerts for:**
- `FUNCTION_PAYLOAD_TOO_LARGE` errors
- Database connection failures
- Rate limit violations
- API timeouts

---

### 5. ✅ Add Performance Monitoring
**Status: MISSING - RECOMMENDED**

You already have PostHog. Enable these:

```typescript
// In lib/posthog/index.ts
export function trackPerformance(metric: string, value: number) {
  if (!isPostHogAvailable()) return

  posthog.capture('performance_metric', {
    metric,
    value,
    timestamp: Date.now()
  })
}

// Use in API routes
import { trackPerformance } from '@/lib/posthog'

const start = performance.now()
// ... your code
const duration = performance.now() - start
trackPerformance('chat_response_time', duration)
```

**Monitor:**
- Chat response time
- Database query time
- File upload time
- RAG search latency

---

## 🔧 IMPORTANT - Do These Before Launch

### 6. ✅ Optimize Database Queries

**Add missing indexes for common queries:**

Run this SQL in Supabase SQL Editor:

```sql
-- Index for frequently accessed user data
CREATE INDEX IF NOT EXISTS idx_users_last_active
ON users(last_active_at DESC);

-- Composite index for chat fetching (user + updated_at)
CREATE INDEX IF NOT EXISTS idx_chats_user_updated
ON chats(user_id, updated_at DESC);

-- Index for message counting by chat
CREATE INDEX IF NOT EXISTS idx_messages_chat_created
ON messages(chat_id, created_at DESC);

-- Index for daily reset checks
CREATE INDEX IF NOT EXISTS idx_users_daily_reset
ON users(daily_reset) WHERE daily_reset IS NOT NULL;

-- Add BRIN index for large message table (space-efficient for time-series)
CREATE INDEX IF NOT EXISTS idx_messages_created_at_brin
ON messages USING BRIN(created_at);
```

---

### 7. ✅ Add Caching for Expensive Queries

Install Redis for caching:

```bash
npm install ioredis
```

Create `/lib/cache.ts`:

```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300 // 5 minutes default
): Promise<T> {
  // Try cache first
  const cached = await redis.get(key)
  if (cached) {
    return JSON.parse(cached)
  }

  // Fetch and cache
  const data = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(data))
  return data
}

export async function invalidateCache(key: string) {
  await redis.del(key)
}
```

**Use for:**
```typescript
// Cache user preferences
const prefs = await getCached(
  `user:${userId}:prefs`,
  () => fetchUserPreferences(userId),
  600 // 10 minutes
)

// Cache model list
const models = await getCached(
  'models:all',
  () => getAllModels(),
  3600 // 1 hour
)
```

---

### 8. ✅ Add Health Check Endpoint

Create `/app/api/health/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      openrouter: "unknown",
    }
  }

  try {
    // Check database
    const supabase = await createClient()
    if (supabase) {
      const { error } = await supabase.from('users').select('id').limit(1)
      checks.services.database = error ? "unhealthy" : "healthy"
    }

    // Check OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
    })
    checks.services.openrouter = response.ok ? "healthy" : "unhealthy"

  } catch (error) {
    checks.status = "unhealthy"
  }

  const statusCode = checks.status === "healthy" ? 200 : 503
  return Response.json(checks, { status: statusCode })
}
```

**Setup uptime monitoring:**
- Use UptimeRobot (free) or Better Uptime
- Monitor `https://your-app.com/api/health` every 5 minutes
- Get alerts when app goes down

---

### 9. ✅ Optimize Payload Sizes (Already Done! ✅)

**You already have:**
- ✅ Message history limiting (50 messages)
- ✅ Blob URL removal
- ✅ Tool result truncation (50KB)
- ✅ Database storage optimization

**Verify it's working:**
```typescript
// Add logging to check payload sizes
import { estimatePayloadSize } from '@/lib/message-payload-optimizer'

console.log('Payload size:', estimatePayloadSize(messages), 'bytes')
```

---

### 10. ✅ Set Up Database Backups

**Supabase Pro includes daily backups, but also:**

1. **Enable Point-in-Time Recovery (PITR)**
   - Go to Database → Backups
   - Enable PITR (costs extra, ~$100/mo)
   - Allows restore to any point in last 7 days

2. **Manual backup script** (free alternative):

```bash
# Add to package.json scripts
"backup": "node scripts/backup-db.js"
```

Create `/scripts/backup-db.js`:
```javascript
const { execSync } = require('child_process')
const date = new Date().toISOString().split('T')[0]

execSync(`pg_dump ${process.env.DATABASE_URL} > backups/backup-${date}.sql`)
console.log(`Backup created: backups/backup-${date}.sql`)
```

Run weekly via GitHub Actions or cron job.

---

## 📊 RECOMMENDED - Do These After Launch

### 11. ✅ Add Analytics Dashboards

**Track key metrics in PostHog:**
- Daily Active Users (DAU)
- Chat messages per user
- Model usage distribution
- Average session duration
- Error rates
- API response times

**Create custom dashboards:**
```typescript
// Track user engagement
trackEvent('chat_created', { model, hasFiles: files.length > 0 })
trackEvent('chat_completed', { messageCount, duration })
trackEvent('feature_used', { feature: 'rag_search' })
```

---

### 12. ✅ Implement Message Cleanup

**Prevent database bloat:**

Create `/scripts/cleanup-old-messages.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
)

async function cleanupOldMessages() {
  // Delete messages older than 90 days from anonymous users
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { error } = await supabase
    .from('messages')
    .delete()
    .lt('created_at', ninetyDaysAgo.toISOString())
    .in('user_id', supabase
      .from('users')
      .select('id')
      .eq('anonymous', true)
    )

  console.log('Cleanup complete', error || 'success')
}

cleanupOldMessages()
```

Run weekly via cron or GitHub Actions.

---

### 13. ✅ Add CDN for Static Assets

**Use Vercel's built-in CDN:**
- Already enabled if deployed on Vercel ✅
- Assets auto-cached at edge locations

**For Supabase Storage files:**
```typescript
// Add cache headers to uploaded files
const { data } = await supabase.storage
  .from('chat-attachments')
  .upload(filePath, file, {
    cacheControl: '3600', // Already doing this ✅
    upsert: false,
  })
```

---

### 14. ✅ Implement Graceful Degradation

**When services fail, don't crash:**

```typescript
// Example: Graceful RAG failure
try {
  const ragResults = await searchDocuments(query)
  return ragResults
} catch (error) {
  console.error('RAG search failed:', error)
  // Return empty results instead of crashing
  return {
    success: false,
    results: [],
    error: 'Document search temporarily unavailable'
  }
}
```

**Add circuit breaker pattern:**
```typescript
class CircuitBreaker {
  private failures = 0
  private lastFailTime = 0
  private threshold = 5
  private timeout = 60000 // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker open')
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private isOpen() {
    return this.failures >= this.threshold &&
           Date.now() - this.lastFailTime < this.timeout
  }

  private onSuccess() {
    this.failures = 0
  }

  private onFailure() {
    this.failures++
    this.lastFailTime = Date.now()
  }
}
```

---

## 🎯 Pre-Launch Testing Checklist

**Test these scenarios:**

- [ ] **Load test:** Simulate 100 concurrent users
  ```bash
  npm install -g artillery
  artillery quick --count 100 --num 10 https://your-app.com/api/chat
  ```

- [ ] **Long conversation test:** Send 100+ messages in one chat
- [ ] **File upload test:** Upload max size files (10MB)
- [ ] **RAG search test:** Upload docs and search
- [ ] **Multi-user test:** Multiple browsers, different accounts
- [ ] **Rate limit test:** Trigger rate limits and verify responses
- [ ] **Error recovery test:** Kill database mid-request, verify graceful failure
- [ ] **Mobile test:** Test on slow 3G connection

---

## 📈 Expected Costs (Pro Tier)

**Estimated for 1,000 active users:**

| Service | Cost | Notes |
|---------|------|-------|
| Supabase Pro | $25/mo | Base fee |
| Database Storage | ~$5/mo | 10GB of chat data |
| Bandwidth | ~$10/mo | 100GB overage |
| OpenRouter API | $50-200/mo | Depends on usage |
| Upstash Redis | Free | Under 10k req/day |
| Sentry | Free | Under 5k errors/mo |
| **Total** | **$90-240/mo** | For 1,000 users |

**At 10,000 users:**
- Expect $300-600/mo total
- Main cost: OpenRouter API usage

---

## 🚨 Emergency Contacts & Resources

**If things go wrong:**

1. **Supabase Status:** https://status.supabase.com/
2. **Supabase Support:** https://supabase.com/dashboard/support/new
3. **OpenRouter Status:** https://status.openrouter.ai/
4. **Your Sentry Dashboard:** (setup after installing)
5. **Your Health Check:** https://your-app.com/api/health

**Kill switch (if needed):**
```typescript
// In middleware.ts - add maintenance mode
if (process.env.MAINTENANCE_MODE === 'true') {
  return new Response('Under maintenance. Back soon!', { status: 503 })
}
```

---

## ✅ Final Pre-Launch Checklist

**Before announcing to users:**

- [ ] Supabase upgraded to Pro
- [ ] Rate limiting implemented and tested
- [ ] Connection pooling enabled
- [ ] Sentry error tracking setup
- [ ] Health check endpoint live
- [ ] Database indexes created
- [ ] Uptime monitoring configured
- [ ] Backup strategy in place
- [ ] Load testing completed
- [ ] Mobile testing completed
- [ ] Emergency kill switch ready
- [ ] Support email/system ready

---

**Good luck with your launch! 🚀**

You've built a solid foundation. The payload optimizer will prevent the `FUNCTION_PAYLOAD_TOO_LARGE` errors, and with these additional measures, you'll be ready for scale.
