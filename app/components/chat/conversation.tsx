import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/prompt-kit/chat-container"
import { TextShimmer } from "@/components/prompt-kit/loader"
import { ScrollButton } from "@/components/prompt-kit/scroll-button"
import { ExtendedMessageAISDK } from "@/lib/chat-store/messages/api"
import { Message as MessageType } from "@ai-sdk/react"
import { useRef, useEffect, useCallback } from "react"
import { Message } from "./message"
import { useReadReceiptsContext } from "@/lib/presence"

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
  const lastMarkedMessageId = useRef<number>(0)
  const readReceiptsContext = useReadReceiptsContext()

  // Auto-mark messages as read when viewing
  // Only marks the last message to avoid excessive API calls
  const markLastMessageAsRead = useCallback(() => {
    if (!readReceiptsContext || !messages.length) return

    // Get the last assistant message's ID (user wants to know when their messages are read by others)
    // Actually, we should mark ALL messages as read when scrolling to the bottom
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) return

    // Parse the numeric ID
    const lastMessageId = parseInt(lastMessage.id, 10)
    if (isNaN(lastMessageId)) return

    // Skip if we've already marked this message
    if (lastMessageId <= lastMarkedMessageId.current) return

    // Mark as read
    lastMarkedMessageId.current = lastMessageId
    readReceiptsContext.markAsRead(lastMessageId).catch((err) => {
      console.error("[read-receipts] Failed to mark as read:", err)
      // Reset so we can retry
      lastMarkedMessageId.current = 0
    })
  }, [readReceiptsContext, messages])

  // Mark messages as read when:
  // 1. Component mounts with messages
  // 2. New messages arrive (status changes to ready)
  // 3. Window regains focus
  useEffect(() => {
    if (status !== "ready" || !messages.length) return

    // Mark after a short delay to ensure the user has seen the messages
    const timeoutId = setTimeout(markLastMessageAsRead, 1000)

    return () => clearTimeout(timeoutId)
  }, [status, messages.length, markLastMessageAsRead])

  // Also mark on window focus
  useEffect(() => {
    if (!readReceiptsContext) return

    const handleFocus = () => {
      // Mark after a short delay
      setTimeout(markLastMessageAsRead, 500)
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [markLastMessageAsRead, readReceiptsContext])

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

            return (
              <Message
                key={message.id}
                id={message.id}
                variant={message.role}
                attachments={message.experimental_attachments}
                isLast={isLast}
                onDelete={onDelete}
                onEdit={onEdit}
                onReload={onReload}
                hasScrollAnchor={hasScrollAnchor}
                parts={message.parts}
                status={status}
                onQuote={onQuote}
                messageGroupId={
                  (message as ExtendedMessageAISDK).message_group_id ?? null
                }
                isUserAuthenticated={isUserAuthenticated}
                userId={(message as ExtendedMessageAISDK).user_id}
              >
                {message.content}
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
          <div className="absolute bottom-0 flex w-full max-w-3xl flex-1 items-end justify-end gap-4 px-6 pb-2">
            <ScrollButton className="absolute top-[-50px] right-[30px]" />
          </div>
        </ChatContainerContent>
      </ChatContainerRoot>
    </div>
  )
}
