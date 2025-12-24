import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
  SupabaseClientType,
} from "@/app/types/api.types"
import {
  ProLimitReachedError,
  SubscriptionRequiredError,
  UsageLimitError,
} from "@/lib/api"
import {
  FREE_MODELS_IDS,
  NON_AUTH_ALLOWED_MODELS,
  AUTH_DAILY_MESSAGE_LIMIT,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
} from "@/lib/config"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { sanitizeUserInput } from "@/lib/sanitize"
import { validateUserIdentity } from "@/lib/server/api"
import {
  checkMessageAccess,
  getCustomerData,
  normalizePlanId,
  trackMessageUsage,
} from "@/lib/subscription/autumn-client"
import { checkUsageByModel, incrementUsage } from "@/lib/usage"
import {
  getEffectiveApiKey,
  type ProviderWithoutOllama,
} from "@/lib/user-keys"

/**
 * Check and use bonus credits for Growth plan users
 * Returns: { hasBonus: boolean, usedBonus: boolean }
 *
 * Bonus credits:
 * - Only available for Growth plan users
 * - Roll over month to month (capped at 100 max)
 * - Used when subscription credits are exhausted
 */
async function checkAndUseBonusCredits(
  supabase: SupabaseClientType,
  userId: string,
  planType: string | null
): Promise<{ hasBonus: boolean; usedBonus: boolean }> {
  // Only Growth plan users can use bonus credits
  if (planType !== "growth") {
    return { hasBonus: false, usedBonus: false }
  }

  // Get user's bonus balance
  const { data: userData } = await supabase
    .from("users")
    .select("bonus_messages")
    .eq("id", userId)
    .single()

  const currentBonus = (userData as any)?.bonus_messages || 0

  // Check if user has bonus credits to use
  if (currentBonus <= 0) {
    return { hasBonus: false, usedBonus: false }
  }

  // Deduct 1 bonus credit
  await supabase
    .from("users")
    .update({ bonus_messages: currentBonus - 1 } as any)
    .eq("id", userId)

  console.log(`[Bonus Credits] Used 1 bonus credit for user ${userId}. Remaining: ${currentBonus - 1}`)

  return { hasBonus: true, usedBonus: true }
}

const isFreeModel = (modelId: string) => FREE_MODELS_IDS.includes(modelId)
const isProModel = (modelId: string) => !isFreeModel(modelId)

/**
 * OPTIMIZED: Single-pass validation that fetches user data once
 * Reduces 4-5 sequential DB queries to 1 query
 */
