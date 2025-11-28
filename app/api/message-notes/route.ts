/**
 * Message Notes API Routes
 * Handles CRUD operations for user notes on AI responses
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"

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

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "messageId is required" },
        { status: 400 }
      )
    }

    const { data: note, error } = await supabase
      .from("message_notes")
      .select("*")
      .eq("message_id", parseInt(messageId))
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("GET /api/message-notes error:", error)
      return NextResponse.json(
        { success: false, error: error.message },
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
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch note",
      },
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

    const body = await req.json()
    const { messageId, content } = body

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "messageId is required" },
        { status: 400 }
      )
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Note content is required" },
        { status: 400 }
      )
    }

    // Upsert: insert or update if exists
    const { data: note, error } = await supabase
      .from("message_notes")
      .upsert(
        {
          message_id: parseInt(messageId),
          user_id: user.id,
          content: content.trim(),
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
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      note,
      message: "Note saved successfully",
    })
  } catch (error) {
    console.error("POST /api/message-notes error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save note",
      },
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

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "messageId is required" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("message_notes")
      .delete()
      .eq("message_id", parseInt(messageId))
      .eq("user_id", user.id)

    if (error) {
      console.error("DELETE /api/message-notes error:", error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Note deleted successfully",
    })
  } catch (error) {
    console.error("DELETE /api/message-notes error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete note",
      },
      { status: 500 }
    )
  }
}
