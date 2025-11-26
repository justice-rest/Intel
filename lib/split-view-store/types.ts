export interface SplitViewState {
  isActive: boolean
  leftChatId: string | null
  rightChatId: string | null
  splitRatio: number
}

export interface SplitViewContextType extends SplitViewState {
  activateSplit: (leftId: string, rightId: string) => void
  deactivateSplit: () => void
  swapPanels: () => void
  closePanel: (side: "left" | "right") => void
  setSplitRatio: (ratio: number) => void
  replacePanel: (side: "left" | "right", chatId: string) => void
}
