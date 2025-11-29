import { LayoutApp } from "@/app/components/layout/layout-app"
import { BatchView } from "./batch-view"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function BatchPage() {
  // Auth check - redirect to home if not authenticated
  if (isSupabaseEnabled) {
    const supabase = await createClient()
    if (supabase) {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        redirect("/")
      }
    }
  }

  return (
    <LayoutApp>
      <BatchView />
    </LayoutApp>
  )
}
