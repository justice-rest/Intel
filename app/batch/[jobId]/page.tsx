import { LayoutApp } from "@/app/components/layout/layout-app"
import { BatchJobDetailView } from "./batch-job-detail-view"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function BatchJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = await params

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
    <LayoutApp forceSidebar>
      <BatchJobDetailView jobId={jobId} />
    </LayoutApp>
  )
}
