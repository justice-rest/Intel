"use client"

import { HistoryTrigger } from "@/app/components/history/history-trigger"
import { AppInfoTrigger } from "@/app/components/layout/app-info/app-info-trigger"
import { ButtonCollaborate } from "@/app/components/layout/button-collaborate"
import { ButtonNewChat } from "@/app/components/layout/button-new-chat"
import { UserMenu } from "@/app/components/layout/user-menu"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/config"
import { useSplitView } from "@/lib/split-view-store/provider"
import { useUser } from "@/lib/user-store/provider"
import { Info } from "@phosphor-icons/react"
import Image from "next/image"
import Link from "next/link"
import { DialogPublish } from "./dialog-publish"
import { HeaderSidebarTrigger } from "./header-sidebar-trigger"

export function Header({ hasSidebar }: { hasSidebar: boolean }) {
  const isMobile = useBreakpoint(768)
  const { user } = useUser()
  const { isActive: isSplitActive } = useSplitView()

  const isLoggedIn = !!user

  // In split view: hide logo (it's in sidebar), show only sidebar trigger on mobile
  // On desktop split view: hide entire header content (logo + actions are in sidebar)
  const showLogo = !isSplitActive
  const showActions = !isSplitActive

  return (
    <header className="h-app-header pointer-events-none fixed top-0 right-0 left-0 z-50">
      <div className="relative mx-auto flex h-full max-w-full items-center justify-between bg-transparent px-4 sm:px-6 lg:bg-transparent lg:px-8">
        <div className="flex flex-1 items-center justify-between">
          <div className="-ml-0.5 flex flex-1 items-center gap-2 lg:-ml-2.5">
            <div className="flex flex-1 items-center gap-2">
              {showLogo && (
                <Link
                  href="/"
                  className="pointer-events-auto inline-flex items-center text-2xl font-semibold tracking-tight group/logo"
                >
                  <span className="relative mr-1.5 size-9">
                    <Image
                      src="/PFPs/1.png"
                      alt="Rōmy"
                      width={36}
                      height={36}
                      className="absolute inset-0 rounded-lg transition-opacity duration-200 group-hover/logo:opacity-0"
                    />
                    <Image
                      src="/PFPs/2.png"
                      alt="Rōmy"
                      width={36}
                      height={36}
                      className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover/logo:opacity-100"
                    />
                  </span>
                  <span style={{ fontFamily: 'roboto-round, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"' }}>
                    {APP_NAME}
                  </span>
                </Link>
              )}
              {/* Always show sidebar trigger on mobile when sidebar is enabled */}
              {hasSidebar && isMobile && <HeaderSidebarTrigger />}
            </div>
          </div>
          <div />
          {showActions && (
            <>
              {!isLoggedIn ? (
                <div className="pointer-events-auto flex flex-1 items-center justify-end gap-4">
                  <AppInfoTrigger
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-background hover:bg-muted text-muted-foreground h-8 w-8 rounded-full"
                        aria-label={`About ${APP_NAME}`}
                      >
                        <Info className="size-4" />
                      </Button>
                    }
                  />
                  <Link
                    href="/auth"
                    className="font-base text-muted-foreground hover:text-foreground text-base transition-colors"
                  >
                    Login
                  </Link>
                </div>
              ) : (
                <div className="pointer-events-auto flex flex-1 items-center justify-end gap-2">
                  <ButtonCollaborate />
                  <DialogPublish />
                  <ButtonNewChat />
                  {!hasSidebar && <HistoryTrigger hasSidebar={hasSidebar} />}
                  <UserMenu />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
