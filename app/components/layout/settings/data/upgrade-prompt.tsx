"use client"

import { PopoverContent } from "@/components/ui/popover"
import Image from "next/image"

export function UpgradePrompt() {
  return (
    <PopoverContent
      className="w-[300px] overflow-hidden rounded-xl p-0"
      side="top"
      align="start"
    >
      <Image
        src="/banner_forest.jpg"
        alt="upgrade to scale"
        width={300}
        height={128}
        className="h-32 w-full object-cover"
      />
      <div className="p-3">
        <p className="text-primary mb-1 text-base font-medium">
          Scale Plan Required
        </p>
        <p className="text-muted-foreground mb-5 text-base">
          Upload and search your own documents with AI-powered RAG. Unlock
          unlimited potential with fundraising insights from your data. Visit the Subscription tab below to upgrade to Scale.
        </p>
      </div>
    </PopoverContent>
  )
}
