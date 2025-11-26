"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { MODEL_DEFAULT } from "@/lib/config"
import { CaretLeft } from "@phosphor-icons/react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function EmailAuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const router = useRouter()

  const supabase = createClient()

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

    try {
      if (showResetPassword) {
        // Handle password reset
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })

        if (error) throw error

        setSuccess(
          "Password reset link has been sent to your email. Please check your inbox."
        )
        setEmail("")
      } else if (isSignUp) {
        // Handle sign up
        // Validate password confirmation
        if (password !== confirmPassword) {
          setError("Passwords do not match")
          setIsLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error

        if (data?.user?.identities?.length === 0) {
          throw new Error("This email is already registered. Please sign in.")
        }

        setSuccess(
          "Account created successfully! Please check your email to verify your account."
        )
        setEmail("")
        setPassword("")
        setConfirmPassword("")
      } else {
        // Handle sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        const user = data.user

        if (!user || !user.email) {
          throw new Error("Failed to get user data")
        }

        // Check if user record exists in database
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single()

        // If user doesn't exist in database, create them
        if (userError && userError.code === "PGRST116") {
          // User not found, create them
          const userEmail = user.email // TypeScript type narrowing
          const { error: insertError } = await supabase.from("users").insert({
            id: user.id,
            email: userEmail,
            created_at: new Date().toISOString(),
            message_count: 0,
            premium: false,
            favorite_models: [MODEL_DEFAULT],
            onboarding_completed: false,
          })

          if (insertError && insertError.code !== "23505") {
            console.error("Error creating user record:", insertError)
          }

          // New user needs onboarding
          router.push("/onboarding")
        } else {
          // Existing user, check if they need onboarding
          const needsOnboarding = !userData?.onboarding_completed
          router.push(needsOnboarding ? "/onboarding" : "/")
        }
      }
    } catch (err: unknown) {
      console.error("Auth error:", err)
      setError((err as Error).message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background flex h-dvh w-full flex-col">
      {/* Back Button */}
      <button
        onClick={() => router.push("/auth")}
        className="fixed left-4 top-4 z-50 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 sm:left-8 sm:top-8"
      >
        <CaretLeft className="size-5" weight="bold" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-foreground text-3xl font-medium tracking-tight sm:text-4xl">
              {showResetPassword
                ? "Reset Password"
                : isSignUp
                  ? "Create Account"
                  : "Welcome Back"}
            </h1>
            <p className="text-muted-foreground mt-3">
              {showResetPassword
                ? "Enter your email to receive a reset link"
                : isSignUp
                  ? "Sign up to get started with Rōmy"
                  : "Sign in to continue your journey"}
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

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>

              {!showResetPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
              )}

              {isSignUp && !showResetPassword && (
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
                    placeholder="Confirm your password"
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full text-base sm:text-base"
              size="lg"
              disabled={isLoading}
            >
              {isLoading
                ? "Loading..."
                : showResetPassword
                  ? "Send Reset Link"
                  : isSignUp
                    ? "Sign Up"
                    : "Sign In"}
            </Button>

            {showResetPassword ? (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(false)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors cursor-pointer"
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            )}
          </form>
        </div>
      </main>

      <footer className="text-muted-foreground py-6 text-center text-sm space-y-3">
        {!showResetPassword && !isSignUp && (
          <p>
            <button
              type="button"
              onClick={() => setShowResetPassword(true)}
              className="text-foreground hover:text-primary transition-colors cursor-pointer underline"
            >
              Forgot password?
            </button>
          </p>
        )}
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
