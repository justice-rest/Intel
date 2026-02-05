import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import type { Database, Json } from "@/app/types/database.types"
import type { ChatMessage, ChatMessagePart } from "@/lib/ai/message-utils"
import {
  attachmentsToFileParts,
  getMessageAttachments,
  getMessageCreatedAt,
  getMessageParts,
  getMessageText,
} from "@/lib/ai/message-utils"
import type { Attachment } from "@/lib/file-handling"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

export type ExtendedChatMessage = ChatMessage

function filterStoredAttachments(attachments?: Attachment[] | null): Attachment[] {
  if (!attachments) return []
  return attachments.filter(
    (attachment) => attachment?.url && !attachment.url.startsWith("blob:")
  )
}

function buildMessageParts(options: {
  content: string | null
  parts: unknown[] | null
  attachments: Attachment[] | null
  role: string
}): ChatMessagePart[] {
  const baseParts = Array.isArray(options.parts)
    ? (options.parts as ChatMessagePart[])
    : []

  const attachmentParts = attachmentsToFileParts(
    filterStoredAttachments(options.attachments)
  )

  const combined = [...baseParts, ...attachmentParts]
  const hasText = combined.some(
    (part) =>
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "text" &&
      typeof (part as { text?: string }).text === "string" &&
      (part as { text?: string }).text?.trim()
  )

  const fallbackText =
    options.content?.trim() ||
    (options.role === "assistant" ? "[Assistant response]" : "[User message]")

  if (!hasText) {
    combined.unshift({ type: "text", text: fallbackText })
  }

  return combined
}

export async function getMessagesFromDb(
  chatId: string
): Promise<ChatMessage[]> {
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
    const parts = buildMessageParts({
      content: message.content as string | null,
      parts: message.parts as unknown[] | null,
      attachments: message.experimental_attachments as Attachment[] | null,
      role: message.role as string,
    })

    return {
      id: String(message.id),
      role: message.role as ChatMessage["role"],
      parts,
      metadata: {
        createdAt: (message.created_at as string) || new Date().toISOString(),
        message_group_id: message.message_group_id as string | null | undefined,
        model: message.model as string | undefined,
        user_id: message.user_id as string | undefined,
      },
    }
  })
}

export async function getLastMessagesFromDb(
  chatId: string,
  limit: number = 2
): Promise<ChatMessage[]> {
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
    const parts = buildMessageParts({
      content: message.content as string | null,
      parts: message.parts as unknown[] | null,
      attachments: message.experimental_attachments as Attachment[] | null,
      role: message.role as string,
    })

    return {
      id: String(message.id),
      role: message.role as ChatMessage["role"],
      parts,
      metadata: {
        createdAt: (message.created_at as string) || new Date().toISOString(),
        message_group_id: message.message_group_id as string | null | undefined,
        model: message.model as string | undefined,
        user_id: message.user_id as string | undefined,
      },
    }
  })
}

async function insertMessageToDb(
  chatId: string,
  message: ExtendedChatMessage
) {
  const supabase = createClient()
  if (!supabase) return

  const createdAt = getMessageCreatedAt(message)?.toISOString() || new Date().toISOString()
  const content = getMessageText(message)
  const attachments = getMessageAttachments(message)

  const payload: Database["public"]["Tables"]["messages"]["Insert"] = {
    chat_id: chatId,
    role: message.role,
    content,
    parts: getMessageParts(message) as Json,
    experimental_attachments: attachments.length > 0 ? attachments : undefined,
    created_at: createdAt,
    message_group_id: message.metadata?.message_group_id || null,
    model: message.metadata?.model || null,
    user_id: message.metadata?.user_id || null,
  }

  await supabase.from("messages").insert(payload)
}

async function insertMessagesToDb(
  chatId: string,
  messages: ExtendedChatMessage[]
) {
  const supabase = createClient()
  if (!supabase) return

  const payload: Database["public"]["Tables"]["messages"]["Insert"][] = messages.map((message) => {
    const createdAt = getMessageCreatedAt(message)?.toISOString() || new Date().toISOString()
    const content = getMessageText(message)
    const attachments = getMessageAttachments(message)

    return {
      chat_id: chatId,
      role: message.role,
      content,
      parts: getMessageParts(message) as Json,
      experimental_attachments: attachments.length > 0 ? attachments : undefined,
      created_at: createdAt,
      message_group_id: message.metadata?.message_group_id || null,
      model: message.metadata?.model || null,
      user_id: message.metadata?.user_id || null,
    }
  })

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
  messages: ChatMessage[]
}

export async function getCachedMessages(
  chatId: string
): Promise<ChatMessage[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort((a, b) => {
    const aTime = getMessageCreatedAt(a)?.getTime() || 0
    const bTime = getMessageCreatedAt(b)?.getTime() || 0
    return aTime - bTime
  })
}

export async function cacheMessages(
  chatId: string,
  messages: ChatMessage[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function addMessage(
  chatId: string,
  message: ChatMessage
): Promise<void> {
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: ChatMessage[]
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
