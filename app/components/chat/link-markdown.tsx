"use client"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import Image from "next/image"
import { useEffect, useState, useMemo } from "react"

interface LinkPreview {
  title: string
  description: string
}

export function LinkMarkdown({
  href,
  children,
  ...props
}: React.ComponentProps<"a">) {
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [isHovering, setIsHovering] = useState(false)

  // Memoize URL processing
  const { cleanedHref, domain, isValidUrl } = useMemo(() => {
    if (!href) return { cleanedHref: "", domain: "", isValidUrl: false }

    let cleaned = href.trim().replace(/[.,;:!?]+$/, "")

    if (
      !cleaned.startsWith("http://") &&
      !cleaned.startsWith("https://") &&
      !cleaned.startsWith("/")
    ) {
      cleaned = `https://${cleaned}`
    }

    let dom = ""
    let valid = false
    try {
      const url = new URL(cleaned)
      dom = url.hostname
      valid = true
    } catch {
      dom = cleaned.split("/").pop() || cleaned
    }

    return { cleanedHref: cleaned, domain: dom, isValidUrl: valid }
  }, [href])

  // Fetch preview when hovering
  useEffect(() => {
    if (!isHovering || preview || !isValidUrl) return

    const fetchPreview = async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(cleanedHref)}`)
        if (res.ok) {
          const data = await res.json()
          setPreview(data)
        }
      } catch {
        setPreview({
          title: domain.replace("www.", ""),
          description: cleanedHref
        })
      }
    }

    fetchPreview()
  }, [isHovering, preview, cleanedHref, domain, isValidUrl])

  // Early returns after all hooks
  if (!href) return <span {...props}>{children}</span>
  if (!isValidUrl && !cleanedHref.startsWith("/")) {
    return <span {...props}>{children}</span>
  }

  return (
    <HoverCard openDelay={200} closeDelay={0} onOpenChange={setIsHovering}>
      <HoverCardTrigger asChild>
        <a
          href={cleanedHref}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-muted text-muted-foreground hover:bg-muted-foreground/30 hover:text-primary inline-flex h-5 max-w-32 items-center gap-1 overflow-hidden rounded-full py-0 pr-2 pl-0.5 text-xs leading-none overflow-ellipsis whitespace-nowrap no-underline transition-colors duration-150"
        >
          <Image
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(cleanedHref)}`}
            alt=""
            width={14}
            height={14}
            className="size-3.5 rounded-full"
          />
          <span className="overflow-hidden font-normal text-ellipsis whitespace-nowrap">
            {domain.replace("www.", "")}
          </span>
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0" side="top" sideOffset={8}>
        <a
          href={cleanedHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-2 p-3 no-underline"
        >
          <div className="flex items-center gap-2">
            <Image
              src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(cleanedHref)}`}
              alt=""
              className="size-4 rounded-full"
              width={16}
              height={16}
            />
            <span className="text-muted-foreground truncate text-sm">
              {domain.replace("www.", "")}
            </span>
          </div>
          {preview ? (
            <>
              <div className="text-foreground line-clamp-2 text-sm font-medium">
                {preview.title}
              </div>
              {preview.description && (
                <div className="text-muted-foreground line-clamp-2 text-xs">
                  {preview.description}
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Loading...</div>
          )}
        </a>
      </HoverCardContent>
    </HoverCard>
  )
}
