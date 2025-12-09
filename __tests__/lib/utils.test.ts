import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn utility function", () => {
  it("merges class names correctly", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    const isActive = true
    const isDisabled = false
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe(
      "base active"
    )
  })

  it("merges Tailwind classes correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4")
  })

  it("handles arrays of classes", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz")
  })

  it("handles undefined and null values", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar")
  })

  it("handles empty strings", () => {
    expect(cn("foo", "", "bar")).toBe("foo bar")
  })

  it("handles conflicting Tailwind classes by using last one", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("handles responsive Tailwind classes", () => {
    expect(cn("w-full", "md:w-1/2", "lg:w-1/3")).toBe("w-full md:w-1/2 lg:w-1/3")
  })
})
