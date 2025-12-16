import * as React from "react"
import type { SVGProps } from "react"

const BloomerangIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    width={64}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Bloomerang-inspired boomerang/flower shape */}
    <path
      fill="currentColor"
      d="M32 4C16.536 4 4 16.536 4 32s12.536 28 28 28 28-12.536 28-28S47.464 4 32 4zm0 8c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20z"
    />
    <path
      fill="currentColor"
      d="M32 20c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 6c3.314 0 6 2.686 6 6s-2.686 6-6 6-6-2.686-6-6 2.686-6 6-6z"
    />
    <circle fill="currentColor" cx="32" cy="32" r="3" />
  </svg>
)

export default BloomerangIcon
