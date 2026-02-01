/**
 * Message Notes API Routes
 * Handles CRUD operations for user notes on AI responses
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { sanitizeUserInput } from "@/lib/sanitize"

// Maximum note content length (10KB should be plenty for notes)
const MAX_CONTENT_LENGTH = 10000

/**
 * Validate messageId is a positive integer
 */
function isValidMessageId(id: string | null): id is string {
  if (!id) return false
  const num = parseInt(id, 10)
  return !isNaN(num) && num > 0 && String(num) === id
}

/**
 * GET /api/message-notes?messageId=X
 * Get note for a specific message
 */
export async function GET(req: Request) {
  try {
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get("messageId")

    if (!isValidMessageId(messageId)) {
      return NextResponse.json(
        { success: false, error: "Valid messageId is required" },
        { status: 400 }
      )
    }

    const { data: note, error } = await supabase
      .from("message_notes")
      .select("*")
      .eq("message_id", parseInt(messageId, 10))
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("GET /api/message-notes error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch note" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      note: note || null,
    })
  } catch (error) {
    console.error("GET /api/message-notes error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch note" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/message-notes
 * Create or update a note for a message (upsert)
 */
export async function POST(req: Request) {
  try {
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const { messageId, content } = body

    // Validate messageId
    const messageIdStr = String(messageId || "")
    if (!isValidMessageId(messageIdStr)) {
      return NextResponse.json(
        { success: false, error: "Valid messageId is required" },
        { status: 400 }
      )
    }

    // Validate content
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { success: false, error: "Note content is required" },
        { status: 400 }
      )
    }

    const trimmedContent = content.trim()
    if (trimmedContent.length === 0) {
      return NextResponse.json(
        { success: false, error: "Note content cannot be empty" },
        { status: 400 }
      )
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Note content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeUserInput(trimmedContent)

    // Upsert: insert or update if exists
    const { data: note, error } = await (supabase as any)
      .from("message_notes")
      .upsert(
        {
          message_id: parseInt(messageIdStr, 10),
          user_id: user.id,
          content: sanitizedContent,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "message_id,user_id",
        }
      )
      .select()
      .single()

    if (error) {
      console.error("POST /api/message-notes error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to save note" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      note,
    })
  } catch (error) {
    console.error("POST /api/message-notes error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to save note" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/message-notes?messageId=X
 * Delete a note for a specific message
 */
export async function DELETE(req: Request) {
  try {
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get("messageId")

    if (!isValidMessageId(messageId)) {
      return NextResponse.json(
        { success: false, error: "Valid messageId is required" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("message_notes")
      .delete()
      .eq("message_id", parseInt(messageId, 10))
      .eq("user_id", user.id)

    if (error) {
      console.error("DELETE /api/message-notes error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to delete note" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("DELETE /api/message-notes error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete note" },
      { status: 500 }
    )
  }
}
