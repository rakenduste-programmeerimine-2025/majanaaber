import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useUserRole } from "@/hooks/use-user-role"

// Mock Supabase client
const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: mockSelect,
    }),
  }),
}))

describe("useUserRole hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ single: mockSingle })
  })

  it("returns loading true initially", () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { result } = renderHook(() => useUserRole())

    expect(result.current.loading).toBe(true)
  })

  it("returns null role when no user is logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBe(null)
    expect(result.current.isOwner).toBe(false)
  })

  it("returns building_manager role correctly", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    })
    mockSingle.mockResolvedValue({
      data: { role: "building_manager" },
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBe("building_manager")
    expect(result.current.isOwner).toBe(true)
  })

  it("returns apartment_owner role correctly", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    })
    mockSingle.mockResolvedValue({
      data: { role: "apartment_owner" },
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBe("apartment_owner")
    expect(result.current.isOwner).toBe(false)
  })

  it("returns resident role correctly", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    })
    mockSingle.mockResolvedValue({
      data: { role: "resident" },
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBe("resident")
    expect(result.current.isOwner).toBe(false)
  })

  it("returns null role when profile has no role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    })
    mockSingle.mockResolvedValue({
      data: { role: null },
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBe(null)
    expect(result.current.isOwner).toBe(false)
  })

  it("queries the correct user profile", async () => {
    const userId = "test-user-id-456"
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
    })
    mockSingle.mockResolvedValue({
      data: { role: "resident" },
    })

    renderHook(() => useUserRole())

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith("id", userId)
    })
  })
})
