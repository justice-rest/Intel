import * as React from "react"

/**
 * Returns whether the viewport is below the given breakpoint.
 *
 * Uses a synchronous initializer to avoid the undefined→boolean hydration
 * mismatch that causes cascading re-renders in parent contexts.
 */
export function useBreakpoint(breakpoint: number) {
  const [isBelowBreakpoint, setIsBelowBreakpoint] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.innerWidth < breakpoint
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsBelowBreakpoint(window.innerWidth < breakpoint)
    }
    mql.addEventListener("change", onChange)
    setIsBelowBreakpoint(window.innerWidth < breakpoint)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return isBelowBreakpoint
}
