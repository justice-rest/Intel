import { getLastMessagesFromDb } from "@/lib/chat-store/messages/api"
import { writeToIndexedDB } from "@/lib/chat-store/persist"
import type { UIMessage } from "ai"
import type { AppMessage } from "@/app/types/message.types"

export async function syncRecentMessages(
  chatId: string,
  setMessages: (updater: (prev: UIMessage[]) => UIMessage[]) => void,
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
        const local = updated[i] as AppMessage
        if (local.role !== dbRole) continue

        if (String(local.id) !== String(dbMsg.id)) {
          // Merge the DB message data with local message
          // Use spread to preserve parts while updating metadata
          const mergedMessage: AppMessage = {
            ...local,
            id: String(dbMsg.id),
            // Preserve createdAt from DB if available (AppMessage extension)
            createdAt: dbMsg.createdAt,
          }
          updated[i] = mergedMessage
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
