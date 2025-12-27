import * as React from "react"
import type { SVGProps } from "react"

const EveryActionIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    width={64}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* EveryAction / NGP VAN - checkmark in circle (action/advocacy) */}
    <circle
      cx={32}
      cy={32}
      r={28}
      stroke="currentColor"
      strokeWidth={4}
      fill="none"
    />
    {/* Checkmark */}
    <path
      fill="currentColor"
      d="M27 32l-6-6-4 4 10 10 20-20-4-4-16 16z"
    />
  </svg>
)

export default EveryActionIcon
