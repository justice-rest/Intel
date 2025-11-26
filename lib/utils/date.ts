/**
 * Format a date to a relative time string (e.g., "2 hours ago", "in 3 days")
 * Native JavaScript implementation to avoid external dependencies
 *
 * @param date - The date to format (Date object or date string)
 * @param options - Optional configuration
 * @returns Formatted relative time string
 */
export function formatDistanceToNow(
  date: Date | string,
  options: { addSuffix?: boolean } = {}
): string {
  const now = new Date()
  const targetDate = typeof date === "string" ? new Date(date) : date
  const diffMs = now.getTime() - targetDate.getTime()
  const diffSeconds = Math.abs(Math.floor(diffMs / 1000))
  const isFuture = diffMs < 0

  // Define time intervals in seconds
  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ]

  // Find the appropriate interval
  for (const interval of intervals) {
    const count = Math.floor(diffSeconds / interval.seconds)
    if (count >= 1) {
      const plural = count > 1 ? "s" : ""
      const timeString = `${count} ${interval.label}${plural}`

      if (options.addSuffix) {
        return isFuture ? `in ${timeString}` : `${timeString} ago`
      }
      return timeString
    }
  }

  // Less than a second
  const timeString = "less than a second"
  if (options.addSuffix) {
    return isFuture ? `in ${timeString}` : `${timeString} ago`
  }
  return timeString
}

/**
 * Format a date to a localized date string
 *
 * @param date - The date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  }
): string {
  const targetDate = typeof date === "string" ? new Date(date) : date
  return targetDate.toLocaleDateString("en-US", options)
}

/**
 * Format a date to a localized date and time string
 *
 * @param date - The date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date and time string
 */
export function formatDateTime(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }
): string {
  const targetDate = typeof date === "string" ? new Date(date) : date
  return targetDate.toLocaleString("en-US", options)
}
