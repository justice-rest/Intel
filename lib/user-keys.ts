import { decryptKey } from "./encryption"
import { env } from "./openproviders/env"
import { Provider } from "./openproviders/types"
import { createClient } from "./supabase/server"

export type { Provider } from "./openproviders/types"
export type ProviderWithoutOllama = Exclude<Provider, "ollama">

// ============================================================================
// CACHING - Reduces repeated DB calls for API keys
// ============================================================================

interface CachedKey {
  key: string | null
  timestamp: number
}

// Cache user keys for 5 minutes (keys rarely change mid-session)
const keyCache = new Map<string, CachedKey>()
const KEY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCacheKey(userId: string, provider: string): string {
  return `${userId}:${provider}`
}

export async function getUserKey(
  userId: string,
  provider: Provider
): Promise<string | null> {
  try {
    // OPTIMIZATION: Check cache first
    const cacheKey = getCacheKey(userId, provider)
    const cached = keyCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < KEY_CACHE_TTL) {
      return cached.key
    }

    const supabase = await createClient()
    if (!supabase) return null

    const { data, error } = await supabase
      .from("user_keys")
      .select("encrypted_key, iv")
      .eq("user_id", userId)
      .eq("provider", provider)
      .single()

    if (error || !data) {
      // Cache negative result too
      keyCache.set(cacheKey, { key: null, timestamp: Date.now() })
      return null
    }

    const decryptedKey = decryptKey(data.encrypted_key, data.iv)

    // Cache the result
    keyCache.set(cacheKey, { key: decryptedKey, timestamp: Date.now() })

    return decryptedKey
  } catch (error) {
    console.error("Error retrieving user key:", error)
    return null
  }
}

export async function getEffectiveApiKey(
  userId: string | null,
  provider: ProviderWithoutOllama
): Promise<string | null> {
  if (userId) {
    const userKey = await getUserKey(userId, provider)
    if (userKey) return userKey
  }

  const envKeyMap: Record<ProviderWithoutOllama, string | undefined> = {
    openrouter: env.OPENROUTER_API_KEY,
  }

  return envKeyMap[provider] || null
}

/**
 * Clear the key cache for a user (call after key updates)
 */
export function clearKeyCache(userId: string): void {
  for (const key of keyCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      keyCache.delete(key)
    }
  }
}
