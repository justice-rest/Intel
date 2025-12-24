import { Autumn } from "autumn-js"

/**
 * Autumn Client Utility
 *
 * Provides a server-side Autumn client for:
 * - Checking feature access
 * - Tracking usage
 * - Managing subscriptions
 *
 * This is used in API routes to enforce subscription limits.
 *
 * OPTIMIZED: Added caching and timeouts to reduce latency
 */

// ============================================================================
// CACHING LAYER - Reduces API calls dramatically
// ============================================================================

interface CachedAccess {
  allowed: boolean
  balance?: number
  limit?: number
  timestamp: number
}

interface CachedCustomer {
  data: any
  timestamp: number
}

// Cache access checks for 30 seconds (most users send multiple messages)
const accessCache = new Map<string, CachedAccess>()
const ACCESS_CACHE_TTL = 30 * 1000 // 30 seconds

// Cache customer data for 5 minutes (subscription status rarely changes)
const customerCache = new Map<string, CachedCustomer>()
const CUSTOMER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Timeout for Autumn API calls (prevents blocking)
const AUTUMN_API_TIMEOUT = 150 // 150ms max

/**
 * Promise.race with timeout - returns fallback if API is slow
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const timeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), timeoutMs)
  )
  return Promise.race([promise, timeout])
}

/**
 * Circuit Breaker for Autumn API
 * Tracks failures and switches to degraded mode after threshold
 */
class AutumnCircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private readonly FAILURE_THRESHOLD = 5 // Number of consecutive failures before circuit opens
  private readonly RESET_TIMEOUT = 60000 // 1 minute - time to reset failure count
  private readonly DEGRADED_LIMIT = 10 // Limit in degraded mode (10 messages)

  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
  }

  recordSuccess() {
    this.failureCount = 0
  }

  isCircuitOpen(): boolean {
    // Reset if enough time has passed
    if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
      this.failureCount = 0
      return false
    }
    return this.failureCount >= this.FAILURE_THRESHOLD
  }

  getDegradedLimit(): number {
    return this.DEGRADED_LIMIT
  }
}

const circuitBreaker = new AutumnCircuitBreaker()

/**
 * Normalize plan ID by extracting the core plan name
 * Handles various product ID formats from Autumn:
 *
 * Examples:
 * - "growth-yearly" → "growth"
 * - "pro-annual" → "pro"
 * - "scale" → "scale"
 * - "scale_yearly" → "scale" (underscore variant)
 * - "romy-scale-monthly" → "scale" (with prefix)
 * - "prod_pro_annual" → "pro" (multiple separators)
 */
export function normalizePlanId(productId?: string): string | null {
  if (!productId) return null

  const lowerProductId = productId.toLowerCase()

  // Known plan names to look for (in order of specificity)
  const knownPlans = ["scale", "pro", "growth"]

  // First, try to find a known plan name in the product ID
  for (const plan of knownPlans) {
    // Check if the product ID contains the plan name as a whole word
    // Match: "scale", "scale-yearly", "romy-scale", "prod_scale_annual"
    // Don't match: "escalate", "oproduction"
    const regex = new RegExp(`(^|[-_])${plan}([-_]|$)`, "i")
    if (regex.test(lowerProductId) || lowerProductId === plan) {
      return plan
    }
  }

  // Fallback: Remove common billing cycle suffixes (both hyphen and underscore variants)
  return lowerProductId
    .replace(/[-_](yearly|annual|monthly|year|month)$/i, "")
    .replace(/^(prod|test|live)[-_]/i, "") // Remove environment prefixes
}

/**
 * Check if Autumn is enabled
 */
export function isAutumnEnabled(): boolean {
  return !!process.env.AUTUMN_SECRET_KEY
}

/**
 * Get the Autumn client instance
 */
export function getAutumnClient(): Autumn | null {
  if (!isAutumnEnabled()) {
    return null
  }

  return new Autumn({
    secretKey: process.env.AUTUMN_SECRET_KEY!,
  })
}

/**
 * Check if a user has access to send messages
 * Returns the allowed status and current balance
 *
 * OPTIMIZED:
 * - Caches access checks for 30 seconds (most users send multiple messages quickly)
 * - Uses timeout to prevent blocking if Autumn API is slow
 * - Implements circuit breaker pattern for resilience
 */
