"use client"

import { ChatInput } from "@/app/components/chat-input/chat-input"
import { Conversation } from "@/app/components/chat/conversation"
import { useChatOperations } from "@/app/components/chat/use-chat-operations"
import { useFileUpload } from "@/app/components/chat/use-file-upload"
import { useModel } from "@/app/components/chat/use-model"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import { useUser } from "@/lib/user-store/provider"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, formatRelativeTime } from "@/lib/utils"
import { useChat } from "@ai-sdk/react"
import {
  UsersThree,
  Upload,
  FileCsv,
  Spinner,
  CheckCircle,
  Clock,
  Play,
  Eye,
  Download,
  ArrowUpRight,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { usePathname } from "next/navigation"
import { useCallback, useMemo, useState, useRef } from "react"
import {
  parseProspectFile,
  transformToProspectData,
  type BatchProspectJob,
  type ProspectInputData,
  type ColumnMapping,
} from "@/lib/batch-processing"
import { MAX_BATCH_FILE_SIZE, ALLOWED_BATCH_EXTENSIONS } from "@/lib/batch-processing/config"

// Batch limits by plan
const BATCH_LIMITS: Record<string, number> = {
  free: 10,
  growth: 10,
  pro: 50,
  scale: 100,
  max: 200,
  ultra: 500,
}

export function BatchView() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enableSearch, setEnableSearch] = useState(true)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [batchLimit, setBatchLimit] = useState(10)
  const [planName, setPlanName] = useState("growth")
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // Fetch batch limit from API
  useQuery({
    queryKey: ["batch-limits"],
    queryFn: async () => {
      const response = await fetch("/api/batch-prospects/limits")
      if (response.ok) {
        const data = await response.json()
        setBatchLimit(data.limit)
        setPlanName(data.plan)
        return data
      }
      return null
    },
  })

  // Fetch batch jobs for this user
  const { data: batchJobs = [], refetch: refetchJobs } = useQuery<BatchProspectJob[]>({
    queryKey: ["batch-jobs"],
    queryFn: async () => {
      const response = await fetch("/api/batch-prospects")
      if (!response.ok) return []
      const data = await response.json()
      return data.jobs || []
    },
  })

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

  const {
    messages,
    input,
    handleSubmit,
    status,
    reload,
    stop,
    setMessages,
    setInput,
  } = useChat({
    id: `batch-${currentChatId}`,
    api: API_ROUTE_CHAT,
    initialMessages: [],
    onFinish: cacheAndAddMessage,
    onError: handleError,
  })

  const { selectedModel, handleModelChange } = useModel({
    currentChat: null,
    user,
    updateChatModel: () => Promise.resolve(),
    chatId: null,
  })

  // Simplified ensureChatExists for authenticated batch context
  const ensureChatExists = useCallback(
    async (userId: string) => {
      if (currentChatId) {
        return currentChatId
      }

      if (messages.length === 0) {
        try {
          const newChat = await createNewChat(
            userId,
            input,
            selectedModel,
            true,
            SYSTEM_PROMPT_DEFAULT,
            undefined // No project ID for batch
          )

          if (!newChat) return null

          setCurrentChatId(newChat.id)
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
    [currentChatId, messages.length, createNewChat, input, selectedModel]
  )

  const { handleDelete, handleEdit } = useChatOperations({
    isAuthenticated: true,
    chatId: null,
    messages,
    selectedModel,
    systemPrompt: SYSTEM_PROMPT_DEFAULT,
    createNewChat,
    setHasDialogAuth: () => {},
    setMessages,
    setInput,
  })

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

    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : []

    const optimisticMessage = {
      id: optimisticId,
      content: input,
      role: "user" as const,
      createdAt: new Date(),
      experimental_attachments:
        optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setInput("")

    const submittedFiles = [...files]
    setFiles([])

    try {
      const chatId = await ensureChatExists(user.id)
      if (!chatId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
        return
      }

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
        attachments = await handleFileUploads(user.id, chatId)
        if (attachments === null) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
          return
        }
      }

      const options = {
        body: {
          chatId,
          userId: user.id,
          model: selectedModel,
          isAuthenticated: true,
          systemPrompt: SYSTEM_PROMPT_DEFAULT,
          enableSearch,
        },
        experimental_attachments: attachments || undefined,
      }

      handleSubmit(undefined, options)
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
      cacheAndAddMessage(optimisticMessage)

      if (messages.length > 0) {
        bumpChat(chatId)
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
    setInput,
    setFiles,
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    handleSubmit,
    cacheAndAddMessage,
    messages.length,
    bumpChat,
    enableSearch,
  ])

  const handleReload = useCallback(async () => {
    if (!user?.id) return

    const options = {
      body: {
        chatId: null,
        userId: user.id,
        model: selectedModel,
        isAuthenticated: true,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
      },
    }

    reload(options)
  }, [user, selectedModel, reload])

  // Handle CSV file upload for batch processing
  const handleBatchFileUpload = useCallback(async (file: File) => {
    setUploadError(null)
    setIsUploadingFile(true)

    try {
      // Validate file size
      if (file.size > MAX_BATCH_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_BATCH_FILE_SIZE / (1024 * 1024)}MB`)
      }

      // Validate extension
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      if (!ALLOWED_BATCH_EXTENSIONS.includes(ext)) {
        throw new Error(`Unsupported file type. Please use ${ALLOWED_BATCH_EXTENSIONS.join(", ")}`)
      }

      // Parse file
      const result = await parseProspectFile(file)

      if (!result.success) {
        throw new Error(result.errors.join(". "))
      }

      // Auto-map columns using suggested mapping
      const columnMapping: ColumnMapping = {
        name: result.suggested_mapping.name || null,
        address: result.suggested_mapping.address || null,
        city: result.suggested_mapping.city || null,
        state: result.suggested_mapping.state || null,
        zip: result.suggested_mapping.zip || null,
        full_address: result.suggested_mapping.full_address || null,
        email: result.suggested_mapping.email || null,
        phone: result.suggested_mapping.phone || null,
        company: result.suggested_mapping.company || null,
        title: result.suggested_mapping.title || null,
        notes: result.suggested_mapping.notes || null,
      }

      // Transform to prospect data
      const { prospects, errors } = transformToProspectData(result.rows, columnMapping)

      if (prospects.length === 0) {
        throw new Error("No valid prospects found in file. Please ensure your CSV has a name column.")
      }

      // Check batch limit
      if (prospects.length > batchLimit) {
        throw new Error(`Your ${planName} plan allows up to ${batchLimit} prospects per batch. You have ${prospects.length} prospects. Please upgrade or reduce the number of prospects.`)
      }

      // Create batch job
      const response = await fetch("/api/batch-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${file.name.replace(/\.[^/.]+$/, "")} - ${new Date().toLocaleDateString()}`,
          prospects,
          column_mapping: columnMapping,
          source_file_name: file.name,
          source_file_size: file.size,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create batch job")
      }

      toast({
        title: `Batch job created with ${prospects.length} prospects`,
        status: "success",
      })

      // Refresh jobs list
      refetchJobs()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload file")
    } finally {
      setIsUploadingFile(false)
    }
  }, [batchLimit, planName, refetchJobs])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleBatchFileUpload(selectedFile)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleBatchFileUpload(droppedFile)
      }
    },
    [handleBatchFileUpload]
  )

  // Memoize the conversation props
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
    ]
  )

  // Show onboarding when on batch page
  const showOnboarding = pathname === "/batch"

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" weight="fill" />
      case "processing":
        return <Spinner className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto",
        showOnboarding && batchJobs.length === 0
          ? "justify-center pt-0"
          : showOnboarding && batchJobs.length > 0
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
              layout: { duration: 0 },
            }}
          >
            <div className="mb-6 flex items-center justify-center gap-2">
              <UsersThree className="text-muted-foreground" size={24} />
              <motion.h1
                className="text-center text-3xl font-medium tracking-tight"
                initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              >
                Batch Research
              </motion.h1>
            </div>

            {/* Upload area */}
            <div
              className={cn(
                "mx-4 mb-6 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                isUploadingFile
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploadingFile ? (
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processing file...</p>
                </div>
              ) : (
                <>
                  <FileCsv className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-base font-medium mb-1">Upload Prospect List</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop a CSV or Excel file, or click to browse
                  </p>
                  <Badge variant="secondary" className="capitalize">
                    {planName} Plan: Up to {batchLimit} prospects per batch
                  </Badge>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>

            {uploadError && (
              <div className="mx-4 mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {uploadError}
              </div>
            )}
          </motion.div>
        ) : (
          <Conversation key="conversation-batch" {...conversationProps} />
        )}
      </AnimatePresence>

      <motion.div
        className={cn("relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl")}
        layout="position"
        layoutId="chat-input-container"
        transition={{
          layout: { duration: messages.length === 1 ? 0.3 : 0 },
        }}
      >
        <ChatInput {...chatInputProps} />
      </motion.div>

      {/* Batch jobs list */}
      {showOnboarding && batchJobs.length > 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            Recent batch jobs
          </h2>
          <div className="space-y-2">
            {batchJobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0",
                  job.status === "completed" ? "bg-green-500/10" :
                  job.status === "processing" ? "bg-blue-500/10" :
                  "bg-muted"
                )}>
                  {statusIcon(job.status)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-medium">{job.name}</h4>
                    <Badge variant="secondary" className={cn(
                      "text-xs",
                      job.status === "completed" && "bg-green-500/10 text-green-600",
                      job.status === "processing" && "bg-blue-500/10 text-blue-500"
                    )}>
                      {job.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span>{job.total_prospects} prospects</span>
                    <span>•</span>
                    <span>{job.completed_count} completed</span>
                    <span>•</span>
                    <span>{formatRelativeTime(new Date(job.created_at))}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {job.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/batch/${job.id}`}
                    >
                      <Play className="mr-1 h-3 w-3" weight="fill" />
                      Start
                    </Button>
                  )}
                  {job.status === "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/batch-prospects/${job.id}/export?format=csv`, "_blank")}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      CSV
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = `/batch/${job.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : showOnboarding && batchJobs.length === 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            No batch jobs yet
          </h2>
          <p className="text-muted-foreground text-sm">
            Upload a CSV file above or ask Rōmy questions about prospect research.
          </p>
        </div>
      ) : null}
    </div>
  )
}
