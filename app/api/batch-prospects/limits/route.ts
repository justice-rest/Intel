/**
 * Batch Limits API
 * GET: Get the batch processing limits for the current user based on their plan
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"
import { PLAN_ROW_LIMITS, DEFAULT_PLAN_ROW_LIMIT } from "@/lib/batch-processing/config"

export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({
        limit: DEFAULT_PLAN_ROW_LIMIT,
        plan: "free",
      })
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        limit: DEFAULT_PLAN_ROW_LIMIT,
        plan: "free",
      })
    }

    // Get customer data from Autumn with longer timeout (2s) since batch limits isn't latency-critical
    try {
      const customerData = await getCustomerData(user.id, 2000)

      console.log("[BatchLimits] Customer data for user:", user.id, JSON.stringify(customerData?.products?.map((p: { id: string; status: string }) => ({ id: p.id, status: p.status })) || []))

      if (customerData?.products && customerData.products.length > 0) {
        // Get the first active or trialing product
        const activeProduct = customerData.products.find(
          (p: { status: string }) => p.status === "active" || p.status === "trialing"
        )

        if (activeProduct) {
          const planId = normalizePlanId(activeProduct.id)
          console.log("[BatchLimits] Active product:", activeProduct.id, "-> normalized:", planId)

          if (planId && PLAN_ROW_LIMITS[planId]) {
            return NextResponse.json({
              limit: PLAN_ROW_LIMITS[planId],
              plan: planId,
            })
          } else {
            console.warn("[BatchLimits] Plan not found in PLAN_ROW_LIMITS:", planId, "Available:", Object.keys(PLAN_ROW_LIMITS))
          }
        } else {
          console.warn("[BatchLimits] No active/trialing product found for user:", user.id)
        }
      } else {
        console.warn("[BatchLimits] No products found for user:", user.id)
      }
    } catch (error) {
      console.error("[BatchLimits] Error fetching customer data:", error)
    }

    // Default to growth plan limit
    return NextResponse.json({
      limit: DEFAULT_PLAN_ROW_LIMIT,
      plan: "growth",
    })
  } catch (error) {
    console.error("[BatchLimits] Error:", error)
    return NextResponse.json({
      limit: DEFAULT_PLAN_ROW_LIMIT,
      plan: "free",
    })
  }
}
