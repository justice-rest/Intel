import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Returns whether the viewport is below the mobile breakpoint (768px).
 *
 * Uses a synchronous initializer to avoid the undefined→boolean hydration
 * mismatch that previously caused SidebarProvider context recalculation
 * and cascading re-renders (which could make the mobile sidebar Sheet
 * close unexpectedly).
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => {
    // During SSR or before window is available, default to false.
    // On the client, read the actual value synchronously to avoid a
    // flash-of-wrong-state on the very first render.
    if (typeof window === "undefined") return false
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Sync on mount in case the initial value was the SSR default
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
