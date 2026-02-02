"use client"

import { useQuery } from "@tanstack/react-query"

interface PlanStatus {
  isScale: boolean
  isPro: boolean
  isGrowth: boolean
  planId: string | null
}

/**
 * Client-side hook to check the user's subscription plan
 * Used for UI gating (e.g., showing/hiding beta features toggle)
 *
 * @returns Plan status with loading state
 */
export function useSubscriptionPlan(): PlanStatus & { isLoading: boolean } {
  const { data, isLoading } = useQuery<PlanStatus>({
    queryKey: ["subscription-plan"],
    queryFn: async () => {
      const response = await fetch("/api/subscription/plan")
      if (!response.ok) {
        return { isScale: false, isPro: false, isGrowth: false, planId: null }
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - subscription status rarely changes
    retry: 1,
  })

  return {
    isScale: data?.isScale ?? false,
    isPro: data?.isPro ?? false,
    isGrowth: data?.isGrowth ?? false,
    planId: data?.planId ?? null,
    isLoading,
  }
}
