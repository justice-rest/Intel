import * as React from "react"
import type { SVGProps } from "react"

const SalesforceIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    width={64}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Salesforce cloud-inspired icon */}
    <path
      fill="currentColor"
      d="M26.5 16c-5.799 0-10.5 4.701-10.5 10.5 0 .873.107 1.72.309 2.531A10.989 10.989 0 0 0 10 38c0 6.075 4.925 11 11 11h28c6.075 0 11-4.925 11-11 0-4.713-2.966-8.734-7.132-10.298A11.476 11.476 0 0 0 53 26.5c0-6.351-5.149-11.5-11.5-11.5a11.46 11.46 0 0 0-8.5 3.773A10.464 10.464 0 0 0 26.5 16z"
    />
    {/* Inner cloud detail */}
    <path
      fill="currentColor"
      fillOpacity={0.6}
      d="M32 24c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"
    />
  </svg>
)

export default SalesforceIcon
