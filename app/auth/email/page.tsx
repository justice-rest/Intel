"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { MODEL_DEFAULT, APP_DOMAIN } from "@/lib/config"
import { CaretLeft, ArrowUpRight, EnvelopeSimple } from "@phosphor-icons/react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"

/**
 * Gets the correct base URL for auth redirects.
 * Uses APP_DOMAIN in production to ensure consistency with Supabase's configured redirect URLs.
 * Falls back to window.location.origin for local development.
 */
function getAuthRedirectUrl(): string {
  const isDev = process.env.NODE_ENV === "development"

  if (isDev) {
    // In development, use current origin (localhost)
    return typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  }

  // In production, ALWAYS use APP_DOMAIN to match Supabase redirect URL configuration
  // This prevents issues with preview deployments, www vs non-www, etc.
  return APP_DOMAIN
}

export default function EmailAuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)
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
          redirectTo: `${getAuthRedirectUrl()}/auth/reset-password`,
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
            emailRedirectTo: `${getAuthRedirectUrl()}/auth/callback`,
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

        if (error) {
          // Detect email-not-confirmed errors from Supabase and show a helpful message
          const msg = error.message?.toLowerCase() ?? ""
          if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
            setNeedsEmailConfirmation(true)
            throw new Error(
              "Your email address has not been confirmed yet. Please check your inbox (and spam folder) for the confirmation link, or click the button below to resend it."
            )
          }
          throw error
        }

        const user = data.user

        if (!user || !user.email) {
          throw new Error("Failed to get user data")
        }

        // Check if user record exists in database
        const { error: userError } = await supabase
          .from("users")
          .select("id")
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
            welcome_completed: false,
          })

          if (insertError && insertError.code !== "23505") {
            console.error("Error creating user record:", insertError)
          }
        }

        // Full page reload to ensure the server-side layout re-renders
        // and getUserProfile() picks up the newly authenticated session.
        // Using router.push("/") would only do a client-side navigation,
        // leaving the UserProvider initialized with null (stale state).
        window.location.href = "/"
      }
    } catch (err: unknown) {
      console.error("Auth error:", err)
      setError((err as Error).message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendConfirmation() {
    if (!supabase || !email) return

    setIsResendingConfirmation(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${getAuthRedirectUrl()}/auth/callback`,
        },
      })

      if (error) throw error

      setSuccess(
        "Confirmation email resent! Please check your inbox (and spam folder) and click the link to verify your account."
      )
      setNeedsEmailConfirmation(false)
    } catch (err: unknown) {
      console.error("Resend confirmation error:", err)
      setError(
        (err as Error).message || "Failed to resend confirmation email. Please try again later."
      )
    } finally {
      setIsResendingConfirmation(false)
    }
  }

  return (
    <div className="bg-background flex h-dvh w-full flex-col">
      {/* Back Button */}
      <button
        onClick={() => router.push("/auth")}
        className="fixed left-4 top-4 z-50 flex items-center gap-2 text-muted-foreground/70 transition-colors hover:text-foreground sm:left-8 sm:top-8"
      >
        <CaretLeft className="size-5" weight="bold" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-lg space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={showResetPassword ? "reset" : isSignUp ? "signup" : "signin"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" as const }}
            >
              <div className="text-center mb-8">
                <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
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
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm mb-6 border border-destructive/20"
                >
                  <p>{error}</p>
                  {needsEmailConfirmation && (
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={isResendingConfirmation}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                    >
                      <EnvelopeSimple className="size-4" weight="bold" />
                      {isResendingConfirmation ? "Sending..." : "Resend confirmation email"}
                    </button>
                  )}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg p-4 text-sm mb-6 border border-green-500/20"
                >
                  {success}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="email" className="text-lg font-medium text-foreground">
                      Email
                    </Label>
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
                      className="h-10 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 pb-2 text-lg text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>

                  {!showResetPassword && (
                    <div>
                      <Label htmlFor="password" className="text-lg font-medium text-foreground">
                        Password
                      </Label>
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
                        className="h-10 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 pb-2 text-lg text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  )}

                  {isSignUp && !showResetPassword && (
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
                        placeholder="Confirm your password"
                        disabled={isLoading}
                        minLength={6}
                        className="h-10 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 pb-2 text-lg text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-full border-foreground bg-foreground py-2 px-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                  disabled={isLoading}
                >
                  <span>
                    {isLoading
                      ? "Loading..."
                      : showResetPassword
                        ? "Send Reset Link"
                        : isSignUp
                          ? "Sign Up"
                          : "Sign In"}
                  </span>
                  {!isLoading && (
                    <div className="rounded-full bg-background/20 p-1.5 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                      <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                    </div>
                  )}
                </Button>

                {showResetPassword ? (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetPassword(false)
                        setError(null)
                        setSuccess(null)
                        setNeedsEmailConfirmation(false)
                      }}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors cursor-pointer"
                    >
                      Back to sign in
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp)
                        setError(null)
                        setSuccess(null)
                        setNeedsEmailConfirmation(false)
                      }}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors cursor-pointer"
                    >
                      {isSignUp
                        ? "Already have an account? Sign in"
                        : "Don't have an account? Sign up"}
                    </button>
                    {!isSignUp && (
                      <p>
                        <button
                          type="button"
                          onClick={() => setShowResetPassword(true)}
                          className="text-muted-foreground hover:text-foreground text-sm transition-colors cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </form>
            </motion.div>
          </AnimatePresence>
        </div>
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
