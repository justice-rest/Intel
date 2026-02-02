/**
 * Onboarding Email Module
 * Handles the 4-email onboarding sequence for new users
 *
 * Email 1: Welcome (immediate) - sent on signup
 * Email 2: How It Works (scheduled for day 2)
 * Email 3: Common Challenges (scheduled for day 4)
 * Email 4: Moving Forward (scheduled for day 6)
 */

import { sendEmail, isEmailEnabled } from "./resend"
import {
  getWelcomeEmailHtml,
  getWelcomeEmailSubject,
  getHowItWorksEmailHtml,
  getHowItWorksEmailSubject,
  getCommonChallengesEmailHtml,
  getCommonChallengesEmailSubject,
  getMovingForwardEmailHtml,
  getMovingForwardEmailSubject,
  type OnboardingEmailData,
} from "./templates/onboarding"

// Resend client for scheduled sends
import { Resend } from "resend"

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  return new Resend(process.env.RESEND_API_KEY)
}

const DEFAULT_FROM = "Rōmy <romy@updates.getromy.app>"

// ============================================================================
// INDIVIDUAL EMAIL SENDERS
// ============================================================================

/**
 * Send welcome email immediately on signup
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailEnabled()) {
    console.log("[Onboarding] Email not configured, skipping welcome email")
    return { success: false, error: "Email not configured" }
  }

  const data: OnboardingEmailData = { email, firstName }

  return sendEmail({
    to: email,
    subject: getWelcomeEmailSubject(firstName),
    html: getWelcomeEmailHtml(data),
  })
}

/**
 * Send "How It Works" email (day 2-3)
 */
export async function sendHowItWorksEmail(
  email: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailEnabled()) {
    return { success: false, error: "Email not configured" }
  }

  const data: OnboardingEmailData = { email, firstName }

  return sendEmail({
    to: email,
    subject: getHowItWorksEmailSubject(),
    html: getHowItWorksEmailHtml(data),
  })
}

/**
 * Send "Common Challenges" email (day 4-5)
 */
export async function sendCommonChallengesEmail(
  email: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailEnabled()) {
    return { success: false, error: "Email not configured" }
  }

  const data: OnboardingEmailData = { email, firstName }

  return sendEmail({
    to: email,
    subject: getCommonChallengesEmailSubject(),
    html: getCommonChallengesEmailHtml(data),
  })
}

/**
 * Send "Moving Forward" email (day 6-7)
 */
export async function sendMovingForwardEmail(
  email: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailEnabled()) {
    return { success: false, error: "Email not configured" }
  }

  const data: OnboardingEmailData = { email, firstName }

  return sendEmail({
    to: email,
    subject: getMovingForwardEmailSubject(),
    html: getMovingForwardEmailHtml(data),
  })
}

// ============================================================================
// SCHEDULED ONBOARDING SEQUENCE
// ============================================================================

/**
 * Schedule all onboarding emails for a new user
 * Uses Resend's scheduled sends feature
 *
 * @param email - User's email address
 * @param firstName - User's first name
 */
export async function scheduleOnboardingSequence(
  email: string,
  firstName: string
): Promise<{ success: boolean; scheduledEmails: number; errors: string[] }> {
  const resend = getResendClient()
  const errors: string[] = []
  let scheduledCount = 0

  if (!resend) {
    console.warn("[Onboarding] RESEND_API_KEY not configured, skipping scheduled emails")
    return { success: false, scheduledEmails: 0, errors: ["Email not configured"] }
  }

  const data: OnboardingEmailData = { email, firstName }

  // Calculate scheduled times
  const now = new Date()
  const day2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) // 2 days
  const day4 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000) // 4 days
  const day6 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000) // 6 days

  // Set all emails to send at 10 AM in user's assumed timezone
  day2.setHours(10, 0, 0, 0)
  day4.setHours(10, 0, 0, 0)
  day6.setHours(10, 0, 0, 0)

  // Email 1: Welcome (send immediately)
  try {
    const result = await sendWelcomeEmail(email, firstName)
    if (result.success) {
      scheduledCount++
      console.log("[Onboarding] Welcome email sent to:", email)
    } else {
      errors.push(`Welcome email failed: ${result.error}`)
    }
  } catch (error) {
    errors.push(`Welcome email error: ${error instanceof Error ? error.message : "Unknown"}`)
  }

  // Email 2: How It Works (day 2)
  try {
    const { error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: email,
      subject: getHowItWorksEmailSubject(),
      html: getHowItWorksEmailHtml(data),
      scheduledAt: day2.toISOString(),
    })

    if (error) {
      errors.push(`How It Works email failed: ${error.message}`)
    } else {
      scheduledCount++
      console.log("[Onboarding] How It Works email scheduled for:", day2.toISOString())
    }
  } catch (error) {
    errors.push(`How It Works email error: ${error instanceof Error ? error.message : "Unknown"}`)
  }

  // Email 3: Common Challenges (day 4)
  try {
    const { error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: email,
      subject: getCommonChallengesEmailSubject(),
      html: getCommonChallengesEmailHtml(data),
      scheduledAt: day4.toISOString(),
    })

    if (error) {
      errors.push(`Common Challenges email failed: ${error.message}`)
    } else {
      scheduledCount++
      console.log("[Onboarding] Common Challenges email scheduled for:", day4.toISOString())
    }
  } catch (error) {
    errors.push(`Common Challenges email error: ${error instanceof Error ? error.message : "Unknown"}`)
  }

  // Email 4: Moving Forward (day 6)
  try {
    const { error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: email,
      subject: getMovingForwardEmailSubject(),
      html: getMovingForwardEmailHtml(data),
      scheduledAt: day6.toISOString(),
    })

    if (error) {
      errors.push(`Moving Forward email failed: ${error.message}`)
    } else {
      scheduledCount++
      console.log("[Onboarding] Moving Forward email scheduled for:", day6.toISOString())
    }
  } catch (error) {
    errors.push(`Moving Forward email error: ${error instanceof Error ? error.message : "Unknown"}`)
  }

  return {
    success: errors.length === 0,
    scheduledEmails: scheduledCount,
    errors,
  }
}
