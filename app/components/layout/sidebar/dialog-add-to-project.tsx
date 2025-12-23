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
import { FolderPlus, Plus, Check } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus size={20} />
            Add to Project
          </DialogTitle>
          <DialogDescription>
            Move &quot;{chatTitle}&quot; to a project folder.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isCreatingNew ? (
            <div className="space-y-3">
              <Label htmlFor="projectName">New project name</Label>
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
                />
                <Button
                  size="sm"
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || isLoading}
                >
                  Create
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingNew(false)}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* No project option */}
              <button
                type="button"
                onClick={() => setSelectedProjectId(null)}
                className={cn(
                  "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                  selectedProjectId === null
                    ? "bg-secondary"
                    : "hover:bg-secondary/50"
                )}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {selectedProjectId === null && (
                    <Check size={14} className="text-primary" weight="bold" />
                  )}
                </div>
                <span className="text-muted-foreground">No project</span>
              </button>

              {/* Project list */}
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                    selectedProjectId === project.id
                      ? "bg-secondary"
                      : "hover:bg-secondary/50"
                  )}
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    {selectedProjectId === project.id && (
                      <Check size={14} className="text-primary" weight="bold" />
                    )}
                  </div>
                  <span>{project.name}</span>
                </button>
              ))}

              {/* Create new project button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingNew(true)}
                className="w-full mt-2"
              >
                <Plus size={16} className="mr-2" />
                Create new project
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || isCreatingNew}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
