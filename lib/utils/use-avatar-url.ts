"use client"

import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { generateDiceBearAvatar } from "./avatar"

/**
 * Returns a DiceBear avatar URL for the given userId,
 * using the current avatarStyleIndex and avatarColorIndex from user preferences.
 *
 * Returns undefined when userId is falsy (guest / unauthenticated).
 */
export function useAvatarUrl(userId: string | undefined): string | undefined {
  const { preferences } = useUserPreferences()

  if (!userId) return undefined

  return generateDiceBearAvatar(
    userId,
    preferences.avatarStyleIndex,
    preferences.avatarColorIndex
  )
}
