"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { FolderSimple, Plus, CaretRight } from "@phosphor-icons/react"
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

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="mb-5">
      {/* Section Header */}
      <div className="group/section flex items-center h-9 px-2 rounded-md hover:bg-accent/50 transition-colors">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <CaretRight
            size={12}
            weight="bold"
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              !isCollapsed && "rotate-90"
            )}
          />
          <FolderSimple size={18} weight="duotone" className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground/90">Projects</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsDialogOpen(true)
          }}
          className="opacity-0 group-hover/section:opacity-100 text-muted-foreground hover:text-foreground p-1 rounded transition-all"
          title="New Project"
        >
          <Plus size={14} weight="bold" />
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
                  className="mt-0.5 space-y-0.5 ml-[26px]"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-2 px-2 py-1.5"
                    >
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 flex-1" />
                    </motion.div>
                  ))}
                </motion.div>
              ) : projects.length > 0 ? (
                <motion.div
                  key="projects"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-0.5 space-y-0.5 ml-[26px]"
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
