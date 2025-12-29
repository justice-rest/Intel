/**
 * Discovery Page
 * AI-powered prospect discovery using FindAll API
 */

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DiscoverView } from "./discover-view"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"
import { DISCOVERY_PLAN_LIMITS } from "@/lib/discovery/config"

export const dynamic = "force-dynamic"

async function getUserPlan(userId: string): Promise<string> {
  try {
    const customerData = await getCustomerData(userId, 2000)

    if (customerData?.products && customerData.products.length > 0) {
      const activeProduct = customerData.products.find(
        (p: { status: string }) => p.status === "active" || p.status === "trialing"
      )

      if (activeProduct) {
        const planId = normalizePlanId(activeProduct.id)
        if (planId && DISCOVERY_PLAN_LIMITS[planId]) {
          // Capitalize for display
          return planId.charAt(0).toUpperCase() + planId.slice(1)
        }
      }
    }
  } catch (error) {
    console.error("[DiscoverPage] Error fetching plan:", error)
  }

  return "Growth" // Default fallback
}

export default async function DiscoverPage() {
  const supabase = await createClient()

  if (!supabase) {
    redirect("/auth")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const planName = await getUserPlan(user.id)

  return <DiscoverView planName={planName} />
}
