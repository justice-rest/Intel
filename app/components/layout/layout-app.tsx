"use client"

import { Header } from "@/app/components/layout/header"
import { AppSidebar } from "@/app/components/layout/sidebar/app-sidebar"
import { SplitViewContainer } from "@/app/components/split-view"
import { DragDropProvider } from "@/lib/drag-drop-store/provider"
import { useSplitView } from "@/lib/split-view-store/provider"
import { useUserPreferences } from "@/lib/user-preference-store/provider"

export function LayoutApp({ children, forceSidebar = false }: { children: React.ReactNode; forceSidebar?: boolean }) {
  const { preferences } = useUserPreferences()
  const { isActive: isSplitActive } = useSplitView()

  // Defensive: ensure layout has valid value, defaulting to "sidebar" for robustness
  // This guards against any edge cases where preferences might be in an unexpected state
  const layout = preferences?.layout
  const hasSidebar = forceSidebar || layout === "sidebar" || (layout !== "fullscreen")

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
