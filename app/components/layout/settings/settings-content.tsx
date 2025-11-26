"use client"

import { Button } from "@/components/ui/button"
import { DrawerClose } from "@/components/ui/drawer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { cn, isDev } from "@/lib/utils"
import {
  DatabaseIcon,
  GearSixIcon,
  PaintBrushIcon,
  PlugsConnectedIcon,
  CreditCardIcon,
  XIcon,
  HardDrives,
} from "@phosphor-icons/react"
import { useState, useEffect } from "react"
import { SubscriptionSection } from "@/components/subscription/subscription-section"
import { InteractionPreferences } from "./appearance/interaction-preferences"
import { LayoutSettings } from "./appearance/layout-settings"
import { ThemeSelection } from "./appearance/theme-selection"
import { ConnectionsPlaceholder } from "./connections/connections-placeholder"
import { DeveloperTools } from "./connections/developer-tools"
import { OllamaSection } from "./connections/ollama-section"
import { AccountManagement } from "./general/account-management"
import { OnboardingDataSection } from "./general/onboarding-data"
import { UserProfile } from "./general/user-profile"
import { DataSection } from "./data/data-section"
import { MemoryList } from "@/app/components/memory"

export type TabType = "general" | "appearance" | "data" | "memory" | "subscription" | "connections"

type SettingsContentProps = {
  isDrawer?: boolean
  defaultTab?: TabType
}

export function SettingsContent({
  isDrawer = false,
  defaultTab = "general",
}: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)

  // Update active tab when defaultTab changes (e.g., when opening settings with a specific tab)
  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-y-auto",
        isDrawer ? "p-0 pb-16" : "py-0"
      )}
    >
      {isDrawer && (
        <div className="border-border mb-2 flex items-center justify-between border-b px-4 pb-2">
          <h2 className="text-lg font-medium">Settings</h2>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon">
              <XIcon className="size-4" />
            </Button>
          </DrawerClose>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
        className={cn(
          "flex w-full flex-row",
          isDrawer ? "" : "flex min-h-[400px]"
        )}
      >
        {isDrawer ? (
          // Mobile version - tabs on top
          <div className="w-full items-start justify-start overflow-hidden py-4">
            <div>
              <TabsList className="mb-4 flex w-full min-w-0 flex-nowrap items-center justify-start overflow-x-auto bg-transparent px-0">
                <TabsTrigger
                  value="general"
                  className="ml-6 flex shrink-0 items-center gap-2"
                >
                  <GearSixIcon className="size-4" />
                  <span>General</span>
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className="flex shrink-0 items-center gap-2"
                >
                  <PaintBrushIcon className="size-4" />
                  <span>Appearance</span>
                </TabsTrigger>
                {isSupabaseEnabled && (
                  <TabsTrigger
                    value="data"
                    className="flex shrink-0 items-center gap-2"
                  >
                    <DatabaseIcon className="size-4" />
                    <span>Data</span>
                  </TabsTrigger>
                )}
                {isSupabaseEnabled && (
                  <TabsTrigger
                    value="memory"
                    className="flex shrink-0 items-center gap-2"
                  >
                    <HardDrives className="size-4" />
                    <span>Memory</span>
                  </TabsTrigger>
                )}
                {isSupabaseEnabled && (
                  <TabsTrigger
                    value="subscription"
                    className="flex shrink-0 items-center gap-2"
                  >
                    <CreditCardIcon className="size-4" />
                    <span>Subscription</span>
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="connections"
                  className="flex shrink-0 items-center gap-2"
                >
                  <PlugsConnectedIcon className="size-4" />
                  <span>Connections</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Mobile tabs content */}
            <TabsContent value="general" className="space-y-6 px-6">
              <UserProfile />
              {isSupabaseEnabled && (
                <>
                  <OnboardingDataSection />
                  <AccountManagement />
                </>
              )}
            </TabsContent>

            <TabsContent value="appearance" className="space-y-6 px-6">
              <ThemeSelection />
              <LayoutSettings />
              <InteractionPreferences />
            </TabsContent>

            <TabsContent value="data" className="space-y-6 px-6">
              {isSupabaseEnabled && <DataSection />}
            </TabsContent>

            <TabsContent value="memory" className="space-y-6 px-6">
              {isSupabaseEnabled && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      AI Memory
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                        BETA
                      </span>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage what the AI remembers about you across conversations. The graph below shows memories that have been added by either you or by the AI.
                    </p>
                  </div>
                  <MemoryList />
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscription" className="space-y-6 px-6">
              {isSupabaseEnabled && <SubscriptionSection />}
            </TabsContent>

            <TabsContent value="connections" className="space-y-6 px-6">
              {!isDev && <ConnectionsPlaceholder />}
              {isDev && <OllamaSection />}
              {isDev && <DeveloperTools />}
            </TabsContent>
          </div>
        ) : (
          // Desktop version - tabs on left
          <>
            <TabsList className="block w-48 rounded-none bg-transparent px-3 pt-4">
              <div className="flex w-full flex-col gap-1">
                <TabsTrigger
                  value="general"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <GearSixIcon className="size-4" />
                    <span>General</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="appearance"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <PaintBrushIcon className="size-4" />
                    <span>Appearance</span>
                  </div>
                </TabsTrigger>

                {isSupabaseEnabled && (
                  <TabsTrigger
                    value="data"
                    className="w-full justify-start rounded-md px-3 py-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <DatabaseIcon className="size-4" />
                      <span>Data</span>
                    </div>
                  </TabsTrigger>
                )}

                {isSupabaseEnabled && (
                  <TabsTrigger
                    value="memory"
                    className="w-full justify-start rounded-md px-3 py-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <HardDrives className="size-4" />
                      <span>Memory</span>
                    </div>
                  </TabsTrigger>
                )}

                {isSupabaseEnabled && (
                  <TabsTrigger
                    value="subscription"
                    className="w-full justify-start rounded-md px-3 py-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCardIcon className="size-4" />
                      <span>Subscription</span>
                    </div>
                  </TabsTrigger>
                )}

                <TabsTrigger
                  value="connections"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <PlugsConnectedIcon className="size-4" />
                    <span>Connections</span>
                  </div>
                </TabsTrigger>
              </div>
            </TabsList>

            {/* Desktop tabs content */}
            <div className="flex-1 overflow-auto px-6 pt-4">
              <TabsContent value="general" className="mt-0 space-y-6">
                <UserProfile />
                {isSupabaseEnabled && (
                  <>
                    <OnboardingDataSection />
                    <AccountManagement />
                  </>
                )}
              </TabsContent>

              <TabsContent value="appearance" className="mt-0 space-y-6">
                <ThemeSelection />
                <LayoutSettings />
                <InteractionPreferences />
              </TabsContent>

              <TabsContent value="data" className="mt-0 space-y-6">
                {isSupabaseEnabled && <DataSection />}
              </TabsContent>

              <TabsContent value="memory" className="mt-0 space-y-6">
                {isSupabaseEnabled && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        AI Memory
                        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                          BETA
                        </span>
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Manage what the AI remembers about you across conversations. The graph below shows memories that have been added by either you or by the AI.
                      </p>
                    </div>
                    <MemoryList />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="subscription" className="mt-0 space-y-6">
                {isSupabaseEnabled && <SubscriptionSection />}
              </TabsContent>

              <TabsContent value="connections" className="mt-0 space-y-6">
                {!isDev && <ConnectionsPlaceholder />}
                {isDev && <OllamaSection />}
                {isDev && <DeveloperTools />}
              </TabsContent>
            </div>
          </>
        )}
      </Tabs>
    </div>
  )
}
