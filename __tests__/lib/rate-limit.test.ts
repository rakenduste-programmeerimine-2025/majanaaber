import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  checkLoginRateLimit,
  checkStrictRateLimit,
  blockIP,
  resetRateLimit,
  getClientIP,
  RATE_LIMITS,
  rateLimiter,
} from "@/lib/rate-limit"

describe("Rate Limiter", () => {
  beforeEach(async () => {
    // Reset rate limiter state between tests
    await resetRateLimit("test-ip")
    await resetRateLimit("strict:test-ip")
  })

  describe("checkLoginRateLimit", () => {
    it("allows requests within limit", async () => {
      const result = await checkLoginRateLimit("test-ip")
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(RATE_LIMITS.LOGIN.limit - 1)
    })

    it("blocks requests after exceeding limit", async () => {
      const ip = "test-ip-block"

      // Make requests up to the limit
      for (let i = 0; i < RATE_LIMITS.LOGIN.limit; i++) {
        await checkLoginRateLimit(ip)
      }

      // Next request should be blocked
      const result = await checkLoginRateLimit(ip)
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it("returns correct limit value", async () => {
      const result = await checkLoginRateLimit("test-ip")
      expect(result.limit).toBe(RATE_LIMITS.LOGIN.limit)
    })
  })

  describe("checkStrictRateLimit", () => {
    it("has stricter limits than normal login", async () => {
      const result = await checkStrictRateLimit("test-ip")
      expect(result.limit).toBe(RATE_LIMITS.LOGIN_STRICT.limit)
      expect(RATE_LIMITS.LOGIN_STRICT.limit).toBeLessThan(
        RATE_LIMITS.LOGIN.limit
      )
    })
  })

  describe("blockIP", () => {
    it("blocks an IP for specified duration", async () => {
      const ip = "blocked-ip"
      await blockIP(ip, 60000) // Block for 1 minute

      const result = await checkLoginRateLimit(ip)
      expect(result.success).toBe(false)
    })
  })

  describe("resetRateLimit", () => {
    it("resets rate limit for an IP", async () => {
      const ip = "reset-test-ip"

      // Use up some requests
      await checkLoginRateLimit(ip)
      await checkLoginRateLimit(ip)
      await checkLoginRateLimit(ip)

      // Reset
      await resetRateLimit(ip)

      // Should have full limit again
      const result = await checkLoginRateLimit(ip)
      expect(result.remaining).toBe(RATE_LIMITS.LOGIN.limit - 1)
    })
  })

  describe("getClientIP", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const headers = new Headers()
      headers.set("x-forwarded-for", "192.168.1.1, 10.0.0.1")
      expect(getClientIP(headers)).toBe("192.168.1.1")
    })

    it("extracts IP from x-real-ip header", () => {
      const headers = new Headers()
      headers.set("x-real-ip", "192.168.1.2")
      expect(getClientIP(headers)).toBe("192.168.1.2")
    })

    it("prefers x-forwarded-for over x-real-ip", () => {
      const headers = new Headers()
      headers.set("x-forwarded-for", "192.168.1.1")
      headers.set("x-real-ip", "192.168.1.2")
      expect(getClientIP(headers)).toBe("192.168.1.1")
    })

    it("returns 'unknown' when no IP headers present", () => {
      const headers = new Headers()
      expect(getClientIP(headers)).toBe("unknown")
    })

    it("trims whitespace from IP addresses", () => {
      const headers = new Headers()
      headers.set("x-forwarded-for", "  192.168.1.1  , 10.0.0.1")
      expect(getClientIP(headers)).toBe("192.168.1.1")
    })
  })

  describe("RATE_LIMITS constants", () => {
    it("has correct LOGIN limits", () => {
      expect(RATE_LIMITS.LOGIN.limit).toBe(10)
      expect(RATE_LIMITS.LOGIN.windowMs).toBe(15 * 60 * 1000)
    })

    it("has correct LOGIN_STRICT limits", () => {
      expect(RATE_LIMITS.LOGIN_STRICT.limit).toBe(5)
      expect(RATE_LIMITS.LOGIN_STRICT.windowMs).toBe(60 * 60 * 1000)
    })

    it("has correct SIGNUP limits", () => {
      expect(RATE_LIMITS.SIGNUP.limit).toBe(3)
      expect(RATE_LIMITS.SIGNUP.windowMs).toBe(60 * 60 * 1000)
    })

    it("has correct PASSWORD_RESET limits", () => {
      expect(RATE_LIMITS.PASSWORD_RESET.limit).toBe(3)
      expect(RATE_LIMITS.PASSWORD_RESET.windowMs).toBe(60 * 60 * 1000)
    })
  })
})
