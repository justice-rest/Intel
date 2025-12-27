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
    {/* Blackbaud/RE NXT inspired geometric icon */}
    <rect
      x={8}
      y={8}
      width={48}
      height={48}
      rx={8}
      fill="currentColor"
    />
    {/* Inner B shape */}
    <path
      fill="currentColor"
      fillOpacity={0.3}
      d="M22 16h12c4.418 0 8 3.582 8 8 0 2.21-.895 4.21-2.343 5.657A7.965 7.965 0 0 1 42 36c0 4.418-3.582 8-8 8H22V16zm6 6v8h6a4 4 0 1 0 0-8h-6zm0 14v8h8a4 4 0 1 0 0-8h-8z"
    />
    {/* Accent dot */}
    <circle fill="currentColor" fillOpacity={0.6} cx={48} cy={48} r={4} />
  </svg>
)

export default BlackbaudIcon
