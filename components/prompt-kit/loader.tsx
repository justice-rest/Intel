"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

// Style constants
const DOT_SIZE = "size-2"
const DOT_COLOR = "bg-primary/60"
const DOT_SPACING = "gap-1"

// Animation constants
const ANIMATION_DURATION = 0.6
const DELAY_DOT_1 = 0
const DELAY_DOT_2 = 0.1
const DELAY_DOT_3 = 0.2

// Animation settings
const ANIMATION = {
  y: ["0%", "-60%", "0%"],
  opacity: [1, 0.7, 1],
}

const TRANSITION = {
  duration: ANIMATION_DURATION,
  ease: "easeInOut" as const,
  repeat: Number.POSITIVE_INFINITY,
  repeatType: "loop" as const,
}

export function Loader() {
  return (
    <div className={`flex items-center justify-center ${DOT_SPACING}`}>
      <Dot delay={DELAY_DOT_1} />
      <Dot delay={DELAY_DOT_2} />
      <Dot delay={DELAY_DOT_3} />
    </div>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.div
      className={`${DOT_SIZE} ${DOT_COLOR} rounded-full`}
      animate={ANIMATION}
      transition={{
        ...TRANSITION,
        delay,
      }}
    />
  )
}

export function TextShimmer({
  text = "Thinking",
  className,
  size = "md",
}: {
  text?: string
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  return (
    <div
      className={cn(
        "animate-text-shimmer bg-[linear-gradient(110deg,_var(--muted-foreground)_0%,_var(--foreground)_50%,_var(--muted-foreground)_100%)]",
        "bg-[length:250%_100%] bg-clip-text font-medium text-transparent [-webkit-background-clip:text]",
        textSizes[size],
        className
      )}
    >
      {text}
    </div>
  )
}
