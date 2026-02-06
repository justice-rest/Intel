"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { Brain, Check, PencilSimple, Trash, CaretDown } from "@phosphor-icons/react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  KnowledgeProfile,
  KnowledgeMergeMode,
  ChatKnowledgeConfig,
} from "@/lib/knowledge/types"
import { TOKEN_BUDGET, TOKEN_WARNING_THRESHOLD } from "@/lib/knowledge/config"

type DialogChatKnowledgeProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  chatId: string
  chatTitle: string
  onKnowledgeChange?: () => void
}

type DialogMode = "loading" | "view" | "create" | "edit"

export function DialogChatKnowledge({
  isOpen,
  setIsOpen,
  chatId,
  chatTitle,
  onKnowledgeChange,
}: DialogChatKnowledgeProps) {
  const [mode, setMode] = useState<DialogMode>("loading")
  const [isLoading, setIsLoading] = useState(false)
  const [config, setConfig] = useState<ChatKnowledgeConfig | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [mergeMode, setMergeMode] = useState<KnowledgeMergeMode>("replace")
  const [voiceContent, setVoiceContent] = useState("")
  const [strategyContent, setStrategyContent] = useState("")
  const [knowledgeContent, setKnowledgeContent] = useState("")
  const [rulesContent, setRulesContent] = useState("")
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const fetchConfig = useCallback(async () => {
    setMode("loading")
    setConfirmRemove(false)
    try {
      const response = await fetch(`/api/chat-knowledge?chatId=${chatId}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data: ChatKnowledgeConfig = await response.json()
      setConfig(data)

      if (data.has_chat_scoped_profile && data.chat_scoped_profile) {
        populateForm(data.chat_scoped_profile)
        setMode("view")
      } else {
        resetForm()
        setMode("create")
      }
    } catch (error) {
      console.error("Error fetching chat knowledge config:", error)
      toast({ title: "Error", description: "Failed to load chat knowledge settings" })
      setIsOpen(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  useEffect(() => {
    if (isOpen) fetchConfig()
  }, [isOpen, fetchConfig])

  const populateForm = (profile: KnowledgeProfile) => {
    setName(profile.name || "")
    setDescription(profile.description || "")
    setMergeMode(profile.merge_mode || "replace")
    setVoiceContent(profile.voice_prompt || "")
    setStrategyContent(profile.strategy_prompt || "")
    setKnowledgeContent(profile.knowledge_prompt || "")
    setRulesContent(profile.rules_prompt || "")
    // Expand sections that have content
    const expanded = new Set<string>()
    if (profile.voice_prompt) expanded.add("voice")
    if (profile.strategy_prompt) expanded.add("strategy")
    if (profile.knowledge_prompt) expanded.add("knowledge")
    if (profile.rules_prompt) expanded.add("rules")
    setExpandedSections(expanded)
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setMergeMode("replace")
    setVoiceContent("")
    setStrategyContent("")
    setKnowledgeContent("")
    setRulesContent("")
    setExpandedSections(new Set())
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const estimateTokenCount = (): number => {
    const text = [voiceContent, strategyContent, knowledgeContent, rulesContent]
      .filter(Boolean)
      .join(" ")
    return Math.ceil(text.length / 4)
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Profile name is required" })
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch("/api/chat-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          action: "create",
          name: name.trim(),
          description: description.trim() || undefined,
          merge_mode: mergeMode,
          voice_content: voiceContent.trim() || undefined,
          strategy_content: strategyContent.trim() || undefined,
          knowledge_content: knowledgeContent.trim() || undefined,
          rules_content: rulesContent.trim() || undefined,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to create profile")
      }
      toast({
        title: "Chat knowledge created",
        description: `Knowledge profile "${name.trim()}" applied`,
      })
      onKnowledgeChange?.()
      await fetchConfig()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create profile",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!config?.chat_scoped_profile?.id) return
    setIsLoading(true)
    try {
      const response = await fetch("/api/chat-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          action: "update",
          profile_id: config.chat_scoped_profile.id,
          name: name.trim() || undefined,
          description: description.trim() || null,
          merge_mode: mergeMode,
          voice_content: voiceContent.trim() || null,
          strategy_content: strategyContent.trim() || null,
          knowledge_content: knowledgeContent.trim() || null,
          rules_content: rulesContent.trim() || null,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to update profile")
      }
      toast({ title: "Chat knowledge updated", description: "Changes saved successfully" })
      onKnowledgeChange?.()
      await fetchConfig()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemove = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/chat-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: "remove" }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to remove profile")
      }
      toast({
        title: "Chat knowledge removed",
        description: "Chat will use your global knowledge profile",
      })
      onKnowledgeChange?.()
      resetForm()
      setMode("create")
      setConfig(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove profile",
      })
    } finally {
      setIsLoading(false)
      setConfirmRemove(false)
    }
  }

  const handleMergeModeChange = async (newMode: KnowledgeMergeMode) => {
    const previousMode = mergeMode
    setMergeMode(newMode)

    // Live-update when viewing existing profile
    if (mode === "view" && config?.chat_scoped_profile?.id) {
      try {
        const response = await fetch("/api/chat-knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            action: "update",
            profile_id: config.chat_scoped_profile.id,
            merge_mode: newMode,
          }),
        })
        if (!response.ok) throw new Error("Failed to update")
        onKnowledgeChange?.()
      } catch {
        setMergeMode(previousMode)
        toast({ title: "Error", description: "Failed to update merge mode" })
      }
    }
  }

  const truncatedTitle =
    chatTitle.length > 50 ? `${chatTitle.slice(0, 50)}...` : chatTitle

  const tokenCount = estimateTokenCount()
  const tokenPercentage = tokenCount / TOKEN_BUDGET.total
  const isWarning = tokenPercentage >= TOKEN_WARNING_THRESHOLD
  const isOverBudget = tokenPercentage > 1.2

  const contentSections = [
    { key: "voice", label: "Voice & Style", value: voiceContent, setter: setVoiceContent, placeholder: "Describe the tone, formality, and communication style..." },
    { key: "strategy", label: "Strategy Rules", value: strategyContent, setter: setStrategyContent, placeholder: "Define fundraising approach rules..." },
    { key: "knowledge", label: "Facts & Knowledge", value: knowledgeContent, setter: setKnowledgeContent, placeholder: "Add organizational facts, campaign details, or context..." },
    { key: "rules", label: "Rules", value: rulesContent, setter: setRulesContent, placeholder: "Behavioral rules or constraints..." },
  ]

  const filledSectionCount = contentSections.filter((s) => s.value.trim()).length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <Brain size={20} weight="fill" className="text-muted-foreground" />
            Chat Knowledge
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
            {mode === "create"
              ? `Add knowledge specific to "${truncatedTitle}".`
              : mode === "view"
                ? `Knowledge profile for "${truncatedTitle}".`
                : `Edit knowledge for "${truncatedTitle}".`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-2">
          {mode === "loading" ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : mode === "view" ? (
            /* ——————————————————— VIEW MODE ——————————————————— */
            <ScrollArea className="max-h-[320px]">
              <div className="space-y-1 py-1">
                {/* Profile info */}
                <div className="px-3 py-2.5">
                  <p className="text-sm font-medium">{config!.chat_scoped_profile!.name}</p>
                  {config!.chat_scoped_profile!.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {config!.chat_scoped_profile!.description}
                    </p>
                  )}
                  {filledSectionCount > 0 && (
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {filledSectionCount} knowledge {filledSectionCount === 1 ? "section" : "sections"} configured
                    </p>
                  )}
                </div>

                {/* Merge mode — radio list matching persona style */}
                <div className="pt-1">
                  <p className="px-3 text-xs text-muted-foreground/60 font-medium mb-1">
                    Global profile behavior
                  </p>
                  <MergeOption
                    label="Replace global"
                    description="Only this chat's knowledge is used"
                    selected={mergeMode === "replace"}
                    onClick={() => handleMergeModeChange("replace")}
                  />
                  <MergeOption
                    label="Merge with global"
                    description={
                      config?.global_active_profile
                        ? `Combines with "${config.global_active_profile.name}"`
                        : "No global profile active"
                    }
                    selected={mergeMode === "merge"}
                    onClick={() => handleMergeModeChange("merge")}
                    dimmed={!config?.global_active_profile}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 px-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setMode("edit")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <PencilSimple size={14} />
                    Edit
                  </button>
                  <span className="text-muted-foreground/30">|</span>
                  {confirmRemove ? (
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleRemove}
                        disabled={isLoading}
                        className="text-sm text-destructive hover:text-destructive/80 transition-colors font-medium"
                      >
                        {isLoading ? "Removing..." : "Confirm remove"}
                      </button>
                      <span className="text-muted-foreground/30">|</span>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(false)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(true)}
                      className="flex items-center gap-1.5 text-sm text-destructive/70 hover:text-destructive transition-colors"
                    >
                      <Trash size={14} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : (
            /* ——————————— CREATE / EDIT MODE ——————————— */
            <ScrollArea className="max-h-[380px]">
              <div className="space-y-3 py-1">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="ck-name" className="text-sm font-medium">
                    Profile name
                  </Label>
                  <Input
                    id="ck-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Annual Gala Campaign"
                    className="h-9"
                    maxLength={100}
                    autoFocus={mode === "create"}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="ck-desc" className="text-sm font-medium text-muted-foreground">
                    Description
                  </Label>
                  <Input
                    id="ck-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="h-9"
                    maxLength={200}
                  />
                </div>

                {/* Merge mode — radio list */}
                <div className="pt-1">
                  <Label className="text-sm font-medium">Global profile behavior</Label>
                  <div className="mt-1.5 space-y-1">
                    <MergeOption
                      label="Replace global"
                      description="Only this chat's knowledge is used"
                      selected={mergeMode === "replace"}
                      onClick={() => handleMergeModeChange("replace")}
                    />
                    <MergeOption
                      label="Merge with global"
                      description={
                        config?.global_active_profile
                          ? `Combines with "${config.global_active_profile.name}"`
                          : "No global profile active"
                      }
                      selected={mergeMode === "merge"}
                      onClick={() => handleMergeModeChange("merge")}
                      dimmed={!config?.global_active_profile}
                    />
                  </div>
                </div>

                {/* Collapsible content sections */}
                <div className="pt-1 space-y-1">
                  <p className="text-xs text-muted-foreground/60 font-medium px-0.5 mb-1">
                    Knowledge content
                  </p>
                  {contentSections.map((section) => (
                    <div key={section.key}>
                      <button
                        type="button"
                        onClick={() => toggleSection(section.key)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-all",
                          expandedSections.has(section.key)
                            ? "bg-accent"
                            : "hover:bg-accent/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              section.value.trim()
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {section.value.trim() && (
                              <Check size={12} className="text-primary-foreground" weight="bold" />
                            )}
                          </div>
                          <span className="text-sm font-medium">{section.label}</span>
                        </div>
                        <CaretDown
                          size={14}
                          className={cn(
                            "text-muted-foreground transition-transform",
                            expandedSections.has(section.key) && "rotate-180"
                          )}
                        />
                      </button>
                      {expandedSections.has(section.key) && (
                        <div className="px-3 pt-2 pb-1">
                          <Textarea
                            value={section.value}
                            onChange={(e) => section.setter(e.target.value)}
                            placeholder={section.placeholder}
                            className="min-h-[72px] text-sm resize-none"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Token budget — only show when there's content */}
                {tokenCount > 0 && (
                  <div
                    className={cn(
                      "flex items-center justify-between text-xs px-3 py-1.5 rounded-lg",
                      isOverBudget
                        ? "bg-destructive/10 text-destructive"
                        : isWarning
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          : "text-muted-foreground/60"
                    )}
                  >
                    <span>~{tokenCount} tokens</span>
                    <span className="font-mono text-[11px]">
                      / {TOKEN_BUDGET.total} budget
                    </span>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {mode !== "loading" && (
          <DialogFooter className="px-5 py-4 border-t bg-muted/30">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  if (mode === "edit" && config?.has_chat_scoped_profile) {
                    populateForm(config.chat_scoped_profile!)
                    setMode("view")
                  } else {
                    setIsOpen(false)
                  }
                }}
                className="flex-1 sm:flex-none h-9"
              >
                {mode === "edit" ? "Cancel" : mode === "view" ? "Close" : "Cancel"}
              </Button>
              {(mode === "create" || mode === "edit") && (
                <Button
                  onClick={mode === "create" ? handleCreate : handleUpdate}
                  disabled={isLoading || (!name.trim() && mode === "create")}
                  className="flex-1 sm:flex-none h-9"
                >
                  {isLoading ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Shared sub-components — matching persona dialog's radio-selection pattern
// ============================================================================

function MergeOption({
  label,
  description,
  selected,
  onClick,
  dimmed,
}: {
  label: string
  description: string
  selected: boolean
  onClick: () => void
  dimmed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
        selected ? "bg-accent" : "hover:bg-accent/50",
        dimmed && "opacity-50"
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
          selected ? "border-primary bg-primary" : "border-muted-foreground/30"
        )}
      >
        {selected && (
          <Check size={12} className="text-primary-foreground" weight="bold" />
        )}
      </div>
      <div className="min-w-0">
        <span className="text-sm font-medium">{label}</span>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {description}
        </p>
      </div>
    </button>
  )
}
