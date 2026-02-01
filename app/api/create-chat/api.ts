import { normalizeModelId } from "@/lib/models"
import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel } from "@/lib/usage"

type CreateChatInput = {
  userId: string
  title?: string
  model: string
  isAuthenticated: boolean
  projectId?: string
}

export async function createChatInDb({
  userId,
  title,
  model,
  isAuthenticated,
  projectId,
}: CreateChatInput) {
  // Normalize model ID for backwards compatibility (e.g., old model IDs → Gemini)
  const normalizedModel = normalizeModelId(model)

  const supabase = await validateUserIdentity(userId, isAuthenticated)
  if (!supabase) {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      model: normalizedModel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  await checkUsageByModel(supabase, userId, normalizedModel, isAuthenticated)

  const insertData: {
    user_id: string
    title: string
    model: string
    project_id?: string
  } = {
    user_id: userId,
    title: title || "New Chat",
    model: normalizedModel,
  }

  if (projectId) {
    insertData.project_id = projectId
  }

  const { data, error } = await supabase
    .from("chats")
    .insert(insertData)
    .select("*")
    .single()

  if (error || !data) {
    console.error("Error creating chat:", error)
    return null
  }

  return data
}
