import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { PeerMessage } from "@/lib/types/chat"

const MAX_MESSAGE_LENGTH = 1000

interface TypingUser {
  userId: string
  userName: string
}

export function usePeerMessages(conversationId: string | null, otherUserId: string | null) {
  const [messages, setMessages] = useState<PeerMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userNameRef = useRef<string>("")
  const userIdRef = useRef<string>("")
  const supabase = createClient()

  useEffect(() => {
    if (!conversationId) return

    loadMessages(conversationId)

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
        .channel(`peer_messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "peer_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async payload => {
            const { data } = await supabase
              .from("peer_messages")
              .select(
                `
              id,
              content,
              created_at,
              edited_at,
              is_deleted,
              sender_id,
              receiver_id,
              conversation_id,
              reply_to_message_id,
              sender:profiles!peer_messages_sender_id_fkey(first_name, last_name),
              receiver:profiles!peer_messages_receiver_id_fkey(first_name, last_name),
              reactions:peer_message_reactions(id, user_id, emoji, created_at),
              read_receipts:peer_message_read_receipts(id, user_id, read_at),
              attachments:peer_message_attachments(id, message_id, file_name, file_path, file_type, file_size, created_at)
            `,
              )
              .eq("id", payload.new.id)
              .single()

            if (data) {
              // Construct message with replied_message property
              let messageWithReply: typeof data & {
                replied_message: { id: string; content: string; sender: { first_name: string; last_name: string }[] } | null
              } = { ...data, replied_message: null }

              if (data.reply_to_message_id) {
                const { data: repliedMsg } = await supabase
                  .from("peer_messages")
                  .select(`
                    id,
                    content,
                    sender:profiles!peer_messages_sender_id_fkey(first_name, last_name)
                  `)
                  .eq("id", data.reply_to_message_id)
                  .single()

                if (repliedMsg) {
                  messageWithReply = {
                    ...data,
                    replied_message: repliedMsg as { id: string; content: string; sender: { first_name: string; last_name: string }[] },
                  }
                }
              }

              // Check if message already exists (from optimistic update)
              setMessages(prev => {
                const existingIndex = prev.findIndex(m => m.id === data.id)
                if (existingIndex !== -1) {
                  // Update existing message with full data (including replied_message)
                  const updated = [...prev]
                  updated[existingIndex] = messageWithReply as unknown as PeerMessage
                  return updated
                }
                return [...prev, messageWithReply as unknown as PeerMessage]
              })
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
  }, [conversationId])

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("peer_messages")
      .select(
        `
        id,
        content,
        created_at,
        edited_at,
        is_deleted,
        sender_id,
        receiver_id,
        conversation_id,
        reply_to_message_id,
        sender:profiles!peer_messages_sender_id_fkey(first_name, last_name),
        receiver:profiles!peer_messages_receiver_id_fkey(first_name, last_name),
        reactions:peer_message_reactions(id, user_id, emoji, created_at),
        read_receipts:peer_message_read_receipts(id, user_id, read_at),
        attachments:peer_message_attachments(id, message_id, file_name, file_path, file_type, file_size, created_at)
      `,
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("Error loading messages:", error)
      return
    }

    const messagesWithReplies = await Promise.all(
      (data || []).map(async (msg) => {
        if (msg.reply_to_message_id) {
          const { data: repliedMsg } = await supabase
            .from("peer_messages")
            .select(`
              id,
              content,
              sender:profiles!peer_messages_sender_id_fkey(first_name, last_name)
            `)
            .eq("id", msg.reply_to_message_id)
            .single()

          return { ...msg, replied_message: repliedMsg || null }
        }
        return msg
      })
    )

    // Reverse to show oldest first (since we ordered by descending to get latest 100)
    setMessages(messagesWithReplies.reverse() as unknown as PeerMessage[])
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
        .from("peer_message_attachments")
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
    if ((!content.trim() && (!files || files.length === 0)) || !conversationId || !otherUserId)
      return
    if (content.length > MAX_MESSAGE_LENGTH) return

    handleTypingStop()
    setIsSending(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Get user profile for optimistic update
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single()

      const { data: newMessage, error } = await supabase
        .from("peer_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          receiver_id: otherUserId,
          content: content.trim() || "(attached file)",
          reply_to_message_id: replyToMessageId || null,
        })
        .select()
        .single()

      if (error) throw error

      // Optimistic update - add message to state immediately
      if (newMessage) {
        const optimisticMessage: PeerMessage = {
          id: newMessage.id,
          content: newMessage.content,
          created_at: newMessage.created_at,
          edited_at: null,
          is_deleted: false,
          sender_id: user.id,
          receiver_id: otherUserId,
          conversation_id: conversationId,
          reply_to_message_id: replyToMessageId || null,
          sender: profile ? { first_name: profile.first_name, last_name: profile.last_name } : null,
          receiver: null,
          reactions: [],
          read_receipts: [],
          attachments: [],
          replied_message: null,
        }
        setMessages(prev => [...prev, optimisticMessage])
      }

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error("Failed to send message: " + message)
    } finally {
      setIsSending(false)
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("peer_messages")
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error("Failed to delete message: " + message)
    }
  }

  const editMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim() || newContent.length > MAX_MESSAGE_LENGTH) return

    try {
      const { error } = await supabase
        .from("peer_messages")
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error("Failed to edit message: " + message)
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
      return
    }

    try {
      const { data, error } = await supabase
        .from("peer_message_reactions")
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
    } catch (err) {
      // Handle duplicate key constraint violation (PostgreSQL error code 23505)
      const pgError = err as { code?: string }
      if (pgError.code === "23505") {
        // Race condition: reaction was added between our check and insert
        return
      }

      // Real error - show to user
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error("Failed to add reaction: " + message)
    }
  }

  const removeReaction = async (messageId: string, reactionId: string) => {
    try {
      const { error } = await supabase
        .from("peer_message_reactions")
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error("Failed to remove reaction: " + message)
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
        .from("peer_message_read_receipts")
        .insert({
          message_id: messageId,
          user_id: userIdRef.current,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
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
    } catch (err) {
      // Silently ignore duplicate key errors (PostgreSQL error code 23505)
      const pgError = err as { code?: string }
      if (pgError.code !== "23505") {
        // Silent failure for read receipts - not critical
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
