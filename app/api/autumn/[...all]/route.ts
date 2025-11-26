import { createClient } from "@/lib/supabase/server"
import { autumnHandler } from "autumn-js/next"

/**
 * Autumn API handler for subscription management
 * This handler integrates Autumn's billing system with Rōmy's existing auth
 *
 * The handler is mounted at /api/autumn/* and handles:
 * - Customer identification via Supabase auth
 * - Checkout flows for subscription purchases
 * - Feature access checks
 * - Usage tracking
 */
export const { GET, POST } = autumnHandler({
  identify: async (request) => {
    // Get Supabase client with user session
    const supabase = await createClient()

    if (!supabase) {
      console.warn("Supabase not enabled - Autumn subscriptions unavailable")
      return null
    }

    // Get the authenticated user from Supabase
    const { data: authData, error: authError } = await supabase.auth.getUser()

    // If no authenticated user, return null (guest users can't subscribe)
    if (authError || !authData?.user) {
      return null
    }

    const user = authData.user

    // Fetch user profile for additional data
    const { data: userProfile } = await supabase
      .from("users")
      .select("display_name, email")
      .eq("id", user.id)
      .single()

    // Return customer information for Autumn
    return {
      customerId: user.id,
      customerData: {
        name: userProfile?.display_name || user.email?.split("@")[0] || "User",
        email: userProfile?.email || user.email || "",
      },
    }
  },
})
