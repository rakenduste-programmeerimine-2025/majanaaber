"use client"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  incrementFailedAttempts,
  resetFailedAttempts,
  formatLockoutTime,
} from "@/lib/login-attempts"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLockoutError, setIsLockoutError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setIsLockoutError(false)

    try {
      const { data: userId } = await supabase.rpc("get_user_id_by_email", {
        user_email: email,
      })

      if (userId) {
        const { data: profileData } = await supabase.rpc(
          "get_profile_login_info",
          { user_id: userId },
        )

        const profile =
          profileData && profileData.length > 0 ? profileData[0] : null

        if (profile) {
          const lockedUntil = profile.locked_until
            ? new Date(profile.locked_until)
            : null
          const now = new Date()

          if (lockedUntil && lockedUntil > now) {
            const minutesRemaining = Math.ceil(
              (lockedUntil.getTime() - now.getTime()) / (1000 * 60),
            )
            setIsLockoutError(true)
            throw new Error(
              `Account is temporarily locked. Please try again in ${formatLockoutTime(minutesRemaining)}.`,
            )
          }
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        if (userId) {
          const { data: profileData } = await supabase.rpc(
            "get_profile_login_info",
            { user_id: userId },
          )

          const profile =
            profileData && profileData.length > 0 ? profileData[0] : null

          if (profile) {
            const newAttemptCount = await incrementFailedAttempts(
              supabase,
              profile.id,
            )
            const remainingAttempts = Math.max(0, 5 - newAttemptCount)

            if (remainingAttempts > 0) {
              throw new Error(
                `Invalid email or password. You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining before your account is locked.`,
              )
            } else {
              setIsLockoutError(true)
              throw new Error(
                "Account locked due to too many failed login attempts. Please try again in 15 minutes.",
              )
            }
          }
        }

        throw error
      }

      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut()
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
        return
      }

      if (data.user) {
        await resetFailedAttempts(supabase, data.user.id)

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single()

        if (profile?.role === "building_owner") {
          router.push("/protected")
        } else {
          router.push("/protected")
        }
      } else {
        router.push("/protected")
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <div
                  className={`p-3 rounded-md text-sm ${
                    isLockoutError
                      ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                      : "text-red-500"
                  }`}
                >
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
