"use client"

import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { ArrowUpRight } from "@phosphor-icons/react"
import { motion } from "motion/react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

function ResetPasswordContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()

  const supabase = createClient()

  useEffect(() => {
    // Check if user has a valid session from the reset link
    const checkSession = async () => {
      if (!supabase) {
        setError("Authentication is not available in this deployment.")
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setError("Invalid or expired reset link. Please request a new one.")
      } else {
        setIsReady(true)
      }
    }

    checkSession()
  }, [supabase])

  if (!supabase) {
    return (
      <div className="bg-background flex h-dvh w-full flex-col items-center justify-center px-4">
        <p className="text-muted-foreground">
          Authentication is not available in this deployment.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!supabase) {
      setError("Authentication is not available.")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccess("Password updated successfully! Redirecting to sign in...")

      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        router.push("/auth")
      }, 2000)
    } catch (err: unknown) {
      console.error("Password reset error:", err)
      setError((err as Error).message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background flex h-dvh w-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <motion.div
          className="w-full max-w-lg space-y-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" as const }}
        >
          <div className="text-center">
            <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
              Set New Password
            </h1>
            <p className="text-muted-foreground mt-3">
              Enter your new password below
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm border border-destructive/20"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg p-4 text-sm border border-green-500/20"
            >
              {success}
            </motion.div>
          )}

          {isReady && !success && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="password" className="text-lg font-medium text-foreground">
                    New Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={isLoading}
                    minLength={6}
                    className="h-10 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 pb-2 text-lg text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>

                <div>
                  <Label htmlFor="confirm-password" className="text-lg font-medium text-foreground">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={isLoading}
                    minLength={6}
                    className="h-10 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 pb-2 text-lg text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="outline"
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-full border-foreground bg-foreground py-2 px-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                disabled={isLoading}
              >
                <span>{isLoading ? "Updating..." : "Update Password"}</span>
                {!isLoading && (
                  <div className="rounded-full bg-background/20 p-1.5 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                    <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                  </div>
                )}
              </Button>
            </form>
          )}

          {!isReady && !error && (
            <div className="text-center">
              <p className="text-muted-foreground">Verifying reset link...</p>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/auth"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors cursor-pointer"
            >
              Back to sign in
            </Link>
          </div>
        </motion.div>
      </main>

      <footer className="text-muted-foreground py-6 text-center text-sm">
        <p>
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            className="text-foreground underline hover:text-foreground/80 transition-colors cursor-pointer"
            target="_blank"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-foreground underline hover:text-foreground/80 transition-colors cursor-pointer"
            target="_blank"
          >
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-background flex h-dvh w-full flex-col items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