export async function checkMessageAccess(
  userId: string,
  dailyMessageCount?: number // Optional Supabase message count for degraded mode
): Promise<{ allowed: boolean; balance?: number; limit?: number }> {
  const autumn = getAutumnClient()

  if (!autumn) {
    // If Autumn is not enabled, allow access (fallback to existing rate limits)
    return { allowed: true }
  }

  // OPTIMIZATION: Check cache first (30 second TTL)
  const cached = accessCache.get(userId)
  if (cached && Date.now() - cached.timestamp < ACCESS_CACHE_TTL) {
    return {
      allowed: cached.allowed,
      balance: cached.balance,
      limit: cached.limit,
    }
  }

  // Check circuit breaker state
  if (circuitBreaker.isCircuitOpen()) {
    console.warn("[Autumn Circuit Breaker] Circuit OPEN - using degraded mode", {
      userId,
      degradedLimit: circuitBreaker.getDegradedLimit(),
    })

    // Degraded mode: allow limited access based on daily message count
    const currentCount = dailyMessageCount ?? 0
    const degradedLimit = circuitBreaker.getDegradedLimit()

    return {
      allowed: currentCount < degradedLimit,
      balance: currentCount,
      limit: degradedLimit,
    }
  }

  // OPTIMIZATION: Wrap in timeout - if Autumn is slow, allow access
  const fallbackResult = { allowed: true }

  try {
    const result = await withTimeout(
      (async () => {
        // First check if customer has any past_due subscriptions
        const customerData = await getCustomerData(userId)
        const hasPastDueSubscription = customerData?.products?.some(
          (product: { status: string }) => product.status === "past_due"
        )

        // Block access if payment is past due
        if (hasPastDueSubscription) {
          console.log("[Autumn] Blocking access due to past_due payment", { userId })
          circuitBreaker.recordSuccess()
          return { allowed: false, balance: 0, limit: 0 }
        }

        const { data, error } = await autumn.check({
          customer_id: userId,
          feature_id: "messages",
        })

        if (error) {
          console.error("[Autumn] Check error:", error)
          circuitBreaker.recordFailure()
          return fallbackResult
        }

        // Success - reset circuit breaker
        circuitBreaker.recordSuccess()

        const accessResult = {
          allowed: data.allowed,
          balance: data.balance ?? undefined,
          limit: undefined,
        }

        // Cache the result
        accessCache.set(userId, { ...accessResult, timestamp: Date.now() })

        return accessResult
      })(),
      AUTUMN_API_TIMEOUT,
      fallbackResult
    )

    return result
  } catch (error) {
    console.error("[Autumn] Exception checking message access:", error)
    circuitBreaker.recordFailure()

    // If circuit opened, use degraded mode
    if (circuitBreaker.isCircuitOpen()) {
      const currentCount = dailyMessageCount ?? 0
      const degradedLimit = circuitBreaker.getDegradedLimit()
      return {
        allowed: currentCount < degradedLimit,
        balance: currentCount,
        limit: degradedLimit,
      }
    }

    // Still within failure threshold, fail open but record failure
    return { allowed: true }
  }
}

/**
 * Track a message usage event
 *
 * IMPORTANT: This tracks usage for ALL authenticated users, including unlimited plans.
 * This ensures accurate balance when users downgrade from unlimited (Max/Ultra) to
 * limited (Pro) plans mid-billing period, preventing sudden lockout.
 */
export async function trackMessageUsage(userId: string): Promise<void> {
  const autumn = getAutumnClient()

  if (!autumn) {
    return
  }

  try {
    await autumn.track({
      customer_id: userId,
      feature_id: "messages",
      value: 1,
    })
  } catch (error) {
    console.error("Error tracking message usage:", error)
    // Don't throw - we don't want to block the user if tracking fails
  }
}

/**
 * Track batch processing credit usage
 * Deducts 1 credit per row/prospect processed
 *
 * @param userId - The user's ID
 * @param rowCount - Number of rows/prospects being processed
 */
export async function trackBatchUsage(userId: string, rowCount: number): Promise<void> {
  const autumn = getAutumnClient()

  if (!autumn) {
    return
  }

  try {
    await autumn.track({
      customer_id: userId,
      feature_id: "messages", // Using messages feature - 1 credit per row
      value: rowCount,
    })
    console.log(`[Autumn] Tracked ${rowCount} batch credits for user ${userId}`)
  } catch (error) {
    console.error("Error tracking batch usage:", error)
    // Don't throw - we don't want to block the user if tracking fails
  }
}

