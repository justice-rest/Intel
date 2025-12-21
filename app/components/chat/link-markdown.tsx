export function LinkMarkdown({
  href,
  children,
  ...props
}: React.ComponentProps<"a">) {
  if (!href) return <span {...props}>{children}</span>

  // Clean and normalize the URL
  let cleanedHref = href.trim()

  // Remove trailing punctuation that might have been accidentally included
  cleanedHref = cleanedHref.replace(/[.,;:!?]+$/, "")

  // Ensure the URL starts with a protocol
  if (
    !cleanedHref.startsWith("http://") &&
    !cleanedHref.startsWith("https://") &&
    !cleanedHref.startsWith("/")
  ) {
    cleanedHref = `https://${cleanedHref}`
  }

  // Check if href is a valid URL
  let domain = ""
  let isValidUrl = false
  try {
    const url = new URL(cleanedHref)
    domain = url.hostname
    isValidUrl = true
  } catch {
    // If href is not a valid URL (likely a relative path or malformed)
    domain = cleanedHref.split("/").pop() || cleanedHref
  }

  // For invalid URLs, just render as text
  if (!isValidUrl && !cleanedHref.startsWith("/")) {
    return <span {...props}>{children}</span>
  }

  return (
    <a
      href={cleanedHref}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-muted text-muted-foreground hover:bg-muted-foreground/30 hover:text-primary inline-flex h-5 max-w-32 items-center gap-1 overflow-hidden rounded-full py-0 pr-2 pl-0.5 text-xs leading-none overflow-ellipsis whitespace-nowrap no-underline transition-colors duration-150"
    >
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(cleanedHref)}`}
        alt="favicon"
        width={14}
        height={14}
        className="size-3.5 rounded-full"
      />
      <span className="overflow-hidden font-normal text-ellipsis whitespace-nowrap">
        {domain.replace("www.", "")}
      </span>
    </a>
  )
}
