"use client"

import type { HTMLAttributes } from "react"

interface RomyLogoProps extends HTMLAttributes<HTMLImageElement> {
  className?: string
}

export function RomyLogo({ className, ...props }: RomyLogoProps) {
  return (
    <img
      src="/blue.png"
      alt="Rōmy"
      className={className}
      {...props}
    />
  )
}