export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
}: ChatApiParams): Promise<SupabaseClientType | null> {
  const supabase = await validateUserIdentity(userId, isAuthenticated)
  if (!supabase) return null

  // Check if user is authenticated
  if (!isAuthenticated) {
    // For unauthenticated users, only allow specific models
    if (!NON_AUTH_ALLOWED_MODELS.includes(model)) {
      throw new Error(
        "This model requires authentication. Please sign in to access more models."
      )
    }
  }

  // OPTIMIZATION: Fetch all user data in ONE query instead of 4 separate queries
  const { data: userData, error: userDataError } = await supabase
    .from("users")
    .select(
      "message_count, daily_message_count, daily_reset, anonymous, premium, daily_pro_message_count, daily_pro_reset"
    )
    .eq("id", userId)
    .maybeSingle()

  if (userDataError) {
    throw new Error("Error fetching user data: " + userDataError.message)
  }
  if (!userData) {
    throw new Error("User record not found for id: " + userId)
  }

  // Handle daily reset if needed (combined for both regular and pro)
  const now = new Date()
  let dailyCount = userData.daily_message_count || 0
  let dailyProCount = userData.daily_pro_message_count || 0
  const lastReset = userData.daily_reset ? new Date(userData.daily_reset) : null
  const lastProReset = userData.daily_pro_reset ? new Date(userData.daily_pro_reset) : null

  const isNewDay = (resetDate: Date | null) =>
    !resetDate ||
    now.getUTCFullYear() !== resetDate.getUTCFullYear() ||
    now.getUTCMonth() !== resetDate.getUTCMonth() ||
    now.getUTCDate() !== resetDate.getUTCDate()

  const needsDailyReset = isNewDay(lastReset)
  const needsProReset = isNewDay(lastProReset)

  if (needsDailyReset || needsProReset) {
    const updates: Record<string, any> = {}
    if (needsDailyReset) {
      dailyCount = 0
      updates.daily_message_count = 0
      updates.daily_reset = now.toISOString()
    }
    if (needsProReset) {
      dailyProCount = 0
      updates.daily_pro_message_count = 0
      updates.daily_pro_reset = now.toISOString()
    }

    const { error: resetError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)

    if (resetError) {
      throw new Error("Failed to reset daily count: " + resetError.message)
    }
  }

  // Check usage limits based on model type
  if (isProModel(model)) {
    if (!isAuthenticated) {
      throw new UsageLimitError("You must log in to use this model.")
    }
    if (dailyProCount >= DAILY_LIMIT_PRO_MODELS) {
      throw new UsageLimitError("Daily Pro model limit reached.")
    }
  } else {
    // Free model check
    const isAnonymous = userData.anonymous
    const dailyLimit = isAnonymous ? NON_AUTH_DAILY_MESSAGE_LIMIT : AUTH_DAILY_MESSAGE_LIMIT
    if (dailyCount >= dailyLimit) {
      throw new UsageLimitError("Daily message limit reached.")
    }
  }

  // For authenticated users, check API key requirements and Autumn subscription
  if (isAuthenticated) {
    // Check API key requirements
    const provider = getProviderForModel(model)
    const effectiveApiKey = await getEffectiveApiKey(
      userId,
      provider as ProviderWithoutOllama
    )

    // If no API key and model is not in free list, deny access
    if (!effectiveApiKey && !FREE_MODELS_IDS.includes(model)) {
      throw new Error(
        `This model requires an API key for ${provider}. Please add your API key in settings or use a free model.`
      )
    }

    // Check message access through Autumn (with circuit breaker support)
    const autumnCheck = await checkMessageAccess(userId, dailyCount)

    // If not allowed, determine the specific reason
    if (!autumnCheck.allowed) {
      // Get customer data to determine plan type
      const customerData = await getCustomerData(userId)

      // Debug logging for subscription issues
      console.log("[Subscription Check] User blocked:", {
        userId,
        autumnAllowed: autumnCheck.allowed,
        autumnBalance: autumnCheck.balance,
        hasCustomerData: !!customerData,
        productsCount: customerData?.products?.length || 0,
        products: customerData?.products?.map((p: { id: string; status: string }) => ({
          id: p.id,
          status: p.status,
        })),
      })

      // Check if payment is past due
      const hasPastDueSubscription = customerData?.products?.some(
        (product: { status: string }) => product.status === "past_due"
      )

      if (hasPastDueSubscription) {
        console.log(
          "[Subscription Check] Payment past due - blocking access"
        )
        throw new SubscriptionRequiredError(
          "Your payment is past due. Please update your payment method to continue using Rōmy."
        )
      }

      // Check if user has any active subscription (including trials)
      const hasActiveSubscription = customerData?.products?.some(
        (product: { status: string }) =>
          product.status === "active" || product.status === "trialing"
      )

      // If no active subscription at all, show upgrade modal
      if (!hasActiveSubscription) {
        console.log(
          "[Subscription Check] No active subscription found - showing upgrade modal"
        )
        throw new SubscriptionRequiredError(
          "You need an active subscription to use Rōmy. Please subscribe to continue."
        )
      }

      // If they have a subscription but reached limit, check which tier
      const currentProductId = customerData?.products?.[0]?.id
      const planType = normalizePlanId(currentProductId)
      const isProTier = planType === "pro"

      console.log("[Subscription Check] Limit reached:", {
        planType,
        isProTier,
        productId: currentProductId,
      })

      // For Growth plan users, check if they have bonus credits to use
      if (planType === "growth") {
        const bonusResult = await checkAndUseBonusCredits(supabase, userId, planType)
        if (bonusResult.usedBonus) {
          console.log("[Subscription Check] Using bonus credit instead of blocking")
          // Allow the request - bonus credit was used
          return supabase
        }
        // No bonus credits available - show limit error
        throw new Error(
          `You've reached your message limit${autumnCheck.limit ? ` of ${autumnCheck.limit} messages` : ""}. Answer daily quiz questions to earn bonus messages, or upgrade your subscription.`
        )
      }

      if (isProTier) {
        throw new ProLimitReachedError(
          "You've reached your monthly message limit. Wait until next month or upgrade to continue."
        )
      } else {
        // For other plans that somehow hit a limit
        throw new Error(
          `You've reached your message limit${autumnCheck.limit ? ` of ${autumnCheck.limit} messages` : ""}. Please upgrade your subscription to continue.`
        )
      }
    }
  }

  return supabase
}

