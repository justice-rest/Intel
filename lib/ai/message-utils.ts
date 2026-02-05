import type {
  UIDataTypes,
  UIMessage,
  UIMessagePart,
  UITools,
  FileUIPart,
  TextUIPart,
  DynamicToolUIPart,
  ToolUIPart,
} from "ai"
import type { Attachment } from "@/lib/file-handling"

export type ChatMessageMetadata = {
  createdAt?: string
  message_group_id?: string | null
  model?: string
  user_id?: string
}


export type LegacyToolInvocationPart = {
  type: "tool-invocation"
  toolInvocation: {
    state: "partial-call" | "call" | "result"
    step?: number
    toolCallId: string
    toolName: string
    args?: unknown
    result?: unknown
  }
}

export type LegacyReasoningPart = {
  type: "reasoning"
  reasoning?: string
  text?: string
  details?: unknown
}

export type LegacySourcePart = {
  type: "source"
  source: {
    id?: string
    url: string
    title?: string
    text?: string
  }
}

export type ChatMessagePart =
  | UIMessagePart<UIDataTypes, UITools>
  | LegacyToolInvocationPart
  | LegacyReasoningPart
  | LegacySourcePart

export type ChatMessage = Omit<UIMessage<ChatMessageMetadata>, "parts"> & {
  parts?: ChatMessagePart[]
}

const TOOL_TYPE_PREFIX = "tool-"

export function getMessageParts(
  message: ChatMessage | (ChatMessage & { content?: unknown; parts?: unknown })
): ChatMessagePart[] {
  const rawParts = (message as { parts?: unknown }).parts
  if (Array.isArray(rawParts)) return rawParts as ChatMessagePart[]

  const rawContent = (message as { content?: unknown }).content
  if (typeof rawContent === "string" && rawContent.trim()) {
    return [{ type: "text", text: rawContent }]
  }

  if (Array.isArray(rawContent)) {
    return rawContent as ChatMessagePart[]
  }

  return []
}

export function getMessageText(
  message: ChatMessage | (ChatMessage & { content?: unknown; parts?: unknown })
): string {
  const parts = getMessageParts(message)
  const texts: string[] = []

  for (const part of parts) {
    if (part && typeof part === "object" && "type" in part) {
      if (part.type === "text" && "text" in part && typeof part.text === "string") {
        if (part.text.trim()) texts.push(part.text)
      }
    }
  }

  if (texts.length > 0) {
    return texts.join("\n")
  }

  const rawContent = (message as { content?: unknown }).content
  if (typeof rawContent === "string") {
    return rawContent
  }

  return ""
}

