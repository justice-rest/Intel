"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  FilePdf,
  FileDoc,
  FileText,
  ChatText,
  Lightbulb,
  ListChecks,
  BookOpen,
  Trash,
  CheckCircle,
  Lightning,
  Upload,
  Sparkle,
  Globe,
} from "@phosphor-icons/react"
import { Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { KnowledgeUrlImportForm } from "./KnowledgeUrlImportForm"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchClient } from "@/lib/fetch"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { WorkspaceSection } from "@/app/components/layout/settings/integrations"
import type {
  ProfileWithCounts,
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
 * Redesigned to match the Workspace (Google Integration) design pattern:
 * - Single compact container with internal grid sections
 * - Collapsible lists with height animations
 * - Dense, information-rich layout
 * - Subtle colors and tight spacing
 */
export function KnowledgeDashboard() {
  const queryClient = useQueryClient()
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isCreatingProfile, setIsCreatingProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState("")

  // Expanded sections state
  const [expandedSection, setExpandedSection] = useState<string | null>("documents")

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

  const profiles = useMemo(() => profilesData ?? [], [profilesData])
  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || profiles[0] || null,
    [profiles, activeProfileId]
  )

  // Set initial active profile
  useEffect(() => {
    if (!activeProfileId && profiles.length > 0) {
      setActiveProfileId(profiles[0].id)
    }
  }, [activeProfileId, profiles])

  // Create profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetchClient("/api/knowledge/profile", {
        method: "POST",
        body: JSON.stringify({ name, description: "" }),
      })
      if (!res.ok) throw new Error("Failed to create profile")
      return res.json()
    },
    onSuccess: (data) => {
      toast({ title: "Profile Created" })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      setActiveProfileId(data.profile.id)
      setIsCreatingProfile(false)
      setNewProfileName("")
    },
    onError: () => {
      toast({ title: "Failed to create profile" })
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
      setActiveProfileId(null)
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

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  if (isLoadingProfiles) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-semibold text-black dark:text-white">
          Knowledge
        </h3>
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
          BETA
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Train Rōmy with your organization&apos;s voice, strategy, and facts.
      </p>

      {/* Main Card */}
      <div className="p-4 bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded">
        {profiles.length === 0 && !isCreatingProfile ? (
          /* Empty State */
          <div className="text-center py-6">
            <BookOpen size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium text-black dark:text-white mb-1">
              No Knowledge Profiles
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Create a profile to start training Rōmy for your organization.
            </p>
            <button
              type="button"
              onClick={() => setIsCreatingProfile(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-black transition-colors"
            >
              <Plus size={14} />
              Create Profile
            </button>
          </div>
        ) : isCreatingProfile ? (
          /* Create Profile Inline Form */
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500 dark:text-gray-400">Profile Name</Label>
              <Input
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="e.g., Main Organization Profile"
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createProfileMutation.mutate(newProfileName || "My Profile")}
                disabled={createProfileMutation.isPending}
              >
                {createProfileMutation.isPending && <Loader2 className="mr-1 size-3 animate-spin" />}
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsCreatingProfile(false)
                  setNewProfileName("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Profile Dashboard */
          <div className="space-y-4">
            {/* Profile Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {profiles.length > 1 ? (
                  <Select value={activeProfileId || ""} onValueChange={setActiveProfileId}>
                    <SelectTrigger className="h-8 w-auto min-w-[160px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-medium text-black dark:text-white">
                    {activeProfile?.name}
                  </span>
                )}
                {activeProfile?.status === "active" && (
                  <CheckCircle size={14} weight="fill" className="text-green-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeProfile?.status !== "active" && (
                  <button
                    type="button"
                    onClick={() => activeProfile && activateProfileMutation.mutate(activeProfile.id)}
                    disabled={activateProfileMutation.isPending}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  >
                    {activateProfileMutation.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Lightning size={12} />
                    )}
                    Activate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors"
                >
                  <Plus size={12} />
                  New
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  <Trash size={12} />
                </button>
              </div>
            </div>

            <hr className="border-gray-200 dark:border-[#333]" />

            {/* Knowledge Sections Grid */}
            {activeProfile && (
              <div className="rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] overflow-hidden">
                <div className="grid grid-cols-2 sm:grid-cols-4">
                  {/* Documents */}
                  <SectionHeader
                    icon={FilePdf}
                    label="Documents"
                    count={activeProfile.document_count}
                    expanded={expandedSection === "documents"}
                    onClick={() => toggleSection("documents")}
                    className="border-r border-b sm:border-b-0 border-gray-200 dark:border-[#333]"
                  />

                  {/* Voice */}
                  <SectionHeader
                    icon={ChatText}
                    label="Voice"
                    count={activeProfile.voice_element_count}
                    expanded={expandedSection === "voice"}
                    onClick={() => toggleSection("voice")}
                    className="border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-[#333]"
                  />

                  {/* Strategy */}
                  <SectionHeader
                    icon={ListChecks}
                    label="Strategy"
                    count={activeProfile.strategy_rule_count}
                    expanded={expandedSection === "strategy"}
                    onClick={() => toggleSection("strategy")}
                    className="border-r border-gray-200 dark:border-[#333]"
                  />

                  {/* Facts */}
                  <SectionHeader
                    icon={Lightbulb}
                    label="Facts"
                    count={activeProfile.fact_count}
                    expanded={expandedSection === "facts"}
                    onClick={() => toggleSection("facts")}
                  />
                </div>

                {/* Expanded Content */}
                <AnimatePresence mode="wait">
                  {expandedSection && (
                    <motion.div
                      key={expandedSection}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-gray-200 dark:border-[#333]"
                    >
                      <div className="p-4">
                        {expandedSection === "documents" && (
                          <DocumentsSection profileId={activeProfile.id} />
                        )}
                        {expandedSection === "voice" && (
                          <VoiceSection profileId={activeProfile.id} />
                        )}
                        {expandedSection === "strategy" && (
                          <StrategySection profileId={activeProfile.id} />
                        )}
                        {expandedSection === "facts" && (
                          <FactsSection profileId={activeProfile.id} />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Token Usage */}
            {activeProfile?.prompt_token_count && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {activeProfile.prompt_token_count} tokens used in knowledge prompt
              </p>
            )}
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
        Knowledge shapes how Rōmy communicates and advises, distinct from RAG document search.
      </p>

      {/* Workspace: Notion, RAG Documents, Memory */}
      <div className="mt-8">
        <WorkspaceSection />
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">
              Delete Knowledge Profile
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              This will delete all documents, voice elements, strategy rules, and facts.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 dark:border-[#444]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activeProfile && deleteProfileMutation.mutate(activeProfile.id)}
              disabled={deleteProfileMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteProfileMutation.isPending && <Loader2 className="mr-2 size-3 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Section Header - Clickable grid item
 */
function SectionHeader({
  icon: Icon,
  label,
  count,
  expanded,
  onClick,
  className,
}: {
  icon: React.ElementType
  label: string
  count: number
  expanded: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-3 flex flex-col items-center justify-center text-center transition-colors",
        expanded
          ? "bg-gray-100 dark:bg-[#2a2a2a]"
          : "hover:bg-gray-50 dark:hover:bg-[#252525]",
        className
      )}
    >
      <Icon size={18} className="text-gray-500 dark:text-gray-400 mb-1" />
      <span className="text-lg font-semibold text-black dark:text-white">{count}</span>
      <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
    </button>
  )
}

/**
 * Documents Section
 */
function DocumentsSection({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { data: documentsData, isLoading } = useQuery({
    queryKey: ["knowledge-documents", profileId],
    queryFn: async () => {
      const res = await fetchClient(`/api/knowledge/documents?profile_id=${profileId}`)
      if (!res.ok) throw new Error("Failed to fetch documents")
      return (await res.json()).documents as KnowledgeDocument[]
    },
  })

  const documents = documentsData || []

  const analyzeMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetchClient("/api/knowledge/documents/analyze", {
        method: "POST",
        body: JSON.stringify({ document_id: documentId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Analysis failed")
      return res.json()
    },
    onSuccess: (data) => {
      toast({ title: "Analysis Complete", description: `Extracted ${data.analysis?.counts?.voice_elements || 0} voice elements, ${data.analysis?.counts?.strategy_rules || 0} rules, ${data.analysis?.counts?.facts || 0} facts` })
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-voice", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-strategy", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-facts", profileId] })
    },
    onError: (error) => {
      toast({ title: "Analysis Failed", description: error instanceof Error ? error.message : "Unknown error" })
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", profileId] })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("profile_id", profileId)
      const res = await fetch("/api/knowledge/documents", { method: "POST", body: formData })
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed")
      return res.json()
    },
    onSuccess: (data) => {
      toast({ title: "Uploaded", description: "Starting AI analysis..." })
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", profileId] })
      // Auto-trigger analysis
      if (data.document?.id) {
        analyzeMutation.mutate(data.document.id)
      }
    },
    onError: (error) => {
      toast({ title: "Upload Failed", description: error instanceof Error ? error.message : "Unknown error" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetchClient(`/api/knowledge/documents/${documentId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => uploadMutation.mutate(file))
  }, [uploadMutation])

  const getFileIcon = (type: string) => {
    if (type === "text/html") return Globe
    if (type.includes("pdf")) return FilePdf
    if (type.includes("word") || type.includes("docx")) return FileDoc
    return FileText
  }

  const getStatusConfig = (status: KnowledgeDocument["status"]) => ({
    pending: { label: "Pending", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    processing: { label: "Processing", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    analyzed: { label: "Ready", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  }[status])

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="space-y-3">
      {/* Upload / Import Tabs */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="h-8 w-full bg-gray-100 dark:bg-[#2a2a2a] p-0.5">
          <TabsTrigger value="upload" className="flex-1 h-7 text-[11px] gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1a1a1a]">
            <Upload size={12} />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="link" className="flex-1 h-7 text-[11px] gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1a1a1a]">
            <Globe size={12} />
            Add Link
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-3 rounded border-2 border-dashed cursor-pointer transition-colors",
              isDragging ? "border-purple-500 bg-purple-50 dark:bg-purple-900/10" : "border-gray-200 dark:border-[#444] hover:border-gray-300 dark:hover:border-[#555]"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            {uploadMutation.isPending ? (
              <Loader2 className="size-4 animate-spin text-purple-500" />
            ) : (
              <Upload size={16} className="text-gray-400" />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {uploadMutation.isPending ? "Uploading..." : "Drop files or click to upload"}
            </span>
          </div>
        </TabsContent>
        <TabsContent value="link" className="mt-2">
          <KnowledgeUrlImportForm profileId={profileId} />
        </TabsContent>
      </Tabs>

      {/* Document List */}
      {documents.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
          Upload documents to extract organizational knowledge.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {documents.map((doc) => {
            const FileIcon = getFileIcon(doc.file_type)
            const statusConfig = getStatusConfig(doc.status)
            return (
              <div
                key={doc.id}
                className="flex items-center gap-2 text-xs p-2 rounded hover:bg-gray-50 dark:hover:bg-[#252525] group"
              >
                <FileIcon size={14} className="text-gray-400 flex-shrink-0" weight="fill" />
                <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">
                  {doc.file_name}
                </span>
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0", statusConfig.className)}>
                  {statusConfig.label}
                </span>
                {doc.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => analyzeMutation.mutate(doc.id)}
                    disabled={analyzeMutation.isPending}
                    className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors"
                  >
                    {analyzeMutation.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkle size={12} className="text-purple-500" weight="fill" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(doc.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash size={12} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Voice Section
 */
function VoiceSection({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [elementType, setElementType] = useState<VoiceElementType>("tone")
  const [value, setValue] = useState("")

  const { data: voiceData, isLoading } = useQuery({
    queryKey: ["knowledge-voice", profileId],
    queryFn: async () => {
      const res = await fetchClient(`/api/knowledge/voice?profile_id=${profileId}`)
      if (!res.ok) throw new Error("Failed to fetch voice elements")
      return (await res.json()).elements as KnowledgeVoiceElement[]
    },
  })

  const elements = voiceData || []

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/knowledge/voice", {
        method: "POST",
        body: JSON.stringify({ profile_id: profileId, element_type: elementType, value }),
      })
      if (!res.ok) throw new Error("Failed to create")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-voice", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      setIsAdding(false)
      setValue("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchClient(`/api/knowledge/voice?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-voice", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  const typeLabels: Record<VoiceElementType, string> = {
    tone: "Tone",
    formality: "Formality",
    terminology: "Term",
    sentence_style: "Style",
    emotional_register: "Emotion",
    word_preference: "Prefer",
    word_avoidance: "Avoid",
  }

  const typeOptions: { value: VoiceElementType; label: string }[] = [
    { value: "tone", label: "Tone" },
    { value: "formality", label: "Formality" },
    { value: "terminology", label: "Terminology" },
    { value: "sentence_style", label: "Style" },
    { value: "emotional_register", label: "Emotion" },
    { value: "word_preference", label: "Prefer" },
    { value: "word_avoidance", label: "Avoid" },
  ]

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="space-y-3">
      {/* Add Form - Elegant inline */}
      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setElementType(opt.value)}
                    className={cn(
                      "px-2 py-1 text-[11px] rounded transition-colors",
                      elementType === opt.value
                        ? "bg-purple-500 text-white font-medium"
                        : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333] hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={elementType === "word_avoidance" ? "Word to avoid..." : elementType === "word_preference" ? "Word to prefer..." : "e.g., warm and professional"}
                className="w-full bg-transparent text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none border-b border-gray-300 dark:border-[#444] pb-2 focus:border-purple-400 transition-colors"
                autoFocus
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-500">
                  Defines how Rōmy communicates
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAdding(false); setValue("") }}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => createMutation.mutate()}
                    disabled={!value.trim() || createMutation.isPending}
                    className="px-3 py-1 text-xs font-medium rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <Plus size={12} />
            Add voice element
          </motion.button>
        )}
      </AnimatePresence>

      {/* Elements List */}
      {elements.length === 0 && !isAdding ? (
        <p className="text-xs text-gray-500 text-center py-2">
          Define how Rōmy should communicate.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {elements.map((el) => (
            <div key={el.id} className="flex items-center gap-2 text-xs p-2 rounded hover:bg-gray-50 dark:hover:bg-[#252525] group">
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-medium flex-shrink-0">
                {typeLabels[el.element_type]}
              </span>
              <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">{el.value}</span>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(el.id)}
                className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash size={12} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Strategy Section
 */
function StrategySection({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [category, setCategory] = useState<StrategyCategory>("cultivation")
  const [rule, setRule] = useState("")

  const { data: strategyData, isLoading } = useQuery({
    queryKey: ["knowledge-strategy", profileId],
    queryFn: async () => {
      const res = await fetchClient(`/api/knowledge/strategy?profile_id=${profileId}`)
      if (!res.ok) throw new Error("Failed to fetch strategy rules")
      return (await res.json()).rules as KnowledgeStrategyRule[]
    },
  })

  const rules = strategyData || []

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/knowledge/strategy", {
        method: "POST",
        body: JSON.stringify({ profile_id: profileId, category, rule, priority: 5 }),
      })
      if (!res.ok) throw new Error("Failed to create")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-strategy", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      setIsAdding(false)
      setRule("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchClient(`/api/knowledge/strategy?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-strategy", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  const categoryLabels: Record<StrategyCategory, string> = {
    cultivation: "Cult",
    solicitation: "Ask",
    stewardship: "Steward",
    objection_handling: "Objection",
    ask_philosophy: "Philosophy",
    donor_segmentation: "Segment",
    communication: "Comms",
    general: "General",
  }

  const categoryOptions: { value: StrategyCategory; label: string }[] = [
    { value: "cultivation", label: "Cultivation" },
    { value: "solicitation", label: "Solicitation" },
    { value: "stewardship", label: "Stewardship" },
    { value: "objection_handling", label: "Objection Handling" },
    { value: "ask_philosophy", label: "Ask Philosophy" },
    { value: "donor_segmentation", label: "Segmentation" },
    { value: "communication", label: "Communication" },
    { value: "general", label: "General" },
  ]

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="space-y-3">
      {/* Add Form - Elegant inline */}
      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={cn(
                      "px-2 py-1 text-[11px] rounded transition-colors",
                      category === opt.value
                        ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                        : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333] hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                value={rule}
                onChange={(e) => setRule(e.target.value)}
                placeholder="Describe the strategy rule..."
                className="w-full bg-transparent text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none border-b border-gray-300 dark:border-[#444] pb-2 focus:border-gray-500 dark:focus:border-gray-400 transition-colors"
                autoFocus
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-500">
                  Press Enter to add, Esc to cancel
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAdding(false); setRule("") }}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => createMutation.mutate()}
                    disabled={!rule.trim() || createMutation.isPending}
                    className="px-3 py-1 text-xs font-medium rounded bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <Plus size={12} />
            Add strategy rule
          </motion.button>
        )}
      </AnimatePresence>

      {/* Rules List */}
      {rules.length === 0 && !isAdding ? (
        <p className="text-xs text-gray-500 text-center py-2">
          Add rules to guide Rōmy&apos;s fundraising approach.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {rules.map((r) => (
            <div key={r.id} className="flex items-start gap-2 text-xs p-2 rounded hover:bg-gray-50 dark:hover:bg-[#252525] group">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-medium flex-shrink-0 mt-0.5">
                {categoryLabels[r.category]}
              </span>
              <span className="flex-1 min-w-0 text-gray-700 dark:text-gray-300 leading-relaxed">{r.rule}</span>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(r.id)}
                className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash size={12} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Facts Section
 */
function FactsSection({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [category, setCategory] = useState<FactCategory>("mission")
  const [fact, setFact] = useState("")

  const { data: factsData, isLoading } = useQuery({
    queryKey: ["knowledge-facts", profileId],
    queryFn: async () => {
      const res = await fetchClient(`/api/knowledge/facts?profile_id=${profileId}`)
      if (!res.ok) throw new Error("Failed to fetch facts")
      return (await res.json()).facts as KnowledgeFact[]
    },
  })

  const facts = factsData || []

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/knowledge/facts", {
        method: "POST",
        body: JSON.stringify({ profile_id: profileId, category, fact }),
      })
      if (!res.ok) throw new Error("Failed to create")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-facts", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
      setIsAdding(false)
      setFact("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchClient(`/api/knowledge/facts?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-facts", profileId] })
      queryClient.invalidateQueries({ queryKey: ["knowledge-profiles"] })
    },
  })

  const categoryLabels: Record<FactCategory, string> = {
    mission: "Mission",
    organization: "Org",
    programs: "Programs",
    impact: "Impact",
    staff: "Staff",
    board: "Board",
    donors: "Donors",
    campaigns: "Campaign",
    history: "History",
    values: "Values",
  }

  const categoryOptions: { value: FactCategory; label: string }[] = [
    { value: "mission", label: "Mission" },
    { value: "organization", label: "Organization" },
    { value: "programs", label: "Programs" },
    { value: "impact", label: "Impact" },
    { value: "staff", label: "Staff" },
    { value: "board", label: "Board" },
    { value: "donors", label: "Donors" },
    { value: "campaigns", label: "Campaigns" },
    { value: "history", label: "History" },
    { value: "values", label: "Values" },
  ]

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="space-y-3">
      {/* Add Form - Elegant inline */}
      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={cn(
                      "px-2 py-1 text-[11px] rounded transition-colors",
                      category === opt.value
                        ? "bg-amber-500 text-black font-medium"
                        : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333] hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                value={fact}
                onChange={(e) => setFact(e.target.value)}
                placeholder="Enter an organizational fact..."
                className="w-full bg-transparent text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none border-b border-gray-300 dark:border-[#444] pb-2 focus:border-amber-400 transition-colors"
                autoFocus
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-500">
                  Facts Rōmy should always know
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAdding(false); setFact("") }}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => createMutation.mutate()}
                    disabled={!fact.trim() || createMutation.isPending}
                    className="px-3 py-1 text-xs font-medium rounded bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <Plus size={12} />
            Add fact
          </motion.button>
        )}
      </AnimatePresence>

      {/* Facts List */}
      {facts.length === 0 && !isAdding ? (
        <p className="text-xs text-gray-500 text-center py-2">
          Add facts that Rōmy should always know about your organization.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {facts.map((f) => (
            <div key={f.id} className="flex items-start gap-2 text-xs p-2 rounded hover:bg-gray-50 dark:hover:bg-[#252525] group">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-medium flex-shrink-0 mt-0.5">
                {categoryLabels[f.category]}
              </span>
              <span className="flex-1 min-w-0 text-gray-700 dark:text-gray-300 leading-relaxed">{f.fact}</span>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(f.id)}
                className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash size={12} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

