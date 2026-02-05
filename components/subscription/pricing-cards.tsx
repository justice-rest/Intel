"use client"

import { useCustomer, CheckoutDialog } from "autumn-js/react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-store/provider"
import Image from "next/image"

/**
 * Pricing Cards Component for Rōmy Subscriptions
 * Based on Zero/mail design - exact replica
 *
 * Plans:
 * - Pro: $29/month
 * - Max: $89/month
 * - Ultra: $200/month
 */

const PRICING_CONSTANTS = {
  PRO_FEATURES: ["100 messages", "file uploads", "email support", "100 batch researches"],
  MAX_FEATURES: [
    "everything in growth",
    "unlimited messaging",
    "dedicated support",
    "500 batch researches",
  ],
  ULTRA_FEATURES: [
    "everything in pro",
    "fundraising consultation",
    "1000 batch researches",
  ],
  CARD_STYLES: {
    base: "relative flex-1 min-w-[280px] max-w-[384px] min-h-[630px] flex flex-col items-start justify-between overflow-hidden rounded-2xl border border-[#2D2D2D] bg-[#18181a] p-5",
    header: "inline-flex items-center justify-start gap-2.5 rounded-lg p-2",
    headerPro: "bg-[#422F10]",
    headerMax: "bg-[#B183FF]",
    headerUltra: "bg-[#B183FF]/60",
    max: "outline outline-2 outline-offset-[3.5px] outline-[#2D2D2D]",
    divider:
      "h-0 self-stretch outline outline-1 outline-offset-[-0.50px] outline-white/10",
  },
  PRICING: {
    pro: 29,
    max: 89,
    ultra: 200,
  },
} as const

const ThickCheck = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1.5 5L4 7.5L8.5 2.5"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PurpleThickCheck = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1.5 5L4 7.5L8.5 2.5"
      stroke="#B183FF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface FeatureItemProps {
  text: string
  isPremium?: boolean
}

const FeatureItem = ({ text, isPremium }: FeatureItemProps) => (
  <div className="inline-flex items-center justify-start gap-2.5">
    <div className="flex h-5 w-5 items-start justify-start gap-3 rounded-[125px] bg-white/10 p-[5px]">
      {isPremium ? (
        <PurpleThickCheck />
      ) : (
        <ThickCheck />
      )}
    </div>
    <div className="justify-center text-sm font-normal leading-normal text-white lg:text-base">
      {text}
    </div>
  </div>
)

