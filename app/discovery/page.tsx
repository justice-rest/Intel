/**
 * Prospect Discovery Page
 *
 * Server component that handles authentication and renders the discovery UI.
 *
 * @module app/discovery/page
 */

import { DiscoveryView } from "./discovery-view"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Prospect Discovery | Rōmy",
  description: "Discover new prospects matching your ideal donor criteria",
}

export default async function DiscoveryPage() {
  // Auth check - require authentication for discovery
  if (isSupabaseEnabled) {
    const supabase = await createClient()
    if (supabase) {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        // Redirect to login with return URL
        redirect("/auth/login?redirect=/discovery")
      }
    }
  } else {
    // Discovery requires Supabase - redirect to home
    redirect("/")
  }

  return <DiscoveryView />
}
