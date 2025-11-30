"use client"

import { useState, useEffect } from "react"
import { useCustomer, CheckoutDialog } from "autumn-js/react"
import { useUser } from "@/lib/user-store/provider"
import { createClient } from "@/lib/supabase/client"
import { Certificate, Truck, CalendarBlank } from "@phosphor-icons/react"

interface SubscriptionProductCardProps {
  features?: {
    messages?: {
      balance: number | null
    }
  }
}

export function SubscriptionProductCard({ features }: SubscriptionProductCardProps) {
  const { customer, checkout, openBillingPortal } = useCustomer()
  const { user } = useUser()
  const [selectedPlan, setSelectedPlan] = useState<"growth" | "pro" | "scale">("growth")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bonusMessages, setBonusMessages] = useState<number>(0)

  const isGuest = user?.anonymous === true || !user
  const currentProduct = customer?.products?.[0]?.id
  const currentProductStatus = customer?.products?.[0]?.status

  // Determine display status
  const getDisplayStatus = (): { label: string; color: string } => {
    if (!currentProductStatus || !currentProduct) {
      return { label: "None", color: "text-muted-foreground" }
    }
    switch (currentProductStatus) {
      case "active":
        return { label: "Active", color: "text-green-600 dark:text-green-400" }
      case "trialing":
        return { label: "Trial", color: "text-blue-600 dark:text-blue-400" }
      case "past_due":
        return { label: "Past Due", color: "text-red-600 dark:text-red-400" }
      case "expired":
        return { label: "Cancelled", color: "text-orange-600 dark:text-orange-400" }
      default:
        return { label: "None", color: "text-muted-foreground" }
    }
  }

  const displayStatus = getDisplayStatus()

  // Plan configurations with message limits and features
  const plans = {
    growth: {
      id: "growth",
      name: "Growth",
      price: 29.0,
      credits: 100,
      messages: "100 messages",
      description: "File uploads, email support, 10 batch researches",
    },
    pro: {
      id: "pro",
      name: "Pro",
      price: 89.0,
      credits: "unlimited",
      messages: "unlimited messages",
      description: "Dedicated support, 50 batch researches, everything in Growth",
    },
    scale: {
      id: "scale",
      name: "Scale",
      price: 200.0,
      credits: "unlimited",
      messages: "unlimited messages",
      description: "Document search (RAG), fundraising consultation, 100 batch researches, everything in Pro",
    },
  }

  // Set selected plan based on current product on mount
  useEffect(() => {
    if (currentProduct && (currentProduct === "growth" || currentProduct === "pro" || currentProduct === "scale")) {
      setSelectedPlan(currentProduct)
    }
  }, [currentProduct])

  // Fetch bonus messages from user's profile
  useEffect(() => {
    const fetchBonusMessages = async () => {
      if (!user?.id) return

      const supabase = createClient()
      if (!supabase) return

      const { data } = await supabase
        .from("users")
        .select("bonus_messages")
        .eq("id", user.id)
        .single()

      setBonusMessages((data as any)?.bonus_messages || 0)
    }

    fetchBonusMessages()

    // Refetch when user changes
  }, [user?.id])

  const selectedPlanConfig = plans[selectedPlan]

  // Get the actual current subscribed plan config (not the selected one)
  const currentSubscribedPlanConfig = currentProduct && (currentProduct === "growth" || currentProduct === "pro" || currentProduct === "scale")
    ? plans[currentProduct]
    : null

  const handlePlanClick = (planId: "growth" | "pro" | "scale") => {
    setSelectedPlan(planId)
  }

  const handleCheckout = async () => {
    if (isGuest) return

    setIsLoading(true)
    setError(null)
    try {
      await checkout({
        productId: selectedPlan,
        dialog: CheckoutDialog,
        successUrl: window.location.origin + "/",
      })
      // Checkout dialog handles the flow, so if we reach here without error, it's successful
    } catch (error) {
      console.error("Checkout error:", error)
      setError("Failed to start checkout. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Show current credits balance only for paying users - based on ACTUAL subscription, not selected plan
  const hasPaidPlan = currentProduct && currentProduct !== "free"
  const displayCredits = currentSubscribedPlanConfig
    ? (currentSubscribedPlanConfig.credits === "unlimited"
        ? "∞"
        : (features?.messages?.balance ?? currentSubscribedPlanConfig.credits))
    : null

  // Calculate new credits when switching plans (for ALL users)
  const getNewCredits = () => {
    // Show new credits whenever user selects a different plan from their current one
    if (selectedPlan !== currentProduct) {
      return selectedPlanConfig.credits === "unlimited" ? "∞" : selectedPlanConfig.credits
    }
    return null
  }

  const newCredits = getNewCredits()

  // Determine button text based on plan comparison
  const getButtonText = () => {
    if (isGuest) return "Sign In to Subscribe"
    if (isLoading) return "Loading..."
    if (currentProduct === selectedPlan) return "Current Plan"

    // Determine upgrade or downgrade
    const planOrder = { growth: 1, pro: 2, scale: 3 }
    const currentOrder = currentProduct ? planOrder[currentProduct as keyof typeof planOrder] ?? 0 : 0
    const selectedOrder = planOrder[selectedPlan]

    if (currentOrder === 0) return "Start Trial"
    if (selectedOrder > currentOrder) return "Upgrade"
    if (selectedOrder < currentOrder) return "Downgrade"

    return "Add to Cart"
  }

  return (
    <div className="checkout__box">
      <h2>Subscription</h2>

      {/* Status Section */}
      <div className="status-line">
        <span className="status_name">Status</span>
        <span className={`status_value ${displayStatus.color}`}>{displayStatus.label}</span>
      </div>

      <h4 className="price">
        <span className="price_name">Price</span>
        <span className="sub_price">${selectedPlanConfig.price.toFixed(2)}</span>
        <br />
      </h4>

      {hasPaidPlan && displayCredits !== null && (
        <div className="credits-line">
          <span className="credits_name">Credits</span>
          <span className="credits_value">{displayCredits}</span>
        </div>
      )}

      {hasPaidPlan && (
        <div className="bonus-line">
          <span className="bonus_name">Bonus</span>
          <span className="bonus_value">{bonusMessages}</span>
        </div>
      )}

      {newCredits !== null && (
        <div className="credits-line">
          <span className="credits_name">New Credits</span>
          <span className="credits_value">{newCredits}</span>
        </div>
      )}

      <hr />

      <div className="checkout__opts">
        {/* Growth Plan */}
        <div
          className={`opt opt1 ${selectedPlan === "growth" ? "selected" : ""}`}
          data-rel="growth"
          data-price="29.00"
          onClick={() => handlePlanClick("growth")}
        >
          <div className="gridme">
            <div className="radio">
              <span className="radio_btn"></span>
            </div>
            <div className="lbl">
              Growth <b>Plan</b>
            </div>
            <div className="radio_price">${plans.growth.price.toFixed(2)}</div>
          </div>
          <div className="info-txt">{plans.growth.description}</div>
          <div className="freq_drop">
            <div className="freq_selected" style={{ cursor: "default" }}>
              <CalendarBlank size={20} weight="regular" className="inline-block mr-1" />
              <b>{plans.growth.messages}</b>
            </div>
          </div>
        </div>

        {/* Pro Plan */}
        <div
          className={`opt opt2 ${selectedPlan === "pro" ? "selected" : ""}`}
          data-rel="pro"
          data-price="89.00"
          onClick={() => handlePlanClick("pro")}
        >
          <div className="gridme">
            <div className="radio">
              <span className="radio_btn"></span>
            </div>
            <div className="lbl">
              Pro <b>Plan</b>
            </div>
            <div className="radio_price">${plans.pro.price.toFixed(2)}</div>
          </div>
          <div className="info-txt">{plans.pro.description}</div>
          <div className="freq_drop">
            <div className="freq_selected" style={{ cursor: "default" }}>
              <CalendarBlank size={20} weight="regular" className="inline-block mr-1" />
              <b>{plans.pro.messages}</b>
            </div>
          </div>
        </div>

        {/* Scale Plan */}
        <div
          className={`opt opt3 ${selectedPlan === "scale" ? "selected" : ""}`}
          data-rel="scale"
          data-price="200.00"
          onClick={() => handlePlanClick("scale")}
        >
          <div className="gridme">
            <div className="radio">
              <span className="radio_btn"></span>
            </div>
            <div className="lbl">
              Scale <b>Plan</b>
            </div>
            <div className="radio_price">${plans.scale.price.toFixed(2)}</div>
          </div>
          <div className="info-txt">{plans.scale.description}</div>
          <div className="freq_drop">
            <div className="freq_selected" style={{ cursor: "default" }}>
              <CalendarBlank size={20} weight="regular" className="inline-block mr-1" />
              <b>{plans.scale.messages}</b>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className="checkout__btns">
        <div className="cart_btn full-width">
          <button
            type="button"
            className="btn addtocart"
            onClick={handleCheckout}
            disabled={currentProduct === selectedPlan || isLoading}
          >
            {getButtonText()}
          </button>
        </div>
        {/* Manage Billing Button - only show for users with active subscription */}
        {currentProduct && currentProductStatus && (currentProductStatus === "active" || currentProductStatus === "trialing") && (
          <div className="cart_btn full-width" style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="btn manage-billing"
              onClick={() => openBillingPortal({ returnUrl: window.location.href })}
            >
              Manage Billing
            </button>
          </div>
        )}
      </div>

      <div className="guarantee">
        <div>
          <Certificate size={28} weight="regular" className="mx-auto mb-2" />
          2-Week Trial
        </div>
        <div className="line"></div>
        <div>
          <Truck size={28} weight="regular" className="mx-auto mb-2" />
          Free Shipping
        </div>
      </div>

      <style jsx>{`
        body {
          font-family: "Open Sans", sans-serif;
          background: #f4f4f4;
        }

        .checkout__box {
          padding: 20px;
          background: #fff;
          margin: 0 auto;
          border: 1px solid #ddd;
          max-width: 600px;
          width: 100%;
        }

        :global(.dark) .checkout__box {
          background: #1a1a1a;
          border: 1px solid #333;
        }

        .checkout__box h2 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 10px;
          color: black;
        }

        :global(.dark) .checkout__box h2 {
          color: white;
        }

        .price {
          text-align: right;
          font-size: 16px;
          font-weight: 700;
          color: black;
          margin-bottom: 10px;
          position: relative;
        }

        :global(.dark) .price {
          color: white;
        }

        .price_name {
          position: absolute;
          left: 0;
          font-weight: 400;
        }

        :global(.dark) .price_name {
          color: #999;
        }

        .reg_price.crossed {
          color: #888;
          text-decoration: line-through;
          font-weight: 400;
        }

        .sub_price {
          color: black;
        }

        :global(.dark) .sub_price {
          color: white;
        }

        .status-line {
          text-align: right;
          font-size: 16px;
          font-weight: 700;
          color: black;
          margin-bottom: 10px;
          position: relative;
        }

        :global(.dark) .status-line {
          color: white;
        }

        .status_name {
          position: absolute;
          left: 0;
          font-weight: 400;
          color: #666;
        }

        :global(.dark) .status_name {
          color: #999;
        }

        .status_value {
          font-size: 16px;
          font-weight: 600;
        }

        .credits-line {
          text-align: right;
          font-size: 16px;
          font-weight: 700;
          color: black;
          margin-bottom: 10px;
          position: relative;
        }

        :global(.dark) .credits-line {
          color: white;
        }

        .credits_name {
          position: absolute;
          left: 0;
          font-weight: 400;
          color: #666;
        }

        :global(.dark) .credits_name {
          color: #999;
        }

        .credits_value {
          color: black;
          font-size: 16px;
        }

        :global(.dark) .credits_value {
          color: white;
        }

        .bonus-line {
          text-align: right;
          font-size: 16px;
          font-weight: 700;
          color: black;
          margin-bottom: 10px;
          position: relative;
        }

        :global(.dark) .bonus-line {
          color: white;
        }

        .bonus_name {
          position: absolute;
          left: 0;
          font-weight: 400;
          color: #666;
        }

        :global(.dark) .bonus_name {
          color: #999;
        }

        .bonus_value {
          color: #8b5cf6;
          font-size: 16px;
        }

        :global(.dark) .bonus_value {
          color: #a78bfa;
        }

        h3 {
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 1.5px;
          color: black;
        }

        :global(.dark) h3 {
          color: white;
        }

        hr {
          border: none;
          margin: 10px;
          padding: 0;
          border-bottom: 1px solid #ddd;
        }

        :global(.dark) hr {
          border-bottom-color: #333;
        }

        .sub-txt {
          color: inherit;
        }

        .checkout__opts .opt {
          padding: 15px 0;
          border: 1px solid #ccc;
          border-radius: 5px;
          margin-bottom: 15px;
          font-size: 14px;
          cursor: pointer;
        }

        :global(.dark) .checkout__opts .opt {
          border-color: #444;
        }

        .checkout__opts .opt.selected {
          border: 2px solid black;
        }

        :global(.dark) .checkout__opts .opt.selected {
          border: 2px solid #3ab54b;
        }

        .checkout__opts .opt.selected .radio_btn {
          border: 2px solid #3ab54b;
        }

        .checkout__opts .opt.selected .radio_btn::before {
          content: "";
          width: 10px;
          height: 10px;
          display: block;
          position: absolute;
          background: #3ab54b;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .checkout__opts .opt.opt1,
        .checkout__opts .opt.opt2,
        .checkout__opts .opt.opt3 {
          padding-bottom: 10px;
          cursor: pointer;
        }

        .checkout__opts .opt .lbl b {
          color: #3ab54b;
        }

        .checkout__opts .opt .info-txt {
          padding-left: 40px;
          font-size: 12px;
          padding-bottom: 15px;
          padding-top: 6px;
          color: #666;
          font-style: italic;
          padding-right: 15px;
        }

        :global(.dark) .checkout__opts .opt .info-txt {
          color: #999;
        }

        .gridme {
          display: grid;
          grid-template-columns: 30px 1fr 80px;
          align-items: center;
          padding: 0 15px;
          color: black;
        }

        :global(.dark) .gridme {
          color: white;
        }

        .radio_btn {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1px solid #bbb;
          display: block;
          position: relative;
        }

        :global(.dark) .radio_btn {
          border-color: #666;
        }

        .radio_price {
          text-align: right;
          font-weight: 600;
        }

        .freq_drop {
          border-top: 1px solid #bbb;
          padding: 10px 15px 0;
          font-size: 14px;
        }

        :global(.dark) .freq_drop {
          border-top-color: #444;
        }

        .freq_selected {
          position: relative;
          color: black;
        }

        :global(.dark) .freq_selected {
          color: white;
        }

        .freq_selected svg {
          vertical-align: middle;
        }

        .error-message {
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 15px;
          color: #c33;
          font-size: 14px;
          text-align: center;
        }

        :global(.dark) .error-message {
          background: #3d1f1f;
          border-color: #5d2f2f;
          color: #ff6b6b;
        }

        .checkout__btns {
          display: block;
          margin-bottom: 20px;
        }

        .full-width {
          width: 100%;
        }

        .btn.addtocart,
        .btn.manage-billing {
          display: block;
          border-radius: 4px;
          color: black;
          font-size: 16px;
          font-weight: 700;
          width: 100%;
          border: 1px solid rgb(255, 187, 16);
          background-color: rgb(255, 187, 16);
          height: 60px;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .btn.addtocart:hover:not(:disabled),
        .btn.manage-billing:hover {
          background-color: transparent;
          border-color: rgb(255, 187, 16);
          color: black;
        }

        :global(.dark) .btn.addtocart:hover:not(:disabled),
        :global(.dark) .btn.manage-billing:hover {
          color: white;
        }

        .btn.addtocart:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .guarantee {
          display: grid;
          grid-template-columns: 1fr 2px 1fr;
          grid-column-gap: 5px;
          text-align: center;
          padding: 8px 0;
          border-top: 1px solid #ddd;
          border-bottom: 1px solid #ddd;
        }

        :global(.dark) .guarantee {
          border-top-color: #333;
          border-bottom-color: #333;
        }

        .guarantee div {
          padding: 10px;
          font-size: 12px;
          color: black;
        }

        :global(.dark) .guarantee div {
          color: white;
        }

        .guarantee div.line {
          padding: 0;
          border-right: 1px solid #ddd;
        }

        :global(.dark) .guarantee div.line {
          border-right-color: #333;
        }

        .guarantee svg {
          color: black;
        }

        :global(.dark) .guarantee svg {
          color: white;
        }
      `}</style>
    </div>
  )
}
