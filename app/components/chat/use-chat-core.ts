import { syncRecentMessages } from "@/app/components/chat/syncRecentMessages"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { useChats } from "@/lib/chat-store/chats/provider"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import type { UserProfile } from "@/lib/user/types"
import type { UIMessage, FileUIPart } from "ai"
import { DefaultChatTransport } from "ai"
import { useChat } from "@ai-sdk/react"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ResearchMode } from "@/app/components/chat-input/research-mode-selector"
import { AppMessage, createAppMessage, getCreatedAt, getAttachments, getTextContent } from "@/app/types/message.types"

type UseChatCoreProps = {
  initialMessages: UIMessage[]
  draftValue: string
  cacheAndAddMessage: (message: UIMessage) => void
  chatId: string | null
  user: UserProfile | null
  files: File[]
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>
  setFiles: (files: File[]) => void
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void
  ensureChatExists: (uid: string, input: string) => Promise<string | null>
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>
  selectedModel: string
  clearDraft: () => void
  bumpChat: (chatId: string) => void
  setHasDialogSubscriptionRequired: (value: boolean) => void
  setHasDialogLimitReached: (value: boolean) => void
}

export function useChatCore({
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
}: UseChatCoreProps) {
  // State management - input is now managed manually in v5
  const [input, setInput] = useState(draftValue)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [enableSearch, setEnableSearch] = useState(true)
  const [researchMode, setResearchMode] = useState<ResearchMode | null>("research")
  const [responseStartTime, setResponseStartTime] = useState<number | null>(null)

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(chatId)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // Search params handling
  const searchParams = useSearchParams()
  const prompt = searchParams.get("prompt")

  // Chats operations
  const { updateTitle } = useChats()

  // Handle errors directly in onError callback
  const handleError = useCallback(
    (error: Error) => {
      console.error("Chat error:", error)
      console.error("Error message:", error.message)
      let errorMsg = error.message || "Something went wrong."

      // Check for subscription required error
      if (
        errorMsg.includes("need an active subscription") ||
        errorMsg.includes("SUBSCRIPTION_REQUIRED")
      ) {
        setHasDialogSubscriptionRequired(true)
        return
      }

      // Check for pro limit reached error
      if (
        errorMsg.includes("monthly message limit") ||
        errorMsg.includes("PRO_LIMIT_REACHED")
      ) {
        setHasDialogLimitReached(true)
        return
      }

      if (errorMsg === "An error occurred" || errorMsg === "fetch failed") {
        errorMsg = "Something went wrong. Please try again."
      }

      toast({
        title: errorMsg,
        status: "error",
      })
    },
    [setHasDialogSubscriptionRequired, setHasDialogLimitReached]
  )

  // Initialize useChat with v5 API
  const {
    messages,
    status,
    error,
    stop,
    setMessages,
    sendMessage,
    regenerate,
  } = useChat({
    id: chatId || "new-chat",
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: API_ROUTE_CHAT,
    }),
    onFinish: async ({ message }) => {
      cacheAndAddMessage(message)
      setResponseStartTime(null) // Clear time estimate when response finishes
      try {
        const effectiveChatId =
          chatId ||
          prevChatIdRef.current ||
          (typeof window !== "undefined"
            ? localStorage.getItem("guestChatId")
            : null)

        if (!effectiveChatId) return
        await syncRecentMessages(effectiveChatId, setMessages, 2)

        // Dispatch event to trigger subscription credit refresh
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("message-sent"))
        }
      } catch (error) {
        console.error("Message ID reconciliation failed: ", error)
      }
    },
    onError: handleError,
  })

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => setInput(prompt))
    }
  }, [prompt])

  // Reset messages and state when navigating from a chat to home
  // Check actual URL to avoid false positives from pushState not updating usePathname
  const isActuallyOnHome = typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/c/")

  if (prevChatIdRef.current !== null && chatId === null && isActuallyOnHome) {
    // Stop any ongoing streaming when navigating away
    stop()
    if (messages.length > 0) {
      setMessages([])
    }
    hasSentFirstMessageRef.current = false
  }

  // Only update prevChatIdRef when NOT in pushState limbo
  // (pushState limbo = chatId is null but URL shows we're on a chat page)
  if (chatId !== null || isActuallyOnHome) {
    prevChatIdRef.current = chatId
  }

  // Helper to create file parts from attachments
  const createFileParts = (attachments: Attachment[]): FileUIPart[] => {
    return attachments.map(att => ({
      type: "file" as const,
      url: att.url,
      filename: att.name,
      mediaType: att.contentType,
    }))
  }

  // Submit action
  const submit = useCallback(async () => {
    setIsSubmitting(true)
    // Mark immediately to prevent onboarding flash
    hasSentFirstMessageRef.current = true

    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      setIsSubmitting(false)
      return
    }

    // Create and show optimistic message FIRST for immediate UI feedback
    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : []

    const optimisticMessage = createAppMessage({
      id: optimisticId,
      content: input,
      role: "user",
      createdAt: new Date(),
      attachments: optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
    })

    setMessages((prev) => [...prev, optimisticMessage])
    setInput("")

    const submittedFiles = [...files]
    setFiles([])

    try {
      // Check rate limits AFTER showing optimistic message (rollback if fails)
      const allowed = await checkLimitsAndNotify(uid)
      if (!allowed) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
        return
      }

      const currentChatId = await ensureChatExists(uid, input)
      if (!currentChatId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
        return
      }

      prevChatIdRef.current = currentChatId

      if (input.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
        return
      }

      let attachments: Attachment[] | null = []
      if (submittedFiles.length > 0) {
        attachments = await handleFileUploads(uid, currentChatId)
        if (attachments === null) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          cleanupOptimisticAttachments(
            optimisticMessage.experimental_attachments
          )
          return
        }
      }

      // CRITICAL: Remove optimistic message BEFORE sendMessage to avoid duplicates
      // In AI SDK v5, sendMessage() adds its own user message to the messages array
      // If we don't remove the optimistic message first, the API receives duplicates
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)

      // Send message with v5 API - this will add the real user message
      await sendMessage(
        attachments && attachments.length > 0
          ? { text: input, files: createFileParts(attachments) }
          : { text: input },
        {
          body: {
            chatId: currentChatId,
            userId: uid,
            model: selectedModel,
            isAuthenticated,
            systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
            enableSearch,
            researchMode,
          },
        }
      )
      clearDraft()
      setResponseStartTime(Date.now()) // Track when response generation starts

      if (messages.length > 0) {
        bumpChat(currentChatId)
      }
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
      toast({ title: "Failed to send message", status: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    user,
    files,
    createOptimisticAttachments,
    input,
    setMessages,
    setFiles,
    checkLimitsAndNotify,
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    researchMode,
    sendMessage,
    cacheAndAddMessage,
    clearDraft,
    messages.length,
    bumpChat,
    setIsSubmitting,
  ])

  const submitEdit = useCallback(
    async (messageId: string, newContent: string) => {
      // Block edits while sending/streaming
      if (isSubmitting || status === "submitted" || status === "streaming") {
        toast({
          title: "Please wait until the current message finishes sending.",
          status: "error",
        })
        return
      }

      if (!newContent.trim()) return

      if (!chatId) {
        toast({ title: "Missing chat.", status: "error" })
        return
      }

      // Find edited message
      const editIndex = messages.findIndex(
        (m) => String(m.id) === String(messageId)
      )
      if (editIndex === -1) {
        toast({ title: "Message not found", status: "error" })
        return
      }

      const target = messages[editIndex] as AppMessage
      const createdAt = getCreatedAt(target)
      const cutoffIso = createdAt?.toISOString()
      if (!cutoffIso) {
        console.error("Unable to locate message timestamp.")
        return
      }

      if (newContent.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        return
      }

      // Store original messages for potential rollback
      const originalMessages = [...messages]

      const optimisticId = `optimistic-edit-${Date.now().toString()}`
      const targetAttachments = getAttachments(target)
      const optimisticEditedMessage = createAppMessage({
        id: optimisticId,
        content: newContent,
        role: "user",
        createdAt: new Date(),
        attachments: targetAttachments.length > 0 ? targetAttachments : undefined,
      })

      try {
        const trimmedMessages = messages.slice(0, editIndex)
        setMessages([...trimmedMessages, optimisticEditedMessage])

        try {
          const { writeToIndexedDB } = await import("@/lib/chat-store/persist")
          await writeToIndexedDB("messages", {
            id: chatId,
            messages: trimmedMessages,
          })
        } catch {}

        // Get user validation
        const uid = await getOrCreateGuestUserId(user)
        if (!uid) {
          setMessages(originalMessages)
          toast({ title: "Please sign in and try again.", status: "error" })
          return
        }

        const allowed = await checkLimitsAndNotify(uid)
        if (!allowed) {
          setMessages(originalMessages)
          return
        }

        const currentChatId = await ensureChatExists(uid, newContent)
        if (!currentChatId) {
          setMessages(originalMessages)
          return
        }

        prevChatIdRef.current = currentChatId

        // If this is an edit of the very first user message, update chat title
        if (editIndex === 0 && target.role === "user") {
          try {
            await updateTitle(currentChatId, newContent)
          } catch {}
        }

        // CRITICAL: Remove optimistic message BEFORE sendMessage to avoid duplicates
        // In AI SDK v5, sendMessage() adds its own user message to the messages array
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))

        // Send message with v5 API - this will add the real user message
        await sendMessage(
          targetAttachments.length > 0
            ? { text: newContent, files: createFileParts(targetAttachments) }
            : { text: newContent },
          {
            body: {
              chatId: currentChatId,
              userId: uid,
              model: selectedModel,
              isAuthenticated,
              systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
              enableSearch,
              researchMode,
              editCutoffTimestamp: cutoffIso, // Backend will delete messages from this timestamp
            },
          }
        )

        bumpChat(currentChatId)
      } catch (error) {
        console.error("Edit failed:", error)
        setMessages(originalMessages)
        toast({ title: "Failed to apply edit", status: "error" })
      }
    },
    [
      chatId,
      messages,
      user,
      checkLimitsAndNotify,
      ensureChatExists,
      selectedModel,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      researchMode,
      sendMessage,
      setMessages,
      bumpChat,
      updateTitle,
      isSubmitting,
      status,
    ]
  )

  // Handle suggestion
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true)
      const optimisticId = `optimistic-${Date.now().toString()}`
      const optimisticMessage = createAppMessage({
        id: optimisticId,
        content: suggestion,
        role: "user",
        createdAt: new Date(),
      })

      setMessages((prev) => [...prev, optimisticMessage])

      try {
        const uid = await getOrCreateGuestUserId(user)

        if (!uid) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          return
        }

        const allowed = await checkLimitsAndNotify(uid)
        if (!allowed) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          return
        }

        const currentChatId = await ensureChatExists(uid, suggestion)

        if (!currentChatId) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          return
        }

        prevChatIdRef.current = currentChatId

        // CRITICAL: Remove optimistic message BEFORE sendMessage to avoid duplicates
        // In AI SDK v5, sendMessage() adds its own user message to the messages array
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))

        // Send message with v5 API - this will add the real user message
        await sendMessage(
          { text: suggestion },
          {
            body: {
              chatId: currentChatId,
              userId: uid,
              model: selectedModel,
              isAuthenticated,
              systemPrompt: SYSTEM_PROMPT_DEFAULT,
              enableSearch,
              researchMode,
            },
          }
        )
      } catch {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        toast({ title: "Failed to send suggestion", status: "error" })
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      ensureChatExists,
      selectedModel,
      user,
      sendMessage,
      checkLimitsAndNotify,
      isAuthenticated,
      enableSearch,
      researchMode,
      setMessages,
      setIsSubmitting,
    ]
  )

  // Handle reload (regenerate in v5)
  const handleReload = useCallback(async () => {
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return
    }

    await regenerate({
      body: {
        chatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        enableSearch,
        researchMode,
      },
    })
  }, [user, chatId, selectedModel, isAuthenticated, systemPrompt, enableSearch, researchMode, regenerate])

  // Handle input change - manages state manually in v5
  const { setDraftValue } = useChatDraft(chatId)
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      setDraftValue(value)
    },
    [setDraftValue]
  )

  // Legacy handleSubmit for form compatibility (wraps submit)
  const handleSubmit = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.()
      submit()
    },
    [submit]
  )

  return {
    // Chat state
    messages,
    input,
    handleSubmit,
    status,
    error,
    reload: handleReload, // Alias for backward compatibility
    stop,
    setMessages,
    setInput,
    append: sendMessage, // Alias for backward compatibility
    isAuthenticated,
    systemPrompt,
    hasSentFirstMessageRef,

    // Component state
    isSubmitting,
    setIsSubmitting,
    hasDialogAuth,
    setHasDialogAuth,
    enableSearch,
    setEnableSearch,
    researchMode,
    setResearchMode,
    responseStartTime,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
    submitEdit,
  }
}
