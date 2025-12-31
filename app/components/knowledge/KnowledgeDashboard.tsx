"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  MagnifyingGlass,
  FilePdf,
  ChatText,
  Lightbulb,
  ListChecks,
  Play,
  Spinner,
  BookOpen,
} from "@phosphor-icons/react"
import { useUser } from "@/lib/user-store/provider"
import type { ProfileWithCounts, DashboardTab } from "@/lib/knowledge/types"

/**
 * KnowledgeDashboard
 *
 * Main dashboard for managing organizational knowledge profiles.
 * Follows existing UI patterns from MemoryList and IntegrationsSection.
 */
export function KnowledgeDashboard() {
  const { user } = useUser()
  const [profiles, setProfiles] = useState<ProfileWithCounts[]>([])
  const [activeProfile, setActiveProfile] = useState<ProfileWithCounts | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DashboardTab>("documents")
  const [error, setError] = useState<string | null>(null)

  // Fetch profiles on mount
  useEffect(() => {
    if (user?.id) {
      fetchProfiles()
    }
  }, [user?.id])

  const fetchProfiles = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/knowledge/profile")
      const data = await response.json()

      if (data.success) {
        setProfiles(data.profiles)
        // Set active profile to the first active one, or first profile
        const active = data.profiles.find((p: ProfileWithCounts) => p.status === "active")
        setActiveProfile(active || data.profiles[0] || null)
      } else {
        setError(data.error || "Failed to fetch profiles")
      }
    } catch (err) {
      setError("Failed to connect to server")
      console.error("Fetch profiles error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProfile = async () => {
    try {
      const response = await fetch("/api/knowledge/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Profile ${profiles.length + 1}`,
          description: "New knowledge profile",
        }),
      })

      const data = await response.json()
      if (data.success) {
        setProfiles((prev) => [data.profile, ...prev])
        setActiveProfile(data.profile)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError("Failed to create profile")
      console.error("Create profile error:", err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Organizational Knowledge
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                BETA
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Train Romy to communicate like your organization. Upload documents, define
              rules, and add examples.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Selector or Empty State */}
      {profiles.length === 0 ? (
        <EmptyState onCreateProfile={handleCreateProfile} />
      ) : (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
          {/* Profile Selector */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1">
              <select
                value={activeProfile?.id || ""}
                onChange={(e) => {
                  const profile = profiles.find((p) => p.id === e.target.value)
                  setActiveProfile(profile || null)
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.status === "active" ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={handleCreateProfile}>
              <Plus className="h-4 w-4 mr-1" />
              New Profile
            </Button>
          </div>

          {/* Profile Stats */}
          {activeProfile && (
            <div className="grid grid-cols-5 gap-3 mb-6">
              <StatCard
                label="Documents"
                count={activeProfile.document_count}
                icon={FilePdf}
              />
              <StatCard
                label="Voice"
                count={activeProfile.voice_element_count}
                icon={ChatText}
              />
              <StatCard
                label="Rules"
                count={activeProfile.strategy_rule_count}
                icon={ListChecks}
              />
              <StatCard
                label="Facts"
                count={activeProfile.fact_count}
                icon={Lightbulb}
              />
              <StatCard
                label="Examples"
                count={activeProfile.example_count}
                icon={BookOpen}
              />
            </div>
          )}

          {/* Status Badge */}
          {activeProfile && (
            <div className="flex items-center gap-2 mb-6">
              <Badge
                variant="secondary"
                className={
                  activeProfile.status === "active"
                    ? "bg-[#B183FF]/20 text-[#B183FF]"
                    : "bg-muted text-muted-foreground"
                }
              >
                {activeProfile.status === "active" ? "Active" : "Draft"}
              </Badge>
              {activeProfile.prompt_token_count && (
                <span className="text-xs text-muted-foreground">
                  {activeProfile.prompt_token_count} tokens
                </span>
              )}
            </div>
          )}

          {/* Tabs */}
          {activeProfile && (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as DashboardTab)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
                <TabsTrigger value="strategy">Strategy</TabsTrigger>
                <TabsTrigger value="facts">Facts</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="documents" className="mt-4">
                <DocumentsTab profileId={activeProfile.id} />
              </TabsContent>

              <TabsContent value="voice" className="mt-4">
                <VoiceTab profileId={activeProfile.id} />
              </TabsContent>

              <TabsContent value="strategy" className="mt-4">
                <StrategyTab profileId={activeProfile.id} />
              </TabsContent>

              <TabsContent value="facts" className="mt-4">
                <FactsTab profileId={activeProfile.id} />
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <PreviewTab profileId={activeProfile.id} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="text-destructive rounded-md bg-destructive/10 p-3 text-sm"
        >
          {error}
        </motion.div>
      )}
    </div>
  )
}

/**
 * Empty State when no profiles exist
 */
function EmptyState({ onCreateProfile }: { onCreateProfile: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <BookOpen className="text-muted-foreground mb-3 h-12 w-12" />
      <p className="text-muted-foreground text-sm mb-4">
        No knowledge profiles yet. Create your first profile to start training Romy.
      </p>
      <Button onClick={onCreateProfile}>
        <Plus className="h-4 w-4 mr-2" />
        Create Knowledge Profile
      </Button>
    </div>
  )
}

/**
 * Stat Card for profile overview
 */
function StatCard({
  label,
  count,
  icon: Icon,
}: {
  label: string
  count: number
  icon: React.ElementType
}) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <Icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
      <div className="text-lg font-semibold">{count}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * Documents Tab - Upload and manage training documents
 */
function DocumentsTab({ profileId }: { profileId: string }) {
  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div className="border-border relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-muted-foreground/50">
        <FilePdf className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Drag and drop documents here</p>
        <p className="text-muted-foreground text-xs">
          or click to browse (PDF, DOCX, TXT - max 50MB)
        </p>
        <Button variant="outline" size="sm" className="mt-3">
          Choose Files
        </Button>
      </div>

      {/* Document List Placeholder */}
      <div className="flex flex-col items-center justify-center py-8">
        <MagnifyingGlass className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">
          No documents uploaded yet. Upload documents to extract organizational knowledge.
        </p>
      </div>
    </div>
  )
}

/**
 * Voice Tab - Manage voice and style settings
 */
function VoiceTab({ profileId }: { profileId: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Define how Romy should communicate for your organization - tone, terminology, and
        style preferences.
      </p>

      <div className="flex flex-col items-center justify-center py-8">
        <ChatText className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">
          No voice elements defined yet. Upload documents or add them manually.
        </p>
        <Button variant="outline" size="sm" className="mt-3">
          <Plus className="h-4 w-4 mr-1" />
          Add Voice Element
        </Button>
      </div>
    </div>
  )
}

/**
 * Strategy Tab - Manage fundraising strategy rules
 */
function StrategyTab({ profileId }: { profileId: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Define your fundraising approach - cultivation strategies, ask philosophies, and
        behavioral rules.
      </p>

      <div className="flex flex-col items-center justify-center py-8">
        <ListChecks className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">
          No strategy rules defined yet. Add rules to guide Romy's advice.
        </p>
        <Button variant="outline" size="sm" className="mt-3">
          <Plus className="h-4 w-4 mr-1" />
          Add Strategy Rule
        </Button>
      </div>
    </div>
  )
}

/**
 * Facts Tab - Manage organizational knowledge facts
 */
function FactsTab({ profileId }: { profileId: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add facts about your organization - mission, programs, impact stories, key people.
      </p>

      <div className="flex flex-col items-center justify-center py-8">
        <Lightbulb className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">
          No facts added yet. Add facts that Romy should always know.
        </p>
        <Button variant="outline" size="sm" className="mt-3">
          <Plus className="h-4 w-4 mr-1" />
          Add Fact
        </Button>
      </div>
    </div>
  )
}

/**
 * Preview Tab - Test how Romy responds with this profile
 */
function PreviewTab({ profileId }: { profileId: string }) {
  const [testPrompt, setTestPrompt] = useState("")

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Test how Romy responds with your knowledge profile. Enter a sample prompt to see the
        difference.
      </p>

      <div className="space-y-3">
        <Input
          placeholder="e.g., Draft a thank you letter for a major donor..."
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
        />
        <Button disabled={!testPrompt.trim()}>
          <Play className="h-4 w-4 mr-1" />
          Test Response
        </Button>
      </div>

      <div className="rounded-lg border border-border p-4 min-h-[200px] bg-muted/30">
        <p className="text-sm text-muted-foreground text-center py-8">
          Enter a prompt and click "Test Response" to preview how Romy would respond with
          your knowledge profile.
        </p>
      </div>
    </div>
  )
}
