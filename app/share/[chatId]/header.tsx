"use client"

import { APP_NAME } from "@/lib/config"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

export function Header() {
  const [href, setHref] = useState("/auth")

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      if (!supabase) {
        // Supabase not enabled, default to /auth
        setHref("/auth")
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      // If authenticated (and not a guest), go to home; otherwise go to auth
      if (user && !user.is_anonymous) {
        setHref("/")
      } else {
        setHref("/auth")
      }
    }

    checkAuth()
  }, [])

  return (
    <header className="h-app-header fixed top-0 right-0 left-0 z-50">
      <div className="h-app-header top-app-header bg-background pointer-events-none absolute left-0 z-50 mx-auto w-full to-transparent backdrop-blur-xl [-webkit-mask-image:linear-gradient(to_bottom,black,transparent)] lg:hidden"></div>
      <div className="bg-background relative mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:bg-transparent lg:px-8">
        <Link
          href={href}
          className="inline-flex items-center text-xl font-semibold tracking-tight group/logo"
        >
          <span className="relative mr-1.5 size-7">
            <Image
              src="/PFPs/1.png"
              alt="Rōmy"
              width={28}
              height={28}
              className="absolute inset-0 rounded-lg transition-opacity duration-200 group-hover/logo:opacity-0"
            />
            <Image
              src="/PFPs/2.png"
              alt="Rōmy"
              width={28}
              height={28}
              className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover/logo:opacity-100"
            />
          </span>
          <span style={{ fontFamily: 'rb-freigeist-neue, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"' }}>
            {APP_NAME}
          </span>
        </Link>
      </div>
    </header>
  )
}
