"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@/lib/user-store/provider"
import { useChats } from "@/lib/chat-store/chats/provider"
import { Lock, Spinner, Check, Warning, SignIn, Users } from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"

type AcceptState = "loading" | "password_required" | "accepting" | "success" | "error"

export default function ShareAcceptPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const { user, isLoading: userLoading } = useUser()
  const { refresh: refreshChats } = useChats()

  const [state, setState] = useState<AcceptState>("loading")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [chatTitle, setChatTitle] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  // Try to accept without password first
  useEffect(() => {
    if (userLoading) return
    if (!user) {
      // User not logged in, show sign in prompt
      setState("error")
      setError("Sign in to join this conversation")
      return
    }

    attemptAccept()
  }, [user, userLoading, token])

  const attemptAccept = async (pwd?: string) => {
    setState(pwd ? "accepting" : "loading")
    setError(null)

    try {
      const res = await fetch("/api/collaborate/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: pwd,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setState("success")
        setRole(data.role)

        // Refresh chats immediately to include the new shared chat
        await refreshChats()

        // Redirect after brief delay to show success state
        setTimeout(() => {
          router.push(data.redirect_url)
        }, 1200)
      } else if (res.status === 403 && data.requires_password) {
        setState("password_required")
      } else if (res.status === 401) {
        setState("error")
        setError("Sign in to join this conversation")
      } else {
        setState("error")
        setError(data.error || "This link may have expired or been revoked")
      }
    } catch {
      setState("error")
      setError("Connection error. Please try again.")
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    attemptAccept(password.trim())
  }

  const handleSignIn = () => {
    const returnUrl = encodeURIComponent(`/collaborate/${token}`)
    router.push(`/auth?returnTo=${returnUrl}`)
  }

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case "editor": return "You can edit"
      case "viewer": return "View-only access"
      default: return "Access granted"
    }
  }

  return (
    <div className="bg-background flex h-dvh w-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md space-y-8">
          {/* Loading state */}
          <AnimatePresence mode="wait">
            {state === "loading" && (
              <motion.div
                key="loading"
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted">
                  <Spinner className="size-8 animate-spin text-muted-foreground" />
                </div>
                <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
                  Joining conversation...
                </h1>
                <p className="text-muted-foreground mt-2">
                  Please wait while we verify your access
                </p>
              </motion.div>
            )}

            {/* Password required state */}
            {state === "password_required" && (
              <motion.div
                key="password"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center">
                  <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted">
                    <Lock className="size-8 text-muted-foreground" />
                  </div>
                  <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
                    Password Required
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    This conversation is password protected
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="mt-8 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="sr-only">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      autoFocus
                      className="h-12 text-base"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-base"
                    disabled={!password.trim()}
                  >
                    Continue
                  </Button>
                </form>
              </motion.div>
            )}

            {/* Accepting state */}
            {state === "accepting" && (
              <motion.div
                key="accepting"
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted">
                  <Spinner className="size-8 animate-spin text-muted-foreground" />
                </div>
                <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
                  Verifying...
                </h1>
              </motion.div>
            )}

            {/* Success state */}
            {state === "success" && (
              <motion.div
                key="success"
                className="text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Check className="size-8 text-green-600 dark:text-green-400" weight="bold" />
                </motion.div>
                <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
                  You&apos;re in!
                </h1>
                <p className="text-muted-foreground mt-2">
                  {getRoleLabel(role)}
                </p>
                <p className="text-muted-foreground/60 mt-4 text-sm">
                  Redirecting to conversation...
                </p>
              </motion.div>
            )}

            {/* Error state */}
            {state === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center">
                  <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10">
                    <Warning className="size-8 text-destructive" />
                  </div>
                  <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
                    {error?.includes("Sign in") ? "Sign in required" : "Unable to join"}
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    {error}
                  </p>
                </div>

                <div className="mt-8 space-y-3">
                  {error?.includes("Sign in") ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Button
                        variant="secondary"
                        className="w-full h-12 text-base"
                        onClick={handleSignIn}
                      >
                        <SignIn className="mr-2 size-5" />
                        Sign in to continue
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Button
                        variant="secondary"
                        className="w-full h-12 text-base"
                        onClick={() => router.push("/")}
                      >
                        Go home
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="text-muted-foreground py-6 text-center text-sm">
        <p>
          Powered by{" "}
          <Link
            href="/"
            className="text-foreground hover:text-primary transition-colors"
          >
            Rōmy
          </Link>
        </p>
      </footer>
    </div>
  )
}
