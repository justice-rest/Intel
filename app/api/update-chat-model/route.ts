import { createClient } from "@/lib/supabase/server"
import { normalizeModelId } from "@/lib/models"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { chatId, model } = await request.json()

    if (!chatId || !model) {
      return new Response(
        JSON.stringify({ error: "Missing chatId or model" }),
        { status: 400 }
      )
    }

    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    // Verify user owns this chat
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      })
    }

    // Check chat ownership before updating
    const { data: chat } = await supabase
      .from("chats")
      .select("user_id")
      .eq("id", chatId)
      .single()

    if (!chat || chat.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
      })
    }

    // Normalize model ID for backwards compatibility (e.g., grok-4-fast → grok-4.1-fast)
    const normalizedModel = normalizeModelId(model)

    const { error } = await supabase
      .from("chats")
      .update({ model: normalizedModel })
      .eq("id", chatId)
      .eq("user_id", user.id)

    if (error) {
      console.error("Error updating chat model:", error)
      return new Response(
        JSON.stringify({
          error: "Failed to update chat model",
          details: error.message,
        }),
        { status: 500 }
      )
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    })
  } catch (err: unknown) {
    console.error("Error in update-chat-model endpoint:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
