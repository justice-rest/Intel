"use client"

import { ChatInput } from "@/app/components/chat-input/chat-input"
import { Conversation } from "@/app/components/chat/conversation"
import { LoaderOverlay } from "@/app/components/chat/loader-overlay"
import { DropZone } from "@/app/components/split-view"
import { useModel } from "@/app/components/chat/use-model"
import { CollaborationWrapper, TypingIndicator, HeaderCollaboration } from "@/app/components/collaboration"
import { useCollaboratorsOptional } from "@/lib/collaboration"
import { usePresenceOptional } from "@/lib/presence"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { useSlashCommands } from "@/app/hooks/use-slash-commands"
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

const QuizPopup = dynamic(
  () => import("@/app/components/quiz").then((mod) => mod.QuizPopup),
  { ssr: false }
)

// Time threshold (in ms) before showing quiz popup during AI response
const QUIZ_POPUP_DELAY = 15000 // 15 seconds

interface ChatProps {
  firstName?: string | null
  /** Override chatId for split view panels */
  chatIdOverride?: string | null
}

export function Chat({
  firstName,
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

  const { messages: initialMessages, cacheAndAddMessage, isLoading: isMessagesLoading } = useMessages()
  const { user } = useUser()
  const { preferences } = useUserPreferences()
  const { customer } = useCustomer()

  // Check if user has an active subscription (any paid plan, including trials)
  const productStatus = customer?.products?.[0]?.status
  const productId = customer?.products?.[0]?.id
  const hasActiveSubscription =
    productStatus === "active" || productStatus === "trialing"
  // Quiz popup only shows for Growth plan users
  const isGrowthPlan = productId === "growth"
  const { draftValue, clearDraft } = useChatDraft(chatId)
  const { processSlashCommand } = useSlashCommands()

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
  const [showQuizPopup, setShowQuizPopup] = useState(false)
  const quizTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hasShownQuizThisSession = useRef(false)
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

  // Handle slash commands (e.g., /draft, /drafts)
  const handleSlashCommand = useCallback(
    (command: string): boolean => {
      const result = processSlashCommand(command)
      return result.handled
    },
    [processSlashCommand]
  )

  // Collaboration context (available when inside CollaborationWrapper)
  // These hooks are called inside CollaborationWrapper's children render
  const collaboratorsContext = useCollaboratorsOptional()
  const presenceContext = usePresenceOptional()

  // Derive collaboration state
  const isViewerRole = collaboratorsContext?.currentUserRole === "viewer"
  const canEdit = collaboratorsContext?.canEdit ?? true

  // Typing handler for collaboration
  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      presenceContext?.setTyping(isTyping)
    },
    [presenceContext]
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
    researchMode,
    setResearchMode,
    responseStartTime,
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

  // Quiz popup timer: Show popup when AI takes more than 15 seconds to respond
  // Only show once per session, and only for authenticated Growth plan users
  // Also checks if user has already answered today's quiz before showing
  useEffect(() => {
    // Start timer when streaming begins - ONLY for Growth plan users
    if (status === "streaming" && isAuthenticated && isGrowthPlan && !hasShownQuizThisSession.current) {
      quizTimerRef.current = setTimeout(async () => {
        // Check if user has already answered today's quiz before showing popup
        try {
          const response = await fetch("/api/quiz")
          if (response.ok) {
            const data = await response.json()
            // Only show popup if user hasn't answered today's question
            if (!data.questionOfTheDay?.answered) {
              setShowQuizPopup(true)
            }
          }
        } catch (error) {
          // On error, don't show popup
          console.error("Error checking quiz status:", error)
        }
        hasShownQuizThisSession.current = true
      }, QUIZ_POPUP_DELAY)
    }

    // Clear timer when streaming ends or status changes
    if (status !== "streaming" && quizTimerRef.current) {
      clearTimeout(quizTimerRef.current)
      quizTimerRef.current = null
    }

    return () => {
      if (quizTimerRef.current) {
        clearTimeout(quizTimerRef.current)
        quizTimerRef.current = null
      }
    }
  }, [status, isAuthenticated, isGrowthPlan])

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
      isLoading: isMessagesLoading,
    }),
    [
      messages,
      status,
      handleDelete,
      submitEdit,
      handleReload,
      isMessagesLoading,
      handleQuotedSelected,
      isAuthenticated,
    ]
  )

  // Determine if we should show the loader overlay
  // Show throughout submitted and streaming phases (including tool execution)
  const lastMessage = messages[messages.length - 1]

  // Check if tools are still being invoked (parts contain tool-invocation without result)
  const hasActiveToolCalls = lastMessage?.role === "assistant" &&
    Array.isArray(lastMessage.parts) &&
    lastMessage.parts.some((part: { type: string; toolInvocation?: { state?: string } }) =>
      part.type === "tool-invocation" &&
      part.toolInvocation?.state !== "result"
    )

  // Keep loader visible throughout entire streaming process (including tool execution)
  const isWaitingForResponse = status === "submitted" || status === "streaming"

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
      researchMode,
      setResearchMode,
      quotedText,
      firstName,
      hasActiveSubscription,
      onSlashCommand: handleSlashCommand,
      isViewerRole,
      onTypingChange: handleTypingChange,
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
      researchMode,
      setResearchMode,
      quotedText,
      firstName,
      hasActiveSubscription,
      handleSlashCommand,
      isViewerRole,
      handleTypingChange,
    ]
  )

  // Handle redirect for invalid chatId - only redirect if we're certain the chat doesn't exist
  // and we're not in a transient state during chat creation or message loading
  if (
    chatId &&
    !isChatsLoading &&
    !isMessagesLoading &&
    !currentChat &&
    !isSubmitting &&
    status === "ready" &&
    messages.length === 0 &&
    !hasSentFirstMessageRef.current // Don't redirect if we've already sent a message in this session
  ) {
    return redirect("/")
  }

  const showOnboarding = !chatId && messages.length === 0 && !isSubmitting && !hasSentFirstMessageRef.current

  return (
    <CollaborationWrapper chatId={chatId}>
      <div
        className={cn(
          "@container/main relative flex h-full flex-col items-center justify-end md:justify-center"
        )}
      >
        {/* Drop zone for initiating split view - only show when not already in split mode */}
        {!isSplitActive && (
          <DropZone onDrop={handleSplitDrop} currentChatId={chatId} />
        )}

        {/* Collaboration dialogs - rendered inline, triggered by header button */}
        <HeaderCollaboration />

      <DialogAuth open={hasDialogAuth} setOpen={setHasDialogAuth} />
      <DialogSubscriptionRequired
        open={hasDialogSubscriptionRequired}
        setOpen={setHasDialogSubscriptionRequired}
      />
      <DialogLimitReached
        open={hasDialogLimitReached}
        setOpen={setHasDialogLimitReached}
      />
      <QuizPopup
        open={showQuizPopup}
        onClose={() => setShowQuizPopup(false)}
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
          <Conversation {...conversationProps} />
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
        <LoaderOverlay
          isActive={isWaitingForResponse}
          enableSearch={enableSearch}
          startTime={responseStartTime ?? null}
          isExecutingTools={hasActiveToolCalls}
        />
        {/* Show typing indicator when collaborators are typing */}
        {presenceContext && presenceContext.typingUsers.length > 0 && (
          <TypingIndicator className="mb-2 px-2" />
        )}
        <ChatInput {...chatInputProps} />
      </motion.div>

        <FeedbackWidget authUserId={user?.id} />
      </div>
    </CollaborationWrapper>
  )
}
