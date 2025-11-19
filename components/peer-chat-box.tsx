"use client"

import { useState, useEffect, useRef, memo } from "react"
import type { PeerMessage, PeerAttachment } from "@/lib/types/chat"
import { formatTimestamp } from "@/lib/utils/date-formatting"
import { createClient } from "@/lib/supabase/client"

const MAX_MESSAGE_LENGTH = 1000
const MAX_FILES_PER_MESSAGE = 5

interface TypingUser {
  userId: string
  userName: string
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

const AttachmentDisplay = memo(({ attachment, isOwnMessage }: { attachment: PeerAttachment; isOwnMessage: boolean }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getFileUrl = async () => {
      try {
        const { data, error } = await supabase.storage
          .from("message-attachments")
          .createSignedUrl(attachment.file_path, 3600)

        if (error) {
          console.error('Storage error:', error)
          setIsLoading(false)
          return
        }

        if (data?.signedUrl) {
          setFileUrl(data.signedUrl)
        }
      } catch (err) {
        console.error('Failed to get file URL:', err)
      } finally {
        setIsLoading(false)
      }
    }

    getFileUrl()
  }, [attachment.file_path])

  if (isLoading) {
    const isImage = attachment.file_type.startsWith("image/")
    return (
      <div className={`flex items-center gap-2 p-2 rounded bg-gray-100 animate-pulse ${isImage ? 'min-h-[200px]' : ''}`}>
        <div className="w-12 h-12 bg-gray-300 rounded"></div>
        <div className="flex-1">
          <div className="h-3 bg-gray-300 rounded w-24 mb-1"></div>
          <div className="h-2 bg-gray-300 rounded w-16"></div>
        </div>
      </div>
    )
  }

  if (!fileUrl) {
    return (
      <div className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-200">
        <span className="text-sm text-red-600">Failed to load file</span>
      </div>
    )
  }

  const isImage = attachment.file_type.startsWith("image/")

  return (
    <div className="max-w-full">
      {isImage ? (
        <div className="relative">
          {imageError ? (
            <div className="flex items-center gap-2 p-2 rounded bg-gray-100 border border-gray-300">
              <span className="text-sm text-gray-600">📷 {attachment.file_name}</span>
            </div>
          ) : (
            <img
              src={fileUrl}
              alt={attachment.file_name}
              className="max-w-full max-h-96 w-auto h-auto rounded cursor-pointer hover:opacity-90"
              onClick={() => window.open(fileUrl, '_blank')}
              onError={() => setImageError(true)}
            />
          )}
        </div>
      ) : (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 p-2 rounded border ${isOwnMessage ? 'bg-blue-600 border-blue-500' : 'bg-gray-100 border-gray-300'} hover:opacity-90 max-w-full`}
        >
          <span className="text-2xl flex-shrink-0">📄</span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium truncate ${isOwnMessage ? 'text-white' : 'text-gray-800'}`}>
              {attachment.file_name}
            </div>
            <div className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
              {formatFileSize(attachment.file_size)}
            </div>
          </div>
        </a>
      )}
    </div>
  )
})

AttachmentDisplay.displayName = 'AttachmentDisplay'

interface PeerChatBoxProps {
  otherUserName: string
  messages: PeerMessage[]
  currentUserId: string | null
  onSendMessage: (content: string, replyToMessageId?: string | null, files?: File[]) => Promise<void>
  onDeleteMessage: (messageId: string) => Promise<void>
  onEditMessage: (messageId: string, newContent: string) => Promise<void>
  isSending: boolean
  typingUsers: TypingUser[]
  onTypingStart: () => void
  onTypingStop: () => void
  onAddReaction: (messageId: string, emoji: string) => Promise<void>
  onRemoveReaction: (messageId: string, reactionId: string) => Promise<void>
  onMarkAsRead: (messageId: string) => Promise<void>
}

