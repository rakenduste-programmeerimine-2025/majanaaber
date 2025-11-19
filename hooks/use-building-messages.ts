import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Message } from "@/lib/types/chat"

const MAX_MESSAGE_LENGTH = 1000

export function useBuildingMessages(buildingId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isSending, setIsSending] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!buildingId) return

    loadMessages(buildingId)

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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
    } catch (err: any) {
      console.error("Error deleting message:", err)
      alert("Failed to delete message: " + err.message)
    }
  }

  return { messages, sendMessage, deleteMessage, isSending }
}
