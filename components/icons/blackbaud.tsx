import * as React from "react"
import type { SVGProps } from "react"

const BlackbaudIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    width={64}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Raiser's Edge NXT / Blackbaud - stylized rising graph icon */}
    <path
      fill="currentColor"
      d="M8 56V20l12 16v20H8zm16 0V28l12 12v16H24zm16 0V32l12 8v16H40zm16 0V36l4-4v24h-4z"
    />
    {/* Upward arrow accent */}
    <path
      fill="currentColor"
      d="M52 8l8 8h-5v12h-6V16h-5l8-8z"
    />
  </svg>
)

export default BlackbaudIcon
