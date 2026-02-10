import { useCallback, useSyncExternalStore } from "react"

/**
 * Returns whether the viewport is below the given breakpoint.
 *
 * Uses useSyncExternalStore to avoid SSR hydration mismatches while
 * still providing the correct value on the first client render.
 */
export function useBreakpoint(breakpoint: number) {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
      mql.addEventListener("change", callback)
      return () => mql.removeEventListener("change", callback)
    },
    [breakpoint]
  )

  const getSnapshot = useCallback(() => {
    return window.innerWidth < breakpoint
  }, [breakpoint])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
