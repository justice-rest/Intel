import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/prompt-kit/chat-container"
import { TextShimmer } from "@/components/prompt-kit/loader"
import { NewMessagesIndicator } from "@/components/prompt-kit/new-messages-indicator"
import { ScrollButton } from "@/components/prompt-kit/scroll-button"
import { ExtendedMessageAISDK } from "@/lib/chat-store/messages/api"
import type { UIMessage as MessageType } from "@ai-sdk/react"
import { useRef } from "react"
import { Message } from "./message"

// Helper to extract text content from v6 parts array
function extractContent(message: MessageType | ExtendedMessageAISDK): string {
  // Try legacy content field first
  const extMsg = message as ExtendedMessageAISDK
  if (typeof extMsg.content === "string" && extMsg.content) {
    return extMsg.content
  }
  // Extract from parts array (v6 format)
  if (message.parts && Array.isArray(message.parts)) {
    const textParts = message.parts
      .filter((p: any) => p?.type === "text" && p?.text)
      .map((p: any) => p.text)
    return textParts.join("\n")
  }
  return ""
}

type ConversationProps = {
  messages: MessageType[]
  status?: "streaming" | "ready" | "submitted" | "error"
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onReload: () => void
  onQuote?: (text: string, messageId: string) => void
  isUserAuthenticated?: boolean
  isLoading?: boolean
}

export function Conversation({
  messages,
  status = "ready",
  onDelete,
  onEdit,
  onReload,
  onQuote,
  isUserAuthenticated,
  isLoading,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length)

  // Show loading state when loading messages for an existing chat
  if (isLoading && (!messages || messages.length === 0)) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <TextShimmer text="Loading messages" size="md" />
      </div>
    )
  }

  if (!messages || messages.length === 0)
    return <div className="h-full w-full"></div>

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto animate-in fade-in duration-200">
      <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
        <div className="h-app-header bg-background flex w-full lg:hidden lg:h-0" />
        <div className="h-app-header bg-background flex w-full mask-b-from-4% mask-b-to-100% lg:hidden" />
      </div>
      <ChatContainerRoot className="relative w-full">
        <ChatContainerContent
          className="flex w-full flex-col items-center pt-20 pb-4"
          style={{
            scrollbarGutter: "stable both-edges",
            scrollbarWidth: "none",
          }}
        >
          {messages?.map((message, index) => {
            const isLast =
              index === messages.length - 1 && status !== "submitted"
            const hasScrollAnchor =
              isLast && messages.length > initialMessageCount.current
            // Cast to ExtendedMessageAISDK for v6 compatibility fields
            const extMsg = message as ExtendedMessageAISDK
            const createdAtValue = extMsg.createdAt
            const createdAtDate = createdAtValue instanceof Date
              ? createdAtValue
              : typeof createdAtValue === "string"
                ? new Date(createdAtValue)
                : undefined

            return (
              <Message
                key={message.id}
                id={message.id}
                variant={message.role}
                attachments={extMsg.experimental_attachments as any}
                isLast={isLast}
                onDelete={onDelete}
                onEdit={onEdit}
                onReload={onReload}
                hasScrollAnchor={hasScrollAnchor}
                parts={message.parts}
                status={status}
                onQuote={onQuote}
                messageGroupId={extMsg.message_group_id ?? null}
                isUserAuthenticated={isUserAuthenticated}
                createdAt={createdAtDate}
              >
                {extractContent(message)}
              </Message>
            )
          })}
          {status === "submitted" &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <div className="group min-h-scroll-anchor flex w-full max-w-3xl flex-col items-start gap-2 px-6 pb-2">
                <TextShimmer text="Thinking" size="md" />
              </div>
            )}
          <div className="absolute bottom-0 flex w-full max-w-3xl flex-1 items-end justify-center gap-4 px-6 pb-2">
            <NewMessagesIndicator
              className="absolute top-[-50px]"
              messageCount={messages.length}
            />
            <ScrollButton className="absolute top-[-50px] right-[30px]" />
          </div>
        </ChatContainerContent>
      </ChatContainerRoot>
    </div>
  )
}
