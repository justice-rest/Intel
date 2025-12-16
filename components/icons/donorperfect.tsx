import * as React from "react"
import type { SVGProps } from "react"

const DonorPerfectIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    width={64}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* DonorPerfect inspired icon - stylized "DP" with heart element */}
    <rect
      x="8"
      y="8"
      width="48"
      height="48"
      rx="8"
      fill="currentColor"
      opacity="0.1"
    />
    {/* D shape */}
    <path
      fill="currentColor"
      d="M14 16h10c7.732 0 14 6.268 14 14s-6.268 14-14 14H14V16zm6 6v16h4c4.418 0 8-3.582 8-8s-3.582-8-8-8h-4z"
    />
    {/* Heart accent representing donor/giving */}
    <path
      fill="currentColor"
      d="M44 20c-2.5-2.5-6.5-2.5-9 0l-1 1-1-1c-2.5-2.5-6.5-2.5-9 0 0 0 0 0 0 0l10 12 10-12c0 0 0 0 0 0z"
      opacity="0.6"
    />
  </svg>
)

export default DonorPerfectIcon