/**
 * Check if a plan has unlimited messages
 * Pro and Scale plans have unlimited messages
 */
export function isUnlimitedPlan(planId: string | null): boolean {
  if (!planId) return false
  const normalized = normalizePlanId(planId)
  return normalized === "pro" || normalized === "scale"
}

/**
 * Check if user has enough credits for batch processing
 *
 * @param userId - The user's ID
 * @param requiredCredits - Number of credits required
 * @returns Object with allowed status and current balance
 */
export async function checkBatchCredits(
  userId: string,
  requiredCredits: number
): Promise<{ allowed: boolean; balance?: number; shortfall?: number }> {
  const autumn = getAutumnClient()

  if (!autumn) {
    // If Autumn is not enabled, allow access (fallback to existing rate limits)
    return { allowed: true }
  }

  try {
    // First check if user is on an unlimited plan (Pro or Scale)
    // Use longer timeout (2s) since batch processing isn't latency-critical
    const customerData = await getCustomerData(userId, 2000)

    console.log(`[Autumn] checkBatchCredits for user ${userId}:`, JSON.stringify(customerData?.products?.map((p: { id: string; status: string }) => ({ id: p.id, status: p.status })) || []))

    if (customerData?.products && customerData.products.length > 0) {
      // Find active or trialing product
      const activeProduct = customerData.products.find(
        (p: { status: string }) => p.status === "active" || p.status === "trialing"
      )

      if (activeProduct) {
        const normalizedPlan = normalizePlanId(activeProduct.id)
        console.log(`[Autumn] Active product: ${activeProduct.id} -> normalized: ${normalizedPlan}, isUnlimited: ${isUnlimitedPlan(activeProduct.id)}`)

        if (isUnlimitedPlan(activeProduct.id)) {
          console.log(`[Autumn] User ${userId} is on unlimited plan (${activeProduct.id}), allowing batch access`)
          return { allowed: true, balance: undefined }
        }
      } else {
        console.warn(`[Autumn] No active/trialing product found for user ${userId}`)
      }
    } else {
      console.warn(`[Autumn] No products found for user ${userId}`)
    }

    // For limited plans (Growth), check the balance
    const { data, error } = await autumn.check({
      customer_id: userId,
      feature_id: "messages",
    })

    if (error) {
      console.error("[Autumn] Check error:", error)
      return { allowed: true } // Fail open
    }

    const currentBalance = data.balance ?? 0

    if (currentBalance < requiredCredits) {
      return {
        allowed: false,
        balance: currentBalance,
        shortfall: requiredCredits - currentBalance,
      }
    }

    return {
      allowed: true,
      balance: currentBalance,
    }
  } catch (error) {
    console.error("[Autumn] Exception checking batch credits:", error)
    return { allowed: true } // Fail open
  }
}

/**
 * Deep Research Credit Check Result
 */
export interface DeepResearchCreditCheck {
  allowed: boolean
  needsDeduction: boolean // true if Growth plan and has credits
  error?: string
}

/**
 * Pre-check deep research credits (NO DEDUCTION - safe for parallel execution)
 * Use this in Promise.all, then call deductDeepResearchCredits after all checks pass
 *
 * @param userId - The user's ID
 * @returns Check result with needsDeduction flag
 */
export async function preCheckDeepResearchCredits(
  userId: string
): Promise<DeepResearchCreditCheck> {
  const autumn = getAutumnClient()
  if (!autumn) {
    return { allowed: true, needsDeduction: false }
  }

  try {
    // Get customer data to check plan (cached - usually instant)
    const customerData = await getCustomerData(userId, 2000)
    const activeProduct = customerData?.products?.find(
      (p: { status: string }) => p.status === "active" || p.status === "trialing"
    )
    const planId = normalizePlanId(activeProduct?.id)

    // Pro/Scale have unlimited or pay normal rate - no deduction needed
    if (planId === "pro" || planId === "scale") {
      return { allowed: true, needsDeduction: false }
    }

    // Growth plan (or no plan): Check if user has 2 credits available
    const { data, error } = await autumn.check({
      customer_id: userId,
      feature_id: "messages",
    })

    if (error) {
      console.error("[Autumn] Deep research pre-check error:", error)
      return { allowed: true, needsDeduction: false } // Fail open
    }

    const balance = data.balance ?? 0
    if (balance < 2) {
      return {
        allowed: false,
        needsDeduction: false,
        error: `Deep Research requires 2 credits. You have ${balance} credit${balance === 1 ? "" : "s"}. Please upgrade your plan or use standard Research mode.`,
      }
    }

    // Has credits - needs deduction after all checks pass
    return { allowed: true, needsDeduction: true }
  } catch (error) {
    console.error("[Autumn] Deep research pre-check failed:", error)
    return { allowed: true, needsDeduction: false } // Fail open
  }
}

