import { syncRecentMessages } from "@/app/components/chat/syncRecentMessages"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { useChats } from "@/lib/chat-store/chats/provider"
import { cacheMessages, getCachedMessages } from "@/lib/chat-store/messages/api"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import type { ChatMessage, ChatMessageMetadata, ChatMessagePart } from "@/lib/ai/message-utils"
import {
  attachmentsToFileParts,
  getMessageAttachments,
  getMessageCreatedAt,
} from "@/lib/ai/message-utils"
import { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import type { UserProfile } from "@/lib/user/types"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ResearchMode } from "@/app/components/chat-input/research-mode-selector"

type UseChatCoreProps = {
  initialMessages: ChatMessage[]
  draftValue: string
  cacheAndAddMessage: (message: ChatMessage) => void
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

type UiChatMessage = UIMessage<ChatMessageMetadata>

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
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [enableSearch, setEnableSearch] = useState(true)
  const [researchMode, setResearchMode] = useState<ResearchMode | null>("research")
  const [responseStartTime, setResponseStartTime] = useState<number | null>(null)
  const [input, setInput] = useState(draftValue)
  const asUiParts = useCallback(
    (parts: ChatMessagePart[]): UiChatMessage["parts"] =>
      parts as UiChatMessage["parts"],
    []
  )

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(chatId)
  const inFlightChatIdRef = useRef<string | null>(null)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )
  const { setDraftValue } = useChatDraft(chatId)

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

  // Initialize useChat
  const {
    messages,
    status,
    error,
    stop,
    setMessages,
    sendMessage,
    regenerate,
  } = useChat<UiChatMessage>({
    id: chatId || "new-chat",
    messages: initialMessages as UiChatMessage[],
    transport: new DefaultChatTransport({ api: API_ROUTE_CHAT }),
    onFinish: async ({ message: assistantMessage }) => {
      const effectiveChatId =
        inFlightChatIdRef.current ||
        chatId ||
        prevChatIdRef.current ||
        (typeof window !== "undefined"
          ? localStorage.getItem("guestChatId")
          : null)

      if (assistantMessage && effectiveChatId) {
        if (effectiveChatId === chatId) {
          cacheAndAddMessage(assistantMessage as ChatMessage)
        } else {
          try {
            const cached = await getCachedMessages(effectiveChatId)
            await cacheMessages(effectiveChatId, [...cached, assistantMessage])
          } catch (err) {
            console.error("Failed to cache message for inactive chat:", err)
          }
        }
      }
      setResponseStartTime(null) // Clear time estimate when response finishes
      try {
        if (!effectiveChatId) return
        if (effectiveChatId === chatId) {
          await syncRecentMessages(effectiveChatId, setMessages, 2)
        }

        // Dispatch event to trigger subscription credit refresh
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("message-sent"))
        }
      } catch (error) {
        console.error("Message ID reconciliation failed: ", error)
      } finally {
        if (inFlightChatIdRef.current === effectiveChatId) {
          inFlightChatIdRef.current = null
        }
      }
    },
    onError: handleError,
  })

  useEffect(() => {
    if (draftValue !== input) {
      setInput(draftValue)
    }
  }, [draftValue, input])

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => {
        setInput(prompt)
        setDraftValue(prompt)
      })
    }
  }, [prompt, setInput, setDraftValue])

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

    const messageText = input
    const createdAt = new Date().toISOString()

    // Create and show optimistic message FIRST for immediate UI feedback
    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : []
    const textPart: ChatMessagePart = { type: "text", text: messageText }
    const optimisticParts: ChatMessagePart[] = [
      textPart,
      ...attachmentsToFileParts(optimisticAttachments),
    ]

    const optimisticMessage: UiChatMessage = {
      id: optimisticId,
      role: "user" as const,
      parts: asUiParts(optimisticParts),
      metadata: { createdAt },
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setInput("")

    const submittedFiles = [...files]
    setFiles([])

    try {
      // Check rate limits AFTER showing optimistic message (rollback if fails)
      const allowed = await checkLimitsAndNotify(uid)
      if (!allowed) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      const currentChatId = await ensureChatExists(uid, messageText)
      if (!currentChatId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      prevChatIdRef.current = currentChatId
      inFlightChatIdRef.current = currentChatId

      if (messageText.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      let attachments: Attachment[] | null = []
      if (submittedFiles.length > 0) {
        attachments = await handleFileUploads(uid, currentChatId)
        if (attachments === null) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          cleanupOptimisticAttachments(optimisticAttachments)
          return
        }
      }

      const uploadedParts = attachments && attachments.length > 0
        ? attachmentsToFileParts(attachments)
        : []

      if (uploadedParts.length > 0) {
        const updatedParts: ChatMessagePart[] = [textPart, ...uploadedParts]
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticId
              ? {
                  ...msg,
                  parts: asUiParts(updatedParts),
                }
              : msg
          )
        )
      }

      const options = {
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

      await sendMessage(
        uploadedParts.length > 0
          ? {
              text: messageText,
              files: uploadedParts,
              metadata: { createdAt },
              messageId: optimisticId,
            }
          : { text: messageText, metadata: { createdAt }, messageId: optimisticId },
        options
      )

      cleanupOptimisticAttachments(optimisticAttachments)

      const cachedMessage: ChatMessage =
        uploadedParts.length > 0
          ? { ...(optimisticMessage as ChatMessage), parts: [textPart, ...uploadedParts] }
          : (optimisticMessage as ChatMessage)
      cacheAndAddMessage(cachedMessage)
      clearDraft()
      setResponseStartTime(Date.now()) // Track when response generation starts

      if (messages.length > 0) {
        bumpChat(currentChatId)
      }
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticAttachments)
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
    setInput,
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
    asUiParts,
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

      const target = messages[editIndex]
      const cutoffDate = getMessageCreatedAt(target)
      const cutoffIso = cutoffDate?.toISOString()
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
      const targetAttachments = getMessageAttachments(target)
      const createdAt = new Date().toISOString()
      const editTextPart: ChatMessagePart = { type: "text", text: newContent }
      const optimisticEditedMessage: UiChatMessage = {
        id: optimisticId,
        role: "user" as const,
        parts: asUiParts([editTextPart, ...attachmentsToFileParts(targetAttachments)]),
        metadata: { createdAt },
      }

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
        inFlightChatIdRef.current = currentChatId

        const options = {
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

        // If this is an edit of the very first user message, update chat title
        if (editIndex === 0 && target.role === "user") {
          try {
            await updateTitle(currentChatId, newContent)
          } catch {}
        }

        const fileParts = targetAttachments.length
          ? attachmentsToFileParts(targetAttachments)
          : undefined

        await sendMessage(
          fileParts
            ? {
                text: newContent,
                files: fileParts,
                metadata: { createdAt },
                messageId: optimisticId,
              }
            : { text: newContent, metadata: { createdAt }, messageId: optimisticId },
          options
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
      asUiParts,
    ]
  )

  // Handle suggestion
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true)
      const optimisticId = `optimistic-${Date.now().toString()}`
      const createdAt = new Date().toISOString()
      const suggestionPart: ChatMessagePart = { type: "text", text: suggestion }
      const optimisticMessage: UiChatMessage = {
        id: optimisticId,
        role: "user" as const,
        parts: asUiParts([suggestionPart]),
        metadata: { createdAt },
      }

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
        inFlightChatIdRef.current = currentChatId

        const options = {
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

        await sendMessage(
          { text: suggestion, metadata: { createdAt }, messageId: optimisticId },
          options
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
      asUiParts,
    ]
  )

  // Handle reload
  const handleReload = useCallback(async () => {
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return
    }

    const options = {
      body: {
        chatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        enableSearch,
        researchMode,
      },
    }

    inFlightChatIdRef.current = chatId || prevChatIdRef.current
    regenerate(options)
  }, [user, chatId, selectedModel, isAuthenticated, systemPrompt, enableSearch, researchMode, regenerate])

  // Handle input change
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      setDraftValue(value)
    },
    [setInput, setDraftValue]
  )

  return {
    // Chat state
    messages,
    input,
    status,
    error,
    stop,
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
