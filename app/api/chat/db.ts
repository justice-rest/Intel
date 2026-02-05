import type { Database, Json } from "@/app/types/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"
import { MAX_TOOL_RESULT_SIZE } from "@/lib/config"
import type { ChatMessage, ChatMessagePart, LegacyToolInvocationPart } from "@/lib/ai/message-utils"
import { getMessageParts, getMessageText } from "@/lib/ai/message-utils"

/**
 * Truncate large tool results to prevent database payload size errors
 */
function truncateToolResult(result: any): any {
  if (!result) return result

  if (typeof result === "string" && result.length > MAX_TOOL_RESULT_SIZE) {
    return (
      result.substring(0, MAX_TOOL_RESULT_SIZE) +
      "\n\n[Content truncated due to size limit]"
    )
  }

  if (typeof result === "object") {
    const truncated = { ...result }

    // Truncate common large fields
    const fields = ["content", "text", "results", "data", "body", "html"]
    for (const field of fields) {
      if (truncated[field] && typeof truncated[field] === "string") {
        const content = truncated[field] as string
        if (content.length > MAX_TOOL_RESULT_SIZE) {
          truncated[field] =
            content.substring(0, MAX_TOOL_RESULT_SIZE) +
            "\n\n[Content truncated due to size limit]"
        }
      }
    }

    // Truncate array results
    if (Array.isArray(truncated.results)) {
      let totalSize = 0
      truncated.results = truncated.results.filter((item: any) => {
        const size = JSON.stringify(item).length
        totalSize += size
        return totalSize <= MAX_TOOL_RESULT_SIZE
      })
    }

    return truncated
  }

  return result
}

function normalizeParts(parts: ChatMessagePart[]): ChatMessagePart[] {
  return parts.map((part) => {
    if (!part || typeof part !== "object" || !(("type" in part))) return part

    if (part.type === "tool-invocation") {
      const toolInvocation = (part as LegacyToolInvocationPart).toolInvocation
      if (toolInvocation?.result) {
        return {
          ...part,
          toolInvocation: {
            ...toolInvocation,
            result: truncateToolResult(toolInvocation.result),
          },
        } as LegacyToolInvocationPart
      }
    }

    if (typeof part.type === "string" && (part.type.startsWith("tool-") || part.type === "dynamic-tool")) {
      if ("output" in part && (part as { output?: unknown }).output !== undefined) {
        return {
          ...part,
          output: truncateToolResult((part as { output?: unknown }).output),
        }
      }
      if ("errorText" in part && typeof (part as { errorText?: unknown }).errorText === "string") {
        return {
          ...part,
          errorText: truncateToolResult((part as { errorText?: string }).errorText),
        }
      }
    }

    return part
  })
}

export async function saveFinalAssistantMessage(
  supabase: SupabaseClient<Database>,
  chatId: string,
  messages: ChatMessage[],
  message_group_id?: string,
  model?: string
) {
  const assistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant")

  if (!assistantMessage) {
    console.warn("No assistant message found to save.")
    return
  }

  const parts = normalizeParts(getMessageParts(assistantMessage))
  const finalPlainText = getMessageText(assistantMessage)

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      role: "assistant",
      content: finalPlainText || "",
      parts: parts as unknown as Json,
      message_group_id,
      model,
    })
    .select("id")
    .single()

  if (error) {
    console.error("Error saving final assistant message:", error)
    throw new Error(`Failed to save assistant message: ${error.message}`)
  }

  console.log("Assistant message saved successfully (merged).")
  return { messageId: String(data?.id), content: finalPlainText }
}
