import React from "react"
import { AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface ErrorDisplayProps {
  error: string | null
  onClear?: () => void
  className?: string
}

export function ErrorDisplay({ error, onClear, className }: ErrorDisplayProps) {
  if (!error) return null

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4 mt-0.5" />
      <AlertDescription>
        {error}
      </AlertDescription>
      {onClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/20 shrink-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear error</span>
        </Button>
      )}
    </Alert>
  )
}