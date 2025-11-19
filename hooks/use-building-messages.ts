import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Message } from "@/lib/types/chat"

const MAX_MESSAGE_LENGTH = 1000

interface TypingUser {
  userId: string
  userName: string
}

export function useBuildingMessages(buildingId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isSending, setIsSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<any>(null)
  const userNameRef = useRef<string>("")
  const userIdRef = useRef<string>("")
  const supabase = createClient()

  useEffect(() => {
    if (!buildingId) return

    loadMessages(buildingId)

    const initChannel = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        userIdRef.current = user.id
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single()

        if (profile) {
          userNameRef.current = `${profile.first_name} ${profile.last_name}`
        }
      }

      const channel = supabase
        .channel(`building_messages:${buildingId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "building_messages",
            filter: `building_id=eq.${buildingId}`,
          },
          async payload => {
            const { data } = await supabase
              .from("building_messages")
              .select(
                `
              id,
              content,
              created_at,
              sender_id,
              sender:profiles(first_name, last_name),
              reactions:message_reactions(id, user_id, emoji, created_at),
              read_receipts:message_read_receipts(id, user_id, read_at)
            `,
              )
              .eq("id", payload.new.id)
              .single()

            if (data) {
              setMessages(prev => [...prev, data as unknown as Message])
            }
          },
        )
        .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
          const { messageId } = payload
          setMessages(prev => prev.filter(msg => msg.id !== messageId))
        })
        .on("broadcast", { event: "reaction_added" }, ({ payload }) => {
          const { messageId, reaction } = payload
          setMessages(prev =>
            prev.map(msg =>
              msg.id === messageId
                ? {
                    ...msg,
                    reactions: [...(msg.reactions || []), reaction],
                  }
                : msg,
            ),
          )
        })
        .on("broadcast", { event: "reaction_removed" }, ({ payload }) => {
          const { messageId, reactionId } = payload
          setMessages(prev =>
            prev.map(msg =>
              msg.id === messageId
                ? {
                    ...msg,
                    reactions: (msg.reactions || []).filter(
                      r => r.id !== reactionId,
                    ),
                  }
                : msg,
            ),
          )
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const { userId, userName, isTyping } = payload

          if (isTyping) {
            setTypingUsers(prev => {
              if (prev.find(u => u.userId === userId)) return prev
              return [...prev, { userId, userName }]
            })
          } else {
            setTypingUsers(prev => prev.filter(u => u.userId !== userId))
          }
        })
        .on("broadcast", { event: "read_receipt_added" }, ({ payload }) => {
          const { messageId, readReceipt } = payload
          setMessages(prev =>
            prev.map(msg =>
              msg.id === messageId
                ? {
                    ...msg,
                    read_receipts: [...(msg.read_receipts || []), readReceipt],
                  }
                : msg,
            ),
          )
        })
        .subscribe()

      channelRef.current = channel
    }

    initChannel()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [buildingId])

  const loadMessages = async (buildingId: string) => {
    const { data, error } = await supabase
      .from("building_messages")
      .select(
        `
        id,
        content,
        created_at,
        sender_id,
        sender:profiles(first_name, last_name),
        reactions:message_reactions(id, user_id, emoji, created_at),
        read_receipts:message_read_receipts(id, user_id, read_at)
      `,
      )
      .eq("building_id", buildingId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error loading messages:", error)
      return
    }

    setMessages((data || []) as unknown as Message[])
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || !buildingId || content.length > MAX_MESSAGE_LENGTH)
      return

    handleTypingStop()
    setIsSending(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from("building_messages").insert({
        building_id: buildingId,
        sender_id: user.id,
        content: content.trim(),
      })

      if (error) throw error
    } catch (err: any) {
      console.error("Error sending message:", err)
      alert("Failed to send message: " + err.message)
    } finally {
      setIsSending(false)
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("building_messages")
        .delete()
        .eq("id", messageId)

      if (error) throw error

      setMessages(prev => prev.filter(msg => msg.id !== messageId))

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "message_deleted",
          payload: { messageId },
        })
      }
    } catch (err: any) {
      console.error("Error deleting message:", err)
      alert("Failed to delete message: " + err.message)
    }
  }

  const broadcastTyping = async (isTyping: boolean) => {
    if (!channelRef.current || !userIdRef.current) return

    try {
      await channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: userIdRef.current,
          userName: userNameRef.current,
          isTyping,
        },
      })
    } catch (err) {
      console.error("Error broadcasting typing:", err)
    }
  }

  const handleTypingStart = () => {
    broadcastTyping(true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false)
    }, 3000)
  }

  const handleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    broadcastTyping(false)
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!userIdRef.current) return

    try {
      const { data, error } = await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: userIdRef.current,
          emoji,
        })
        .select()
        .single()

      if (error) throw error

      if (data && channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "reaction_added",
          payload: { messageId, reaction: data },
        })

        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  reactions: [...(msg.reactions || []), data],
                }
              : msg,
          ),
        )
      }
    } catch (err: any) {
      console.error("Error adding reaction:", err)
      if (!err.message.includes("duplicate")) {
        alert("Failed to add reaction: " + err.message)
      }
    }
  }

  const removeReaction = async (messageId: string, reactionId: string) => {
    try {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("id", reactionId)

      if (error) throw error

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "reaction_removed",
          payload: { messageId, reactionId },
        })
      }

      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? {
                ...msg,
                reactions: (msg.reactions || []).filter(r => r.id !== reactionId),
              }
            : msg,
        ),
      )
    } catch (err: any) {
      console.error("Error removing reaction:", err)
      alert("Failed to remove reaction: " + err.message)
    }
  }

  const markMessageAsRead = async (messageId: string) => {
    if (!userIdRef.current) return

    const message = messages.find(m => m.id === messageId)
    if (!message) return

    const alreadyRead = message.read_receipts?.some(
      r => r.user_id === userIdRef.current,
    )
    if (alreadyRead) return

    if (message.sender_id === userIdRef.current) return

    try {
      const { data, error } = await supabase
        .from("message_read_receipts")
        .insert({
          message_id: messageId,
          user_id: userIdRef.current,
        })
        .select()
        .single()

      if (error) throw error

      if (data && channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "read_receipt_added",
          payload: { messageId, readReceipt: data },
        })

        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  read_receipts: [...(msg.read_receipts || []), data],
                }
              : msg,
          ),
        )
      }
    } catch (err: any) {
      console.error("Error marking message as read:", err)
      if (!err.message.includes("duplicate")) {
        console.error("Failed to mark message as read: " + err.message)
      }
    }
  }

  return {
    messages,
    sendMessage,
    deleteMessage,
    isSending,
    typingUsers,
    handleTypingStart,
    handleTypingStop,
    addReaction,
    removeReaction,
    markMessageAsRead,
  }
}
