import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import {
  convertFromApiFormat,
  defaultPreferences,
} from "@/lib/user-preference-store/utils"
import { generateDiceBearAvatar } from "@/lib/utils/avatar"
import type { UserProfile } from "./types"

export async function getSupabaseUser() {
  const supabase = await createClient()
  if (!supabase) return { supabase: null, user: null }

  const { data } = await supabase.auth.getUser()
  return {
    supabase,
    user: data.user ?? null,
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (!isSupabaseEnabled) {
    // return fake user profile for no supabase
    return {
      id: "guest",
      email: "guest@intel.getromy.app",
      display_name: "Guest",
      profile_image: "",
      anonymous: true,
      preferences: defaultPreferences,
    } as UserProfile
  }

  const { supabase, user } = await getSupabaseUser()
  if (!supabase || !user) return null

  const { data: userProfileData } = await supabase
    .from("users")
    .select("*, user_preferences(*)")
    .eq("id", user.id)
    .single()

  // Don't load anonymous users in the user store
  if (userProfileData?.anonymous) return null

  // Format user preferences if they exist
  const rawPrefs = userProfileData?.user_preferences as Record<string, unknown> | null | undefined
  const formattedPreferences = rawPrefs
    ? convertFromApiFormat(rawPrefs)
    : undefined

  // Read avatar indices from preferences (default 0 for backward compat)
  const avatarStyleIndex = typeof rawPrefs?.avatar_style_index === "number" ? rawPrefs.avatar_style_index : 0
  const avatarColorIndex = typeof rawPrefs?.avatar_color_index === "number" ? rawPrefs.avatar_color_index : 0

  // Always use DiceBear avatar instead of Google/provider avatar
  const diceBearAvatar = generateDiceBearAvatar(user.id, avatarStyleIndex, avatarColorIndex)

  return {
    ...userProfileData,
    profile_image: diceBearAvatar,
    display_name: user.user_metadata?.name ?? "",
    preferences: formattedPreferences,
  } as UserProfile
}
