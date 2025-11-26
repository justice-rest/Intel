"use client"

import { useRouter } from "next/navigation"
import { OnboardingForm } from "./onboarding-form"
import { OnboardingFormData } from "@/app/api/onboarding/route"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function OnboardingPage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      const supabase = createClient()

      if (!supabase) {
        router.push("/")
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth")
        return
      }

      // Check if user has already completed onboarding
      const { data: userData } = await supabase
        .from("users")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single()

      if (userData?.onboarding_completed) {
        router.push("/")
        return
      }

      setIsChecking(false)
    }

    checkOnboardingStatus()
  }, [router])

  const handleComplete = async (data: OnboardingFormData) => {
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to save onboarding data")
      }

      // Redirect to home page
      router.push("/")
    } catch (error) {
      console.error("Error completing onboarding:", error)
      throw error
    }
  }

  if (isChecking) {
    return <div className="h-dvh w-full overflow-hidden bg-background" />
  }

  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      <OnboardingForm onComplete={handleComplete} />
    </div>
  )
}
