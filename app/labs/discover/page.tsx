/**
 * Discovery Page
 * AI-powered prospect discovery using FindAll API
 */

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DiscoverView } from "./discover-view"

export const dynamic = "force-dynamic"

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

  return <DiscoverView planName="Growth" />
}