/**
 * OPTIMIZED: Atomic increment using PostgreSQL increment syntax
 * No need to fetch-then-update, just increment directly
 */
export async function incrementMessageCount({
  supabase,
  userId,
  isAuthenticated,
  model,
  skipAutumnTracking = false,
}: {
  supabase: SupabaseClientType
  userId: string
  isAuthenticated: boolean
  model: string
  skipAutumnTracking?: boolean
}): Promise<void> {
  if (!supabase) return

  try {
    // Atomic increment - no fetch required
    const isProModelCheck = isProModel(model)

    // Build update object for atomic increment
    // This uses PostgreSQL's increment syntax to avoid race conditions
    // @ts-ignore - RPC function may not be in types yet
    const { error } = await supabase.rpc('increment_message_count', {
      p_user_id: userId,
      p_is_pro: isProModelCheck
    })

    // Fallback to manual increment if RPC doesn't exist
    if (error && error.code === '42883') { // Function does not exist
      console.warn('Atomic increment function not found, using fallback')

      // Fetch current counts
      const { data, error: fetchError } = await supabase
        .from("users")
        .select("message_count, daily_message_count, daily_pro_message_count")
        .eq("id", userId)
        .maybeSingle()

      if (fetchError) {
        throw new Error("Failed to fetch user counts: " + fetchError.message)
      }

      if (!data) {
        throw new Error("User not found for increment: " + userId)
      }

      const messageCount = (data.message_count || 0) + 1
      const dailyCount = (data.daily_message_count || 0) + 1
      const dailyProCount = (data.daily_pro_message_count || 0) + 1

      const updates: Record<string, any> = {
        message_count: messageCount,
        daily_message_count: dailyCount,
        last_active_at: new Date().toISOString(),
      }

      if (isProModelCheck) {
        updates.daily_pro_message_count = dailyProCount
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId)

      if (updateError) {
        throw new Error("Failed to update counts: " + updateError.message)
      }
    } else if (error) {
      throw error
    }

    // Track usage in Autumn for authenticated users (non-blocking)
    // Skip if already tracked (e.g., deep research deducts 2 credits upfront)
    if (isAuthenticated && !skipAutumnTracking) {
      trackMessageUsage(userId).catch(err =>
        console.error("Autumn tracking failed:", err)
      )
    }
  } catch (err) {
    console.error("Failed to increment message count:", err)
    // Don't throw error as this shouldn't block the chat
  }
}

export async function logUserMessage({
  supabase,
  userId,
  chatId,
  content,
  attachments,
  model,
  isAuthenticated,
  message_group_id,
}: LogUserMessageParams): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: sanitizeUserInput(content),
    experimental_attachments: attachments,
    user_id: userId,
    message_group_id,
  })

  if (error) {
    console.error("Error saving user message:", error)
  }
}

export async function storeAssistantMessage({
  supabase,
  chatId,
  messages,
  message_group_id,
  model,
}: StoreAssistantMessageParams): Promise<{
  messageId?: string
  content?: string
} | void> {
  if (!supabase) return
  try {
    const result = await saveFinalAssistantMessage(
      supabase,
      chatId,
      messages,
      message_group_id,
      model
    )
    return result
  } catch (err) {
    console.error("Failed to save assistant messages:", err)
  }
}
