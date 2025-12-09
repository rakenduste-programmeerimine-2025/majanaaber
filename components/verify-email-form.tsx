"use client"

import { cn } from "@/lib/utils"
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
import { resendVerificationEmail } from "@/app/actions/auth"

export function VerifyEmailForm({
  email,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { email: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRateLimited, setIsRateLimited] = useState(false)

  const handleResendEmail = async () => {
    setIsLoading(true)
    setError(null)
    setMessage(null)
    setIsRateLimited(false)

    const result = await resendVerificationEmail(email)

    if (result.success) {
      setMessage(
        result.remainingAttempts !== undefined && result.remainingAttempts > 0
          ? `Verification email sent! You have ${result.remainingAttempts} resend${result.remainingAttempts !== 1 ? "s" : ""} remaining.`
          : "Verification email sent! Please check your inbox."
      )
    } else {
      setError(result.error || "Failed to send verification email")
      if (result.rateLimited) {
        setIsRateLimited(true)
      }
    }

    setIsLoading(false)
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
              <div
                className={`p-3 rounded-md ${
                  isRateLimited
                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                    : "bg-destructive/10 border border-destructive/20"
                }`}
              >
                <p
                  className={`text-sm ${
                    isRateLimited
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-destructive"
                  }`}
                >
                  {error}
                </p>
              </div>
            )}

            <Button
              type="button"
              onClick={handleResendEmail}
              disabled={isLoading || isRateLimited}
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
