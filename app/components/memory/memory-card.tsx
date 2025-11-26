"use client"

import { useState } from "react"
import { useMemory } from "@/lib/memory-store"
import type { UserMemory } from "@/lib/memory/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  Trash,
  DotsThreeVertical,
  Spinner,
  Star,
  Lightning,
  Circle,
} from "@phosphor-icons/react"
import { formatDistanceToNow } from "@/lib/utils/date"
import { motion } from "motion/react"

interface MemoryCardProps {
  memory: UserMemory
}

function ImportanceBadge({ score }: { score: number }) {
  const config =
    score >= 0.8
      ? {
          icon: Star,
          label: "High",
          className: "bg-[#B183FF]/20 text-[#B183FF]",
        }
      : score >= 0.5
        ? {
            icon: Lightning,
            label: "Medium",
            className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
          }
        : {
            icon: Circle,
            label: "Low",
            className: "bg-muted text-muted-foreground",
          }

  const { icon: Icon, label, className } = config

  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" weight="fill" />
      {label}
    </Badge>
  )
}

function TypeBadge({ isExplicit }: { isExplicit: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1",
        isExplicit
          ? "bg-purple-500/10 text-purple-500"
          : "bg-blue-500/10 text-blue-500"
      )}
    >
      {isExplicit ? "Saved" : "Auto"}
    </Badge>
  )
}

export function MemoryCard({ memory }: MemoryCardProps) {
  const { deleteMemory } = useMemory()
  const [isDeleting, setIsDeleting] = useState(false)

  const metadata = memory.metadata as Record<string, unknown> | null
  const category = (metadata?.category as string) || "general"
  const tags = (metadata?.tags as string[]) || []
  const isExplicit = memory.memory_type === "explicit"

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this memory?")) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteMemory(memory.id)
    } catch (error) {
      console.error("Failed to delete memory:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="group relative rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
    >
      {/* Header row with badges and actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground capitalize">
            {category.replace("_", " ")}
          </span>
          <ImportanceBadge score={memory.importance_score} />
          <TypeBadge isExplicit={isExplicit} />
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <DotsThreeVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Memory Content */}
      <p className="mt-2 text-sm leading-relaxed">{memory.content}</p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((tag: string) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{Math.round(memory.importance_score * 100)}%</span>
        <span>•</span>
        <span>
          {memory.last_accessed_at
            ? `Used ${formatDistanceToNow(new Date(memory.last_accessed_at), { addSuffix: true })}`
            : `Added ${formatDistanceToNow(new Date(memory.created_at), { addSuffix: true })}`}
        </span>
        {memory.access_count > 0 && (
          <>
            <span>•</span>
            <span>
              {memory.access_count} {memory.access_count === 1 ? "use" : "uses"}
            </span>
          </>
        )}
      </div>
    </motion.div>
  )
}
