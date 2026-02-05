"use client"

import { ChatInput } from "@/app/components/chat-input/chat-input"
import type { ResearchMode } from "@/app/components/chat-input/research-mode-selector"
import { Conversation } from "@/app/components/chat/conversation"
import { useChatOperations } from "@/app/components/chat/use-chat-operations"
import { useFileUpload } from "@/app/components/chat/use-file-upload"
import { useModel } from "@/app/components/chat/use-model"
import { ProjectChatItem } from "@/app/components/layout/sidebar/project-chat-item"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import type { ChatMessage, ChatMessageMetadata, ChatMessagePart } from "@/lib/ai/message-utils"
import { attachmentsToFileParts } from "@/lib/ai/message-utils"
import { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import { useUser } from "@/lib/user-store/provider"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ChatCircleIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { usePathname } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

type Project = {
  id: string
  name: string
  user_id: string
  created_at: string
}

type ProjectViewProps = {
  projectId: string
}

type UiChatMessage = UIMessage<ChatMessageMetadata>

export function ProjectView({ projectId }: ProjectViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enableSearch, setEnableSearch] = useState(true)
  const [researchMode, setResearchMode] = useState<ResearchMode | null>("research")
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const asUiParts = useCallback(
    (parts: ChatMessagePart[]): UiChatMessage["parts"] =>
      parts as UiChatMessage["parts"],
    []
  )
  const { user } = useUser()
  const { createNewChat, bumpChat } = useChats()
  const { cacheAndAddMessage } = useMessages()
  const pathname = usePathname()
  const {
    files,
    setFiles,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
    handleFileUpload,
    handleFileRemove,
  } = useFileUpload()

  // Fetch project details
  const { data: project, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch project")
      }
      return response.json()
    },
  })

  // Get chats from the chat store and filter for this project
  const { chats: allChats } = useChats()

  // Filter chats for this project
  const chats = allChats.filter((chat) => chat.project_id === projectId)

  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    let errorMsg = "Something went wrong."
    try {
      const parsed = JSON.parse(error.message)
      errorMsg = parsed.error || errorMsg
    } catch {
      errorMsg = error.message || errorMsg
    }
    toast({
      title: errorMsg,
      status: "error",
    })
  }, [])

  const [input, setInput] = useState("")

  const {
    messages,
    status,
    stop,
    setMessages,
    sendMessage,
    regenerate,
  } = useChat<UIMessage<ChatMessageMetadata>>({
    id: `project-${projectId}-${currentChatId}`,
    messages: [] as UIMessage<ChatMessageMetadata>[],
    transport: new DefaultChatTransport({ api: API_ROUTE_CHAT }),
    onFinish: ({ message }) => cacheAndAddMessage(message as ChatMessage),
    onError: handleError,
  })

  const { selectedModel, handleModelChange } = useModel({
    currentChat: null,
    user,
    updateChatModel: () => Promise.resolve(),
    chatId: null,
  })

  // Simplified ensureChatExists for authenticated project context
  const ensureChatExists = useCallback(
    async (userId: string) => {
      // If we already have a current chat ID, return it
      if (currentChatId) {
        return currentChatId
      }

      // Only create a new chat if we haven't started one yet
      if (messages.length === 0) {
        try {
          const newChat = await createNewChat(
            userId,
            input,
            selectedModel,
            true, // Always authenticated in this context
            SYSTEM_PROMPT_DEFAULT,
            projectId
          )

          if (!newChat) return null

          setCurrentChatId(newChat.id)
          // Redirect to the chat page as expected
          window.history.pushState(null, "", `/c/${newChat.id}`)
          return newChat.id
        } catch (err: unknown) {
          let errorMessage = "Something went wrong."
          try {
            const errorObj = err as { message?: string }
            if (errorObj.message) {
              const parsed = JSON.parse(errorObj.message)
              errorMessage = parsed.error || errorMessage
            }
          } catch {
            const errorObj = err as { message?: string }
            errorMessage = errorObj.message || errorMessage
          }
          toast({
            title: errorMessage,
            status: "error",
          })
          return null
        }
      }

      return currentChatId
    },
    [
      currentChatId,
      messages.length,
      createNewChat,
      input,
      selectedModel,
      projectId,
    ]
  )

  const { handleDelete, handleEdit } = useChatOperations({
    isAuthenticated: true, // Always authenticated in project context
    chatId: null,
    messages,
    selectedModel,
    systemPrompt: SYSTEM_PROMPT_DEFAULT,
    createNewChat,
    setHasDialogAuth: () => {}, // Not used in project context
    setMessages,
    setInput,
  })

  // Simple input change handler for project context (no draft saving needed)
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
    },
    [setInput]
  )

  const submit = useCallback(async () => {
    setIsSubmitting(true)

    if (!user?.id) {
      setIsSubmitting(false)
      return
    }

    const messageText = input
    const createdAt = new Date().toISOString()
    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : []

    const textPart: ChatMessagePart = { type: "text", text: messageText }
    const optimisticMessage: UiChatMessage = {
      id: optimisticId,
      role: "user" as const,
      parts: asUiParts([
        textPart,
        ...attachmentsToFileParts(optimisticAttachments),
      ]),
      metadata: { createdAt },
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setInput("")

    const submittedFiles = [...files]
    setFiles([])

    try {
      const currentChatId = await ensureChatExists(user.id)
      if (!currentChatId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

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
        attachments = await handleFileUploads(user.id, currentChatId)
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
          userId: user.id,
          model: selectedModel,
          isAuthenticated: true,
          systemPrompt: SYSTEM_PROMPT_DEFAULT,
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

      // Bump existing chats to top (non-blocking, after submit)
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
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    sendMessage,
    cacheAndAddMessage,
    messages.length,
    bumpChat,
    enableSearch,
    researchMode,
    asUiParts,
  ])

  const handleReload = useCallback(async () => {
    if (!user?.id) {
      return
    }

    const options = {
      body: {
        chatId: null,
        userId: user.id,
        model: selectedModel,
        isAuthenticated: true,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
        enableSearch,
        researchMode,
      },
    }

    regenerate(options)
  }, [user, selectedModel, enableSearch, researchMode, regenerate])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Memoize the conversation props to prevent unnecessary rerenders
  const conversationProps = useMemo(
    () => ({
      messages,
      status,
      onDelete: handleDelete,
      onEdit: handleEdit,
      onReload: handleReload,
    }),
    [messages, status, handleDelete, handleEdit, handleReload]
  )

  // Memoize the chat input props
  const chatInputProps = useMemo(
    () => ({
      value: input,
      onSuggestion: () => {},
      onValueChange: handleInputChange,
      onSend: submit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      hasSuggestions: false,
      onSelectModel: handleModelChange,
      selectedModel,
      isUserAuthenticated: isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      researchMode,
      setResearchMode,
    }),
    [
      input,
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
    ]
  )

  // Always show onboarding when on project page, regardless of messages
  const showOnboarding = pathname === `/p/${projectId}`

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto",
        showOnboarding && chats.length === 0
          ? "justify-center pt-0"
          : showOnboarding && chats.length > 0
            ? "justify-start pt-32"
            : "justify-end"
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {showOnboarding ? (
          <motion.div
            key="onboarding"
            className="relative z-10 mx-auto mb-4 max-w-[50rem]"
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
            <div className="mb-6 flex items-center justify-center gap-2">
              <ChatCircleIcon className="text-muted-foreground" size={24} />
              <AnimatePresence mode="wait">
                {isProjectLoading ? (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Skeleton className="h-9 w-48 rounded-lg" />
                  </motion.div>
                ) : (
                  <motion.h1
                    key="project-name"
                    className="text-center text-3xl font-medium tracking-tight"
                    initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{
                      duration: 0.3,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    {project?.name || "Untitled Project"}
                  </motion.h1>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <Conversation key={`conversation-${projectId}`} {...conversationProps} />
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

      {showOnboarding && chats.length > 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            Recent chats
          </h2>
          <div className="space-y-2">
            {chats.map((chat) => (
              <ProjectChatItem
                key={chat.id}
                chat={chat}
                formatDate={formatDate}
              />
            ))}
          </div>
        </div>
      ) : showOnboarding && chats.length === 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            No chats yet
          </h2>
        </div>
      ) : null}
    </div>
  )
}
