"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface ReadReceipt {
  id: string
  notice_id: string
  user_id: string
  read_at: string
  reader?: {
    first_name: string
    last_name: string
  }
}

export function useNoticeReadReceipts(noticeId: string | null) {
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!noticeId) {
      setLoading(false)
      return
    }

    const fetchReadReceipts = async () => {
      const { data, error } = await supabase
        .from("notice_read_receipts")
        .select(
          `
          id,
          notice_id,
          user_id,
          read_at,
          reader:profiles!user_id(first_name, last_name)
        `,
        )
        .eq("notice_id", noticeId)
        .order("read_at", { ascending: false })

      if (error) {
        console.error("Error fetching read receipts:", error)
      } else {
        setReadReceipts(data || [])
      }
      setLoading(false)
    }

    fetchReadReceipts()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`notice-read-receipts:${noticeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notice_read_receipts",
          filter: `notice_id=eq.${noticeId}`,
        },
        async payload => {
          // Fetch the full record with profile data
          const { data } = await supabase
            .from("notice_read_receipts")
            .select(
              `
              id,
              notice_id,
              user_id,
              read_at,
              reader:profiles!user_id(first_name, last_name)
            `,
            )
            .eq("id", payload.new.id)
            .single()

          if (data) {
            setReadReceipts(prev => [data, ...prev])
          }
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [noticeId])

  const markAsRead = async (noticeId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Use upsert to avoid duplicate key errors
    const { error } = await supabase.from("notice_read_receipts").upsert(
      {
        notice_id: noticeId,
        user_id: user.id,
      },
      {
        onConflict: "notice_id,user_id",
      },
    )

    if (error) {
      console.error("Error marking notice as read:", error)
    }
  }

  return {
    readReceipts,
    loading,
    markAsRead,
    readCount: readReceipts.length,
  }
}
