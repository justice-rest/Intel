"use client"

import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/user-store/provider"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function Home() {
  const router = useRouter()
  const { user } = useUser()
  const [showWelcome, setShowWelcome] = useState(false)

  // Use the user's onboarding_completed status from the already-loaded user profile
  const needsOnboarding =
    user && !user.anonymous && user.onboarding_completed === false

  // Redirect to onboarding if needed (non-blocking)
  useEffect(() => {
    if (needsOnboarding) {
      router.push("/onboarding")
    }
  }, [needsOnboarding, router])

  // Fetch firstName using react-query (cached, non-blocking)
  const { data: firstName } = useQuery({
    queryKey: ["onboarding-data", user?.id],
    queryFn: async () => {
      const supabase = createClient()
      if (!supabase || !user?.id) return null

      const { data } = await supabase
        .from("onboarding_data")
        .select("first_name")
        .eq("user_id", user.id)
        .single()

      return data?.first_name || null
    },
    enabled: !!user?.id && !user.anonymous,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  // Check if user just completed onboarding (show welcome once)
  useEffect(() => {
    if (user?.onboarding_completed && !user.anonymous) {
      const hasSeenWelcome = localStorage.getItem("hasSeenWelcome")
      if (!hasSeenWelcome) {
        setShowWelcome(true)
      }
    }
  }, [user?.onboarding_completed, user?.anonymous])

  // Don't render if we need to redirect to onboarding
  if (needsOnboarding) {
    return <div className="bg-background h-dvh" />
  }

  return (
    <LayoutApp>
      <ChatContainer
        showWelcome={showWelcome}
        firstName={firstName}
        onWelcomeDismiss={() => {
          setShowWelcome(false)
          localStorage.setItem("hasSeenWelcome", "true")
        }}
      />
    </LayoutApp>
  )
}
