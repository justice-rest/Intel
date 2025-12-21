"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { PopoverContentAuth } from "@/app/components/chat-input/popover-content-auth"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  CaretDownIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react"
import { useState } from "react"

export type ResearchMode = "research" | "deep-research"

type ResearchModeOption = {
  id: ResearchMode
  name: string
  description: string
  speed: string
  depth: string
}

const RESEARCH_MODES: ResearchModeOption[] = [
  {
    id: "research",
    name: "Research",
    description: "Fast, real-time web research with source citations",
    speed: "Fast",
    depth: "Standard",
  },
  {
    id: "deep-research",
    name: "Deep Research",
    description: "Thorough multi-step research for complex questions",
    speed: "Slower",
    depth: "Comprehensive",
  },
]

type ResearchModeSelectorProps = {
  selectedMode: ResearchMode | null
  onModeChange: (mode: ResearchMode | null) => void
  isAuthenticated: boolean
  className?: string
}

export function ResearchModeSelector({
  selectedMode,
  onModeChange,
  isAuthenticated,
  className,
}: ResearchModeSelectorProps) {
  const isMobile = useBreakpoint(768)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const currentMode = selectedMode ? RESEARCH_MODES.find((mode) => mode.id === selectedMode) : null
  const isActive = selectedMode !== null

  const trigger = (
    <Button
      variant="outline"
      className={cn(
        "dark:bg-secondary justify-between gap-1.5",
        isActive && "border-primary/50 bg-primary/10 dark:bg-primary/20",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <MagnifyingGlassIcon className={cn("size-4", isActive && "text-primary")} />
        <span className="hidden md:inline">{currentMode?.name || "Research"}</span>
      </div>
      <CaretDownIcon className="size-3.5 opacity-50" />
    </Button>
  )

  // If user is not authenticated, show the auth popover
  if (!isAuthenticated) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className={cn(
                  "border-border dark:bg-secondary text-accent-foreground h-9 w-auto border bg-transparent",
                  className
                )}
                type="button"
              >
                <MagnifyingGlassIcon className="size-4" />
                <span className="hidden md:inline">Research</span>
                <CaretDownIcon className="size-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Select research mode</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    )
  }

  if (isMobile) {
    return (
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Select Research Mode</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-1 px-4 pb-6">
            {/* Off option */}
            <div
              className={cn(
                "flex w-full cursor-pointer flex-col gap-1 rounded-md px-3 py-2.5 hover:bg-accent",
                selectedMode === null && "bg-accent"
              )}
              onClick={() => {
                onModeChange(null)
                setIsDrawerOpen(false)
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Off</span>
                {selectedMode === null && (
                  <div className="bg-primary size-2 rounded-full" />
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                Use standard AI chat without web research
              </span>
            </div>
            {RESEARCH_MODES.map((mode) => (
              <div
                key={mode.id}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-1 rounded-md px-3 py-2.5 hover:bg-accent",
                  selectedMode === mode.id && "bg-accent"
                )}
                onClick={() => {
                  onModeChange(mode.id)
                  setIsDrawerOpen(false)
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{mode.name}</span>
                  {selectedMode === mode.id && (
                    <div className="bg-primary size-2 rounded-full" />
                  )}
                </div>
                <span className="text-muted-foreground text-xs">
                  {mode.description}
                </span>
                <div className="mt-1 flex gap-2">
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                    {mode.speed}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                    {mode.depth}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Tooltip>
      <DropdownMenu
        open={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
      >
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Select research mode</TooltipContent>
        <DropdownMenuContent
          className="flex w-[280px] flex-col overflow-visible p-1"
          align="start"
          sideOffset={4}
          side="top"
        >
          {/* Off option */}
          <DropdownMenuItem
            className={cn(
              "flex w-full cursor-pointer flex-col items-start gap-1 px-3 py-2.5",
              selectedMode === null && "bg-accent"
            )}
            onSelect={() => {
              onModeChange(null)
              setIsDropdownOpen(false)
            }}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-medium">Off</span>
              {selectedMode === null && (
                <div className="bg-primary size-2 rounded-full" />
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              Use standard AI chat without web research
            </span>
          </DropdownMenuItem>
          {RESEARCH_MODES.map((mode) => (
            <DropdownMenuItem
              key={mode.id}
              className={cn(
                "flex w-full cursor-pointer flex-col items-start gap-1 px-3 py-2.5",
                selectedMode === mode.id && "bg-accent"
              )}
              onSelect={() => {
                onModeChange(mode.id)
                setIsDropdownOpen(false)
              }}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium">{mode.name}</span>
                {selectedMode === mode.id && (
                  <div className="bg-primary size-2 rounded-full" />
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {mode.description}
              </span>
              <div className="mt-1 flex gap-2">
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                  {mode.speed}
                </span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                  {mode.depth}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Tooltip>
  )
}
