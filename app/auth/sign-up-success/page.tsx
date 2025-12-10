"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { resendVerificationEmail } from "@/app/actions/auth"
import { useTranslations } from "next-intl"

export default function Page() {
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const searchParams = useSearchParams()
  const email = searchParams.get("email")

  const handleResendEmail = async () => {
    if (!email) {
      setError(t("signup.emailNotFound"))
      return
    }

    setIsLoading(true)
    setError(null)
    setMessage(null)
    setIsRateLimited(false)

    const result = await resendVerificationEmail(email)

    if (result.success) {
      setMessage(
        result.remainingAttempts !== undefined && result.remainingAttempts > 0
          ? t("signup.verificationSentRemaining", {
              count: result.remainingAttempts,
            })
          : t("signup.verificationSent"),
      )
    } else {
      setError(result.error || t("signup.failedSend"))
      if (result.rateLimited) {
        setIsRateLimited(true)
      }
    }

    setIsLoading(false)
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("signup.thankYou")}</CardTitle>
              <CardDescription>{t("signup.checkEmail")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {t("signup.successMessage")}
                </p>

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

                {email && (
                  <Button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={isLoading || isRateLimited}
                    variant="outline"
                    className="w-full"
                  >
                    {isLoading ? t("signup.sending") : t("signup.resendButton")}
                  </Button>
                )}

                <div className="text-center text-sm">
                  <Link
                    href="/auth/login"
                    className="underline underline-offset-4"
                  >
                    {t("signup.backToLogin")}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
