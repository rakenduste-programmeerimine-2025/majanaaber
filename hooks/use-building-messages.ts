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
              edited_at,
              is_deleted,
              sender_id,
              reply_to_message_id,
              sender:profiles!building_messages_sender_id_fkey(first_name, last_name),
              reactions:message_reactions(id, user_id, emoji, created_at),
              read_receipts:message_read_receipts(id, user_id, read_at),
              attachments:message_attachments(id, message_id, file_name, file_path, file_type, file_size, created_at)
            `,
              )
              .eq("id", payload.new.id)
              .single()

            // Fetch replied message separately if it exists
            if (data && data.reply_to_message_id) {
              const { data: repliedMsg } = await supabase
                .from("building_messages")
                .select(`
                  id,
                  content,
                  sender:profiles!building_messages_sender_id_fkey(first_name, last_name)
                `)
                .eq("id", data.reply_to_message_id)
                .single()

              if (repliedMsg) {
                data.replied_message = repliedMsg
              }
            }

            if (data) {
              setMessages(prev => [...prev, data as unknown as Message])
            }
          },
        )
        .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
          const { messageId } = payload
          setMessages(prev =>
            prev.map(msg =>
              msg.id === messageId
                ? { ...msg, is_deleted: true }
                : msg,
            ),
          )
        })
        .on("broadcast", { event: "message_edited" }, ({ payload }) => {
          const { messageId, content, edited_at } = payload
          setMessages(prev =>
            prev.map(msg =>
              msg.id === messageId
                ? { ...msg, content, edited_at }
                : msg,
            ),
          )
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
    const { data, error} = await supabase
      .from("building_messages")
      .select(
        `
        id,
        content,
        created_at,
        edited_at,
        is_deleted,
        sender_id,
        reply_to_message_id,
        sender:profiles!building_messages_sender_id_fkey(first_name, last_name),
        reactions:message_reactions(id, user_id, emoji, created_at),
        read_receipts:message_read_receipts(id, user_id, read_at),
        attachments:message_attachments(id, message_id, file_name, file_path, file_type, file_size, created_at)
      `,
      )
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("Error loading messages:", error)
      return
    }

    // Fetch replied messages separately for any messages that have replies
    const messagesWithReplies = await Promise.all(
      (data || []).map(async (msg: any) => {
        if (msg.reply_to_message_id) {
          const { data: repliedMsg } = await supabase
            .from("building_messages")
            .select(`
              id,
              content,
              sender:profiles!building_messages_sender_id_fkey(first_name, last_name)
            `)
            .eq("id", msg.reply_to_message_id)
            .single()

          return { ...msg, replied_message: repliedMsg || null }
        }
        return msg
      })
    )

    // Reverse to show oldest first (since we ordered by descending to get latest 100)
    setMessages(messagesWithReplies.reverse() as unknown as Message[])
  }

  const uploadFiles = async (
    messageId: string,
    files: File[],
    userId: string,
  ) => {
    const attachments = []

    for (const file of files) {
      const fileExt = file.name.split(".").pop()
      const fileName = `${userId}/${messageId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(fileName, file)

      if (uploadError) {
        console.error("Error uploading file:", uploadError)
        continue
      }

      const { data: attachment, error: dbError } = await supabase
        .from("message_attachments")
        .insert({
          message_id: messageId,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single()

      if (dbError) {
        console.error("Error creating attachment record:", dbError)
        continue
      }

      if (attachment) {
        attachments.push(attachment)
      }
    }

    return attachments
  }

  const sendMessage = async (
    content: string,
    replyToMessageId?: string | null,
    files?: File[],
  ) => {
    if ((!content.trim() && (!files || files.length === 0)) || !buildingId)
      return
    if (content.length > MAX_MESSAGE_LENGTH) return

    handleTypingStop()
    setIsSending(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: newMessage, error } = await supabase
        .from("building_messages")
        .insert({
          building_id: buildingId,
          sender_id: user.id,
          content: content.trim() || "(attached file)",
          reply_to_message_id: replyToMessageId || null,
        })
        .select()
        .single()

      if (error) throw error

      if (files && files.length > 0 && newMessage) {
        const uploadedAttachments = await uploadFiles(newMessage.id, files, user.id)

        // Update local state with the uploaded attachments (filter duplicates)
        if (uploadedAttachments.length > 0) {
          setMessages(prev =>
            prev.map(msg => {
              if (msg.id !== newMessage.id) return msg
              const existingIds = new Set((msg.attachments || []).map(a => a.id))
              const newAttachments = uploadedAttachments.filter(a => !existingIds.has(a.id))
              return { ...msg, attachments: [...(msg.attachments || []), ...newAttachments] }
            }),
          )
        }
      }
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
        .update({ is_deleted: true })
        .eq("id", messageId)

      if (error) throw error

      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, is_deleted: true }
            : msg,
        ),
      )

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

  const editMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim() || newContent.length > MAX_MESSAGE_LENGTH) return

    try {
      const { error } = await supabase
        .from("building_messages")
        .update({
          content: newContent.trim(),
          edited_at: new Date().toISOString(),
        })
        .eq("id", messageId)

      if (error) throw error

      const edited_at = new Date().toISOString()
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: newContent.trim(), edited_at }
            : msg,
        ),
      )

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "message_edited",
          payload: { messageId, content: newContent.trim(), edited_at },
        })
      }
    } catch (err: any) {
      console.error("Error editing message:", err)
      alert("Failed to edit message: " + err.message)
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

    // Check if reaction already exists locally to prevent unnecessary DB calls
    const message = messages.find(m => m.id === messageId)
    const alreadyReacted = message?.reactions?.some(
      r => r.user_id === userIdRef.current && r.emoji === emoji
    )

    if (alreadyReacted) {
      // User already has this reaction, silently return
      return
    }

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
      // Handle duplicate key constraint violation (PostgreSQL error code 23505)
      if (err.code === '23505') {
        // Race condition: reaction was added between our check and insert
        // This is expected behavior in real-time systems, not an error
        console.debug("Reaction already exists (race condition):", { messageId, emoji })
        return
      }

      // Real error - show to user
      console.error("Error adding reaction:", err)
      alert("Failed to add reaction: " + err.message)
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

      if (error) {
        // Silently ignore duplicate key errors (409)
        if (error.code === '23505' || error.message.includes('duplicate')) {
          return
        }
        throw error
      }

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
      // Silently ignore duplicate key errors (PostgreSQL error code 23505)
      if (err.code !== '23505') {
        console.error("Error marking message as read:", err)
      }
    }
  }

  return {
    messages,
    sendMessage,
    deleteMessage,
    editMessage,
    isSending,
    typingUsers,
    handleTypingStart,
    handleTypingStop,
    addReaction,
    removeReaction,
    markMessageAsRead,
  }
}
