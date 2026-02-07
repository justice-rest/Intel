"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useSplitView } from "@/lib/split-view-store/provider"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FolderSimple } from "@phosphor-icons/react"

type DialogCreateProjectProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

type CreateProjectData = {
  id: string
  name: string
  user_id: string
  created_at: string
}

export function DialogCreateProject({
  isOpen,
  setIsOpen,
}: DialogCreateProjectProps) {
  const [projectName, setProjectName] = useState("")
  const queryClient = useQueryClient()
  const router = useRouter()
  const { isActive: isSplitActive, deactivateSplit } = useSplitView()
  const createProjectMutation = useMutation({
    mutationFn: async (name: string): Promise<CreateProjectData> => {
      const response = await fetchClient("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error("Failed to create project")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      if (isSplitActive) deactivateSplit()
      router.push(`/p/${data.id}`)
      setProjectName("")
      setIsOpen(false)
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (projectName.trim()) {
      createProjectMutation.mutate(projectName.trim())
    }
  }

  const handleClose = () => {
    setProjectName("")
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-5 pt-5 pb-4">
            <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
              <FolderSimple size={20} weight="fill" className="text-muted-foreground" />
              New Project
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
              Create a new project to organize your chats and research.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-4">
            <Input
              placeholder="Enter project name..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              autoFocus
              className="h-10"
            />
          </div>

          <DialogFooter className="px-5 py-4 border-t bg-muted/30">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1 sm:flex-none h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!projectName.trim() || createProjectMutation.isPending}
                className="flex-1 sm:flex-none h-9"
              >
                {createProjectMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
