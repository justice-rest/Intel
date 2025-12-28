"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { FolderSimple, Plus, CaretDown } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { useState, useEffect } from "react"
import { DialogCreateProject } from "./dialog-create-project"
import { SidebarProjectItem } from "./sidebar-project-item"
import { cn } from "@/lib/utils"

const PROJECTS_COLLAPSED_KEY = "sidebar-projects-collapsed"

type Project = {
  id: string
  name: string
  user_id: string
  created_at: string
}

export function SidebarProject() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(PROJECTS_COLLAPSED_KEY) === "true"
    }
    return false
  })

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(PROJECTS_COLLAPSED_KEY, String(isCollapsed))
  }, [isCollapsed])

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects")
      if (!response.ok) {
        throw new Error("Failed to fetch projects")
      }
      return response.json()
    },
  })

  const toggleCollapsed = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="mb-5">
      <div className="flex items-center">
        <button
          onClick={toggleCollapsed}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <CaretDown
            size={14}
            className={cn(
              "transition-transform duration-200",
              isCollapsed && "-rotate-90"
            )}
          />
        </button>
        <div
          className="hover:bg-accent/80 hover:text-foreground text-primary group/projects relative inline-flex flex-1 items-center rounded-md bg-transparent px-2 py-2 text-sm transition-colors cursor-default"
        >
          <div className="flex items-center gap-2">
            <FolderSimple size={20} />
            Projects
          </div>
        </div>
        {/* Plus button to open create project dialog */}
        <button
          onClick={() => setIsDialogOpen(true)}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/50 p-1.5 rounded-md transition-colors"
          title="New Project"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1 pl-6 mt-1"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-2 px-2 py-2"
                    >
                      <Skeleton className="h-5 w-5 rounded" />
                      <Skeleton className="h-4 flex-1" />
                    </motion.div>
                  ))}
                </motion.div>
              ) : projects.length > 0 ? (
                <motion.div
                  key="projects"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-1 pl-6 mt-1"
                >
                  {projects.map((project, index) => (
                    <SidebarProjectItem
                      key={project.id}
                      project={project}
                      index={index}
                    />
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <DialogCreateProject isOpen={isDialogOpen} setIsOpen={setIsDialogOpen} />
    </div>
  )
}
