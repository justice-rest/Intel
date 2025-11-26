"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUser } from "@/lib/user-store/provider"
import { User } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export function UserProfile() {
  const { user } = useUser()

  // Use React Query for caching - prevents glitch when switching tabs
  const { data: onboardingFirstName } = useQuery({
    queryKey: ["onboarding-first-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null

      const supabase = createClient()
      if (!supabase) return null

      const { data } = await supabase
        .from("onboarding_data")
        .select("first_name")
        .eq("user_id", user.id)
        .single()

      return data?.first_name || null
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  })

  if (!user) return null

  // Use onboarding first_name if available, fall back to display_name
  const displayName = onboardingFirstName || user?.display_name

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">Profile</h3>
      <div className="flex items-center space-x-4">
        <div className="bg-muted flex items-center justify-center overflow-hidden rounded-full">
          {user?.profile_image ? (
            <Avatar className="size-12">
              <AvatarImage src={user.profile_image} className="object-cover" />
              <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="text-muted-foreground size-12" />
          )}
        </div>
        <div>
          <h4 className="text-sm font-medium">{displayName}</h4>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>
      </div>
    </div>
  )
}
