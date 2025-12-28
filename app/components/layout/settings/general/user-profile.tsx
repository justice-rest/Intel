"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUser } from "@/lib/user-store/provider"
import { User, Pencil, Check, X } from "@phosphor-icons/react"
import { useState } from "react"
import { toast } from "sonner"

export function UserProfile() {
  const { user, updateUser } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [firstName, setFirstName] = useState(user?.first_name || "")
  const [isSaving, setIsSaving] = useState(false)

  if (!user) return null

  const displayName = user.first_name || user.display_name

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateUser({ first_name: firstName.trim() || null })
      setIsEditing(false)
      toast.success("Profile updated")
    } catch (error) {
      console.error("Failed to update profile:", error)
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFirstName(user.first_name || "")
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  return (
    <div data-settings-section="user-profile">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Profile</h3>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8 w-8 p-0"
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <div className="bg-muted flex items-center justify-center overflow-hidden rounded-full">
          {user.profile_image ? (
            <Avatar className="size-12">
              <AvatarImage src={user.profile_image} className="object-cover" />
              <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="text-muted-foreground size-12" />
          )}
        </div>
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your name"
                className="h-8 max-w-[180px]"
                autoFocus
                disabled={isSaving}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSave}
                disabled={isSaving}
                className="h-8 w-8 p-0"
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
                className="h-8 w-8 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <h4 className="text-sm font-medium">{displayName}</h4>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </>
          )}
          {isEditing && (
            <p className="text-muted-foreground mt-1 text-sm">{user.email}</p>
          )}
        </div>
      </div>
    </div>
  )
}
