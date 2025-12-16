import * as React from "react"
import type { SVGProps } from "react"

const VirtuousIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    width={64}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Virtuous-inspired V with heart/giving motif */}
    <path
      fill="currentColor"
      d="M32 56L8 20h12l12 24 12-24h12L32 56z"
    />
    <path
      fill="currentColor"
      d="M32 8c-4.418 0-8 3.582-8 8 0 2.21.895 4.21 2.343 5.657L32 28l5.657-6.343A7.963 7.963 0 0040 16c0-4.418-3.582-8-8-8z"
    />
  </svg>
)

export default VirtuousIcon
