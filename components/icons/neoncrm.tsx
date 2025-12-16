import * as React from "react"
import type { SVGProps } from "react"

const NeonCRMIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    width={64}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Neon CRM inspired icon - stylized "N" with glow effect */}
    <rect
      x="8"
      y="8"
      width="48"
      height="48"
      rx="8"
      fill="currentColor"
      opacity="0.1"
    />
    <path
      fill="currentColor"
      d="M18 16v32h6V28.8l16 19.2h6V16h-6v19.2L24 16h-6z"
    />
    {/* Accent dots representing "neon glow" */}
    <circle fill="currentColor" cx="52" cy="12" r="3" opacity="0.6" />
    <circle fill="currentColor" cx="12" cy="52" r="3" opacity="0.6" />
  </svg>
)

export default NeonCRMIcon
