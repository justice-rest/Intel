/**
 * Discovery Job Detail Page
 * Shows discovery results with candidate table
 */

import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { DiscoveryDetailView } from "./discovery-detail-view"

export const dynamic = "force-dynamic"

export default async function DiscoveryDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = await params
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

  // Fetch job to verify it exists and belongs to user
  const { data: job, error } = await (supabase as any)
    .from("discovery_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single()

  if (error || !job) {
    notFound()
  }

  return <DiscoveryDetailView jobId={jobId} initialJob={job} />
}
