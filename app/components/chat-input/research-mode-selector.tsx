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
  GlobeIcon,
  BrainIcon,
  LightningIcon,
  ClockIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react"
import { useState } from "react"

export type ResearchMode = "research" | "deep-research"

type ResearchModeOption = {
  id: ResearchMode
  name: string
  description: string
  speed: string
  depth: string
  model: string
  modelLink: string
  features: {
    webSearch: boolean
    reasoning: boolean
    multiStep: boolean
  }
}

const RESEARCH_MODES: ResearchModeOption[] = [
  {
    id: "research",
    name: "Research",
    description: "Fast, real-time web research with Exa search. Best for quick prospect lookups and single-step queries.",
    speed: "Fast (~10s)",
    depth: "Standard",
    model: "Grok 4.1 Fast",
    modelLink: "https://openrouter.ai/x-ai/grok-4.1-fast",
    features: {
      webSearch: true,
      reasoning: true,
      multiStep: false,
    },
  },
  {
    id: "deep-research",
    name: "Deep Research",
    description: "Thorough multi-step research with extended thinking. Best for complex prospects requiring full wealth screening.",
    speed: "Slower (~60s)",
    depth: "Comprehensive",
    model: "Grok 4.1 Fast (Thinking)",
    modelLink: "https://openrouter.ai/x-ai/grok-4.1-fast",
    features: {
      webSearch: true,
      reasoning: true,
      multiStep: true,
    },
  },
]

// Submenu component for hover state
function ResearchModeSubMenu({ mode }: { mode: ResearchModeOption }) {
  return (
    <div className="bg-popover border-border w-[280px] rounded-md border p-3 shadow-md">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <MagnifyingGlassIcon className="text-primary size-5" />
          <h3 className="font-medium">{mode.name}</h3>
        </div>

        <p className="text-muted-foreground text-sm">{mode.description}</p>

        <div className="flex flex-col gap-1">
          <div className="mt-1 flex flex-wrap gap-2">
            {mode.features.webSearch && (
              <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-800 dark:text-blue-100">
                <GlobeIcon className="size-3" />
                <span>Web Search</span>
              </div>
            )}

            {mode.features.reasoning && (
              <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-800 dark:text-amber-100">
                <BrainIcon className="size-3" />
                <span>Reasoning</span>
              </div>
            )}

            {mode.features.multiStep && (
              <div className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-800 dark:text-purple-100">
                <LightningIcon className="size-3" />
                <span>Multi-Step</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <ClockIcon className="size-4" />
              Speed
            </span>
            <span>{mode.speed}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Depth</span>
            <span>{mode.depth}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Model</span>
            <span className="text-muted-foreground truncate text-xs max-w-[140px]">
              {mode.model}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-end text-xs">
            <a
              href={mode.modelLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground flex items-center gap-0.5 hover:text-foreground transition-colors"
            >
              <span>Model Page</span>
              <ArrowSquareOutIcon className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const [hoveredMode, setHoveredMode] = useState<ResearchMode | null>(null)

  const currentMode = selectedMode
    ? RESEARCH_MODES.find((mode) => mode.id === selectedMode)
    : null
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
        <MagnifyingGlassIcon
          className={cn("size-4", isActive && "text-primary")}
        />
        <span className="hidden md:inline">
          {currentMode?.name || "Research"}
        </span>
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
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {mode.features.webSearch && (
                    <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-800 dark:text-blue-100">
                      <GlobeIcon className="size-2.5" />
                      Web
                    </span>
                  )}
                  {mode.features.reasoning && (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-800 dark:text-amber-100">
                      <BrainIcon className="size-2.5" />
                      Reasoning
                    </span>
                  )}
                  {mode.features.multiStep && (
                    <span className="flex items-center gap-0.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 dark:bg-purple-800 dark:text-purple-100">
                      <LightningIcon className="size-2.5" />
                      Multi-Step
                    </span>
                  )}
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                    {mode.speed}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Get the hovered mode data
  const hoveredModeData = RESEARCH_MODES.find(
    (mode) => mode.id === hoveredMode
  )

  return (
    <Tooltip>
      <DropdownMenu
        open={isDropdownOpen}
        onOpenChange={(open) => {
          setIsDropdownOpen(open)
          if (!open) {
            setHoveredMode(null)
          } else if (selectedMode) {
            setHoveredMode(selectedMode)
          }
        }}
      >
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Select research mode</TooltipContent>
        <DropdownMenuContent
          className="flex w-[240px] flex-col overflow-visible p-1"
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
            onMouseEnter={() => setHoveredMode(null)}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-medium">Off</span>
              {selectedMode === null && (
                <div className="bg-primary size-2 rounded-full" />
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              Standard AI chat
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
              onFocus={() => {
                if (isDropdownOpen) {
                  setHoveredMode(mode.id)
                }
              }}
              onMouseEnter={() => {
                if (isDropdownOpen) {
                  setHoveredMode(mode.id)
                }
              }}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <MagnifyingGlassIcon className="text-muted-foreground size-4" />
                  <span className="text-sm font-medium">{mode.name}</span>
                </div>
                {selectedMode === mode.id && (
                  <div className="bg-primary size-2 rounded-full" />
                )}
              </div>
              <div className="ml-6 flex gap-1.5">
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                  {mode.speed}
                </span>
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                  {mode.depth}
                </span>
              </div>
            </DropdownMenuItem>
          ))}

          {/* Submenu positioned absolutely */}
          {hoveredModeData && (
            <div className="absolute top-0 left-[calc(100%+8px)]">
              <ResearchModeSubMenu mode={hoveredModeData} />
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </Tooltip>
  )
}
