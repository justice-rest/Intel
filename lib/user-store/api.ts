// @todo: move in /lib/user/api.ts
import { toast } from "@/components/ui/toast"
import { createClient } from "@/lib/supabase/client"
import type { UserProfile } from "@/lib/user/types"
import { generateDiceBearAvatar } from "@/lib/utils/avatar"

export async function fetchUserProfile(
  id: string
): Promise<UserProfile | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("users")
    .select("*, user_preferences(*)")
    .eq("id", id)
    .single()

  if (error || !data) {
    console.error("Failed to fetch user:", error)
    return null
  }

  // Don't return anonymous users
  if (data.anonymous) return null

  // Read avatar indices from joined preferences (default 0 for backward compat)
  const rawPrefs = data.user_preferences as Record<string, unknown> | null | undefined
  const avatarStyleIndex = typeof rawPrefs?.avatar_style_index === "number" ? rawPrefs.avatar_style_index : 0
  const avatarColorIndex = typeof rawPrefs?.avatar_color_index === "number" ? rawPrefs.avatar_color_index : 0

  // Always use DiceBear avatar instead of stored profile_image
  const diceBearAvatar = generateDiceBearAvatar(id, avatarStyleIndex, avatarColorIndex)

  return {
    ...data,
    profile_image: diceBearAvatar,
    display_name: data.display_name || "",
  }
}

export async function updateUserProfile(
  id: string,
  updates: Partial<UserProfile>
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await supabase.from("users").update(updates).eq("id", id)

  if (error) {
    console.error("Failed to update user:", error)
    return false
  }

  return true
}

export async function signOutUser(): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) {
    toast({
      title: "Sign out is not supported in this deployment",
      status: "info",
    })
    return false
  }

  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error("Failed to sign out:", error)
    return false
  }

  return true
}

export function subscribeToUserUpdates(
  userId: string,
  onUpdate: (newData: Partial<UserProfile>) => void
) {
  const supabase = createClient()
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`public:users:id=eq.${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "users",
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const newData = payload.new as Partial<UserProfile>
        // Use default avatar — realtime payloads don't include joined tables.
        // The useAvatarUrl hook provides the preference-aware URL on the client.
        if (newData.id) {
          newData.profile_image = generateDiceBearAvatar(newData.id)
        }
        onUpdate(newData)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
