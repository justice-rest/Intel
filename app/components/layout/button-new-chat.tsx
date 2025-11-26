"use client"

import { useKeyShortcut } from "@/app/hooks/use-key-shortcut"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSplitView } from "@/lib/split-view-store/provider"
import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

export function ButtonNewChat() {
  const pathname = usePathname()
  const router = useRouter()
  const { isActive: isSplitActive, deactivateSplit } = useSplitView()

  const handleNewChat = useCallback(() => {
    if (isSplitActive) deactivateSplit()
    router.push("/")
  }, [isSplitActive, deactivateSplit, router])

  useKeyShortcut(
    (e) => (e.key === "u" || e.key === "U") && e.metaKey && e.shiftKey,
    handleNewChat
  )

  if (pathname === "/") return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground hover:bg-muted bg-background rounded-full p-1.5 transition-colors"
          prefetch
          aria-label="New Chat"
          onClick={(e) => {
            if (isSplitActive) {
              e.preventDefault()
              handleNewChat()
            }
          }}
        >
          <NotePencilIcon size={24} />
        </Link>
      </TooltipTrigger>
      <TooltipContent>New Chat ⌘⇧U</TooltipContent>
    </Tooltip>
  )
}
