import { getLastMessagesFromDb } from "@/lib/chat-store/messages/api"
import { writeToIndexedDB } from "@/lib/chat-store/persist"
import type { ChatMessage } from "@/lib/ai/message-utils"
import { coerceMessageMetadata, getMessageCreatedAt } from "@/lib/ai/message-utils"

export async function syncRecentMessages<T extends ChatMessage>(
  chatId: string,
  setMessages: (updater: (prev: T[]) => T[]) => void,
  count: number = 2
): Promise<void> {
  const lastFromDb = await getLastMessagesFromDb(chatId, count)
  if (!lastFromDb || lastFromDb.length === 0) return

  setMessages((prev) => {
    if (!prev || prev.length === 0) return prev

    const updated = [...prev]
    let changed = false

    // Pair from the end; for each DB message (last to first),
    for (let d = lastFromDb.length - 1; d >= 0; d--) {
      const dbMsg = lastFromDb[d]
      const dbRole = dbMsg.role

      for (let i = updated.length - 1; i >= 0; i--) {
        const local = updated[i]
        if (local.role !== dbRole) continue

        if (String(local.id) !== String(dbMsg.id)) {
          const createdAt = getMessageCreatedAt(dbMsg)?.toISOString()
          updated[i] = coerceMessageMetadata(
            { ...local, id: String(dbMsg.id) },
            createdAt ? { createdAt } : {}
          ) as typeof updated[number]
          changed = true
        }
        break
      }
    }

    if (changed) {
      writeToIndexedDB("messages", { id: chatId, messages: updated })
      return updated
    }

    return prev
  })
}
