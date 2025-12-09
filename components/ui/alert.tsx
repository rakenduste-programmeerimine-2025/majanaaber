import React from "react"
import { cn } from "@/lib/utils"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "warning" | "success"
  children: React.ReactNode
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full rounded-lg border p-4 gap-3 items-start",
          {
            "border-border bg-background text-foreground":
              variant === "default",
            "border-red-200 bg-red-50 text-red-900 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-200":
              variant === "destructive",
            "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800/50 dark:bg-yellow-950/50 dark:text-yellow-200":
              variant === "warning",
            "border-green-200 bg-green-50 text-green-900 dark:border-green-800/50 dark:bg-green-950/50 dark:text-green-200":
              variant === "success",
          },
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed flex-1", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }
