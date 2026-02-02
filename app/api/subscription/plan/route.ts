import { createClient } from "@/lib/supabase/server"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"
import { NextResponse } from "next/server"

/**
 * GET /api/subscription/plan
 *
 * Returns the user's subscription plan status for client-side UI gating.
 * Used by useSubscriptionPlan() hook to show/hide beta features toggle.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ isScale: false, isPro: false, isGrowth: false, planId: null })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ isScale: false, isPro: false, isGrowth: false, planId: null })
    }

    const customerData = await getCustomerData(user.id, 2000)
    const activeProduct = customerData?.products?.find(
      (p: { status: string }) => p.status === "active" || p.status === "trialing"
    )

    const planId = normalizePlanId(activeProduct?.id)

    return NextResponse.json({
      isScale: planId === "scale",
      isPro: planId === "pro",
      isGrowth: planId === "growth",
      planId,
    })
  } catch (error) {
    console.error("Error checking plan status:", error)
    return NextResponse.json({ isScale: false, isPro: false, isGrowth: false, planId: null })
  }
}
