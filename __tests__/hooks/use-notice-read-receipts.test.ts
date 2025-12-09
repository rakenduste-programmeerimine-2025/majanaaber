import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useNoticeReadReceipts } from "@/hooks/use-notice-read-receipts"

// Mock data
const mockReadReceipts = [
  {
    id: "receipt-1",
    notice_id: "notice-123",
    user_id: "user-1",
    read_at: "2024-01-15T10:00:00Z",
    reader: { first_name: "John", last_name: "Doe" },
  },
  {
    id: "receipt-2",
    notice_id: "notice-123",
    user_id: "user-2",
    read_at: "2024-01-15T09:00:00Z",
    reader: { first_name: "Jane", last_name: "Smith" },
  },
]

// Mock functions
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockUpsert = vi.fn()
const mockGetUser = vi.fn()
const mockChannel = vi.fn()
const mockOn = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => ({
      select: mockSelect,
      upsert: mockUpsert,
    }),
    channel: mockChannel,
  }),
}))

describe("useNoticeReadReceipts hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock chain
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder, single: vi.fn() })
    mockOrder.mockResolvedValue({ data: mockReadReceipts, error: null })
    mockUpsert.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: "current-user" } } })

    // Setup channel mock
    mockChannel.mockReturnValue({
      on: mockOn,
    })
    mockOn.mockReturnValue({
      subscribe: mockSubscribe,
    })
    mockSubscribe.mockReturnValue({
      unsubscribe: mockUnsubscribe,
    })
  })

  it("returns loading true initially", () => {
    const { result } = renderHook(() => useNoticeReadReceipts("notice-123"))
    expect(result.current.loading).toBe(true)
  })

  it("returns empty data when noticeId is null", async () => {
    const { result } = renderHook(() => useNoticeReadReceipts(null))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.readReceipts).toEqual([])
    expect(result.current.readCount).toBe(0)
  })

  it("fetches read receipts for a notice", async () => {
    const { result } = renderHook(() => useNoticeReadReceipts("notice-123"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.readReceipts).toEqual(mockReadReceipts)
    expect(result.current.readCount).toBe(2)
  })

  it("returns correct readCount", async () => {
    const { result } = renderHook(() => useNoticeReadReceipts("notice-123"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.readCount).toBe(mockReadReceipts.length)
  })

  it("provides markAsRead function", async () => {
    const { result } = renderHook(() => useNoticeReadReceipts("notice-123"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(typeof result.current.markAsRead).toBe("function")
  })

  it("calls markAsRead with correct parameters", async () => {
    const { result } = renderHook(() => useNoticeReadReceipts("notice-123"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.markAsRead("notice-456")
    })

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        notice_id: "notice-456",
        user_id: "current-user",
      },
      {
        onConflict: "notice_id,user_id",
      }
    )
  })

  it("does not call upsert when user is not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { result } = renderHook(() => useNoticeReadReceipts("notice-123"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.markAsRead("notice-456")
    })

    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("sets up real-time subscription", async () => {
    renderHook(() => useNoticeReadReceipts("notice-123"))

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith("notice-read-receipts:notice-123")
    })

    expect(mockOn).toHaveBeenCalled()
    expect(mockSubscribe).toHaveBeenCalled()
  })

  it("cleans up subscription on unmount", async () => {
    const { unmount } = renderHook(() => useNoticeReadReceipts("notice-123"))

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled()
    })

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it("handles fetch error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    })

    const { result } = renderHook(() => useNoticeReadReceipts("notice-123"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.readReceipts).toEqual([])
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
