import type { ContentPart, Message } from "@/app/types/api.types"
import type { Database, Json } from "@/app/types/database.types"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any
import { MAX_TOOL_RESULT_SIZE } from "@/lib/config"

const DEFAULT_STEP = 0

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

export async function saveFinalAssistantMessage(
  supabase: AnySupabaseClient,
  chatId: string,
  messages: Message[],
  message_group_id?: string,
  model?: string
) {
  const parts: ContentPart[] = []
  const toolMap = new Map<string, ContentPart>()
  const textParts: string[] = []

  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          textParts.push(part.text || "")
          parts.push(part)
        } else if (part.type === "tool-invocation" && part.toolInvocation) {
          const { toolCallId, state } = part.toolInvocation
          if (!toolCallId) continue

          const existing = toolMap.get(toolCallId)
          if (state === "result" || !existing) {
            toolMap.set(toolCallId, {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                args: part.toolInvocation?.args || {},
                // Truncate large results to prevent payload errors
                result: truncateToolResult(part.toolInvocation?.result),
              },
            })
          }
        } else if (part.type === "reasoning") {
          parts.push({
            type: "reasoning",
            reasoning: part.text || "",
            details: [
              {
                type: "text",
                text: part.text || "",
              },
            ],
          })
        } else if (part.type === "step-start") {
          parts.push(part)
        }
      }
    } else if (msg.role === "tool" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "tool-result") {
          const toolCallId = part.toolCallId || ""
          toolMap.set(toolCallId, {
            type: "tool-invocation",
            toolInvocation: {
              state: "result",
              step: DEFAULT_STEP,
              toolCallId,
              toolName: part.toolName || "",
              // Truncate large results to prevent payload errors
              result: truncateToolResult(part.result),
            },
          })
        }
      }
    }
  }

  // Merge tool parts at the end
  parts.push(...toolMap.values())

  const finalPlainText = textParts.join("\n\n")

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
