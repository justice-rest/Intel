/**
 * Resend Email Client
 * Handles email sending via Resend API
 */

import { Resend } from "resend"

// Lazy-load Resend client to avoid build errors when API key is not set
let resend: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

// Default sender - update this to your verified domain
const DEFAULT_FROM = "Rōmy <romy@updates.getromy.app>"
const DEFAULT_REPLY_TO = "howard@getromy.app"

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string | string[]
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, html, from = DEFAULT_FROM, replyTo = DEFAULT_REPLY_TO } = options

  const client = getResendClient()
  if (!client) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email")
    return { success: false, error: "Email not configured" }
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      replyTo: Array.isArray(replyTo) ? replyTo : [replyTo],
      subject,
      html,
    })

    if (error) {
      console.error("[Email] Failed to send:", error)
      return { success: false, error: error.message }
    }

    console.log("[Email] Sent successfully:", data?.id)
    return { success: true, id: data?.id }
  } catch (error) {
    console.error("[Email] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    }
  }
}

/**
 * Check if email sending is enabled
 */
export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY
}
