"use client"

import { Header } from "@/app/components/layout/header"
import { AppSidebar } from "@/app/components/layout/sidebar/app-sidebar"
import { SplitViewContainer } from "@/app/components/split-view"
import { DragDropProvider } from "@/lib/drag-drop-store/provider"
import { useSplitView } from "@/lib/split-view-store/provider"
import { useUserPreferences } from "@/lib/user-preference-store/provider"

export function LayoutApp({ children }: { children: React.ReactNode }) {
  const { preferences } = useUserPreferences()
  const { isActive: isSplitActive } = useSplitView()
  const hasSidebar = preferences.layout === "sidebar"

  return (
    <DragDropProvider>
      <div className="bg-background flex h-dvh w-full overflow-hidden">
        {hasSidebar && <AppSidebar />}
        <main className="@container relative h-dvh w-0 flex-shrink flex-grow overflow-y-auto">
          <Header hasSidebar={hasSidebar} />
          {isSplitActive ? <SplitViewContainer /> : children}
        </main>
      </div>
    </DragDropProvider>
  )
}
