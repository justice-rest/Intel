"use client"

import { PopoverContentAuth } from "@/app/components/chat-input/popover-content-auth"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
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
  LightningIcon,
  BrainIcon,
  GlobeIcon,
  ListChecksIcon,
} from "@phosphor-icons/react"
import { useState } from "react"

export type ResearchMode = "research" | "deep-research"

type ResearchOption = {
  id: ResearchMode
  name: string
  description: string
  features: {
    webSearch: boolean
    reasoning: boolean
    multiStep: boolean
  }
}

const RESEARCH_OPTIONS: ResearchOption[] = [
  {
    id: "research",
    name: "Research",
    description: "Fast web search with intelligent analysis. Best for quick lookups, current information, and straightforward research queries.",
    features: {
      webSearch: true,
      reasoning: false,
      multiStep: false,
    },
  },
  {
    id: "deep-research",
    name: "Deep Research",
    description: "Advanced reasoning with multi-step analysis. Best for complex prospect research, wealth screening, and comprehensive donor profiles.",
    features: {
      webSearch: true,
      reasoning: true,
      multiStep: true,
    },
  },
]

type ResearchSelectorProps = {
  selectedMode: ResearchMode | null
  onModeChange: (mode: ResearchMode | null) => void
  className?: string
  isUserAuthenticated?: boolean
}

export function ResearchSelector({
  selectedMode,
  onModeChange,
  className,
  isUserAuthenticated = true,
}: ResearchSelectorProps) {
  const isMobile = useBreakpoint(768)
  const [hoveredMode, setHoveredMode] = useState<ResearchMode | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const currentOption = RESEARCH_OPTIONS.find((opt) => opt.id === selectedMode)

  const trigger = (
    <Button
      variant="outline"
      className={cn("dark:bg-secondary justify-between gap-2", className)}
    >
      <div className="flex items-center gap-2">
        <MagnifyingGlassIcon className="size-4" />
        <span>{currentOption?.name || "Research"}</span>
      </div>
      <CaretDownIcon className="size-4 opacity-50" />
    </Button>
  )

  // If user is not authenticated, show the auth popover
  if (!isUserAuthenticated) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className={cn(
                  "border-border dark:bg-secondary text-accent-foreground h-9 w-auto border bg-transparent gap-2",
                  className
                )}
                type="button"
              >
                <MagnifyingGlassIcon className="size-4" />
                {currentOption?.name || "Research"}
                <CaretDownIcon className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Select research mode</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    )
  }

  // Get the hovered option data for submenu
  const hoveredOption = RESEARCH_OPTIONS.find((opt) => opt.id === hoveredMode)

  // Submenu component
  const renderSubMenu = (option: ResearchOption) => (
    <div className="bg-popover border-border w-[260px] rounded-md border p-3 shadow-md">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon className="size-4" />
          <h3 className="font-medium">{option.name}</h3>
        </div>

        <p className="text-muted-foreground text-sm">
          {option.description}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {option.features.webSearch && (
            <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-800 dark:text-blue-100">
              <GlobeIcon className="size-3" />
              <span>Web Search</span>
            </div>
          )}
          {option.features.reasoning && (
            <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-800 dark:text-amber-100">
              <BrainIcon className="size-3" />
              <span>Reasoning</span>
            </div>
          )}
          {option.features.multiStep && (
            <div className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-800 dark:text-purple-100">
              <ListChecksIcon className="size-3" />
              <span>Multi-Step</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <LightningIcon className="size-3" />
          <span>
            {option.id === "research" ? "Fast responses" : "Thorough analysis"}
          </span>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Select Research Mode</DrawerTitle>
          </DrawerHeader>
          <div className="flex h-full flex-col space-y-2 overflow-y-auto px-4 pb-6">
            {RESEARCH_OPTIONS.map((option) => (
              <div
                key={option.id}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-lg border p-4 cursor-pointer transition-colors",
                  selectedMode === option.id
                    ? "bg-accent border-primary"
                    : "hover:bg-accent/50"
                )}
                onClick={() => {
                  onModeChange(option.id)
                  setIsDrawerOpen(false)
                }}
              >
                <div className="flex items-center gap-2">
                  <MagnifyingGlassIcon className="size-4" />
                  <span className="font-medium">{option.name}</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  {option.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {option.features.webSearch && (
                    <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-800 dark:text-blue-100">
                      <GlobeIcon className="size-3" />
                      <span>Web Search</span>
                    </div>
                  )}
                  {option.features.reasoning && (
                    <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-800 dark:text-amber-100">
                      <BrainIcon className="size-3" />
                      <span>Reasoning</span>
                    </div>
                  )}
                  {option.features.multiStep && (
                    <div className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-800 dark:text-purple-100">
                      <ListChecksIcon className="size-3" />
                      <span>Multi-Step</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <div>
      <Tooltip>
        <DropdownMenu
          open={isDropdownOpen}
          onOpenChange={(open) => {
            setIsDropdownOpen(open)
            if (!open) {
              setHoveredMode(null)
            } else {
              if (selectedMode) setHoveredMode(selectedMode)
            }
          }}
        >
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Switch research mode</TooltipContent>
          <DropdownMenuContent
            className="flex w-[200px] flex-col space-y-0.5 overflow-visible p-1"
            align="start"
            sideOffset={4}
            forceMount
            side="top"
          >
            {RESEARCH_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.id}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 cursor-pointer",
                  selectedMode === option.id && "bg-accent"
                )}
                onSelect={() => {
                  onModeChange(option.id)
                  setIsDropdownOpen(false)
                }}
                onFocus={() => {
                  if (isDropdownOpen) {
                    setHoveredMode(option.id)
                  }
                }}
                onMouseEnter={() => {
                  if (isDropdownOpen) {
                    setHoveredMode(option.id)
                  }
                }}
              >
                <MagnifyingGlassIcon className="size-4" />
                <span className="text-sm">{option.name}</span>
              </DropdownMenuItem>
            ))}

            {/* Submenu positioned absolutely */}
            {hoveredOption && (
              <div className="absolute top-0 left-[calc(100%+8px)]">
                {renderSubMenu(hoveredOption)}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </div>
  )
}
