import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import type { Message as MessageAISDK } from "ai"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

export interface ExtendedMessageAISDK extends MessageAISDK {
  message_group_id?: string
  model?: string
  /** The user ID who sent this message (for collaborative chats) */
  user_id?: string
}

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
): Promise<MessageAISDK[]> {
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

  return data.map((message) => ({
    id: String(message.id),
    role: message.role as MessageAISDK["role"],
    // Use getEffectiveContent to ensure non-empty content for xAI/Grok
    content: getEffectiveContent(
      message.content as string | null,
      message.parts as unknown[] | null,
      message.role as string
    ),
    createdAt: new Date((message.created_at as string) || ""),
    experimental_attachments: message.experimental_attachments as MessageAISDK["experimental_attachments"],
    parts: (message.parts as MessageAISDK["parts"]) || undefined,
    message_group_id: message.message_group_id as string | undefined,
    model: message.model as string | undefined,
    user_id: message.user_id as string | undefined,
  }))
}

export async function getLastMessagesFromDb(
  chatId: string,
  limit: number = 2
): Promise<MessageAISDK[]> {
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
  return ascendingData.map((message) => ({
    ...message,
    id: String(message.id),
    // Use getEffectiveContent to ensure non-empty content for xAI/Grok
    content: getEffectiveContent(
      message.content as string | null,
      message.parts as unknown[] | null,
      message.role as string
    ),
    createdAt: new Date(message.created_at || ""),
    parts: (message?.parts as MessageAISDK["parts"]) || undefined,
    message_group_id: message.message_group_id,
    model: message.model,
    user_id: message.user_id as string | undefined,
  }))
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
    experimental_attachments: message.experimental_attachments,
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: message.message_group_id || null,
    model: message.model || null,
  })
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

  await supabase.from("messages").insert(payload)
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
  messages: MessageAISDK[]
}

export async function getCachedMessages(
  chatId: string
): Promise<MessageAISDK[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messages: MessageAISDK[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function addMessage(
  chatId: string,
  message: MessageAISDK
): Promise<void> {
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: MessageAISDK[]
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
