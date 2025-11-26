import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChatsProvider } from "@/lib/chat-store/chats/provider"
import { ChatSessionProvider } from "@/lib/chat-store/session/provider"
import { SplitViewProvider } from "@/lib/split-view-store/provider"
import { ModelProvider } from "@/lib/model-store/provider"
import { AutumnWrapper } from "@/lib/subscription/autumn-wrapper"
import { TanstackQueryProvider } from "@/lib/tanstack-query/tanstack-query-provider"
import { UserPreferencesProvider } from "@/lib/user-preference-store/provider"
import { UserProvider } from "@/lib/user-store/provider"
import { getUserProfile } from "@/lib/user/api"
import { PostHogProvider } from "@/lib/posthog/provider"
import { MemoryProvider } from "@/lib/memory-store"
import { ThemeProvider } from "next-themes"
import Script from "next/script"
import { Suspense } from "react"
import { LayoutClient } from "./layout-client"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Rōmy",
  description:
    "Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isDev = process.env.NODE_ENV === "development"
  const isOfficialDeployment = process.env.ROMY_OFFICIAL === "true"
  const userProfile = await getUserProfile()

  return (
    <html lang="en" suppressHydrationWarning>
      {isOfficialDeployment ? (
        <Script
          defer
          src="https://assets.onedollarstats.com/stonks.js"
          {...(isDev ? { "data-debug": "romy.chat" } : {})}
        />
      ) : null}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PostHogProvider>
          <TanstackQueryProvider>
            <LayoutClient />
            <UserProvider initialUser={userProfile}>
              <AutumnWrapper>
                <ModelProvider>
                  <ChatsProvider userId={userProfile?.id}>
                    <ChatSessionProvider>
                      <Suspense fallback={null}>
                        <SplitViewProvider>
                          <UserPreferencesProvider
                            userId={userProfile?.id}
                            initialPreferences={userProfile?.preferences}
                          >
                            <MemoryProvider userId={userProfile?.id || null}>
                              <TooltipProvider
                                delayDuration={200}
                                skipDelayDuration={500}
                              >
                                <ThemeProvider
                                  attribute="class"
                                  defaultTheme="light"
                                  enableSystem
                                  disableTransitionOnChange
                                >
                                  <SidebarProvider defaultOpen>
                                    <Toaster position="top-center" />
                                    {children}
                                  </SidebarProvider>
                                </ThemeProvider>
                              </TooltipProvider>
                            </MemoryProvider>
                          </UserPreferencesProvider>
                        </SplitViewProvider>
                      </Suspense>
                    </ChatSessionProvider>
                  </ChatsProvider>
                </ModelProvider>
              </AutumnWrapper>
            </UserProvider>
          </TanstackQueryProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
