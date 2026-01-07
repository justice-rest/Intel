/**
 * User Plan API
 *
 * GET: Get the current user's subscription plan
 *
 * @module app/api/user-plan
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  getCustomerData,
  normalizePlanId,
} from "@/lib/subscription/autumn-client"

export const runtime = "nodejs"

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ plan: null }, { status: 200 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ plan: null }, { status: 200 })
    }

    // Get customer data from Autumn
    const customerData = await getCustomerData(user.id, 2000)
    const activeProduct = customerData?.products?.find(
      (p: { status: string }) => p.status === "active" || p.status === "trialing"
    )
    const plan = normalizePlanId(activeProduct?.id)

    return NextResponse.json({
      plan,
      productId: activeProduct?.id || null,
      status: activeProduct?.status || null,
    })
  } catch (error) {
    console.error("[User Plan API] Error:", error)
    return NextResponse.json({ plan: null }, { status: 200 })
  }
}
