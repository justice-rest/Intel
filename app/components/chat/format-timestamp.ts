/**
 * Format a timestamp for display in chat messages
 * Shows relative time for recent messages, absolute time for older ones
 */

export function formatMessageTimestamp(date: Date | undefined): string {
  if (!date) return ""

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  // Less than 1 minute ago
  if (diffMins < 1) {
    return "Just now"
  }

  // Less than 1 hour ago
  if (diffMins < 60) {
    return `${diffMins}m ago`
  }

  // Less than 24 hours ago
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  // Less than 7 days ago
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  // Older - show date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

/**
 * Format a timestamp for tooltip (full date and time)
 */
export function formatFullTimestamp(date: Date | undefined): string {
  if (!date) return ""

  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}
