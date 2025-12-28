"use client"

import XIcon from "@/components/icons/x"
import { GoldVerifiedBadge } from "@/components/icons/gold-verified-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useUser } from "@/lib/user-store/provider"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { clearAllIndexedDBStores } from "@/lib/chat-store/persist"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { InstagramLogoIcon, LinkedinLogoIcon, SignOut } from "@phosphor-icons/react"
import { toast } from "@/components/ui/toast"
import { useState, useEffect, useRef } from "react"
import { useCustomer } from "autumn-js/react"
import { AppInfoTrigger } from "./app-info/app-info-trigger"
import { FeedbackTrigger } from "./feedback/feedback-trigger"
import { SettingsTrigger } from "./settings/settings-trigger"
import type { TabType } from "./settings/settings-content"

export function UserMenu() {
  const { user, updateUser, signOut } = useUser()
  const { resetChats } = useChats()
  const { resetMessages } = useMessages()
  const { customer } = useCustomer()
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<TabType>("general")
  const hasSyncedRef = useRef(false)

  // Listen for custom event to open settings with a specific tab and optional section
  useEffect(() => {
    const handleOpenSettings = (event: CustomEvent<{ tab?: TabType; section?: string }>) => {
      let tab = event.detail?.tab || "general"
      const section = event.detail?.section

      // Tabs that require Supabase - fall back to general if Supabase is disabled
      const supabaseRequiredTabs: TabType[] = ["data", "memory", "subscription", "integrations"]
      if (!isSupabaseEnabled && supabaseRequiredTabs.includes(tab)) {
        tab = "general"
      }

      setSettingsDefaultTab(tab)
      setSettingsOpen(true)
      setMenuOpen(true)

      // If a section is specified, scroll to it after the settings modal renders
      if (section) {
        // Use requestAnimationFrame + setTimeout to ensure the tab content is rendered
        requestAnimationFrame(() => {
          setTimeout(() => {
            const sectionElement = document.querySelector(
              `[data-settings-section="${section}"]`
            )
            if (sectionElement) {
              sectionElement.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          }, 150) // Small delay for tab transition animation
        })
      }
    }

    window.addEventListener("open-settings", handleOpenSettings as EventListener)

    return () => {
      window.removeEventListener("open-settings", handleOpenSettings as EventListener)
    }
  }, [])

  // Handle Google OAuth callback params (google_success/google_error)
  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const success = params.get("google_success")
    const error = params.get("google_error")

    if (success || error) {
      // Show toast
      if (success) {
        toast({
          title: "Google Connected",
          description: success,
        })
      } else if (error) {
        toast({
          title: "Connection Failed",
          description: error,
        })
      }

      // Open settings modal to integrations tab
      setSettingsDefaultTab("integrations")
      setSettingsOpen(true)
      setMenuOpen(true)

      // Clean URL
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  // Sync subscription status to user record when customer data loads
  useEffect(() => {
    if (!user || !customer || hasSyncedRef.current) return

    const productStatus = customer.products?.[0]?.status
    const productId = customer.products?.[0]?.id

    // Normalize tier to match database constraint ('starter', 'pro', 'scale', or null)
    let tier: string | null = null
    if (productId) {
      const normalizedId = productId.toLowerCase()
      if (normalizedId.includes("scale")) {
        tier = "scale"
      } else if (normalizedId.includes("pro")) {
        tier = "pro"
      } else if (normalizedId.includes("starter")) {
        tier = "starter"
      }
    }

    // Only sync if different from cached values
    if (
      user.subscription_status !== productStatus ||
      user.subscription_tier !== tier
    ) {
      hasSyncedRef.current = true
      updateUser({
        subscription_status: productStatus || null,
        subscription_tier: tier,
      })
    }
  }, [customer, user, updateUser])

  if (!user) return null

  // Use first_name if available, otherwise fall back to display_name
  const displayName = user?.first_name || user?.display_name

  const handleSettingsOpenChange = (isOpen: boolean) => {
    setSettingsOpen(isOpen)
    if (!isOpen) {
      setMenuOpen(false)
      // Reset to general tab when closing
      setSettingsDefaultTab("general")
    }
  }

  const handleSignOut = async () => {
    try {
      // Clear React state first for immediate UI feedback
      await resetMessages()
      await resetChats()
      // Sign out from Supabase + clear user context
      await signOut()
      // Clear all IndexedDB caches to prevent stale data
      await clearAllIndexedDBStores()
      // Use synchronous redirect to prevent flash of guest view
      window.location.href = "/auth"
    } catch (error) {
      console.error("Sign out failed:", error)
    }
  }

  // Use cached subscription data from user first, fall back to customer data
  const cachedStatus = user.subscription_status
  const cachedTier = user.subscription_tier

  // Check if user has an active subscription (any paid plan, including trials)
  // Use cached data immediately, customer data if available
  const productStatus = customer?.products?.[0]?.status ?? cachedStatus
  const hasActiveSubscription =
    productStatus === "active" || productStatus === "trialing"

  // Get the subscription tier - use cached or customer data
  const currentProductId = customer?.products?.[0]?.id
  const planType = currentProductId?.replace("-yearly", "") ?? cachedTier
  const isPremiumTier = planType === "pro" || planType === "scale"

  return (
    // fix shadcn/ui / radix bug when dialog into dropdown menu
    <DropdownMenu open={isMenuOpen} onOpenChange={setMenuOpen} modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger>
            <Avatar className="bg-background hover:bg-muted">
              <AvatarImage src={user?.profile_image ?? undefined} />
              <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Profile</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        className="w-56"
        align="end"
        forceMount
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (isSettingsOpen) {
            e.preventDefault()
            return
          }
          setMenuOpen(false)
        }}
      >
        <DropdownMenuItem className="flex flex-col items-start gap-0 no-underline hover:bg-transparent focus:bg-transparent">
          <div className="flex items-center gap-1.5">
            <span>{displayName}</span>
            {hasActiveSubscription && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    {isPremiumTier ? (
                      <GoldVerifiedBadge className="h-4 w-4" />
                    ) : (
                      <img
                        src="/verified.png"
                        alt="Verified"
                        className="h-4 w-4"
                        width={16}
                        height={16}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Verified Subscriber</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className="text-muted-foreground max-w-full truncate">
            {user?.email}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SettingsTrigger
          onOpenChange={handleSettingsOpenChange}
          defaultTab={settingsDefaultTab}
          externalOpen={isSettingsOpen}
        />
        <FeedbackTrigger />
        <AppInfoTrigger />
        <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2">
          <SignOut className="size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href="https://x.com/RomyFindsMoney"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <XIcon className="size-4 p-0.5" />
            <span>@RomyFindsMoney</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href="https://www.instagram.com/getromy.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <InstagramLogoIcon className="size-4" />
            <span>@getromy.app</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href="https://www.linkedin.com/company/107042684/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <LinkedinLogoIcon className="size-4" />
            <span>Rōmy</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
