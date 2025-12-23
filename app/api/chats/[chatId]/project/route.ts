import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * PUT /api/chats/[chatId]/project
 * Update a chat's project assignment
 * Body: { projectId: string | null }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const supabase = await createClient()
    const { chatId } = await params

    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authData.user.id
    const { projectId } = await request.json()

    // Verify the chat belongs to the user
    const { data: chat, error: chatError } = await (supabase as any)
      .from("chats")
      .select("user_id")
      .eq("id", chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    if (chat.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // If projectId is provided, verify it belongs to the user
    if (projectId) {
      const { data: project, error: projectError } = await (supabase as any)
        .from("projects")
        .select("user_id")
        .eq("id", projectId)
        .single()

      if (projectError || !project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }

      if (project.user_id !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    // Update the chat's project_id
    const { error: updateError } = await (supabase as any)
      .from("chats")
      .update({ project_id: projectId || null })
      .eq("id", chatId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, projectId: projectId || null })
  } catch (err: unknown) {
    console.error("Error updating chat project:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
