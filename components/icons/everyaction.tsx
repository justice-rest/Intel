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
    {/* EveryAction/NGP VAN inspired icon - stylized EA */}
    <circle
      cx={32}
      cy={32}
      r={28}
      fill="currentColor"
    />
    {/* E shape */}
    <path
      fill="currentColor"
      fillOpacity={0.3}
      d="M18 20h14v4H22v8h8v4h-8v8h10v4H18V20z"
    />
    {/* A shape */}
    <path
      fill="currentColor"
      fillOpacity={0.3}
      d="M34 48V20l12 28h-5l-2-6h-8l2-4h4l-3-9-6 19h-4l10-28z"
    />
  </svg>
)

export default EveryActionIcon