/**
 * Deduct deep research credits (2 credits for Growth plan)
 * Call this AFTER preCheckDeepResearchCredits and AFTER all other validations pass
 *
 * @param userId - The user's ID
 */
export async function deductDeepResearchCredits(userId: string): Promise<void> {
  const autumn = getAutumnClient()
  if (!autumn) return

  try {
    await autumn.track({
      customer_id: userId,
      feature_id: "messages",
      value: 2,
    })
    console.log(`[Autumn] Deducted 2 credits for deep research (Growth plan): ${userId}`)

    // Invalidate cache so balance is accurate
    accessCache.delete(userId)
  } catch (error) {
    console.error("[Autumn] Deep research deduction failed:", error)
    // Don't throw - already committed to the request
  }
}

/**
 * Check and track deep research usage for Growth plan users (LEGACY - combined check+track)
 * @deprecated Use preCheckDeepResearchCredits + deductDeepResearchCredits for parallel execution
 */
export async function checkAndTrackDeepResearchCredits(
  userId: string
): Promise<{ allowed: boolean; error?: string }> {
  const check = await preCheckDeepResearchCredits(userId)
  if (!check.allowed) {
    return { allowed: false, error: check.error }
  }
  if (check.needsDeduction) {
    await deductDeepResearchCredits(userId)
  }
  return { allowed: true }
}

/**
 * Get customer subscription data
 * OPTIMIZED: Cached for 5 minutes to reduce API calls
 *
 * IMPORTANT: When the API times out, this function now returns stale cached data
 * as a fallback rather than returning null. This prevents plan check failures
 * for users with valid subscriptions when the Autumn API is slow.
 *
 * @param userId - The user's ID
 * @param timeoutMs - Optional custom timeout in ms (default: 150ms for chat, use higher for non-latency-critical endpoints)
 */
export async function getCustomerData(userId: string, timeoutMs?: number) {
  const autumn = getAutumnClient()

  if (!autumn) {
    return null
  }

  // OPTIMIZATION: Check cache first (5 minute TTL)
  const cached = customerCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CUSTOMER_CACHE_TTL) {
    return cached.data
  }

  // Use custom timeout if provided, otherwise use default (150ms for chat latency)
  const effectiveTimeout = timeoutMs ?? AUTUMN_API_TIMEOUT

  try {
    // OPTIMIZATION: Use timeout to prevent blocking
    // Use a sentinel value to detect timeout vs actual null response
    const TIMEOUT_SENTINEL = { __timeout: true } as const
    const result = await withTimeout(
      autumn.customers.get(userId),
      effectiveTimeout,
      { data: TIMEOUT_SENTINEL, error: undefined } as any
    )

    // Check if we hit a timeout
    if (result.data && typeof result.data === 'object' && '__timeout' in result.data) {
      console.warn("[Autumn] Customer data fetch timed out for user:", userId)
      // Return stale cached data as fallback (even if expired) rather than null
      // This prevents plan check failures for valid subscribers when API is slow
      if (cached) {
        console.log("[Autumn] Using stale cached data as fallback")
        return cached.data
      }
      // No cached data available, return null
      console.warn("[Autumn] No cached data available, returning null")
      return null
    }

    if (result.error) {
      console.error("Error fetching customer data:", result.error)
      // Return stale cached data as fallback
      if (cached) {
        console.log("[Autumn] Using stale cached data due to API error")
        return cached.data
      }
      return null
    }

    // Cache the result
    if (result.data) {
      customerCache.set(userId, { data: result.data, timestamp: Date.now() })
    }

    return result.data
  } catch (error) {
    console.error("Error fetching customer data:", error)
    // Return stale cached data as fallback
    if (cached) {
      console.log("[Autumn] Using stale cached data due to exception")
      return cached.data
    }
    return null
  }
}
