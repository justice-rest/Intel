import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { Chat } from "@/lib/chat-store/types"
import { useNotificationsOptional } from "@/lib/notifications"
import { Bell, BellSlash, Brain, DotsThree, FolderPlus, PencilSimple, Trash, UserCircle } from "@phosphor-icons/react"
import { Pin, PinOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { DialogDeleteChat } from "./dialog-delete-chat"
import { DialogAddToProject } from "./dialog-add-to-project"
import { DialogAssignPersona } from "./dialog-assign-persona"
import { DialogChatKnowledge } from "./dialog-chat-knowledge"

type SidebarItemMenuProps = {
  chat: Chat
  onStartEditing: () => void
  onMenuOpenChange?: (open: boolean) => void
}

export function SidebarItemMenu({
  chat,
  onStartEditing,
  onMenuOpenChange,
}: SidebarItemMenuProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false)
  const [isAssignPersonaOpen, setIsAssignPersonaOpen] = useState(false)
  const [isChatKnowledgeOpen, setIsChatKnowledgeOpen] = useState(false)
  const router = useRouter()
  const { deleteMessages } = useMessages()
  const { deleteChat, togglePinned, refresh } = useChats()
  const { chatId } = useChatSession()
  const isMobile = useBreakpoint(768)
  const notifications = useNotificationsOptional()
  const isMuted = notifications?.isChatMuted(chat.id) ?? false

  const handleConfirmDelete = async () => {
    await deleteMessages()
    await deleteChat(chat.id, chatId!, () => router.push("/"))
  }

  return (
    <>
      <DropdownMenu
        // shadcn/ui / radix pointer-events-none issue
        modal={isMobile ? true : false}
        onOpenChange={onMenuOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <button
            className="hover:bg-secondary flex size-7 items-center justify-center rounded-md p-1 transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <DotsThree size={18} className="text-primary" weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              togglePinned(chat.id, !chat.pinned)
            }}
          >
            {chat.pinned ? (
              <PinOff size={16} className="mr-2" />
            ) : (
              <Pin size={16} className="mr-2" />
            )}
            {chat.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onStartEditing()
            }}
          >
            <PencilSimple size={16} className="mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsAddToProjectOpen(true)
            }}
          >
            <FolderPlus size={16} className="mr-2" />
            Add to Project
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsAssignPersonaOpen(true)
            }}
          >
            <UserCircle size={16} className="mr-2" />
            Assign Persona
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsChatKnowledgeOpen(true)
            }}
          >
            <Brain size={16} className="mr-2" />
            Chat Knowledge
          </DropdownMenuItem>
          {notifications && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isMuted) {
                  notifications.unmuteChat(chat.id)
                } else {
                  notifications.muteChat(chat.id)
                }
              }}
            >
              {isMuted ? (
                <>
                  <Bell size={16} className="mr-2" />
                  Unmute
                </>
              ) : (
                <>
                  <BellSlash size={16} className="mr-2" />
                  Mute
                </>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDeleteDialogOpen(true)
            }}
          >
            <Trash size={16} className="mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogDeleteChat
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        chatTitle={chat.title || "Untitled chat"}
        onConfirmDelete={handleConfirmDelete}
      />

      <DialogAddToProject
        isOpen={isAddToProjectOpen}
        setIsOpen={setIsAddToProjectOpen}
        chatId={chat.id}
        chatTitle={chat.title || "Untitled chat"}
        currentProjectId={chat.project_id}
        onProjectChange={() => refresh()}
      />

      <DialogAssignPersona
        isOpen={isAssignPersonaOpen}
        setIsOpen={setIsAssignPersonaOpen}
        chatId={chat.id}
        chatTitle={chat.title || "Untitled chat"}
        currentPersonaId={chat.persona_id}
        onPersonaChange={() => refresh()}
      />

      <DialogChatKnowledge
        isOpen={isChatKnowledgeOpen}
        setIsOpen={setIsChatKnowledgeOpen}
        chatId={chat.id}
        chatTitle={chat.title || "Untitled chat"}
        onKnowledgeChange={() => refresh()}
      />
    </>
  )
}
