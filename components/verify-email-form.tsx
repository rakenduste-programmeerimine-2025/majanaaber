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
import { useState } from "react"
import Link from "next/link"

export function VerifyEmailForm({
  email,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { email: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleResendEmail = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/protected`,
        },
      })

      if (error) throw error

      setMessage("Verification email sent! Please check your inbox.")
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
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            Please verify your email address to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <div className="text-sm text-muted-foreground">
              <p className="mb-4">We sent a verification email to:</p>
              <p className="font-medium text-foreground mb-4">{email}</p>
              <p>
                Please check your inbox and click the verification link to
                activate your account.
              </p>
            </div>

            {message && (
              <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  {message}
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="button"
              onClick={handleResendEmail}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? "Sending..." : "Resend verification email"}
            </Button>

            <div className="text-center text-sm">
              Already verified?{" "}
              <Link
                href="/auth/login"
                className="underline underline-offset-4"
              >
                Login
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
