"use client"

import { useState, useEffect } from "react"
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
import { toast } from "@/components/ui/toast"
import { FolderSimple, Plus, Check, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

type Project = {
  id: string
  name: string
  created_at: string | null
}

type DialogAddToProjectProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  chatId: string
  chatTitle: string
  currentProjectId?: string | null
  onProjectChange: (projectId: string | null) => void
}

export function DialogAddToProject({
  isOpen,
  setIsOpen,
  chatId,
  chatTitle,
  currentProjectId,
  onProjectChange,
}: DialogAddToProjectProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")

  // Fetch projects when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchProjects()
      setSelectedProjectId(currentProjectId || null)
      setIsCreatingNew(false)
      setNewProjectName("")
    }
  }, [isOpen, currentProjectId])

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects")
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      })

      if (response.ok) {
        const newProject = await response.json()
        setProjects((prev) => [...prev, newProject])
        setSelectedProjectId(newProject.id)
        setIsCreatingNew(false)
        setNewProjectName("")
        toast({
          title: "Project created",
          description: `Created "${newProject.name}"`,
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to create project",
        })
      }
    } catch (error) {
      console.error("Error creating project:", error)
      toast({
        title: "Error",
        description: "Failed to create project",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats/${chatId}/project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      })

      if (response.ok) {
        onProjectChange(selectedProjectId)
        setIsOpen(false)
        if (selectedProjectId) {
          const project = projects.find((p) => p.id === selectedProjectId)
          toast({
            title: "Added to project",
            description: `Moved to "${project?.name}"`,
          })
        } else {
          toast({
            title: "Removed from project",
            description: "Chat is now in the main list",
          })
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to update project",
        })
      }
    } catch (error) {
      console.error("Error updating chat project:", error)
      toast({
        title: "Error",
        description: "Failed to update project",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Truncate long chat titles for display
  const truncatedTitle = chatTitle.length > 50 ? `${chatTitle.slice(0, 50)}...` : chatTitle

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <FolderSimple size={20} weight="fill" className="text-muted-foreground" />
            Add to Project
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
            Move &quot;{truncatedTitle}&quot; to a project folder.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-2">
          {isCreatingNew ? (
            <div className="space-y-3 py-2">
              <Label htmlFor="projectName" className="text-sm font-medium">New project name</Label>
              <div className="flex gap-2">
                <Input
                  id="projectName"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProject()
                    if (e.key === "Escape") setIsCreatingNew(false)
                  }}
                  autoFocus
                  className="h-9"
                />
                <Button
                  size="sm"
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || isLoading}
                  className="h-9 px-3"
                >
                  Create
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <ScrollArea className="max-h-[240px]">
              <div className="space-y-1 py-1">
                {/* No project option */}
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(null)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                    selectedProjectId === null
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    selectedProjectId === null
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}>
                    {selectedProjectId === null && (
                      <Check size={12} className="text-primary-foreground" weight="bold" />
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">No project</span>
                </button>

                {/* Project list */}
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                      selectedProjectId === project.id
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      selectedProjectId === project.id
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    )}>
                      {selectedProjectId === project.id && (
                        <Check size={12} className="text-primary-foreground" weight="bold" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{project.name}</span>
                  </button>
                ))}

                {/* Create new project button */}
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-accent/50 mt-1"
                >
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <Plus size={12} className="text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Create new project</span>
                </button>
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="px-5 py-4 border-t bg-muted/30">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1 sm:flex-none h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || isCreatingNew}
              className="flex-1 sm:flex-none h-9"
            >
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
