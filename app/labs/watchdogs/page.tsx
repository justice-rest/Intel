import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import WatchdogsView from "./watchdogs-view"

export const metadata = {
  title: "Watchdogs | Romy Labs",
  description: "Real-time global intelligence dashboard - monitor financial, geopolitical, natural, and regulatory events worldwide",
}

export default async function WatchdogsPage() {
  const supabase = await createClient()

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      redirect("/auth/email")
    }
  }

  return <WatchdogsView />
}
