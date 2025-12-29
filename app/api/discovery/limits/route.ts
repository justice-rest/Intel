/**
 * Discovery Limits API
 * GET: Get the discovery limits for the current user based on their plan
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"
import { getDiscoveryPlanLimits, DISCOVERY_PLAN_LIMITS } from "@/lib/discovery/config"

export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      const limits = getDiscoveryPlanLimits("free")
      return NextResponse.json({
        ...limits,
        plan: "free",
      })
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const limits = getDiscoveryPlanLimits("free")
      return NextResponse.json({
        ...limits,
        plan: "free",
      })
    }

    // Get customer data from Autumn
    try {
      const customerData = await getCustomerData(user.id, 2000)

      console.log("[DiscoveryLimits] Customer data for user:", user.id, JSON.stringify(customerData?.products?.map((p: { id: string; status: string }) => ({ id: p.id, status: p.status })) || []))

      if (customerData?.products && customerData.products.length > 0) {
        // Get the first active or trialing product
        const activeProduct = customerData.products.find(
          (p: { status: string }) => p.status === "active" || p.status === "trialing"
        )

        if (activeProduct) {
          const planId = normalizePlanId(activeProduct.id)
          console.log("[DiscoveryLimits] Active product:", activeProduct.id, "-> normalized:", planId)

          if (planId && DISCOVERY_PLAN_LIMITS[planId]) {
            const limits = getDiscoveryPlanLimits(planId)
            return NextResponse.json({
              ...limits,
              plan: planId,
            })
          } else {
            console.warn("[DiscoveryLimits] Plan not found in DISCOVERY_PLAN_LIMITS:", planId, "Available:", Object.keys(DISCOVERY_PLAN_LIMITS))
          }
        } else {
          console.warn("[DiscoveryLimits] No active/trialing product found for user:", user.id)
        }
      } else {
        console.warn("[DiscoveryLimits] No products found for user:", user.id)
      }
    } catch (error) {
      console.error("[DiscoveryLimits] Error fetching customer data:", error)
    }

    // Default to growth plan limit
    const limits = getDiscoveryPlanLimits("growth")
    return NextResponse.json({
      ...limits,
      plan: "growth",
    })
  } catch (error) {
    console.error("[DiscoveryLimits] Error:", error)
    const limits = getDiscoveryPlanLimits("free")
    return NextResponse.json({
      ...limits,
      plan: "free",
    })
  }
}
