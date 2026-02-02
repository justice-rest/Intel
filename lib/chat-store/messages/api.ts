import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import type { UIMessage as MessageAISDK, UIMessagePart, UIDataTypes, UITools } from "ai"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"
import type { AppMessage, Attachment } from "@/app/types/message.types"
import { toAppMessage } from "@/app/types/message.types"

// Re-export for backward compatibility
export type ExtendedMessageAISDK = AppMessage

/**
 * Extract text content from message parts array
 * Used when content field is empty but parts have data
 */
function extractContentFromParts(parts: unknown[] | null): string {
  if (!parts || !Array.isArray(parts) || parts.length === 0) return ""

  const texts: string[] = []
  for (const part of parts) {
    if (part && typeof part === "object") {
      const p = part as { type?: string; text?: string }
      if (p.type === "text" && typeof p.text === "string" && p.text.trim()) {
        texts.push(p.text)
      }
    }
  }
  return texts.join("\n")
}

/**
 * Get effective content, preferring content field but falling back to parts
 * This ensures messages always have non-empty content for xAI/Grok
 */
function getEffectiveContent(content: string | null, parts: unknown[] | null, role: string): string {
  // If content has text, use it
  if (content && content.trim()) {
    return content
  }

  // Try to extract from parts
  const partsContent = extractContentFromParts(parts)
  if (partsContent) {
    return partsContent
  }

  // Fallback placeholder to prevent xAI empty content errors
  return role === "assistant" ? "[Assistant response]" : "[User message]"
}

export async function getMessagesFromDb(
  chatId: string
): Promise<AppMessage[]> {
  // fallback to local cache only
  if (!isSupabaseEnabled) {
    const cached = await getCachedMessages(chatId)
    return cached
  }

  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, content, role, experimental_attachments, created_at, parts, message_group_id, model, user_id"
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  if (!data || error) {
    console.error("Failed to fetch messages:", error)
    // Fall back to cached messages instead of returning empty
    const cached = await getCachedMessages(chatId)
    return cached
  }

  return data.map((message) => {
    // Get effective content from DB (prioritize content field, fallback to parts)
    const content = getEffectiveContent(
      message.content as string | null,
      message.parts as unknown[] | null,
      message.role as string
    )

    // Build parts array for v5 compatibility
    const parts: UIMessagePart<UIDataTypes, UITools>[] = (message.parts as UIMessagePart<UIDataTypes, UITools>[]) || []
    if (parts.length === 0 && content) {
      parts.push({ type: "text", text: content })
    }

    return {
      id: String(message.id),
      role: message.role as "user" | "assistant" | "system",
      parts,
      // Legacy fields for backward compatibility
      content,
      createdAt: new Date((message.created_at as string) || ""),
      experimental_attachments: message.experimental_attachments as Attachment[] | undefined,
      message_group_id: message.message_group_id as string | undefined,
      model: message.model as string | undefined,
      user_id: message.user_id as string | undefined,
    } as AppMessage
  })
}

export async function getLastMessagesFromDb(
  chatId: string,
  limit: number = 2
): Promise<AppMessage[]> {
  if (!isSupabaseEnabled) {
    const cached = await getCachedMessages(chatId)
    return cached.slice(-limit)
  }

  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, content, role, experimental_attachments, created_at, parts, message_group_id, model, user_id"
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (!data || error) {
    console.error("Failed to fetch last messages: ", error)
    return []
  }

  const ascendingData = [...data].reverse()
  return ascendingData.map((message) => {
    const content = getEffectiveContent(
      message.content as string | null,
      message.parts as unknown[] | null,
      message.role as string
    )

    const parts: UIMessagePart<UIDataTypes, UITools>[] = (message.parts as UIMessagePart<UIDataTypes, UITools>[]) || []
    if (parts.length === 0 && content) {
      parts.push({ type: "text", text: content })
    }

    return {
      id: String(message.id),
      role: message.role as "user" | "assistant" | "system",
      parts,
      content,
      createdAt: new Date(message.created_at || ""),
      experimental_attachments: message.experimental_attachments as Attachment[] | undefined,
      message_group_id: message.message_group_id,
      model: message.model,
      user_id: message.user_id as string | undefined,
    } as AppMessage
  })
}

async function insertMessageToDb(
  chatId: string,
  message: ExtendedMessageAISDK
) {
  const supabase = createClient()
  if (!supabase) return

  await supabase.from("messages").insert({
    chat_id: chatId,
    role: message.role,
    content: message.content,
    experimental_attachments: message.experimental_attachments as any,
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: message.message_group_id || null,
    model: message.model || null,
  } as any)
}

async function insertMessagesToDb(
  chatId: string,
  messages: ExtendedMessageAISDK[]
) {
  const supabase = createClient()
  if (!supabase) return

  const payload = messages.map((message) => ({
    chat_id: chatId,
    role: message.role,
    content: message.content,
    experimental_attachments: message.experimental_attachments,
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: message.message_group_id || null,
    model: message.model || null,
  }))

  await supabase.from("messages").insert(payload as any)
}

async function deleteMessagesFromDb(chatId: string) {
  const supabase = createClient()
  if (!supabase) return

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId)

  if (error) {
    console.error("Failed to clear messages from database:", error)
  }
}

type ChatMessageEntry = {
  id: string
  messages: AppMessage[]
}

export async function getCachedMessages(
  chatId: string
): Promise<AppMessage[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messages: AppMessage[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function addMessage(
  chatId: string,
  message: AppMessage
): Promise<void> {
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: AppMessage[]
): Promise<void> {
  await insertMessagesToDb(chatId, messages)
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}
