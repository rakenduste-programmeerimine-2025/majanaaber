"use client"

import { useState, useEffect, useRef, memo } from "react"
import type { Message, Attachment } from "@/lib/types/chat"
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

const AttachmentDisplay = memo(({ attachment, isOwnMessage }: { attachment: Attachment; isOwnMessage: boolean }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    console.log('[IMAGE] AttachmentDisplay mounted for:', attachment.file_name)

    const getFileUrl = async () => {
      try {
        const { data, error } = await supabase.storage
          .from("message-attachments")
          .createSignedUrl(attachment.file_path, 3600)

        if (error) {
          console.error('[IMAGE] Storage error:', error)
          setIsLoading(false)
          return
        }

        if (data?.signedUrl) {
          console.log('[IMAGE] Got signed URL for:', attachment.file_name)
          setFileUrl(data.signedUrl)
        }
      } catch (err) {
        console.error('[IMAGE] Failed to get file URL:', err)
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
              onClick={(e) => {
                e.stopPropagation()
                window.open(fileUrl, '_blank')
              }}
              onLoad={() => console.log('[IMAGE] Loaded:', attachment.file_name)}
              onError={() => {
                console.log('[IMAGE] Error loading:', attachment.file_name)
                setImageError(true)
              }}
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

interface ChatBoxProps {
  buildingName: string
  messages: Message[]
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
  headerAction?: React.ReactNode
}

export function ChatBox({
  buildingName,
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
  headerAction,
}: ChatBoxProps) {
  const [input, setInput] = useState("")
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editInput, setEditInput] = useState("")
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const markedAsReadRef = useRef<Set<string>>(new Set())

  const scrollToBottom = () => {
    console.log('[SCROLL] Scrolling to bottom')
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const prevMessagesLengthRef = useRef(messages.length)
  const isUserSendingRef = useRef(false)

  // Simple scroll: only when user sends a message
  useEffect(() => {
    console.log('[MESSAGES] Messages updated. Count:', messages.length, 'Previous:', prevMessagesLengthRef.current, 'isUserSending:', isUserSendingRef.current)

    if (messages.length > prevMessagesLengthRef.current && isUserSendingRef.current) {
      console.log('[SCROLL] Scheduling scroll to bottom in 100ms')
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
    const handleClickOutside = (e: MouseEvent) => {
      if (showMessageMenu) {
        setShowMessageMenu(null)
      }
      if (showEmojiPicker) {
        setShowEmojiPicker(null)
      }
    }

    if (showMessageMenu || showEmojiPicker) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showMessageMenu, showEmojiPicker])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 50

      console.log('[SCROLL EVENT] scrollTop:', container.scrollTop, 'scrollHeight:', container.scrollHeight, 'clientHeight:', container.clientHeight, 'isAtBottom:', isAtBottom)

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
            if (messageId && !markedAsReadRef.current.has(messageId)) {
              markedAsReadRef.current.add(messageId)
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
    if ((!input.trim() && selectedFiles.length === 0) || input.length > MAX_MESSAGE_LENGTH) return

    isUserSendingRef.current = true
    await onSendMessage(input, replyingTo?.id, selectedFiles.length > 0 ? selectedFiles : undefined)
    setInput("")
    setReplyingTo(null)
    setSelectedFiles([])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const currentCount = selectedFiles.length
    const availableSlots = MAX_FILES_PER_MESSAGE - currentCount

    if (availableSlots <= 0) {
      alert(`Maximum ${MAX_FILES_PER_MESSAGE} files per message`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      return
    }

    const filesToAdd = files.slice(0, availableSlots)
    if (files.length > availableSlots) {
      alert(`Only adding ${availableSlots} file(s). Maximum ${MAX_FILES_PER_MESSAGE} files per message.`)
    }

    setSelectedFiles(prev => [...prev, ...filesToAdd])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
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

  const handleEditClick = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId)
    setEditInput(currentContent)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const handleEditSave = async (messageId: string) => {
    if (!editInput.trim() || editInput.length > MAX_MESSAGE_LENGTH) return

    await onEditMessage(messageId, editInput)
    setEditingMessageId(null)
    setEditInput("")
  }

  const handleEditCancel = () => {
    setEditingMessageId(null)
    setEditInput("")
  }

  const handleEditKeyPress = (e: React.KeyboardEvent, messageId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleEditSave(messageId)
    } else if (e.key === "Escape") {
      handleEditCancel()
    }
  }

  const handleReply = (message: Message) => {
    setReplyingTo(message)
    inputRef.current?.focus()
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😀", "🔥", "✅"]

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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold">Building Chat</h3>
          {headerAction}
        </div>
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
                  <div className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[75%] p-3 rounded-lg shadow-sm relative group ${
                        msg.is_deleted
                          ? "bg-gray-100 text-gray-500"
                          : isOwnMessage
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-800"
                      }`}
                    >
                    {msg.is_deleted ? (
                      <>
                        <p className="text-sm italic">This message was deleted</p>
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(msg.created_at)}
                        </span>
                      </>
                    ) : (
                    <>
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)
                        }}
                        className={`absolute top-1/2 -translate-y-1/2 ${isOwnMessage ? '-left-12' : '-right-12'} bg-gray-200 text-gray-600 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-300`}
                        title="Add reaction"
                      >
                        😊
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowMessageMenu(showMessageMenu === msg.id ? null : msg.id)
                        }}
                        className={`absolute top-1/2 -translate-y-1/2 ${isOwnMessage ? '-left-6' : '-right-6'} bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600`}
                        title="More actions"
                      >
                        ⋮
                      </button>

                      {showMessageMenu === msg.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute top-1/2 -translate-y-full -mt-6 ${isOwnMessage ? '-left-32' : '-right-32'} bg-white border border-gray-300 rounded-lg shadow-lg py-1 z-30 min-w-[120px]`}
                        >
                          <button
                            onClick={() => {
                              handleReply(msg)
                              setShowMessageMenu(null)
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm"
                          >
                            Reply
                          </button>
                          {isOwnMessage && (
                            <>
                              <button
                                onClick={() => {
                                  handleEditClick(msg.id, msg.content)
                                  setShowMessageMenu(null)
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  handleDeleteClick(msg.id)
                                  setShowMessageMenu(null)
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600 text-sm"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                    {!isOwnMessage && (
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm text-blue-600">
                          {msg.sender
                            ? `${msg.sender.first_name} ${msg.sender.last_name}`
                            : "Unknown User"}
                        </span>
                      </div>
                    )}
                    {editingMessageId === msg.id ? (
                      <div className="flex flex-col gap-2">
                        <input
                          ref={editInputRef}
                          type="text"
                          className="border rounded p-2 text-sm text-gray-800"
                          value={editInput}
                          onChange={e => {
                            if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                              setEditInput(e.target.value)
                            }
                          }}
                          onKeyDown={e => handleEditKeyPress(e, msg.id)}
                          maxLength={MAX_MESSAGE_LENGTH}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSave(msg.id)}
                            className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600"
                            disabled={!editInput.trim()}
                          >
                            Save
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="bg-gray-500 text-white px-3 py-1 rounded text-xs hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                        {editInput.length > 0 && (
                          <span
                            className={`text-xs ${
                              editInput.length > MAX_MESSAGE_LENGTH * 0.9
                                ? "text-red-500"
                                : "text-gray-500"
                            }`}
                          >
                            {editInput.length}/{MAX_MESSAGE_LENGTH}
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        {msg.replied_message && (
                          <div className={`border-l-2 pl-2 mb-2 text-xs ${isOwnMessage ? 'border-blue-300' : 'border-gray-400'}`}>
                            <div className={`font-semibold ${isOwnMessage ? 'text-blue-200' : 'text-gray-600'}`}>
                              {msg.replied_message.sender
                                ? `${msg.replied_message.sender.first_name} ${msg.replied_message.sender.last_name}`
                                : 'Unknown User'}
                            </div>
                            <div className={`${isOwnMessage ? 'text-blue-100' : 'text-gray-500'} truncate`}>
                              {msg.replied_message.content}
                            </div>
                          </div>
                        )}
                        {msg.content && msg.content !== "(attached file)" && (
                          <p className="text-sm break-words">{msg.content}</p>
                        )}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 flex flex-col gap-2 overflow-hidden">
                            {msg.attachments.map(attachment => (
                              <AttachmentDisplay
                                key={attachment.id}
                                attachment={attachment}
                                isOwnMessage={isOwnMessage}
                              />
                            ))}
                          </div>
                        )}
                        {msg.edited_at && (
                          <span
                            className={`text-xs italic ${
                              isOwnMessage ? "text-blue-200" : "text-gray-400"
                            }`}
                          >
                            (edited)
                          </span>
                        )}
                      </>
                    )}
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

                    {showEmojiPicker === msg.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute top-full mt-1 ${isOwnMessage ? 'right-0' : 'left-0'} bg-white border border-gray-300 rounded shadow-lg p-1 flex gap-0.5 z-20`}
                      >
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => {
                              handleEmojiClick(msg.id, emoji)
                              setShowEmojiPicker(null)
                            }}
                            className="hover:bg-gray-100 rounded p-0.5 text-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    </>
                    )}
                    </div>

                    {!msg.is_deleted && groupReactions(msg.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
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
                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${
                                group.hasCurrentUser
                                  ? "bg-blue-100 border border-blue-300"
                                  : "bg-gray-100 border border-gray-300"
                              } hover:bg-blue-50 transition`}
                            >
                              <span className="text-xs">{group.emoji}</span>
                              <span className="text-xs">{group.count}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
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
        {replyingTo && (
          <div className="bg-gray-100 border-l-2 border-blue-500 p-2 rounded flex justify-between items-start">
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-700">
                Replying to {replyingTo.sender
                  ? `${replyingTo.sender.first_name} ${replyingTo.sender.last_name}`
                  : 'Unknown User'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {replyingTo.content}
              </div>
            </div>
            <button
              onClick={cancelReply}
              className="text-gray-500 hover:text-gray-700 ml-2"
              title="Cancel reply"
            >
              ×
            </button>
          </div>
        )}
        {selectedFiles.length > 0 && (
          <div className="bg-gray-50 border border-gray-300 rounded p-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-600 font-medium">
                {selectedFiles.length} / {MAX_FILES_PER_MESSAGE} files
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative bg-white border border-gray-300 rounded p-2 flex items-center gap-2 max-w-xs">
                  {file.type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-2xl">
                      📄
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-200 text-gray-700 px-3 rounded hover:bg-gray-300"
            title="Attach file"
            disabled={isSending}
          >
            📎
          </button>
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
            placeholder={replyingTo ? `Reply to ${replyingTo.sender?.first_name}...` : "Type a message..."}
            disabled={isSending}
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <button
            onClick={handleSendMessage}
            disabled={(!input.trim() && selectedFiles.length === 0) || input.length > MAX_MESSAGE_LENGTH || isSending}
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
