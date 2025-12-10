"use client"

import { useRouter } from "next/navigation"

export function BackButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="text-sm px-3 py-1 border rounded hover:bg-muted"
    >
      ← Back
    </button>
  )
}
