import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/prompt-kit/chat-container"
import { ScrollButton } from "@/components/prompt-kit/scroll-button"
import { ExtendedMessageAISDK } from "@/lib/chat-store/messages/api"
import { Message as MessageType } from "@ai-sdk/react"
import { useRef } from "react"
import { Message } from "./message"
import { ResponseTimeEstimate } from "./response-time-estimate"

type ConversationProps = {
  messages: MessageType[]
  status?: "streaming" | "ready" | "submitted" | "error"
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onReload: () => void
  onQuote?: (text: string, messageId: string) => void
  isUserAuthenticated?: boolean
  enableSearch?: boolean
  responseStartTime?: number | null
}

export function Conversation({
  messages,
  status = "ready",
  onDelete,
  onEdit,
  onReload,
  onQuote,
  isUserAuthenticated,
  enableSearch = false,
  responseStartTime,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length)

  if (!messages || messages.length === 0)
    return <div className="h-full w-full"></div>

  // Determine if we should show the loader and time estimate
  // Show when: submitted OR streaming but no text content yet (tools still running)
  const lastMessage = messages[messages.length - 1]
  const isWaitingForTextResponse =
    status === "submitted" ||
    (status === "streaming" &&
      messages.length > 0 &&
      (lastMessage?.role === "user" ||
        (lastMessage?.role === "assistant" && !lastMessage.content?.trim())))

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
            // Don't mark as "last" when loader is showing (scroll anchor goes to loader)
            const isLast =
              index === messages.length - 1 && !isWaitingForTextResponse
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
              >
                {message.content}
              </Message>
            )
          })}
          {isWaitingForTextResponse && (
            <div className="group min-h-scroll-anchor flex w-full max-w-3xl flex-col items-start gap-2 px-6 pb-2">
              <ResponseTimeEstimate
                isActive={isWaitingForTextResponse}
                enableSearch={enableSearch}
                startTime={responseStartTime ?? null}
              />
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
