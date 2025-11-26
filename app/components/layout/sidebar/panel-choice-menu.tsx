"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useSplitView } from "@/lib/split-view-store/provider"
import { cn } from "@/lib/utils"
import {
  ArrowSquareLeft,
  ArrowSquareRight,
  SignOut,
} from "@phosphor-icons/react"
import { useRouter } from "next/navigation"

interface PanelChoiceMenuProps {
  chatId: string
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PanelChoiceMenu({
  chatId,
  children,
  open,
  onOpenChange,
}: PanelChoiceMenuProps) {
  const { replacePanel, deactivateSplit, isActive } = useSplitView()
  const router = useRouter()

  // Don't render menu functionality if not in split mode
  if (!isActive) {
    return <>{children}</>
  }

  const handleOpenInLeft = () => {
    replacePanel("left", chatId)
    onOpenChange(false)
  }

  const handleOpenInRight = () => {
    replacePanel("right", chatId)
    onOpenChange(false)
  }

  const handleExitSplit = () => {
    deactivateSplit()
    router.push(`/c/${chatId}`)
    onOpenChange(false)
  }

  const menuItemClass = cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
    "hover:bg-accent text-foreground transition-colors cursor-pointer"
  )

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-48 p-1"
        sideOffset={8}
      >
        <div className="flex flex-col gap-0.5">
          <button onClick={handleOpenInLeft} className={menuItemClass}>
            <ArrowSquareLeft size={16} weight="bold" />
            <span>Open in left panel</span>
          </button>
          <button onClick={handleOpenInRight} className={menuItemClass}>
            <ArrowSquareRight size={16} weight="bold" />
            <span>Open in right panel</span>
          </button>
          <div className="bg-border my-1 h-px" />
          <button onClick={handleExitSplit} className={menuItemClass}>
            <SignOut size={16} weight="bold" />
            <span>Exit split view</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
