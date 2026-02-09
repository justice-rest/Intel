/**
 * DiceBear avatar style and color configuration
 *
 * Styles are visually distinct DiceBear 9.x collections.
 * Colors are curated hex values (no # prefix — DiceBear URL format).
 */

export const AVATAR_STYLES = [
  "dylan",
  "glass",
  "big-smile",
  "big-ears",
  "lorelei",
  "lorelei-neutral",
  "notionists-neutral",
  "open-peeps",
] as const

export const AVATAR_COLORS = [
  "00A5E4", // sky blue (default)
  "FF6B6B", // coral
  "51CF66", // green
  "845EF7", // purple
  "FF922B", // orange
  "22B8CF", // teal
  "F06595", // rose
  "FFD43B", // golden
  "20C997", // mint
  "7950F2", // indigo
] as const

export type AvatarStyle = (typeof AVATAR_STYLES)[number]
export type AvatarColor = (typeof AVATAR_COLORS)[number]

/** Human-readable display names for each avatar style */
export const AVATAR_STYLE_NAMES: Record<AvatarStyle, string> = {
  "dylan": "Dylan",
  "glass": "Glass",
  "big-smile": "Big Smile",
  "big-ears": "Big Ears",
  "lorelei": "Lorelei",
  "lorelei-neutral": "Lorelei Neutral",
  "notionists-neutral": "Notionists Neutral",
  "open-peeps": "Open Peeps",
}

/**
 * Generate a DiceBear avatar URL for a user
 * Uses a consistent seed based on user ID for deterministic results.
 *
 * @param userId - The user's unique identifier
 * @param styleIndex - Index into AVATAR_STYLES (default 0 = "dylan")
 * @param colorIndex - Index into AVATAR_COLORS (default 0 = "00A5E4")
 * @returns URL to the DiceBear avatar SVG
 */
export function generateDiceBearAvatar(
  userId: string,
  styleIndex = 0,
  colorIndex = 0
): string {
  const seed = encodeURIComponent(userId)
  const style = AVATAR_STYLES[styleIndex % AVATAR_STYLES.length]
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=${color}`
}
