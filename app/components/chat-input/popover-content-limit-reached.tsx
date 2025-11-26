"use client"

import { PopoverContent } from "@/components/ui/popover"
import { APP_NAME } from "@/lib/config"
import Image from "next/image"

export function PopoverContentLimitReached() {
  return (
    <PopoverContent
      className="w-[300px] overflow-hidden rounded-xl p-0"
      side="top"
      align="start"
    >
      <Image
        src="/banner_forest.jpg"
        alt={`calm paint generate by ${APP_NAME}`}
        width={300}
        height={128}
        className="h-32 w-full object-cover"
      />
      <div className="p-3">
        <p className="text-primary mb-1 text-base font-medium">
          Monthly message limit reached
        </p>
        <p className="text-muted-foreground mb-5 text-base">
          Wait until next month or upgrade to Pro/Scale to continue your workflow. Visit Settings → Subscription to upgrade.
        </p>
      </div>
    </PopoverContent>
  )
}
