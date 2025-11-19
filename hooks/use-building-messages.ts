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
              sender:profiles(first_name, last_name)
            `,
              )
              .eq("id", payload.new.id)
              .single()

            if (data) {
              setMessages(prev => [...prev, data])
            }
          },
        )
        .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
          const { messageId } = payload
          setMessages(prev => prev.filter(msg => msg.id !== messageId))
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
        sender:profiles(first_name, last_name)
      `,
      )
      .eq("building_id", buildingId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error loading messages:", error)
      return
    }

    setMessages(data || [])
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

  return {
    messages,
    sendMessage,
    deleteMessage,
    isSending,
    typingUsers,
    handleTypingStart,
    handleTypingStop,
  }
}
