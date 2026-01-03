"use client"

import { cn } from "@/lib/utils"
import type { CollaboratorRole } from "@/lib/collaboration/types"
import { Crown, PencilSimple, Eye } from "@phosphor-icons/react"

interface CollaboratorBadgeProps {
  role: CollaboratorRole
  size?: "sm" | "md"
  showIcon?: boolean
  className?: string
}

/**
 * Badge displaying a collaborator's role
 */
export function CollaboratorBadge({
  role,
  size = "sm",
  showIcon = true,
  className,
}: CollaboratorBadgeProps) {
  const config = ROLE_CONFIG[role]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        config.className,
        className
      )}
    >
      {showIcon && <config.icon size={size === "sm" ? 12 : 14} weight="fill" />}
      <span>{config.label}</span>
    </div>
  )
}

const ROLE_CONFIG: Record<
  CollaboratorRole,
  { label: string; icon: typeof Crown; className: string }
> = {
  owner: {
    label: "Owner",
    icon: Crown,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  editor: {
    label: "Editor",
    icon: PencilSimple,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
}