export function PeerChatBox({
  otherUserName,
  messages,
  currentUserId,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  isSending,
  typingUsers,
  onTypingStart,
  onTypingStop,
  onAddReaction,
  onRemoveReaction,
  onMarkAsRead,
}: PeerChatBoxProps) {
  const [input, setInput] = useState("")
  const [replyingTo, setReplyingTo] = useState<PeerMessage | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const markedAsReadRef = useRef<Set<string>>(new Set())

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const prevMessagesLengthRef = useRef(messages.length)
  const isUserSendingRef = useRef(false)

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current && isUserSendingRef.current) {
      setTimeout(() => scrollToBottom(), 100)
      isUserSendingRef.current = false
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages])

  useEffect(() => {
    if (!isSending && input === "") {
      inputRef.current?.focus()
    }
  }, [isSending, input])

  useEffect(() => {
    if (!currentUserId) return

    messages.forEach(msg => {
      if (msg.sender_id !== currentUserId && !markedAsReadRef.current.has(msg.id)) {
        markedAsReadRef.current.add(msg.id)
        onMarkAsRead(msg.id)
      }
    })
  }, [messages, currentUserId, onMarkAsRead])

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
    const handleClickOutside = () => {
      setOpenMenuId(null)
      setShowEmojiPicker(null)
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  const handleSendMessage = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || isSending) return
    if (input.length > MAX_MESSAGE_LENGTH) return

    isUserSendingRef.current = true
    await onSendMessage(input, replyingTo?.id || null, selectedFiles.length > 0 ? selectedFiles : undefined)
    setInput("")
    setReplyingTo(null)
    setSelectedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + selectedFiles.length > MAX_FILES_PER_MESSAGE) {
      alert(`You can only upload up to ${MAX_FILES_PER_MESSAGE} files per message`)
      return
    }
    setSelectedFiles(prev => [...prev, ...files].slice(0, MAX_FILES_PER_MESSAGE))
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleDeleteClick = (messageId: string) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      onDeleteMessage(messageId)
    }
  }

  const handleEditStart = (message: PeerMessage) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const handleEditSave = async () => {
    if (!editingMessageId || !editContent.trim()) return

    await onEditMessage(editingMessageId, editContent)
    setEditingMessageId(null)
    setEditContent("")
  }

  const handleEditCancel = () => {
    setEditingMessageId(null)
    setEditContent("")
  }

  const handleReply = (message: PeerMessage) => {
    setReplyingTo(message)
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    onTypingStart()
  }

  const toggleMenu = (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(openMenuId === messageId ? null : messageId)
  }

  const toggleEmojiPicker = (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowEmojiPicker(showEmojiPicker === messageId ? null : messageId)
    setOpenMenuId(null)
  }

  const commonEmojis = ["👍", "❤️", "😊", "😂", "🎉", "🔥", "👏", "✅"]

  const handleEmojiClick = async (messageId: string, emoji: string) => {
    await onAddReaction(messageId, emoji)
    setShowEmojiPicker(null)
  }

  const handleReactionClick = async (messageId: string, reactionId: string, userId: string) => {
    if (userId === currentUserId) {
      await onRemoveReaction(messageId, reactionId)
    }
  }

  return (
    <>
    <section className="flex flex-col h-[600px] border rounded-lg bg-white">
      <div className="border-b p-4 bg-gray-50">
        <h2 className="text-lg font-semibold">{otherUserName}</h2>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
      >
        {messages.map((message) => {
          const isOwnMessage = message.sender_id === currentUserId
          const senderName = message.sender
            ? `${message.sender.first_name} ${message.sender.last_name}`
            : "Unknown"

          const messageReactions = message.reactions || []
          const reactionGroups = messageReactions.reduce((acc, reaction) => {
            if (!acc[reaction.emoji]) {
              acc[reaction.emoji] = []
            }
            acc[reaction.emoji].push(reaction)
            return acc
          }, {} as Record<string, typeof messageReactions>)

          const isRead = message.read_receipts && message.read_receipts.length > 0

          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"} flex flex-col`}>
                {!isOwnMessage && (
                  <span className="text-xs text-gray-500 mb-1">{senderName}</span>
                )}

                {message.replied_message && (
                  <div className={`text-xs mb-1 p-2 rounded border-l-2 ${isOwnMessage ? 'bg-blue-100 border-blue-400' : 'bg-gray-100 border-gray-400'}`}>
                    <div className="font-medium">
                      {message.replied_message.sender
                        ? `${message.replied_message.sender.first_name} ${message.replied_message.sender.last_name}`
                        : "Unknown"}
                    </div>
                    <div className="text-gray-600 truncate">{message.replied_message.content}</div>
                  </div>
                )}

                <div className="relative group">
                  {editingMessageId === message.id ? (
                    <div className="bg-white border rounded-lg p-2">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleEditSave()
                          }
                          if (e.key === "Escape") {
                            handleEditCancel()
                          }
                        }}
                        className="w-full px-2 py-1 border rounded"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleEditSave}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="px-3 py-1 bg-gray-300 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          isOwnMessage
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-900"
                        }`}
                      >
                        <p className="break-words whitespace-pre-wrap">{message.content}</p>

                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.attachments.map((attachment) => (
                              <AttachmentDisplay
                                key={attachment.id}
                                attachment={attachment}
                                isOwnMessage={isOwnMessage}
                              />
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs ${
                              isOwnMessage ? "text-blue-100" : "text-gray-500"
                            }`}
                          >
                            {formatTimestamp(message.created_at)}
                          </span>
                          {message.edited_at && (
                            <span
                              className={`text-xs italic ${
                                isOwnMessage ? "text-blue-100" : "text-gray-500"
                              }`}
                            >
                              (edited)
                            </span>
                          )}
                          {isOwnMessage && isRead && (
                            <span className="text-xs text-blue-100">✓✓</span>
                          )}
                        </div>
                      </div>

                      {Object.keys(reactionGroups).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Object.entries(reactionGroups).map(([emoji, reactions]) => (
                            <button
                              key={emoji}
                              onClick={() => {
                                const userReaction = reactions.find(r => r.user_id === currentUserId)
                                if (userReaction) {
                                  handleReactionClick(message.id, userReaction.id, currentUserId!)
                                }
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                reactions.some(r => r.user_id === currentUserId)
                                  ? 'bg-blue-100 border border-blue-300'
                                  : 'bg-gray-100 border border-gray-300'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{reactions.length}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1 bg-white border rounded-lg shadow-lg p-1">
                          <button
                            onClick={(e) => toggleEmojiPicker(message.id, e)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Add reaction"
                          >
                            😊
                          </button>
                          <button
                            onClick={(e) => toggleMenu(message.id, e)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="More options"
                          >
                            •••
                          </button>
                        </div>

                        {showEmojiPicker === message.id && (
                          <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg p-2 flex gap-1 z-10">
                            {commonEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleEmojiClick(message.id, emoji)}
                                className="hover:bg-gray-100 p-1 rounded text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {openMenuId === message.id && (
                          <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-[120px] z-10">
                            <button
                              onClick={() => {
                                handleReply(message)
                                setOpenMenuId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                            >
                              Reply
                            </button>
                            {isOwnMessage && (
                              <>
                                <button
                                  onClick={() => {
                                    handleEditStart(message)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleDeleteClick(message.id)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-red-600"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {typingUsers.length > 0 && (
          <div className="text-sm text-gray-500 italic">
            {typingUsers.map((u) => u.userName).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        )}

        <div ref={messagesEndRef} />

        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-colors"
          >
            ↓
          </button>
        )}
      </div>

      {replyingTo && (
        <div className="px-4 py-2 bg-gray-50 border-t border-b flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">
              Replying to{" "}
              {replyingTo.sender
                ? `${replyingTo.sender.first_name} ${replyingTo.sender.last_name}`
                : "Unknown"}
            </span>
            <p className="text-gray-600 truncate">{replyingTo.content}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-t bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-white border rounded px-3 py-1"
              >
                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || selectedFiles.length >= MAX_FILES_PER_MESSAGE}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            📎
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isSending}
            maxLength={MAX_MESSAGE_LENGTH}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={handleSendMessage}
            disabled={(!input.trim() && selectedFiles.length === 0) || isSending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {input.length}/{MAX_MESSAGE_LENGTH} characters
        </div>
      </div>
    </section>
    </>
  )
}
