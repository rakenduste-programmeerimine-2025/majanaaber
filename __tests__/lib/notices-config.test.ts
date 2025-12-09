import { describe, it, expect } from "vitest"
import {
  formatFileSize,
  MAX_FILES_PER_NOTICE,
  priorityConfig,
  categoryConfig,
} from "@/components/notices/config"

describe("formatFileSize", () => {
  it("returns '0 B' for 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B")
  })

  it("formats bytes correctly", () => {
    expect(formatFileSize(500)).toBe("500 B")
    expect(formatFileSize(1)).toBe("1 B")
  })

  it("formats kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1 KB")
    expect(formatFileSize(1536)).toBe("1.5 KB")
    expect(formatFileSize(2048)).toBe("2 KB")
  })

  it("formats megabytes correctly", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1 MB")
    expect(formatFileSize(1024 * 1024 * 5)).toBe("5 MB")
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB")
  })

  it("formats gigabytes correctly", () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB")
    expect(formatFileSize(1024 * 1024 * 1024 * 2)).toBe("2 GB")
  })

  it("rounds to one decimal place", () => {
    expect(formatFileSize(1500)).toBe("1.5 KB")
    expect(formatFileSize(1234567)).toBe("1.2 MB")
  })
})

describe("MAX_FILES_PER_NOTICE", () => {
  it("is set to 5", () => {
    expect(MAX_FILES_PER_NOTICE).toBe(5)
  })
})

describe("priorityConfig", () => {
  it("has urgent priority config", () => {
    expect(priorityConfig.urgent).toBeDefined()
    expect(priorityConfig.urgent.label).toBe("Urgent")
    expect(priorityConfig.urgent.badgeVariant).toBe("destructive")
  })

  it("has normal priority config", () => {
    expect(priorityConfig.normal).toBeDefined()
    expect(priorityConfig.normal.label).toBe("Normal")
    expect(priorityConfig.normal.badgeVariant).toBe("default")
  })

  it("has low priority config", () => {
    expect(priorityConfig.low).toBeDefined()
    expect(priorityConfig.low.label).toBe("Low")
    expect(priorityConfig.low.badgeVariant).toBe("secondary")
  })

  it("has all required properties for each priority", () => {
    const priorities = ["urgent", "normal", "low"] as const
    priorities.forEach((priority) => {
      expect(priorityConfig[priority]).toHaveProperty("label")
      expect(priorityConfig[priority]).toHaveProperty("color")
      expect(priorityConfig[priority]).toHaveProperty("badgeVariant")
    })
  })
})

describe("categoryConfig", () => {
  const categories = [
    "general",
    "maintenance",
    "meeting",
    "payment",
    "safety",
    "event",
  ] as const

  it("has all expected categories", () => {
    categories.forEach((category) => {
      expect(categoryConfig[category]).toBeDefined()
    })
  })

  it("has correct labels for each category", () => {
    expect(categoryConfig.general.label).toBe("General")
    expect(categoryConfig.maintenance.label).toBe("Maintenance")
    expect(categoryConfig.meeting.label).toBe("Meeting")
    expect(categoryConfig.payment.label).toBe("Payment")
    expect(categoryConfig.safety.label).toBe("Safety")
    expect(categoryConfig.event.label).toBe("Event")
  })

  it("has all required properties for each category", () => {
    categories.forEach((category) => {
      expect(categoryConfig[category]).toHaveProperty("label")
      expect(categoryConfig[category]).toHaveProperty("icon")
      expect(categoryConfig[category]).toHaveProperty("color")
    })
  })

  it("has icon components for each category", () => {
    categories.forEach((category) => {
      // Lucide icons are React forwardRef components (objects with $$typeof)
      expect(categoryConfig[category].icon).toBeDefined()
      expect(categoryConfig[category].icon).not.toBeNull()
    })
  })
})
