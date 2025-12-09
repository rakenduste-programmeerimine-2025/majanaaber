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
import { useRouter } from "next/navigation"
import { useState } from "react"
import { PasswordStrengthInput } from "@/components/password-strength-input"
import { checkPasswordStrength } from "@/lib/password-strength"
import { ErrorDisplay } from "@/components/ui/error-display"
import { useErrorHandler } from "@/hooks/use-error-handler"

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("")
  const { error, handleError, clearError } = useErrorHandler()
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    clearError()

    try {
      const { score } = checkPasswordStrength(password)
      if (score < 4) {
        handleError("Password must meet all requirements.", undefined, false)
        setIsLoading(false)
        return
      }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/protected")
    } catch (error: unknown) {
      handleError(error, "An error occurred")
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
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>
            Please enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              <PasswordStrengthInput
                id="password"
                label="New password"
                value={password}
                onChange={setPassword}
                placeholder="Enter new password"
                required
                showRequirements
              />
              <ErrorDisplay error={error} onClear={clearError} />
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save new password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
