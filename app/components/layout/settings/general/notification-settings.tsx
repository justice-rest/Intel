"use client"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useNotifications } from "@/lib/notifications"
import { Bell, BellSlash } from "@phosphor-icons/react"

export function NotificationSettings() {
  const {
    permission,
    isSupported,
    isEnabled,
    requestPermission,
    setEnabled,
  } = useNotifications()

  if (!isSupported) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Desktop Notifications</h3>
          <p className="text-muted-foreground text-xs">
            Notifications are not supported in this browser
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Desktop Notifications</h3>
        <p className="text-muted-foreground mb-4 text-xs">
          Get notified when collaborators send messages
        </p>

        {permission === "denied" ? (
          <div className="flex items-center gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
            <BellSlash className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-500">
                Notifications blocked
              </p>
              <p className="text-muted-foreground text-xs">
                Please enable notifications in your browser settings
              </p>
            </div>
          </div>
        ) : permission === "default" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={requestPermission}
            className="gap-2"
          >
            <Bell className="h-4 w-4" />
            Enable Notifications
          </Button>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="text-muted-foreground h-4 w-4" />
              <span className="text-sm">Notification sounds</span>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={setEnabled}
            />
          </div>
        )}
      </div>

      {permission === "granted" && (
        <div className="text-muted-foreground text-xs">
          You&apos;ll receive notifications when:
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>A collaborator sends a message in a shared chat</li>
            <li>You&apos;re mentioned in a conversation</li>
          </ul>
        </div>
      )}
    </div>
  )
}
