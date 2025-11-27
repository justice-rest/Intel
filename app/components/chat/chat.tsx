"use client"

import { ChatInput } from "@/app/components/chat-input/chat-input"
import { Conversation } from "@/app/components/chat/conversation"
import { DropZone } from "@/app/components/split-view"
import { useModel } from "@/app/components/chat/use-model"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useChatId } from "@/lib/chat-store/session/use-chat-id"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { useSplitView } from "@/lib/split-view-store/provider"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useUser } from "@/lib/user-store/provider"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import dynamic from "next/dynamic"
import { redirect } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { useChatCore } from "./use-chat-core"
import { useChatOperations } from "./use-chat-operations"
import { useFileUpload } from "./use-file-upload"
import { useCustomer } from "autumn-js/react"

const FeedbackWidget = dynamic(
  () => import("./feedback-widget").then((mod) => mod.FeedbackWidget),
  { ssr: false }
)

const DialogAuth = dynamic(
  () => import("./dialog-auth").then((mod) => mod.DialogAuth),
  { ssr: false }
)

const DialogSubscriptionRequired = dynamic(
  () =>
    import("./dialog-subscription-required").then(
      (mod) => mod.DialogSubscriptionRequired
    ),
  { ssr: false }
)

const DialogLimitReached = dynamic(
  () => import("./dialog-limit-reached").then((mod) => mod.DialogLimitReached),
  { ssr: false }
)

interface ChatProps {
  showWelcome?: boolean
  firstName?: string | null
  onWelcomeDismiss?: () => void
  /** Override chatId for split view panels */
  chatIdOverride?: string | null
}

