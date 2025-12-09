import { useState, useCallback } from "react"

interface UseErrorHandlerReturn {
  error: string | null
  setError: (error: string | null) => void
  clearError: () => void
  handleError: (error: unknown, fallbackMessage?: string, shouldLog?: boolean) => void
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const handleError = useCallback((error: unknown, fallbackMessage = "An error occurred", shouldLog = true) => {
    // Only log to console if it's an actual Error object or if explicitly requested
    if (shouldLog && (error instanceof Error || (typeof error !== "string"))) {
      console.error("Error:", error)
    }
    
    let errorMessage: string
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === "string") {
      errorMessage = error
    } else {
      errorMessage = fallbackMessage
    }
    
    setError(errorMessage)
  }, [])

  return {
    error,
    setError,
    clearError,
    handleError,
  }
}