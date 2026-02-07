"use client"

import { Button } from "@/components/ui/button"
import { signInWithGoogle } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { motion } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { Envelope } from "@phosphor-icons/react"

const endorsements = [
  {
    quote: "The recommendations are super helpful, especially the employer match and peer-to-peer ideas.",
    author: "Sofia Carvalho",
    title: "founder, GoodestDogs.org"
  },
  {
    quote: "I'm impressed! The deep dive is deep.",
    author: "Kristin",
    title: "Teens, Inc."
  }
]

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Random endorsement selected on mount (rotates on refresh)
  const endorsement = useMemo(() => {
    return endorsements[Math.floor(Math.random() * endorsements.length)]
  }, [])

  async function handleSignInWithGoogle() {
    const supabase = createClient()

    if (!supabase) {
      throw new Error("Supabase is not configured")
    }

    try {
      setIsLoading(true)
      setError(null)

      const data = await signInWithGoogle(supabase)

      // Redirect to the provider URL
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      console.error("Error signing in with Google:", err)
      setError(
        (err as Error).message ||
        "An unexpected error occurred. Please try again."
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background flex h-dvh w-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-foreground text-3xl font-medium tracking-tight sm:text-4xl">
              Welcome to Rōmy
            </h1>
            <motion.div
              className="mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" as const }}
            >
              <motion.p
                className="text-muted-foreground italic text-base leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                &ldquo;{endorsement.quote}&rdquo;
              </motion.p>
              <motion.p
                className="text-muted-foreground/70 mt-2 text-sm"
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                — {endorsement.author}, <span className="text-muted-foreground/60">{endorsement.title}</span>
              </motion.p>
            </motion.div>
          </div>
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}
          <div className="mt-8 space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.2, ease: "easeOut" as const }}
            >
              <Button
                variant="secondary"
                className="w-full text-base sm:text-base"
                size="lg"
                onClick={handleSignInWithGoogle}
                disabled={isLoading}
              >
                <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>
                  {isLoading ? "Connecting..." : "Sign-In with Google"}
                </span>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.2, ease: "easeOut" as const }}
            >
              <Button
                variant="secondary"
                className="w-full text-base sm:text-base"
                size="lg"
                onClick={() => router.push("/auth/email")}
              >
                <Envelope className="mr-2 size-4" weight="regular" />
                <span>Sign-In with Email</span>
              </Button>
            </motion.div>
          </div>
        </div>
      </main>

      <footer className="text-muted-foreground py-6 text-center text-sm">
        <p>
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            className="text-foreground underline hover:text-primary transition-colors cursor-pointer"
            target="_blank"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-foreground underline hover:text-primary transition-colors cursor-pointer"
            target="_blank"
          >
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  )
}
