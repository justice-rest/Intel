"use client"

import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { useUser } from "@/lib/user-store/provider"
import { WelcomePopup } from "@/app/components/welcome-popup"

export default function Home() {
  const { user, refreshUser } = useUser()

  // Show welcome popup if authenticated, not anonymous, and not completed
  const showWelcome = user && !user.anonymous && user.welcome_completed === false

  return (
    <LayoutApp>
      <ChatContainer firstName={user?.first_name} />
      {showWelcome && (
        <WelcomePopup
          isOpen={showWelcome}
          onComplete={() => refreshUser()}
        />
      )}
    </LayoutApp>
  )
}
