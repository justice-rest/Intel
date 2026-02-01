import {
  getShareConversationEmailHtml,
  getShareConversationEmailSubject,
  isEmailEnabled,
  sendEmail,
} from "@/lib/email"
import { APP_DOMAIN } from "@/lib/config"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export async function POST(request: Request) {
  try {
    // Check if email is enabled
    if (!isEmailEnabled()) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      )
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { chatId, recipientEmail, recipientName, personalNote } = body

    // Validate required fields
    if (!chatId) {
      return NextResponse.json(
        { error: "Missing chatId" },
        { status: 400 }
      )
    }

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Missing recipient email" },
        { status: 400 }
      )
    }

    if (!isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    // Verify chat exists and is either owned by user or is public
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id, user_id, public")
      .eq("id", chatId)
      .single() as { data: any; error: any }

    if (chatError || !chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      )
    }

    // User must own the chat or the chat must be public
    if (chat.user_id !== user.id && !chat.public) {
      return NextResponse.json(
        { error: "Unauthorized to share this chat" },
        { status: 403 }
      )
    }

    // Get sender's display name from profile
    const { data: userProfile } = await supabase
      .from("users")
      .select("display_name, email")
      .eq("id", user.id)
      .single() as { data: any; error: any }

    const senderName =
      userProfile?.display_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Someone"

    // Generate share link
    const conversationLink = `${APP_DOMAIN}/share/${chatId}`

    // Generate email content
    const emailHtml = getShareConversationEmailHtml({
      senderName,
      recipientName: recipientName || undefined,
      personalNote: personalNote || undefined,
      conversationLink,
      appUrl: APP_DOMAIN,
    })

    const emailSubject = getShareConversationEmailSubject(senderName)

    // Send email with personal sender name
    const result = await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      from: `${senderName} via Rōmy <romy@updates.getromy.app>`,
    })

    if (!result.success) {
      console.error("[share-email] Failed to send:", result.error)
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[share-email] Unhandled error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
