import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import useClickOutside from "@/app/hooks/use-click-outside"
import { useChats } from "@/lib/chat-store/chats/provider"
import { Chat } from "@/lib/chat-store/types"
import { useDragDrop } from "@/lib/drag-drop-store/provider"
import { useSplitView } from "@/lib/split-view-store/provider"
import { useNotificationsOptional } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { BellSlash, Check, X } from "@phosphor-icons/react"
import Link from "next/link"
import { useCallback, useMemo, useRef, useState } from "react"
import { SidebarItemMenu } from "./sidebar-item-menu"
import { PanelChoiceMenu } from "./panel-choice-menu"

type SidebarItemProps = {
  chat: Chat
  currentChatId: string
}

export function SidebarItem({ chat, currentChatId }: SidebarItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(chat.title || "")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPanelChoiceOpen, setIsPanelChoiceOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastChatTitleRef = useRef(chat.title)
  const { updateTitle } = useChats()
  const { startDrag, endDrag } = useDragDrop()
  const { isActive: isSplitActive, leftChatId, rightChatId, deactivateSplit } = useSplitView()
  const isMobile = useBreakpoint(768)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const notifications = useNotificationsOptional()
  const isMuted = notifications?.isChatMuted(chat.id) ?? false

  if (!isEditing && lastChatTitleRef.current !== chat.title) {
    lastChatTitleRef.current = chat.title
    setEditTitle(chat.title || "")
  }

  const handleStartEditing = useCallback(() => {
    setIsEditing(true)
    setEditTitle(chat.title || "")

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    })
  }, [chat.title])

  const handleSave = useCallback(async () => {
    setIsEditing(false)
    setIsMenuOpen(false)
    await updateTitle(chat.id, editTitle)
  }, [chat.id, editTitle, updateTitle])

  const handleCancel = useCallback(() => {
    setEditTitle(chat.title || "")
    setIsEditing(false)
    setIsMenuOpen(false)
  }, [chat.title])

  const handleMenuOpenChange = useCallback((open: boolean) => {
    setIsMenuOpen(open)
  }, [])

  const handleClickOutside = useCallback(() => {
    if (isEditing) {
      handleSave()
    }
  }, [isEditing, handleSave])

  useClickOutside(containerRef, handleClickOutside)

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditTitle(e.target.value)
    },
    []
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSave()
      } else if (e.key === "Escape") {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) {
        e.stopPropagation()
      }
    },
    [isEditing]
  )

  const handleSaveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleSave()
    },
    [handleSave]
  )

  const handleCancelClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleCancel()
    },
    [handleCancel]
  )

  const handleLinkClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      // In split mode, handle navigation
      if (isSplitActive) {
        // If this chat is already in one of the panels, show choice menu
        if (chat.id === leftChatId || chat.id === rightChatId) {
          e.preventDefault()
          setIsPanelChoiceOpen(true)
        } else {
          // Otherwise, close split view and navigate normally
          deactivateSplit()
          // Don't prevent default - let Link navigate
        }
      }
    },
    [isSplitActive, chat.id, leftChatId, rightChatId, deactivateSplit]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("application/x-chat-id", chat.id)
      e.dataTransfer.effectAllowed = "move"
      startDrag(chat.id, chat.title || "Untitled Chat")
    },
    [chat.id, chat.title, startDrag]
  )

  const handleDragEnd = useCallback(() => {
    endDrag()
  }, [endDrag])

  // Memoize computed values
  const isActive = useMemo(
    () => chat.id === currentChatId || isEditing || isMenuOpen,
    [chat.id, currentChatId, isEditing, isMenuOpen]
  )

  const displayTitle = useMemo(
    () => chat.title || "Untitled Chat",
    [chat.title]
  )

  const containerClassName = useMemo(
    () =>
      cn(
        "hover:bg-accent/80 hover:text-foreground group/chat relative w-full rounded-md transition-colors",
        isActive && "bg-accent hover:bg-accent text-foreground"
      ),
    [isActive]
  )

  const menuClassName = useMemo(
    () =>
      cn(
        "absolute top-0 right-1 flex h-full items-center justify-center opacity-0 transition-opacity group-hover/chat:opacity-100",
        isMobile && "opacity-100 group-hover/chat:opacity-100"
      ),
    [isMobile]
  )

  return (
    <div
      className={containerClassName}
      onClick={handleContainerClick}
      ref={containerRef}
    >
      {isEditing ? (
        <div className="bg-accent flex items-center rounded-md py-1 pr-1 pl-2">
          <input
            ref={inputRef}
            value={editTitle}
            onChange={handleInputChange}
            className="text-primary max-h-full w-full bg-transparent text-sm focus:outline-none"
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-0.5">
            <button
              onClick={handleSaveClick}
              className="hover:bg-secondary text-muted-foreground hover:text-primary flex size-7 items-center justify-center rounded-md p-1 transition-colors duration-150"
              type="button"
            >
              <Check size={16} weight="bold" />
            </button>
            <button
              onClick={handleCancelClick}
              className="hover:bg-secondary text-muted-foreground hover:text-primary flex size-7 items-center justify-center rounded-md p-1 transition-colors duration-150"
              type="button"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <PanelChoiceMenu
            chatId={chat.id}
            open={isPanelChoiceOpen}
            onOpenChange={setIsPanelChoiceOpen}
          >
            <Link
              href={`/c/${chat.id}`}
              className="block w-full"
              prefetch
              onClick={handleLinkClick}
              draggable
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div
                className="text-primary relative line-clamp-1 mask-r-from-80% mask-r-to-85% px-2 py-2 text-sm text-ellipsis whitespace-nowrap"
                title={displayTitle}
              >
                <span className="flex items-center gap-1.5">
                  {isMuted && (
                    <BellSlash size={12} className="text-muted-foreground flex-shrink-0" weight="bold" />
                  )}
                  {displayTitle}
                </span>
              </div>
            </Link>
          </PanelChoiceMenu>

          <div className={menuClassName} key={chat.id}>
            <SidebarItemMenu
              chat={chat}
              onStartEditing={handleStartEditing}
              onMenuOpenChange={handleMenuOpenChange}
            />
          </div>
        </>
      )}
    </div>
  )
}
