// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

import { APP_DOMAIN } from "@/lib/config"
import type { UserProfile } from "@/lib/user/types"
import { SupabaseClient } from "@supabase/supabase-js"
import { fetchClient } from "./fetch"
import { API_ROUTE_CREATE_GUEST, API_ROUTE_UPDATE_CHAT_MODEL } from "./routes"
import { createClient } from "./supabase/client"

/**
 * Creates a guest user record on the server
 */
export async function createGuestUser(guestId: string) {
  try {
    const res = await fetchClient(API_ROUTE_CREATE_GUEST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: guestId }),
    })
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to create guest user: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (err) {
    console.error("Error creating guest user:", err)
    throw err
  }
}

export class UsageLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_LIMIT_REACHED"
  }
}

export class SubscriptionRequiredError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "SUBSCRIPTION_REQUIRED"
  }
}

export class ProLimitReachedError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "PRO_LIMIT_REACHED"
  }
}

/**
 * Checks the user's daily usage and increments both overall and daily counters.
 * Resets the daily counter if a new day (UTC) is detected.
 * Uses the `anonymous` flag from the user record to decide which daily limit applies.
 *
 * @param supabase - Your Supabase client.
 * @param userId - The ID of the user.
 * @returns The remaining daily limit.
 */
export async function checkRateLimits(
  userId: string,
  isAuthenticated: boolean
) {
  try {
    const res = await fetchClient(
      `/api/rate-limits?userId=${userId}&isAuthenticated=${isAuthenticated}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to check rate limits: ${res.status} ${res.statusText}`
      )
    }
    return responseData
  } catch (err) {
    console.error("Error checking rate limits:", err)
    throw err
  }
}

/**
 * Updates the model for an existing chat
 */
export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetchClient(API_ROUTE_UPDATE_CHAT_MODEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, model }),
    })
    const responseData = await res.json()

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update chat model: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (error) {
    console.error("Error updating chat model:", error)
    throw error
  }
}

/**
 * Gets the correct base URL for auth redirects.
 * Uses APP_DOMAIN in production to ensure consistency with Supabase's configured redirect URLs.
 * This prevents issues with preview deployments, www vs non-www, etc.
 */
function getAuthRedirectUrl(): string {
  const isDev = process.env.NODE_ENV === "development"

  if (isDev) {
    return "http://localhost:3000"
  }

  // In production, ALWAYS use APP_DOMAIN to match Supabase redirect URL configuration
  return APP_DOMAIN
}

/**
 * Signs in user with Google OAuth via Supabase
 */
export async function signInWithGoogle(supabase: AnySupabaseClient) {
  try {
    const baseUrl = getAuthRedirectUrl()

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${baseUrl}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })

    if (error) {
      throw error
    }

    // Return the provider URL
    return data
  } catch (err) {
    console.error("Error signing in with Google:", err)
    throw err
  }
}

export const getOrCreateGuestUserId = async (
  user: UserProfile | null
): Promise<string | null> => {
  if (user?.id) return user.id

  const supabase = createClient()

  if (!supabase) {
    console.warn("Supabase is not available in this deployment.")
    return null
  }

  const existingGuestSessionUser = await supabase.auth.getUser()
  if (
    existingGuestSessionUser.data?.user &&
    existingGuestSessionUser.data.user.is_anonymous
  ) {
    const anonUserId = existingGuestSessionUser.data.user.id

    const profileCreationAttempted = localStorage.getItem(
      `guestProfileAttempted_${anonUserId}`
    )

    if (!profileCreationAttempted) {
      try {
        await createGuestUser(anonUserId)
        localStorage.setItem(`guestProfileAttempted_${anonUserId}`, "true")
      } catch (error) {
        console.error(
          "Failed to ensure guest user profile exists for existing anonymous auth user:",
          error
        )
        return null
      }
    }
    return anonUserId
  }

  try {
    const { data: anonAuthData, error: anonAuthError } =
      await supabase.auth.signInAnonymously()

    if (anonAuthError) {
      console.error("Error during anonymous sign-in:", anonAuthError)
      return null
    }

    if (!anonAuthData || !anonAuthData.user) {
      console.error("Anonymous sign-in did not return a user.")
      return null
    }

    const guestIdFromAuth = anonAuthData.user.id
    await createGuestUser(guestIdFromAuth)
    localStorage.setItem(`guestProfileAttempted_${guestIdFromAuth}`, "true")
    return guestIdFromAuth
  } catch (error) {
    console.error(
      "Error in getOrCreateGuestUserId during anonymous sign-in or profile creation:",
      error
    )
    return null
  }
}
