"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUser } from "@/lib/user-store/provider"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useAvatarUrl } from "@/lib/utils/use-avatar-url"
import { AVATAR_STYLES, AVATAR_STYLE_NAMES } from "@/lib/utils/avatar"
import { User, Pencil, Check, X, SealCheck } from "@phosphor-icons/react"
import { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { useCustomer } from "autumn-js/react"
import { cn } from "@/lib/utils"

export function UserProfile() {
  const { user, updateUser } = useUser()
  const { customer } = useCustomer()
  const { cycleAvatarStyle, preferences } = useUserPreferences()
  const avatarUrl = useAvatarUrl(user?.id)
  const [isEditing, setIsEditing] = useState(false)
  const [firstName, setFirstName] = useState(user?.first_name || "")
  const [isSaving, setIsSaving] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const lastTapRef = useRef(0)
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up animation timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
    }
  }, [])

  const triggerCycle = useCallback(() => {
    // Compute the next style name before cycling (optimistic update changes state async)
    const nextStyleIndex = ((preferences.avatarStyleIndex ?? 0) + 1) % AVATAR_STYLES.length
    const nextStyleKey = AVATAR_STYLES[nextStyleIndex]
    const nextStyleName = AVATAR_STYLE_NAMES[nextStyleKey]

    cycleAvatarStyle()
    setIsAnimating(true)
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
    animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), 300)

    toast.success(`Avatar changed to ${nextStyleName}`)
  }, [cycleAvatarStyle, preferences.avatarStyleIndex])

  const handleAvatarTap = useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastTapRef.current

    if (elapsed > 0 && elapsed < 300) {
      // Double-tap detected
      lastTapRef.current = 0 // Reset to prevent triple-tap re-trigger
      triggerCycle()
    } else {
      lastTapRef.current = now
    }
  }, [triggerCycle])

  if (!user) return null

  const displayName = user.first_name || user.display_name

  // Get subscription info for badge
  const activeProduct = customer?.products?.find(
    (p: { status: string }) => p.status === "active" || p.status === "trialing"
  )
  const planId = activeProduct?.id?.toLowerCase() || ""
  const isPro = planId.includes("pro")
  const isScale = planId.includes("scale")
  const hasPaidPlan = isPro || isScale

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
        <div
          className={cn(
            "bg-muted flex items-center justify-center overflow-hidden rounded-full cursor-pointer select-none transition-transform duration-300",
            isAnimating && "scale-110"
          )}
          onClick={handleAvatarTap}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              triggerCycle()
            }
          }}
          aria-label="Change avatar style"
          title="Double-tap to change avatar style"
        >
          {avatarUrl ? (
            <Avatar className="size-12">
              <AvatarImage src={avatarUrl} className="object-cover" />
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
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-medium">{displayName}</h4>
                {hasPaidPlan && (
                  <span title={isScale ? "Scale Plan" : "Pro Plan"}>
                    <SealCheck
                      size={18}
                      weight="fill"
                      className={cn(
                        isScale
                          ? "text-amber-500"
                          : "text-blue-500"
                      )}
                    />
                  </span>
                )}
              </div>
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