export function getMessageCreatedAt(
  message: ChatMessage | (ChatMessage & { createdAt?: unknown })
): Date | undefined {
  const metadata = (message as ChatMessage).metadata
  if (metadata?.createdAt) {
    const parsed = new Date(metadata.createdAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  const legacyCreatedAt = (message as { createdAt?: unknown }).createdAt
  if (legacyCreatedAt instanceof Date) return legacyCreatedAt
  if (typeof legacyCreatedAt === "string") {
    const parsed = new Date(legacyCreatedAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return undefined
}

export function updateMessageText(message: ChatMessage, newText: string): ChatMessage {
  const parts = getMessageParts(message)
  const nextParts = [...parts]
  const index = nextParts.findIndex(
    (part) => part && typeof part === "object" && "type" in part && part.type === "text"
  )

  if (index >= 0) {
    nextParts[index] = {
      ...(nextParts[index] as TextUIPart),
      text: newText,
    }
  } else {
    nextParts.unshift({ type: "text", text: newText })
  }

  return {
    ...message,
    parts: nextParts,
  }
}

export function attachmentsToFileParts(attachments: Attachment[]): FileUIPart[] {
  return attachments.map((attachment) => ({
    type: "file",
    url: attachment.url,
    mediaType: attachment.contentType || "application/octet-stream",
    filename: attachment.name,
  }))
}

export function filePartsToAttachments(parts: ChatMessagePart[]): Attachment[] {
  const attachments: Attachment[] = []

  for (const part of parts) {
    if (part && typeof part === "object" && "type" in part && part.type === "file") {
      const filePart = part as FileUIPart
      const url = filePart.url
      if (!url) continue

      const nameFromUrl = (() => {
        try {
          const parsed = new URL(url)
          const last = parsed.pathname.split("/").pop()
          if (last) return last
        } catch {
          const fallback = url.split("/").pop()
          if (fallback) return fallback
        }
        return "attachment"
      })()

      attachments.push({
        name: filePart.filename || nameFromUrl,
        contentType: filePart.mediaType || "application/octet-stream",
        url,
      })
    }
  }

  return attachments
}

export function getMessageAttachments(
  message: ChatMessage | (ChatMessage & { experimental_attachments?: unknown })
): Attachment[] {
  const legacy = (message as { experimental_attachments?: unknown }).experimental_attachments
  if (Array.isArray(legacy)) {
    return legacy as Attachment[]
  }

  return filePartsToAttachments(getMessageParts(message))
}

export function getReasoningText(parts: ChatMessagePart[] | undefined): string | null {
  if (!parts) return null
  for (const part of parts) {
    if (part && typeof part === "object" && "type" in part && part.type === "reasoning") {
      const legacy = part as LegacyReasoningPart
      if (typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text
      }
      if (typeof legacy.reasoning === "string") {
        return legacy.reasoning
      }
    }
  }
  return null
}

function mapToolState(state: string | undefined): "partial-call" | "call" | "result" {
  if (!state) return "call"
  if (state === "input-streaming") return "partial-call"
  if (state.startsWith("input")) return "call"
  if (state.startsWith("output")) return "result"
  if (state.startsWith("approval")) return "call"
  return "call"
}

function normalizeToolPart(part: ToolUIPart | DynamicToolUIPart): LegacyToolInvocationPart {
  const isDynamic = part.type === "dynamic-tool"
  const toolName = isDynamic ? part.toolName : part.type.slice(TOOL_TYPE_PREFIX.length)
  const state = mapToolState(part.state)
  const args = (part as { input?: unknown }).input
  let result: unknown

  if (part.state?.startsWith("output")) {
    if ((part as { output?: unknown }).output !== undefined) {
      result = (part as { output?: unknown }).output
    } else if ((part as { errorText?: string }).errorText) {
      result = { error: (part as { errorText?: string }).errorText }
    }
  }

  if (part.state === "output-denied") {
    result = {
      denied: true,
      reason: (part as { approval?: { reason?: string } }).approval?.reason,
    }
  }

  return {
    type: "tool-invocation",
    toolInvocation: {
      state,
      step: 0,
      toolCallId: part.toolCallId,
      toolName,
      args,
      result,
    },
  }
}

export function getLegacyToolInvocationParts(
  parts: ChatMessagePart[] | undefined
): LegacyToolInvocationPart[] {
  if (!parts) return []

  const toolParts: LegacyToolInvocationPart[] = []

  for (const part of parts) {
    if (!part || typeof part !== "object" || !("type" in part)) continue

    if (part.type === "tool-invocation") {
      toolParts.push(part as LegacyToolInvocationPart)
      continue
    }

    if (part.type === "dynamic-tool" || (typeof part.type === "string" && part.type.startsWith(TOOL_TYPE_PREFIX))) {
      toolParts.push(normalizeToolPart(part as ToolUIPart | DynamicToolUIPart))
    }
  }

  return toolParts
}

export function coerceMessageMetadata(
  message: ChatMessage,
  metadata: ChatMessageMetadata
): ChatMessage {
  return {
    ...message,
    metadata: {
      ...(message.metadata || {}),
      ...metadata,
    },
  }
}
