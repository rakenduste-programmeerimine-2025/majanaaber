"use client"

import { useState, useEffect, useRef } from "react"
import type { Message } from "@/lib/types/chat"
import { formatTimestamp } from "@/lib/utils/date-formatting"

const MAX_MESSAGE_LENGTH = 1000

interface TypingUser {
  userId: string
  userName: string
}

interface ChatBoxProps {
  buildingName: string
  messages: Message[]
  currentUserId: string | null
  onSendMessage: (content: string) => Promise<void>
  onDeleteMessage: (messageId: string) => Promise<void>
  isSending: boolean
  typingUsers: TypingUser[]
  onTypingStart: () => void
  onTypingStop: () => void
  onAddReaction: (messageId: string, emoji: string) => Promise<void>
  onRemoveReaction: (messageId: string, reactionId: string) => Promise<void>
  onMarkAsRead: (messageId: string) => Promise<void>
}

export function ChatBox({
  buildingName,
  messages,
  currentUserId,
  onSendMessage,
  onDeleteMessage,
  isSending,
  typingUsers,
  onTypingStart,
  onTypingStop,
  onAddReaction,
  onRemoveReaction,
  onMarkAsRead,
}: ChatBoxProps) {
  const [input, setInput] = useState("")
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!isSending && input === "") {
      inputRef.current?.focus()
    }
  }, [isSending, input])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 50
      setShowScrollButton(!isAtBottom)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!currentUserId) return

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute("data-message-id")
            if (messageId) {
              onMarkAsRead(messageId)
            }
          }
        })
      },
      { threshold: 0.5 },
    )

    const messageElements = document.querySelectorAll("[data-message-id]")
    messageElements.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [messages, currentUserId, onMarkAsRead])

  const handleSendMessage = async () => {
    if (!input.trim() || input.length > MAX_MESSAGE_LENGTH) return

    await onSendMessage(input)
    setInput("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleDeleteClick = (messageId: string) => {
    setMessageToDelete(messageId)
  }

  const confirmDelete = () => {
    if (messageToDelete) {
      onDeleteMessage(messageToDelete)
      setMessageToDelete(null)
    }
  }

  const cancelDelete = () => {
    setMessageToDelete(null)
  }

  const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😀"]

  const handleEmojiClick = async (messageId: string, emoji: string) => {
    const message = messages.find(m => m.id === messageId)
    if (!message) return

    const existingReaction = message.reactions?.find(
      r => r.emoji === emoji && r.user_id === currentUserId,
    )

    if (existingReaction) {
      await onRemoveReaction(messageId, existingReaction.id)
    } else {
      await onAddReaction(messageId, emoji)
    }
  }

  const groupReactions = (reactions:any[] | undefined) => {
    if (!reactions) return []

    const groups: Record<string, { emoji: string; count: number; users: string[]; hasCurrentUser: boolean }> = {}

    reactions.forEach(reaction => {
      if (!groups[reaction.emoji]) {
        groups[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          hasCurrentUser: false,
        }
      }
      groups[reaction.emoji].count++
      groups[reaction.emoji].users.push(reaction.user_id)
      if (reaction.user_id === currentUserId) {
        groups[reaction.emoji].hasCurrentUser = true
      }
    })

    return Object.values(groups)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .chat-scrollbar::-webkit-scrollbar {
          width: 12px;
        }
        .chat-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 6px;
        }
        .chat-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}} />
    <section className="flex flex-col bg-white p-6 shadow-lg border border-gray-300 w-[30%] h-[70vh]">
      <div className="flex flex-col mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-lg">{buildingName}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <h3 className="text-xl font-semibold mb-2">Building Chat</h3>
        <div className="relative flex-1 min-h-0">
          <div
            ref={messagesContainerRef}
            className="chat-scrollbar flex-1 overflow-y-auto border rounded p-3 space-y-2 bg-gray-50 absolute inset-0 cursor-default"
          >
          {messages.length === 0 ? (
            <p className="text-gray-500 text-sm text-center">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map(msg => {
              const isOwnMessage = msg.sender_id === currentUserId
              const readCount = msg.read_receipts?.length || 0
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  data-message-id={msg.id}
                >
                  <div
                    className={`max-w-[75%] p-3 rounded-lg shadow-sm relative group ${
                      isOwnMessage
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-800"
                    }`}
                  >
                    {isOwnMessage && (
                      <button
                        onClick={() => handleDeleteClick(msg.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-red-600"
                        title="Delete message"
                      >
                        ×
                      </button>
                    )}
                    {!isOwnMessage && (
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm text-blue-600">
                          {msg.sender
                            ? `${msg.sender.first_name} ${msg.sender.last_name}`
                            : "Unknown User"}
                        </span>
                      </div>
                    )}
                    <p className="text-sm break-words">{msg.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs ${
                          isOwnMessage ? "text-blue-100" : "text-gray-500"
                        }`}
                      >
                        {formatTimestamp(msg.created_at)}
                      </span>
                      {isOwnMessage && readCount > 0 && (
                        <span
                          className="text-xs text-blue-100 flex items-center gap-1"
                          title={`Read by ${readCount} ${readCount === 1 ? "person" : "people"}`}
                        >
                          <span>✓✓</span>
                          <span>{readCount}</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() =>
                        setShowEmojiPicker(
                          showEmojiPicker === msg.id ? null : msg.id,
                        )
                      }
                      className="absolute -bottom-2 -left-2 bg-gray-200 text-gray-600 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm hover:bg-gray-300"
                      title="Add reaction"
                    >
                      +
                    </button>

                    {showEmojiPicker === msg.id && (
                      <div className={`absolute -bottom-10 ${isOwnMessage ? 'right-0' : 'left-0'} bg-white border border-gray-300 rounded-lg shadow-lg p-2 flex gap-1 z-20`}>
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => {
                              handleEmojiClick(msg.id, emoji)
                              setShowEmojiPicker(null)
                            }}
                            className="hover:bg-gray-100 rounded p-1 text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {groupReactions(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {groupReactions(msg.reactions).map(group => {
                        const userReaction = msg.reactions?.find(
                          r =>
                            r.emoji === group.emoji &&
                            r.user_id === currentUserId,
                        )
                        return (
                          <button
                            key={group.emoji}
                            onClick={() => {
                              if (userReaction) {
                                onRemoveReaction(msg.id, userReaction.id)
                              } else {
                                onAddReaction(msg.id, group.emoji)
                              }
                            }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                              group.hasCurrentUser
                                ? "bg-blue-100 border border-blue-300"
                                : "bg-gray-100 border border-gray-300"
                            } hover:bg-blue-50 transition`}
                          >
                            <span>{group.emoji}</span>
                            <span className="text-xs">{group.count}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
          {typingUsers.filter(u => u.userId !== currentUserId).length > 0 && (
            <div className="flex justify-start">
              <div className="bg-gray-300 text-gray-700 p-3 rounded-lg text-sm italic">
                {typingUsers.filter(u => u.userId !== currentUserId).length === 1
                  ? `${typingUsers.filter(u => u.userId !== currentUserId)[0].userName} is typing...`
                  : `${typingUsers.filter(u => u.userId !== currentUserId).length} people are typing...`}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 right-2 bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all z-10"
            title="Scroll to bottom"
          >
            ↓
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1 mt-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            className="border rounded p-2 flex-1"
            value={input}
            onChange={e => {
              if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                setInput(e.target.value)
                if (e.target.value.trim()) {
                  onTypingStart()
                } else {
                  onTypingStop()
                }
              }
            }}
            onKeyPress={handleKeyPress}
            onBlur={onTypingStop}
            placeholder="Type a message..."
            disabled={isSending}
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || input.length > MAX_MESSAGE_LENGTH || isSending}
            className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
        {input.length > 0 && (
          <span
            className={`text-xs text-right ${
              input.length > MAX_MESSAGE_LENGTH * 0.9
                ? "text-red-500"
                : "text-gray-500"
            }`}
          >
            {input.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </div>
      </div>

      {messageToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete Message</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
    </>
  )
}
