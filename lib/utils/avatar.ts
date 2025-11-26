/**
 * Generate a DiceBear avatar URL for a user
 * Uses the "dylan" style with a consistent seed based on user ID
 *
 * @param userId - The user's unique identifier
 * @returns URL to the DiceBear avatar image
 */
export function generateDiceBearAvatar(userId: string): string {
  const seed = encodeURIComponent(userId)
  return `https://api.dicebear.com/9.x/dylan/svg?seed=${seed}&backgroundColor=00A5E4`
}
