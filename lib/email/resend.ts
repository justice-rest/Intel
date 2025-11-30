/**
 * Resend Email Client
 * Handles email sending via Resend API
 */

import { Resend } from "resend"

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

// Default sender - update this to your verified domain
const DEFAULT_FROM = "Rōmy <notifications@romyai.com>"

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, html, from = DEFAULT_FROM } = options

  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email")
    return { success: false, error: "Email not configured" }
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
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
