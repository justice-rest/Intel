"use client"

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  MagnifyingGlass,
  FilePdf,
  FileDoc,
  FileText,
  ChatText,
  Lightbulb,
  ListChecks,
  Play,
  BookOpen,
  DotsThreeVertical,
  Trash,
  CheckCircle,
  WarningCircle,
  Clock,
  Lightning,
  Upload,
  X,
} from "@phosphor-icons/react"
import { Loader2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchClient } from "@/lib/fetch"
import { toast } from "@/components/ui/toast"
import { cn, formatRelativeTime } from "@/lib/utils"
import type {
  ProfileWithCounts,
  DashboardTab,
  KnowledgeDocument,
  KnowledgeVoiceElement,
  KnowledgeStrategyRule,
  KnowledgeFact,
  VoiceElementType,
  StrategyCategory,
  FactCategory,
} from "@/lib/knowledge/types"

/**
 * KnowledgeDashboard
 *
 * Main dashboard for managing organizational knowledge profiles.
 * Follows UI patterns from IntegrationsSection, MemoryList, and RAG DocumentList.
 */
export function KnowledgeDashboard() {
  const queryClient = useQueryClient()
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DashboardTab>("documents")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null)

  // Fetch profiles
  const { data: profilesData, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["knowledge-profiles"],
    queryFn: async () => {
      const res = await fetchClient("/api/knowledge/profile")
      if (!res.ok) throw new Error("Failed to fetch profiles")
      const data = await res.json()
      return data.profiles as ProfileWithCounts[]
    },
  })

  const profiles = profilesData || []
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0] || null

  // Set initial active profile
  if (!activeProfileId && profiles.length > 0) {
    setActiveProfileId(profiles[0].id)
  }

  // Create profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/knowledge/profile", {
        method: "POST",
        body: JSON.stringify({
          name: `Profile ${profiles.length + 1}`,
          description: "New knowledge profile",
        }),
      })
      if (!res.ok) throw new Error("Failed to create profile")
      return res.json()
    },
    onSuccess: (data) => {
      toast({ title: "Profile Created", description: data.message })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      setActiveProfileId(data.profile.id)
    },
    onError: (error) => {
      toast({
        title: "Failed to create profile",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Delete profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetchClient(`/api/knowledge/profile/${profileId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete profile")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Profile Deleted" })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      setDeleteDialogOpen(false)
      setProfileToDelete(null)
      setActiveProfileId(null)
    },
    onError: (error) => {
      toast({
        title: "Failed to delete profile",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Activate profile mutation
  const activateProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetchClient(`/api/knowledge/profile/${profileId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "active" }),
      })
      if (!res.ok) throw new Error("Failed to activate profile")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Profile Activated" })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  if (isLoadingProfiles) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div data-settings-section="knowledge">
      {/* Header */}
      <h3 className="relative mb-2 flex items-center gap-2 text-lg font-medium">
        Organizational Knowledge
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
          BETA
        </span>
      </h3>
      <p className="text-muted-foreground text-sm">
        Train Rōmy to communicate like your organization. Upload documents, define rules, and add examples.
      </p>

      {/* Profile Selector or Empty State */}
      {profiles.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-12">
          <BookOpen className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground mb-4 text-sm">
            No knowledge profiles yet. Create your first profile to start training Rōmy.
          </p>
          <Button onClick={() => createProfileMutation.mutate()} disabled={createProfileMutation.isPending}>
            {createProfileMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Create Knowledge Profile
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Profile Selector */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select
                value={activeProfileId || ""}
                onValueChange={(value) => setActiveProfileId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      <div className="flex items-center gap-2">
                        {profile.name}
                        {profile.status === "active" && (
                          <Badge variant="secondary" className="bg-[#B183FF]/20 text-[#B183FF] text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => createProfileMutation.mutate()}
              disabled={createProfileMutation.isPending}
            >
              {createProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {activeProfile && (
            <>
              {/* Profile Stats Grid */}
              <div className="grid grid-cols-5 gap-2">
                <StatCard
                  label="Documents"
                  count={activeProfile.document_count}
                  icon={FilePdf}
                  active={activeTab === "documents"}
                  onClick={() => setActiveTab("documents")}
                />
                <StatCard
                  label="Voice"
                  count={activeProfile.voice_element_count}
                  icon={ChatText}
                  active={activeTab === "voice"}
                  onClick={() => setActiveTab("voice")}
                />
                <StatCard
                  label="Strategy"
                  count={activeProfile.strategy_rule_count}
                  icon={ListChecks}
                  active={activeTab === "strategy"}
                  onClick={() => setActiveTab("strategy")}
                />
                <StatCard
                  label="Facts"
                  count={activeProfile.fact_count}
                  icon={Lightbulb}
                  active={activeTab === "facts"}
                  onClick={() => setActiveTab("facts")}
                />
                <StatCard
                  label="Preview"
                  count={null}
                  icon={Play}
                  active={activeTab === "preview"}
                  onClick={() => setActiveTab("preview")}
                />
              </div>

              {/* Profile Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeProfile.status !== "active" && (
                    <Button
                      size="sm"
                      onClick={() => activateProfileMutation.mutate(activeProfile.id)}
                      disabled={activateProfileMutation.isPending}
                    >
                      {activateProfileMutation.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Lightning className="mr-1 h-4 w-4" />
                      )}
                      Activate
                    </Button>
                  )}
                  {activeProfile.status === "active" && (
                    <Badge variant="secondary" className="bg-[#B183FF]/20 text-[#B183FF]">
                      <CheckCircle className="mr-1 h-3 w-3" weight="fill" />
                      Active
                    </Badge>
                  )}
                  {activeProfile.prompt_token_count && (
                    <span className="text-xs text-muted-foreground">
                      {activeProfile.prompt_token_count} tokens
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProfileToDelete(activeProfile.id)
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash className="mr-1 h-4 w-4" />
                  Delete Profile
                </Button>
              </div>

              {/* Tab Content */}
              <div className="mt-4">
                {activeTab === "documents" && <DocumentsTab profileId={activeProfile.id} />}
                {activeTab === "voice" && <VoiceTab profileId={activeProfile.id} />}
                {activeTab === "strategy" && <StrategyTab profileId={activeProfile.id} />}
                {activeTab === "facts" && <FactsTab profileId={activeProfile.id} />}
                {activeTab === "preview" && <PreviewTab profileId={activeProfile.id} />}
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this profile? This will remove all documents, voice
              elements, strategy rules, and facts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => profileToDelete && deleteProfileMutation.mutate(profileToDelete)}
              disabled={deleteProfileMutation.isPending}
            >
              {deleteProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Stat Card - clickable tab selector
 */
function StatCard({
  label,
  count,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  count: number | null
  icon: React.ElementType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border p-3 transition-colors",
        active ? "border-primary ring-primary/30 ring-2 bg-accent/50" : "border-border hover:bg-accent/30"
      )}
    >
      <Icon className="mb-1 h-5 w-5 text-muted-foreground" />
      {count !== null && <div className="text-lg font-semibold">{count}</div>}
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  )
}

/**
 * Status Badge for documents
 */
function StatusBadge({ status }: { status: KnowledgeDocument["status"] }) {
  const config = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-blue-500/10 text-blue-500",
    },
    processing: {
      icon: Loader2,
      label: "Processing",
      className: "bg-[#422F10] text-yellow-600",
    },
    analyzed: {
      icon: CheckCircle,
      label: "Ready",
      className: "bg-[#B183FF]/20 text-[#B183FF]",
    },
    failed: {
      icon: WarningCircle,
      label: "Failed",
      className: "bg-red-500/10 text-red-500",
    },
  }

  const { icon: Icon, label, className } = config[status]

  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Icon className={cn("h-3 w-3", status === "processing" && "animate-spin")} />
      {label}
    </Badge>
  )
}

/**
 * Documents Tab - Upload and manage training documents
 */
function DocumentsTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch documents
  const { data: documentsData, isLoading } = useQuery({
    queryKey: ["knowledge-documents", profileId],
    queryFn: async () => {
      const res = await fetchClient(`/api/knowledge/documents?profile_id=${profileId}`)
      if (!res.ok) throw new Error("Failed to fetch documents")
      const data = await res.json()
      return data.documents as KnowledgeDocument[]
    },
  })

  const documents = documentsData || []

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("profile_id", profileId)

      const res = await fetch("/api/knowledge/documents", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Upload failed")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({ title: "Document Uploaded", description: data.message })
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetchClient("/api/knowledge/documents/analyze", {
        method: "POST",
        body: JSON.stringify({ document_id: documentId }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Analysis failed")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({ title: "Document Analyzed", description: data.message })
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetchClient(`/api/knowledge/documents/${documentId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Document Deleted" })
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return
      Array.from(files).forEach((file) => {
        uploadMutation.mutate(file)
      })
    },
    [uploadMutation]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect]
  )

  const filteredDocuments = documents.filter((doc) =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return FilePdf
    if (fileType.includes("word") || fileType.includes("docx")) return FileDoc
    return FileText
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        {uploadMutation.isPending ? (
          <>
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD - max 50MB</p>
          </>
        )}
      </div>

      {/* Search */}
      {documents.length > 0 && (
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <FilePdf className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No documents uploaded yet. Upload documents to extract organizational knowledge.
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <MagnifyingGlass className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No documents match your search.</p>
        </div>
      ) : (
        <motion.div layout className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredDocuments.map((doc) => {
              const FileIcon = getFileIcon(doc.file_type)
              return (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                >
                  <FileIcon className="h-8 w-8 flex-shrink-0 text-primary" weight="fill" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-medium">{doc.file_name}</h4>
                      <StatusBadge status={doc.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {doc.word_count && <span>{doc.word_count.toLocaleString()} words</span>}
                      {doc.page_count && (
                        <>
                          <span>•</span>
                          <span>{doc.page_count} pages</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatRelativeTime(new Date(doc.created_at))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => analyzeMutation.mutate(doc.id)}
                        disabled={analyzeMutation.isPending}
                      >
                        {analyzeMutation.isPending ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Lightning className="mr-1 h-4 w-4" />
                        )}
                        Analyze
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <DotsThreeVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {doc.status === "pending" && (
                          <DropdownMenuItem onClick={() => analyzeMutation.mutate(doc.id)}>
                            <Lightning className="mr-2 h-4 w-4" />
                            Analyze
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(doc.id)}
                          className="text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

/**
 * Voice Tab - Manage voice and style settings
 */
function VoiceTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: voiceData, isLoading } = useQuery({
    queryKey: ["knowledge-voice", profileId],
    queryFn: async () => {
      const res = await fetchClient(`/api/knowledge/voice?profile_id=${profileId}`)
      if (!res.ok) throw new Error("Failed to fetch voice elements")
      const data = await res.json()
      return data.elements as KnowledgeVoiceElement[]
    },
  })

  const elements = voiceData || []

  const deleteMutation = useMutation({
    mutationFn: async (elementId: string) => {
      const res = await fetchClient(`/api/knowledge/voice?id=${elementId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-voice", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define how Rōmy should communicate - tone, terminology, and style preferences.
        </p>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {elements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <ChatText className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No voice elements defined yet. Upload documents or add them manually.
          </p>
        </div>
      ) : (
        <motion.div layout className="space-y-2">
          <AnimatePresence mode="popLayout">
            {elements.map((element) => (
              <motion.div
                key={element.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {element.element_type.replace("_", " ")}
                    </Badge>
                    <span className="font-medium">{element.value}</span>
                  </div>
                  {element.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{element.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(element.id)}
                  className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {showForm && (
        <VoiceForm profileId={profileId} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

/**
 * Voice Form Modal
 */
function VoiceForm({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [elementType, setElementType] = useState<VoiceElementType>("tone")
  const [value, setValue] = useState("")
  const [description, setDescription] = useState("")

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/knowledge/voice", {
        method: "POST",
        body: JSON.stringify({
          profile_id: profileId,
          element_type: elementType,
          value,
          description: description || undefined,
        }),
      })
      if (!res.ok) throw new Error("Failed to create voice element")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Voice Element Added" })
      queryClient.invalidateQueries({ queryKey: ["knowledge-voice", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Add Voice Element</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select value={elementType} onValueChange={(v) => setElementType(v as VoiceElementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tone">Tone</SelectItem>
                <SelectItem value="formality">Formality</SelectItem>
                <SelectItem value="terminology">Terminology</SelectItem>
                <SelectItem value="sentence_style">Sentence Style</SelectItem>
                <SelectItem value="emotional_register">Emotional Register</SelectItem>
                <SelectItem value="word_preference">Word Preference</SelectItem>
                <SelectItem value="word_avoidance">Word Avoidance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Value</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g., warm and professional"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When and how to use this"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!value || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Strategy Tab - Manage fundraising strategy rules
 */
function StrategyTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: strategyData, isLoading } = useQuery({
    queryKey: ["knowledge-strategy", profileId],
    queryFn: async () => {
      const res = await fetchClient(`/api/knowledge/strategy?profile_id=${profileId}`)
      if (!res.ok) throw new Error("Failed to fetch strategy rules")
      const data = await res.json()
      return data.rules as KnowledgeStrategyRule[]
    },
  })

  const rules = strategyData || []

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetchClient(`/api/knowledge/strategy?id=${ruleId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-strategy", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define your fundraising approach - cultivation strategies, ask philosophies, and behavioral rules.
        </p>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <ListChecks className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No strategy rules defined yet. Add rules to guide Rōmy's advice.
          </p>
        </div>
      ) : (
        <motion.div layout className="space-y-2">
          <AnimatePresence mode="popLayout">
            {rules.map((rule) => (
              <motion.div
                key={rule.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {rule.category.replace("_", " ")}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Priority {rule.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">{rule.rule}</p>
                  {rule.rationale && (
                    <p className="mt-1 text-xs text-muted-foreground">{rule.rationale}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(rule.id)}
                  className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {showForm && (
        <StrategyForm profileId={profileId} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

/**
 * Strategy Form Modal
 */
function StrategyForm({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<StrategyCategory>("cultivation")
  const [rule, setRule] = useState("")
  const [rationale, setRationale] = useState("")
  const [priority, setPriority] = useState("5")

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/knowledge/strategy", {
        method: "POST",
        body: JSON.stringify({
          profile_id: profileId,
          category,
          rule,
          rationale: rationale || undefined,
          priority: parseInt(priority),
        }),
      })
      if (!res.ok) throw new Error("Failed to create strategy rule")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Strategy Rule Added" })
      queryClient.invalidateQueries({ queryKey: ["knowledge-strategy", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Add Strategy Rule</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as StrategyCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cultivation">Cultivation</SelectItem>
                <SelectItem value="solicitation">Solicitation</SelectItem>
                <SelectItem value="stewardship">Stewardship</SelectItem>
                <SelectItem value="objection_handling">Objection Handling</SelectItem>
                <SelectItem value="ask_philosophy">Ask Philosophy</SelectItem>
                <SelectItem value="donor_segmentation">Donor Segmentation</SelectItem>
                <SelectItem value="communication">Communication</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rule</Label>
            <Textarea
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              placeholder="Describe the rule or guideline..."
              rows={3}
            />
          </div>
          <div>
            <Label>Rationale (optional)</Label>
            <Input
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why is this rule important?"
            />
          </div>
          <div>
            <Label>Priority (1-10)</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n >= 8 ? "(High)" : n >= 4 ? "(Medium)" : "(Low)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!rule || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Facts Tab - Manage organizational knowledge facts
 */
function FactsTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: factsData, isLoading } = useQuery({
    queryKey: ["knowledge-facts", profileId],
    queryFn: async () => {
      const res = await fetchClient(`/api/knowledge/facts?profile_id=${profileId}`)
      if (!res.ok) throw new Error("Failed to fetch facts")
      const data = await res.json()
      return data.facts as KnowledgeFact[]
    },
  })

  const facts = factsData || []

  const deleteMutation = useMutation({
    mutationFn: async (factId: string) => {
      const res = await fetchClient(`/api/knowledge/facts?id=${factId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-facts", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add facts about your organization - mission, programs, impact stories, key people.
        </p>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {facts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Lightbulb className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No facts added yet. Add facts that Rōmy should always know.
          </p>
        </div>
      ) : (
        <motion.div layout className="space-y-2">
          <AnimatePresence mode="popLayout">
            {facts.map((fact) => (
              <motion.div
                key={fact.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {fact.category}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">{fact.fact}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(fact.id)}
                  className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {showForm && (
        <FactForm profileId={profileId} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

/**
 * Fact Form Modal
 */
function FactForm({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<FactCategory>("mission")
  const [fact, setFact] = useState("")

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/knowledge/facts", {
        method: "POST",
        body: JSON.stringify({
          profile_id: profileId,
          category,
          fact,
        }),
      })
      if (!res.ok) throw new Error("Failed to create fact")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Fact Added" })
      queryClient.invalidateQueries({ queryKey: ["knowledge-facts", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Add Fact</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as FactCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mission">Mission</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="programs">Programs</SelectItem>
                <SelectItem value="impact">Impact</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="board">Board</SelectItem>
                <SelectItem value="donors">Donors</SelectItem>
                <SelectItem value="campaigns">Campaigns</SelectItem>
                <SelectItem value="history">History</SelectItem>
                <SelectItem value="values">Values</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fact</Label>
            <Textarea
              value={fact}
              onChange={(e) => setFact(e.target.value)}
              placeholder="Enter an organizational fact..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!fact || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Preview Tab - Test how Rōmy responds with this profile
 */
function PreviewTab({ profileId }: { profileId: string }) {
  const [testPrompt, setTestPrompt] = useState("")
  const [response, setResponse] = useState<string | null>(null)

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/knowledge/preview", {
        method: "POST",
        body: JSON.stringify({
          profile_id: profileId,
          test_prompt: testPrompt,
        }),
      })
      if (!res.ok) throw new Error("Preview failed")
      return res.json()
    },
    onSuccess: (data) => {
      setResponse(data.response)
    },
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Test how Rōmy responds with your knowledge profile. Enter a sample prompt to see the difference.
      </p>

      <div className="space-y-3">
        <Textarea
          placeholder="e.g., Draft a thank you letter for a major donor who gave $10,000..."
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
          rows={3}
        />
        <Button
          onClick={() => previewMutation.mutate()}
          disabled={!testPrompt.trim() || previewMutation.isPending}
        >
          {previewMutation.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-1 h-4 w-4" />
          )}
          Test Response
        </Button>
      </div>

      <div className="min-h-[200px] rounded-lg border border-border bg-muted/30 p-4">
        {response ? (
          <p className="whitespace-pre-wrap text-sm">{response}</p>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Enter a prompt and click "Test Response" to preview how Rōmy would respond with your
            knowledge profile.
          </p>
        )}
      </div>
    </div>
  )
}
