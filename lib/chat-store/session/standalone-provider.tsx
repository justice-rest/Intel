"use client"

import { createContext, useContext } from "react"

const StandaloneChatSessionContext = createContext<{ chatId: string | null }>({
  chatId: null,
})

export const useStandaloneChatSession = () =>
  useContext(StandaloneChatSessionContext)

export function StandaloneChatSessionProvider({
  chatId,
  children,
}: {
  chatId: string | null
  children: React.ReactNode
}) {
  return (
    <StandaloneChatSessionContext.Provider value={{ chatId }}>
      {children}
    </StandaloneChatSessionContext.Provider>
  )
}
