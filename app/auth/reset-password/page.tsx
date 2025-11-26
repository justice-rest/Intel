"use client"

import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
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
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-foreground text-3xl font-medium tracking-tight sm:text-4xl">
              Set New Password
            </h1>
            <p className="text-muted-foreground mt-3">
              Enter your new password below
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 text-green-600 dark:text-green-400 rounded-md p-3 text-sm">
              {success}
            </div>
          )}

          {isReady && !success && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
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
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full text-base sm:text-base"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Password"}
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
