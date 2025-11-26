"use client"

import React, { useState } from "react"
import { useCustomer, CheckoutDialog } from "autumn-js/react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-store/provider"
import Link from "next/link"

/**
 * Theme-aware MM Pricing Cards Component
 *
 * Based on MM PricingComponent with:
 * - Transparent background (removed bg-[#1a1520])
 * - Light/dark mode support (text-foreground instead of hardcoded colors)
 * - Integrated autumn-js checkout
 * - Monthly billing only
 */

interface PricingFeatureProps {
  children: React.ReactNode
  dataId?: string
}

const PricingFeature: React.FC<PricingFeatureProps> = ({
  children,
  dataId,
}) => {
  return (
    <li className="mb-4 flex items-center space-x-2" data-id={dataId}>
      <span className="text-xl text-foreground/60">•</span>
      <span className="text-foreground/80">{children}</span>
    </li>
  )
}

interface PricingCardProps {
  title: string
  price: string | number
  period?: string
  features: string[]
  ctaText: string
  ctaVariant: "outline" | "solid"
  badge?: string
  dataId?: string
  onCtaClick?: () => void
  disabled?: boolean
  isLoading?: boolean
}

const PricingCard: React.FC<PricingCardProps> = ({
  title,
  price,
  period,
  features,
  ctaText,
  ctaVariant,
  badge,
  dataId,
  onCtaClick,
  disabled,
  isLoading,
}) => {
  return (
    <div className="flex w-full flex-col px-8 py-12" data-id={dataId}>
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-4xl font-medium text-foreground">{title}</h2>
        {badge && (
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-500">
            {badge}
          </span>
        )}
      </div>
      <div className="mb-10">
        <p className="mb-2 text-3xl text-foreground/90">
          ${price}
          {period && (
            <span className="text-lg text-foreground/60">{period}</span>
          )}
        </p>
      </div>
      <ul className="mb-12">
        {features.map((feature, index) => (
          <PricingFeature key={index}>{feature}</PricingFeature>
        ))}
      </ul>
      <div className="mt-auto">
        <button
          onClick={onCtaClick}
          disabled={disabled || isLoading}
          className={cn(
            "w-full rounded-md py-4 text-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            ctaVariant === "outline"
              ? "border border-foreground/20 bg-transparent text-foreground hover:border-foreground hover:bg-foreground hover:text-background"
              : "border border-foreground bg-foreground text-background hover:border-foreground/20 hover:bg-transparent hover:text-foreground"
          )}
        >
          {isLoading ? "Loading..." : ctaText}
        </button>
      </div>
    </div>
  )
}

const PRICING_CONSTANTS = {
  PRICING: {
    pro: 29,
    max: 89,
    ultra: 200,
  },
} as const

export function MMPricingCards() {
  const { customer, checkout } = useCustomer()
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState<string | null>(null)

  // Check if user is a guest (anonymous user)
  const isGuest = user?.anonymous === true || !user

  const handleCheckout = async (productId: string) => {
    // Prevent checkout for guest users
    if (isGuest) {
      return
    }

    setIsLoading(productId)
    try {
      await checkout({
        productId: productId,
        dialog: CheckoutDialog,
        successUrl: window.location.origin + "/",
      })
    } catch (error) {
      console.error("Checkout error:", error)
    } finally {
      setIsLoading(null)
    }
  }

  const currentProduct = customer?.products?.[0]?.id

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">

      {/* MM Pricing Component Container - Transparent background */}
      <div className="w-full overflow-hidden rounded-xl" data-id="mm-pricing">
        <div className="flex flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
          <PricingCard
            title="Growth"
            price={PRICING_CONSTANTS.PRICING.pro}
            period="/month"
            features={[
              "100 messages per month",
              "File uploads",
              "Email support",
            ]}
            ctaText={isGuest ? "Sign In to Subscribe" : (currentProduct === "growth" ? "Current Plan" : currentProduct ? "Subscribe" : "Start Trial")}
            ctaVariant="outline"
            onCtaClick={() => handleCheckout("growth")}
            disabled={currentProduct === "growth"}
            isLoading={isLoading === "growth"}
          />
          <PricingCard
            title="Pro"
            price={PRICING_CONSTANTS.PRICING.max}
            period="/month"
            features={[
              "Unlimited messages",
              "Dedicated support",
              "Everything in Growth",
            ]}
            ctaText={isGuest ? "Sign In to Subscribe" : (currentProduct === "pro" ? "Current Plan" : currentProduct ? "Subscribe" : "Start Trial")}
            ctaVariant="solid"
            badge="Popular"
            onCtaClick={() => handleCheckout("pro")}
            disabled={currentProduct === "pro"}
            isLoading={isLoading === "pro"}
          />
          <PricingCard
            title="Scale"
            price={PRICING_CONSTANTS.PRICING.ultra}
            period="/month"
            features={[
              "Everything in Pro",
              "Upload & search your own documents (RAG)",
              "Fundraising consultation",
            ]}
            ctaText={isGuest ? "Sign In to Subscribe" : (currentProduct === "scale" ? "Current Plan" : currentProduct ? "Subscribe" : "Start Trial")}
            ctaVariant="outline"
            onCtaClick={() => handleCheckout("scale")}
            disabled={currentProduct === "scale"}
            isLoading={isLoading === "scale"}
          />
        </div>
      </div>
    </div>
  )
}