export function Chat({
  showWelcome,
  firstName,
  onWelcomeDismiss,
  chatIdOverride,
}: ChatProps = {}) {
  const contextChatId = useChatId()
  // Use override if provided (for split view), otherwise use context
  const chatId = chatIdOverride !== undefined ? chatIdOverride : contextChatId
  const { isActive: isSplitActive, activateSplit } = useSplitView()
  const {
    createNewChat,
    getChatById,
    updateChatModel,
    bumpChat,
    isLoading: isChatsLoading,
  } = useChats()

  // Handle drop event to activate split view
  const handleSplitDrop = useCallback(
    (droppedChatId: string) => {
      if (chatId && droppedChatId !== chatId) {
        activateSplit(chatId, droppedChatId)
      }
    },
    [chatId, activateSplit]
  )

  const currentChat = useMemo(
    () => (chatId ? getChatById(chatId) : null),
    [chatId, getChatById]
  )

  const { messages: initialMessages, cacheAndAddMessage } = useMessages()
  const { user } = useUser()
  const { preferences } = useUserPreferences()
  const { customer } = useCustomer()

  // Check if user has an active subscription (any paid plan, including trials)
  const productStatus = customer?.products?.[0]?.status
  const hasActiveSubscription =
    productStatus === "active" || productStatus === "trialing"
  const { draftValue, clearDraft } = useChatDraft(chatId)

  // File upload functionality
  const {
    files,
    setFiles,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
    handleFileUpload,
    handleFileRemove,
  } = useFileUpload()

  // Model selection
  const { selectedModel, handleModelChange } = useModel({
    currentChat: currentChat || null,
    user,
    updateChatModel,
    chatId,
  })

  // State to pass between hooks
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [hasDialogSubscriptionRequired, setHasDialogSubscriptionRequired] =
    useState(false)
  const [hasDialogLimitReached, setHasDialogLimitReached] = useState(false)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // New state for quoted text
  const [quotedText, setQuotedText] = useState<{
    text: string
    messageId: string
  }>()
  const handleQuotedSelected = useCallback(
    (text: string, messageId: string) => {
      setQuotedText({ text, messageId })
    },
    []
  )

  // Chat operations (utils + handlers) - created first
  const { checkLimitsAndNotify, ensureChatExists, handleDelete } =
    useChatOperations({
      isAuthenticated,
      chatId,
      messages: initialMessages,
      selectedModel,
      systemPrompt,
      createNewChat,
      setHasDialogAuth,
      setMessages: () => {},
      setInput: () => {},
    })

  // Core chat functionality (initialization + state + actions)
  const {
    messages,
    input,
    status,
    stop,
    hasSentFirstMessageRef,
    isSubmitting,
    enableSearch,
    setEnableSearch,
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
    submitEdit,
  } = useChatCore({
    initialMessages,
    draftValue,
    cacheAndAddMessage,
    chatId,
    user,
    files,
    createOptimisticAttachments,
    setFiles,
    checkLimitsAndNotify,
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    clearDraft,
    bumpChat,
    setHasDialogSubscriptionRequired,
    setHasDialogLimitReached,
  })

  // Memoize the conversation props to prevent unnecessary rerenders
  const conversationProps = useMemo(
    () => ({
      messages,
      status,
      onDelete: handleDelete,
      onEdit: submitEdit,
      onReload: handleReload,
      onQuote: handleQuotedSelected,
      isUserAuthenticated: isAuthenticated,
    }),
    [
      messages,
      status,
      handleDelete,
      submitEdit,
      handleReload,
      handleQuotedSelected,
      isAuthenticated,
    ]
  )

  // Memoize the chat input props
  const chatInputProps = useMemo(
    () => ({
      value: input,
      onSuggestion: handleSuggestion,
      onValueChange: handleInputChange,
      onSend: submit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      onSelectModel: handleModelChange,
      selectedModel,
      isUserAuthenticated: isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      quotedText,
      showWelcome,
      firstName,
      onWelcomeDismiss,
      hasActiveSubscription,
    }),
    [
      input,
      handleSuggestion,
      handleInputChange,
      submit,
      isSubmitting,
      files,
      handleFileUpload,
      handleFileRemove,
      handleModelChange,
      selectedModel,
      isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      quotedText,
      showWelcome,
      firstName,
      onWelcomeDismiss,
      hasActiveSubscription,
    ]
  )

  // Handle redirect for invalid chatId - only redirect if we're certain the chat doesn't exist
  // and we're not in a transient state during chat creation
  if (
    chatId &&
    !isChatsLoading &&
    !currentChat &&
    !isSubmitting &&
    status === "ready" &&
    messages.length === 0 &&
    !hasSentFirstMessageRef.current // Don't redirect if we've already sent a message in this session
  ) {
    return redirect("/")
  }

  const showOnboarding = !chatId && messages.length === 0

  return (
    <div
      className={cn(
        "@container/main relative flex h-full flex-col items-center justify-end md:justify-center"
      )}
    >
      {/* Drop zone for initiating split view - only show when not already in split mode */}
      {!isSplitActive && (
        <DropZone onDrop={handleSplitDrop} currentChatId={chatId} />
      )}

      <DialogAuth open={hasDialogAuth} setOpen={setHasDialogAuth} />
      <DialogSubscriptionRequired
        open={hasDialogSubscriptionRequired}
        setOpen={setHasDialogSubscriptionRequired}
      />
      <DialogLimitReached
        open={hasDialogLimitReached}
        setOpen={setHasDialogLimitReached}
      />

      <AnimatePresence initial={false} mode="popLayout">
        {showOnboarding ? (
          <motion.div
            key="onboarding"
            className="absolute bottom-[60%] mx-auto max-w-[50rem] md:relative md:bottom-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            layout="position"
            layoutId="onboarding"
            transition={{
              layout: {
                duration: 0,
              },
            }}
          >
            <h1 className="mb-6 text-xl sm:text-2xl md:text-3xl font-medium tracking-tight text-center md:text-left">
              Who should I search for
              <AnimatePresence mode="wait">
                {firstName ? (
                  <motion.span
                    key="name"
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(4px)" }}
                    transition={{ duration: 0.2 }}
                  >
                    , {firstName.split(" ")[0]}
                  </motion.span>
                ) : null}
              </AnimatePresence>
              ?
            </h1>
          </motion.div>
        ) : (
          <motion.div
            key={chatId || "new-chat"}
            className="h-full w-full"
            initial={{ opacity: 0, x: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -8, filter: "blur(4px)" }}
            transition={{
              duration: 0.3,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <Conversation {...conversationProps} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={cn(
          "relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl"
        )}
        layout="position"
        layoutId="chat-input-container"
        transition={{
          layout: {
            duration: messages.length === 1 ? 0.3 : 0,
          },
        }}
      >
        <ChatInput {...chatInputProps} />
      </motion.div>

      <FeedbackWidget authUserId={user?.id} />
    </div>
  )
}
