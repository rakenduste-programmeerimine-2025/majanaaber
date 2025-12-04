import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Conversation } from "@/lib/types/chat"

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const userIdRef = useRef<string>("")
  const channelRef = useRef<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const initConversations = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsLoading(false)
        return
      }

      userIdRef.current = user.id
      await loadConversations(user.id)

      const channel = supabase
        .channel(`user_conversations:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "peer_messages",
            filter: `sender_id=eq.${user.id}`,
          },
          () => {
            loadConversations(user.id)
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "peer_messages",
            filter: `receiver_id=eq.${user.id}`,
          },
          () => {
            loadConversations(user.id)
          },
        )
        .subscribe()

      channelRef.current = channel
    }

    initConversations()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  const loadConversations = async (userId: string) => {
    try {
      const { data: conversationsData, error } = await supabase
        .from("conversations")
        .select(`
          id,
          participant1_id,
          participant2_id,
          created_at,
          last_message_at
        `)
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order("last_message_at", { ascending: false })

      if (error) throw error

      const enrichedConversations = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const otherUserId = conv.participant1_id === userId
            ? conv.participant2_id
            : conv.participant1_id

          const { data: profile } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .eq("id", otherUserId)
            .single()

          const { data: lastMessage } = await supabase
            .from("peer_messages")
            .select("content, created_at, sender_id")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

          // Get all messages from other user in this conversation
          const { data: otherUserMessages } = await supabase
            .from("peer_messages")
            .select("id")
            .eq("conversation_id", conv.id)
            .eq("sender_id", otherUserId)

          const messageIds = (otherUserMessages || []).map((m: { id: string }) => m.id)

          let unreadCount = 0
          if (messageIds.length > 0) {
            // Count how many of these messages have been read by current user
            const { count: readCount } = await supabase
              .from("peer_message_read_receipts")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .in("message_id", messageIds)

            unreadCount = messageIds.length - (readCount || 0)
          }

          return {
            ...conv,
            other_participant: profile,
            last_message: lastMessage,
            unread_count: unreadCount || 0,
          } as Conversation
        })
      )

      setConversations(enrichedConversations)
    } catch (err) {
      console.error("Error loading conversations:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const getOrCreateConversation = async (otherUserId: string): Promise<string | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return null

      const { data, error } = await supabase
        .rpc("get_or_create_conversation", {
          user1_id: user.id,
          user2_id: otherUserId,
        })

      if (error) throw error

      await loadConversations(user.id)

      return data as string
    } catch (err) {
      console.error("Error getting or creating conversation:", err)
      return null
    }
  }

  return {
    conversations,
    isLoading,
    getOrCreateConversation,
    refreshConversations: () => loadConversations(userIdRef.current),
  }
}
