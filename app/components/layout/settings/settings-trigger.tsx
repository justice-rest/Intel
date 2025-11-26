"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { User } from "@phosphor-icons/react"
import type React from "react"
import { useState, useEffect } from "react"
import { SettingsContent, TabType } from "./settings-content"

type SettingsTriggerProps = {
  onOpenChange: (open: boolean) => void
  defaultTab?: TabType
  externalOpen?: boolean
}

export function SettingsTrigger({ onOpenChange, defaultTab = "general", externalOpen }: SettingsTriggerProps) {
  const [open, setOpen] = useState(false)
  const [currentTab, setCurrentTab] = useState<TabType>(defaultTab)
  const isMobile = useBreakpoint(768)

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen)
    }
  }, [externalOpen])

  // Update current tab when defaultTab changes
  useEffect(() => {
    setCurrentTab(defaultTab)
  }, [defaultTab])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    onOpenChange(isOpen)
    // Reset to general tab when closing
    if (!isOpen) {
      setCurrentTab("general")
    }
  }

  const trigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      <User className="size-4" />
      <span>Settings</span>
    </DropdownMenuItem>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <SettingsContent isDrawer defaultTab={currentTab} />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex h-[80%] min-h-[480px] w-full flex-col gap-0 p-0 sm:max-w-[768px]">
        <DialogHeader className="border-border border-b px-6 py-5">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <SettingsContent defaultTab={currentTab} />
      </DialogContent>
    </Dialog>
  )
}
