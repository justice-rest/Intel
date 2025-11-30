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

    // Get customer data from Autumn
    try {
      const customerData = await getCustomerData(user.id)

      if (customerData?.products && customerData.products.length > 0) {
        // Get the first active product
        const activeProduct = customerData.products.find(
          (p: { status: string }) => p.status === "active"
        )

        if (activeProduct) {
          const planId = normalizePlanId(activeProduct.id)

          if (planId && PLAN_ROW_LIMITS[planId]) {
            return NextResponse.json({
              limit: PLAN_ROW_LIMITS[planId],
              plan: planId,
            })
          }
        }
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
