"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Lock, Spinner, Check, Warning, SignIn } from "@phosphor-icons/react"
import { useUser } from "@/lib/user-store/provider"

type AcceptState = "loading" | "password_required" | "accepting" | "success" | "error"

export default function ShareAcceptPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const { user, isLoading: userLoading } = useUser()

  const [state, setState] = useState<AcceptState>("loading")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  // Try to accept without password first
  useEffect(() => {
    if (userLoading) return
    if (!user) {
      // User not logged in, show sign in prompt
      setState("error")
      setError("Please sign in to join this conversation")
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
        setRedirectUrl(data.redirect_url)
        // Redirect after brief delay
        setTimeout(() => {
          router.push(data.redirect_url)
        }, 1500)
      } else if (res.status === 403 && data.requires_password) {
        setState("password_required")
      } else if (res.status === 401) {
        setState("error")
        setError("Please sign in to join this conversation")
      } else {
        setState("error")
        setError(data.error || "Failed to join conversation")
      }
    } catch {
      setState("error")
      setError("Network error. Please try again.")
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    attemptAccept(password.trim())
  }

  const handleSignIn = () => {
    // Redirect to sign in with return URL
    const returnUrl = encodeURIComponent(`/collaborate/${token}`)
    router.push(`/auth?returnTo=${returnUrl}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 size-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Users size={24} className="text-primary" />
          </div>
          <CardTitle>Join Conversation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to collaborate on a conversation
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Loading state */}
          {state === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Spinner className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Joining conversation...</p>
            </div>
          )}

          {/* Password required state */}
          {state === "password_required" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <Lock size={16} className="text-muted-foreground shrink-0" />
                <span>This link is password protected</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Enter password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <Warning size={16} />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!password.trim()}>
                Join Conversation
              </Button>
            </form>
          )}

          {/* Accepting state */}
          {state === "accepting" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Spinner className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying...</p>
            </div>
          )}

          {/* Success state */}
          {state === "success" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-medium">You&apos;re in!</p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to conversation...
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {state === "error" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Warning size={24} className="text-destructive" />
                </div>
                <p className="text-sm text-center text-muted-foreground">{error}</p>
              </div>

              {error?.includes("sign in") ? (
                <Button onClick={handleSignIn} className="w-full gap-2">
                  <SignIn size={16} />
                  Sign In to Continue
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push("/")}
                >
                  Go Home
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