export function PricingCards() {
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

      <div className="flex flex-col items-center justify-center gap-5 lg:flex-row lg:items-stretch">
        {/* Pro Plan */}
        <div className={PRICING_CONSTANTS.CARD_STYLES.base}>
          <div className="absolute inset-0 z-0 h-full w-full overflow-hidden"></div>

          <div className="relative z-10 flex flex-col items-start justify-start gap-5 self-stretch">
            <div className="flex flex-col items-start justify-start gap-4 self-stretch">
              <div
                className={cn(
                  PRICING_CONSTANTS.CARD_STYLES.header,
                  PRICING_CONSTANTS.CARD_STYLES.headerPro
                )}
              >
                <div className="relative h-6 w-6">
                  <Image
                    src="/lock.svg"
                    alt="lock"
                    height={24}
                    width={24}
                    className="relative left-0 h-6 w-6"
                  />
                </div>
              </div>

              <div className="flex flex-col items-start justify-start gap-2 self-stretch">
                <div className="inline-flex items-end justify-start gap-1 self-stretch">
                  <div className="justify-center text-4xl font-semibold leading-10 text-white">
                    ${PRICING_CONSTANTS.PRICING.pro}
                  </div>
                  <div className="flex items-center justify-center gap-2.5 pb-0.5">
                    <div className="justify-center text-sm font-medium leading-tight text-white/40">
                      /MONTH
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start justify-start gap-2 self-stretch">
                  <div className="justify-center self-stretch text-sm font-normal leading-normal text-white opacity-70 lg:text-base">
                    Perfect for individuals getting started with AI.
                  </div>
                </div>
              </div>
            </div>
            <div className={PRICING_CONSTANTS.CARD_STYLES.divider}></div>
            <div className="flex flex-col items-start justify-start gap-2.5 self-stretch">
              {PRICING_CONSTANTS.PRO_FEATURES.map((feature) => (
                <FeatureItem key={feature} text={feature} />
              ))}
            </div>
          </div>
          <button
            onClick={() => handleCheckout("growth")}
            disabled={currentProduct === "growth" || isLoading === "growth"}
            className="z-30 mt-auto inline-flex h-10 items-center justify-center gap-2.5 self-stretch overflow-hidden rounded-lg bg-[#2D2D2D] p-3 shadow shadow-black/30 outline outline-1 -outline-offset-1 outline-[#434343] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2.5 px-1">
              <div className="justify-start text-center font-semibold leading-none text-[#D5D5D5]">
                {currentProduct === "growth"
                  ? "Current Plan"
                  : isLoading === "growth"
                    ? "Loading..."
                    : isGuest
                      ? "Sign In to Subscribe"
                      : currentProduct
                        ? "Subscribe"
                        : "Start Trial"}
              </div>
            </div>
          </button>
        </div>

        {/* Max Plan */}
        <div
          className={cn(
            PRICING_CONSTANTS.CARD_STYLES.base,
            PRICING_CONSTANTS.CARD_STYLES.max
          )}
        >
          <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
            <Image
              src="/pricing-gradient.png"
              alt=""
              className="absolute -right-0 -top-52 h-auto w-full"
              height={535}
              width={535}
              priority
            />
          </div>

          <div className="absolute inset-x-0 -top-14 h-56 overflow-hidden relative">
            <div className="absolute inset-0 bg-white/10 mix-blend-overlay blur-[100px]" />
            <Image
              className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
              src="/small-pixel.png"
              alt="background effect"
              fill
              sizes="100vw"
            />
          </div>

          <div className="relative z-10 flex flex-col items-start justify-start gap-5 self-stretch">
            <div className="flex flex-col items-start justify-start gap-4 self-stretch">
              <div
                className={cn(
                  PRICING_CONSTANTS.CARD_STYLES.header,
                  PRICING_CONSTANTS.CARD_STYLES.headerMax
                )}
              >
                <div className="relative h-6 w-6">
                  <Image height={24} width={24} src="/zap.svg" alt="zap" />
                </div>
              </div>

              <div className="flex flex-col items-start justify-start gap-2 self-stretch">
                <div className="inline-flex items-end justify-start gap-1 self-stretch">
                  <div className="justify-center text-4xl font-semibold leading-10 text-white">
                    ${PRICING_CONSTANTS.PRICING.max}
                  </div>
                  <div className="flex items-center justify-center gap-2.5 pb-0.5">
                    <div className="justify-center text-sm font-medium leading-tight text-white/40">
                      /MONTH
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start justify-start gap-2 self-stretch">
                  <div className="justify-center self-stretch text-sm font-normal leading-normal text-white opacity-70 lg:text-base">
                    For power users who need unlimited access.
                  </div>
                </div>
              </div>
            </div>
            <div className={PRICING_CONSTANTS.CARD_STYLES.divider}></div>
            <div className="flex flex-col items-start justify-start gap-2.5 self-stretch">
              {PRICING_CONSTANTS.MAX_FEATURES.map((feature) => (
                <FeatureItem key={feature} text={feature} isPremium />
              ))}
            </div>
          </div>
          <button
            className="z-30 mt-auto inline-flex h-10 cursor-pointer items-center justify-center gap-2.5 self-stretch overflow-hidden rounded-lg bg-white p-3 outline outline-1 -outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleCheckout("pro")}
            disabled={currentProduct === "pro" || isLoading === "pro"}
          >
            <div className="flex items-center justify-center gap-2.5 px-1">
              <div className="justify-start text-center font-semibold leading-none text-black">
                {currentProduct === "pro"
                  ? "Current Plan"
                  : isLoading === "pro"
                    ? "Loading..."
                    : isGuest
                      ? "Sign In to Subscribe"
                      : currentProduct
                        ? "Subscribe"
                        : "Start Trial"}
              </div>
            </div>
          </button>
        </div>

        {/* Ultra Plan */}
        <div className={PRICING_CONSTANTS.CARD_STYLES.base}>
          <div className="absolute inset-0 z-0 h-full w-full overflow-hidden"></div>
          <div className="relative z-10 flex flex-col items-start justify-start gap-5 self-stretch">
            <div className="flex flex-col items-start justify-start gap-4 self-stretch">
              <div
                className={cn(
                  PRICING_CONSTANTS.CARD_STYLES.header,
                  PRICING_CONSTANTS.CARD_STYLES.headerUltra
                )}
              >
                <div className="relative h-6 w-6">
                  <Image
                    height={40}
                    width={40}
                    src="/mail-pixel.svg"
                    alt="enterprise"
                  />
                </div>
              </div>

              <div className="flex flex-col items-start justify-start gap-2 self-stretch">
                <div className="inline-flex items-end justify-start gap-1 self-stretch">
                  <div className="justify-center text-4xl font-semibold leading-10 text-white">
                    ${PRICING_CONSTANTS.PRICING.ultra}
                  </div>
                  <div className="flex items-center justify-center gap-2.5 pb-0.5">
                    <div className="justify-center text-sm font-medium leading-tight text-white/40">
                      /MONTH
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start justify-start gap-2 self-stretch">
                  <div className="justify-center self-stretch text-sm font-normal leading-normal text-white opacity-70 lg:text-base">
                    For professionals and NGO seeking growth.
                  </div>
                </div>
              </div>
            </div>
            <div className={PRICING_CONSTANTS.CARD_STYLES.divider}></div>
            <div className="flex flex-col items-start justify-start gap-2.5 self-stretch">
              {PRICING_CONSTANTS.ULTRA_FEATURES.map((feature) => (
                <FeatureItem key={feature} text={feature} isPremium />
              ))}
            </div>
          </div>
          <button
            className="z-30 mt-auto inline-flex h-10 items-center justify-center gap-2.5 self-stretch overflow-hidden rounded-lg bg-[#2D2D2D] p-3 shadow shadow-black/30 outline outline-1 -outline-offset-1 outline-[#434343] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleCheckout("scale")}
            disabled={currentProduct === "scale" || isLoading === "scale"}
          >
            <div className="flex items-center justify-center gap-2.5 px-1">
              <div className="justify-start text-center font-semibold leading-none text-[#D5D5D5]">
                {currentProduct === "scale"
                  ? "Current Plan"
                  : isLoading === "scale"
                    ? "Loading..."
                    : isGuest
                      ? "Sign In to Subscribe"
                      : currentProduct
                        ? "Subscribe"
                        : "Start Trial"}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
