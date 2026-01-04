import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/prompt-kit/chat-container"
import { TextShimmer } from "@/components/prompt-kit/loader"
import { MessageContent } from "@/components/prompt-kit/message"
import { NewMessagesIndicator } from "@/components/prompt-kit/new-messages-indicator"
import { ScrollButton } from "@/components/prompt-kit/scroll-button"
import { ExtendedMessageAISDK } from "@/lib/chat-store/messages/api"
import { cn } from "@/lib/utils"
import { Message as MessageType } from "@ai-sdk/react"
import { useRef, useEffect, useCallback, useMemo } from "react"
import { Message } from "./message"
import { useReadReceiptsContext, usePresenceOptional, type StreamingContent } from "@/lib/presence"
import { Reasoning } from "./reasoning"
import { ToolInvocation } from "./tool-invocation"
import { useUserPreferences } from "@/lib/user-preference-store/provider"

/**
 * CollaboratorStreamingMessage
 * Displays real-time AI streaming content from a collaborator
 * Shows as a distinct message with collaborator attribution and live streaming indicator
 */
function CollaboratorStreamingMessage({ streaming }: { streaming: StreamingContent }) {
  const { preferences } = useUserPreferences()

  // Extract reasoning and tool invocations from parts if available
  const parts = streaming.parts as MessageType["parts"] | undefined
  const reasoningParts = parts?.find((part) => part.type === "reasoning")
  const toolInvocationParts = parts?.filter((part) => part.type === "tool-invocation")

  // Get initials for avatar fallback (with safeguard for empty names)
  const displayName = streaming.display_name || "User"
  const initials = displayName
    .split(" ")
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U"

  return (
    <div className="group min-h-scroll-anchor flex w-full max-w-3xl flex-col items-start gap-2 px-6 pb-2 animate-in fade-in duration-200">
      {/* Collaborator attribution header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="size-5 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 ring-2 ring-blue-500/30">
          <span className="text-[8px] font-medium text-muted-foreground">
            {initials}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {displayName}&apos;s AI
        </span>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
      </div>

      {/* Content area - matches MessageAssistant styling */}
      <div className="relative flex min-w-full flex-col gap-2 pb-8">
        {/* Reasoning section if available */}
        {reasoningParts && reasoningParts.reasoning && (
          <Reasoning
            reasoning={reasoningParts.reasoning}
            isStreaming={true}
          />
        )}

        {/* Tool invocations if available and user has preference enabled */}
        {toolInvocationParts &&
          toolInvocationParts.length > 0 &&
          preferences.showToolInvocations && (
            <ToolInvocation toolInvocations={toolInvocationParts} />
          )}

        {/* Main content */}
        {streaming.content && (
          <MessageContent
            className={cn(
              "prose dark:prose-invert relative min-w-full bg-transparent p-0",
              "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
            )}
            markdown={true}
          >
            {streaming.content}
          </MessageContent>
        )}

        {/* Show thinking indicator if no content yet */}
        {!streaming.content && !reasoningParts && !toolInvocationParts?.length && (
          <TextShimmer text={`${displayName}'s AI is thinking`} size="md" />
        )}
      </div>
    </div>
  )
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
  const lastMarkedMessageId = useRef<number>(0)
  const readReceiptsContext = useReadReceiptsContext()
  const presenceContext = usePresenceOptional()

  // Get collaborator streaming content (real-time AI response from another user)
  const collaboratorStreaming = presenceContext?.collaboratorStreaming

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
                createdAt={message.createdAt instanceof Date ? message.createdAt : undefined}
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
          {/* Display collaborator's streaming AI response in real-time */}
          {collaboratorStreaming && (
            <CollaboratorStreamingMessage streaming={collaboratorStreaming} />
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
