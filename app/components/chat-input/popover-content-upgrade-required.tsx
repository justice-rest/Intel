"use client"

import { Button } from "@/components/ui/button"
import { PopoverContent } from "@/components/ui/popover"
import { APP_NAME } from "@/lib/config"
import Image from "next/image"

export function PopoverContentUpgradeRequired() {
  const handleSubscribe = () => {
    window.dispatchEvent(
      new CustomEvent("open-settings", { detail: { tab: "subscription" } })
    )
  }

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
          Upgrade to use Rōmy
        </p>
        <p className="text-muted-foreground mb-3 text-base">
          Subscribe to start chatting with AI models and unlock all features. Start with a free 2-week trial!
        </p>
        <Button onClick={handleSubscribe} className="w-full">
          Start Free Trial
        </Button>
      </div>
    </PopoverContent>
  )
}
