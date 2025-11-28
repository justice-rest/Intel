"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { MODEL_DEFAULT } from "@/lib/config"
import { CaretLeft, ArrowUpRight } from "@phosphor-icons/react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"

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
        <div className="w-full max-w-lg space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={showResetPassword ? "reset" : isSignUp ? "signup" : "signin"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
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
                  {error}
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
                      className="h-14 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 text-lg text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>

                  {!showResetPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
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
                        className="h-14 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 text-lg text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </motion.div>
                  )}

                  {isSignUp && !showResetPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 }}
                    >
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
                        className="h-14 rounded-none border-b-2 border-l-0 border-r-0 border-t-0 border-border !bg-transparent px-0 text-lg text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </motion.div>
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
                      }}
                      className="text-muted-foreground hover:text-blue-600 text-sm transition-colors cursor-pointer"
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
                      className="text-muted-foreground hover:text-blue-600 text-sm transition-colors cursor-pointer"
                    >
                      {isSignUp
                        ? "Already have an account? Sign in"
                        : "Don't have an account? Sign up"}
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="text-muted-foreground py-6 text-center text-sm space-y-3">
        {!showResetPassword && !isSignUp && (
          <p>
            <button
              type="button"
              onClick={() => setShowResetPassword(true)}
              className="text-foreground hover:text-blue-600 transition-colors cursor-pointer underline"
            >
              Forgot password?
            </button>
          </p>
        )}
        <p>
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            className="text-foreground underline hover:text-blue-600 transition-colors cursor-pointer"
            target="_blank"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-foreground underline hover:text-blue-600 transition-colors cursor-pointer"
            target="_blank"
          >
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  )
}
