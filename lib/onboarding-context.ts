import { createClient } from "@/lib/supabase/server"

export interface OnboardingData {
  first_name: string | null
  nonprofit_name: string | null
  nonprofit_location: string | null
  nonprofit_sector: string | null
  annual_budget: string | null
  donor_count: string | null
  fundraising_primary: boolean | null
  prior_tools: string[] | null
  purpose: string | null
  agent_name: string | null
  additional_context: string | null
}

/**
 * OPTIMIZATION: In-memory cache for onboarding context
 * TTL: 5 minutes (300000ms)
 * This reduces DB queries since onboarding data rarely changes
 */
const onboardingCache = new Map<string, { data: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches onboarding data for a user from the database
 */
export async function fetchOnboardingData(
  userId: string
): Promise<OnboardingData | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null

    const { data, error } = await supabase
      .from("onboarding_data")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching onboarding data:", error)
      return null
    }

    return data as OnboardingData | null
  } catch (error) {
    console.error("Error in fetchOnboardingData:", error)
    return null
  }
}

/**
 * Invalidate cached onboarding context for a user
 * Call this when user updates their settings
 */
export function invalidateOnboardingCache(userId: string): void {
  onboardingCache.delete(userId)
}

/**
 * Formats onboarding data into a contextual string to append to system prompt
 */
export function formatOnboardingContext(data: OnboardingData): string {
  if (!data) return ""

  const sections: string[] = []

  // Personal info and agent name
  const userInfo: string[] = []
  if (data.first_name) {
    userInfo.push(`You are assisting ${data.first_name}.`)
  }
  if (data.agent_name) {
    userInfo.push(
      `${data.first_name || "This user"} has named you "${data.agent_name}" - use this name when appropriate or when they address you.`
    )
  }
  if (userInfo.length > 0) {
    sections.push(`USER INFORMATION:\n${userInfo.join(" ")}`)
  }

  // Organization details
  const orgDetails: string[] = []
  if (data.nonprofit_name) {
    orgDetails.push(`Organization: ${data.nonprofit_name}`)
  }
  if (data.nonprofit_location) {
    orgDetails.push(`Location: ${data.nonprofit_location}`)
  }
  if (data.nonprofit_sector) {
    orgDetails.push(`Sector: ${data.nonprofit_sector}`)
  }
  if (data.annual_budget) {
    orgDetails.push(`Annual Budget: ${data.annual_budget}`)
  }
  if (data.donor_count) {
    orgDetails.push(`Number of Donors: ${data.donor_count}`)
  }
  if (data.fundraising_primary !== null) {
    orgDetails.push(
      `Fundraising Primary Responsibility: ${data.fundraising_primary ? "Yes" : "No"}`
    )
  }

  if (orgDetails.length > 0) {
    sections.push(
      `ORGANIZATION CONTEXT:\n${orgDetails.join("\n")}`
    )
  }

  // Experience with tools
  if (data.prior_tools && data.prior_tools.length > 0) {
    sections.push(
      `PRIOR EXPERIENCE:\nThey have experience with these wealth screening tools: ${data.prior_tools.join(", ")}`
    )
  }

  // User's purpose and goals
  if (data.purpose) {
    sections.push(
      `USER'S GOALS:\n${data.purpose}`
    )
  }

  // Additional context from settings
  if (data.additional_context) {
    sections.push(
      `ADDITIONAL CONTEXT:\n${data.additional_context}`
    )
  }

  // Combine all sections
  if (sections.length === 0) return ""

  return `\n\n---\n\n${sections.join("\n\n")}\n\n---\n\nUse the above contextual information to personalize your responses and provide more relevant assistance to the user. Reference their organization, goals, and experience level when appropriate.`
}

/**
 * OPTIMIZED: Gets the complete system prompt with onboarding context injected
 * Uses in-memory cache to avoid hitting DB on every request
 */
export async function getSystemPromptWithContext(
  userId: string | null,
  baseSystemPrompt: string
): Promise<string> {
  if (!userId) return baseSystemPrompt

  // Check cache first
  const cached = onboardingCache.get(userId)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    // Cache hit - return immediately
    return baseSystemPrompt + cached.data
  }

  // Cache miss or expired - fetch from DB
  const onboardingData = await fetchOnboardingData(userId)
  if (!onboardingData) return baseSystemPrompt

  const contextString = formatOnboardingContext(onboardingData)

  // Update cache
  onboardingCache.set(userId, {
    data: contextString,
    timestamp: now
  })

  return baseSystemPrompt + contextString
}
