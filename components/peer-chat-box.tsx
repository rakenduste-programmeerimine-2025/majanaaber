"use client"

import { useState, useEffect, useRef, memo } from "react"
import { toast } from "sonner"
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

const AttachmentDisplay = memo(
  ({
    attachment,
    isOwnMessage,
  }: {
    attachment: PeerAttachment
    isOwnMessage: boolean
  }) => {
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
            console.error("Storage error:", error)
            setIsLoading(false)
            return
          }

          if (data?.signedUrl) {
            setFileUrl(data.signedUrl)
          }
        } catch (err) {
          console.error("Failed to get file URL:", err)
        } finally {
          setIsLoading(false)
        }
      }

      getFileUrl()
    }, [attachment.file_path])

    if (isLoading) {
      const isImage = attachment.file_type.startsWith("image/")
      return (
        <div
          className={`flex items-center gap-2 p-2 rounded bg-muted/30 animate-pulse ${isImage ? "min-h-[200px]" : ""}`}
        >
          <div className="w-12 h-12 bg-muted rounded"></div>
          <div className="flex-1">
            <div className="h-3 bg-muted rounded w-24 mb-1"></div>
            <div className="h-2 bg-muted rounded w-16"></div>
          </div>
        </div>
      )
    }

    if (!fileUrl) {
      return (
        <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
          <span className="text-sm text-destructive">Failed to load file</span>
        </div>
      )
    }

    const isImage = attachment.file_type.startsWith("image/")

    return (
      <div className="max-w-full">
        {isImage ? (
          <div className="relative">
            {imageError ? (
              <div className="flex items-center gap-2 p-2 rounded bg-muted/30 border border-border">
                <span className="text-sm text-muted-foreground">
                  📷 {attachment.file_name}
                </span>
              </div>
            ) : (
              <img
                src={fileUrl}
                alt={attachment.file_name}
                className="max-w-full max-h-96 w-auto h-auto rounded cursor-pointer hover:opacity-90"
                onClick={e => {
                  e.stopPropagation()
                  window.open(fileUrl, "_blank")
                }}
                onError={() => setImageError(true)}
              />
            )}
          </div>
        ) : (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 p-2 rounded border ${isOwnMessage ? "bg-primary border-primary" : "bg-muted border-muted"} hover:opacity-90 max-w-full`}
          >
            <span className="text-2xl flex-shrink-0">📄</span>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium truncate ${isOwnMessage ? "text-primary-foreground" : "text-foreground"}`}
              >
                {attachment.file_name}
              </div>
              <div
                className={`text-xs ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}
              >
                {formatFileSize(attachment.file_size)}
              </div>
            </div>
          </a>
        )}
      </div>
    )
  },
)

AttachmentDisplay.displayName = "AttachmentDisplay"

interface PeerChatBoxProps {
  otherUserName: string
  messages: PeerMessage[]
  currentUserId: string | null
  onSendMessage: (
    content: string,
    replyToMessageId?: string | null,
    files?: File[],
  ) => Promise<void>
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
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null)

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
  const hasInitiallyScrolledRef = useRef(false)

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && !hasInitiallyScrolledRef.current) {
      hasInitiallyScrolledRef.current = true
      setTimeout(() => scrollToBottom(), 100)
    }
  }, [messages])

  useEffect(() => {
    if (
      messages.length > prevMessagesLengthRef.current &&
      isUserSendingRef.current
    ) {
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
      if (
        msg.sender_id !== currentUserId &&
        !markedAsReadRef.current.has(msg.id)
      ) {
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
        container.scrollHeight - container.scrollTop - container.clientHeight <
        50

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
    await onSendMessage(
      input,
      replyingTo?.id || null,
      selectedFiles.length > 0 ? selectedFiles : undefined,
    )
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
      toast.error(
        `You can only upload up to ${MAX_FILES_PER_MESSAGE} files per message`,
      )
      return
    }
    setSelectedFiles(prev =>
      [...prev, ...files].slice(0, MAX_FILES_PER_MESSAGE),
    )
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
    e.nativeEvent.stopImmediatePropagation()
    setOpenMenuId(openMenuId === messageId ? null : messageId)
  }

  const toggleEmojiPicker = (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    setShowEmojiPicker(showEmojiPicker === messageId ? null : messageId)
    setOpenMenuId(null)
  }

  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "😀", "🔥", "✅"]

  const handleEmojiClick = async (messageId: string, emoji: string) => {
    await onAddReaction(messageId, emoji)
    setShowEmojiPicker(null)
  }

  const handleReactionClick = async (
    messageId: string,
    reactionId: string,
    userId: string,
  ) => {
    if (userId === currentUserId) {
      await onRemoveReaction(messageId, reactionId)
    }
  }

  return (
    <>
      <section className="flex flex-col h-[600px] border rounded-lg bg-card">
        <div className="border-b p-4 bg-card">
          <h2 className="text-lg font-semibold">{otherUserName}</h2>
        </div>

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 relative"
        >
          {messages.map(message => {
            const isOwnMessage = message.sender_id === currentUserId
            const senderName = message.sender
              ? `${message.sender.first_name} ${message.sender.last_name}`
              : "Unknown"

            const messageReactions = message.reactions || []
            const reactionGroups = messageReactions.reduce(
              (acc, reaction) => {
                if (!acc[reaction.emoji]) {
                  acc[reaction.emoji] = []
                }
                acc[reaction.emoji].push(reaction)
                return acc
              },
              {} as Record<string, typeof messageReactions>,
            )

            const isRead =
              message.read_receipts && message.read_receipts.length > 0

            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`${isOwnMessage ? "items-end" : "items-start"} flex flex-col w-full`}
                >
                  {!isOwnMessage && (
                    <span className="text-xs text-muted-foreground mb-1">
                      {senderName}
                    </span>
                  )}

                  {message.replied_message && (
                    <div
                      className={`text-xs mb-1 p-2 rounded border-l-2 ${
                        isOwnMessage
                          ? "bg-primary/20 border-primary"
                          : "bg-muted/30 border-muted"
                      }`}
                    >
                      <div className="font-medium">
                        {message.replied_message.sender
                          ? `${message.replied_message.sender.first_name} ${message.replied_message.sender.last_name}`
                          : "Unknown"}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {message.replied_message.content}
                      </div>
                    </div>
                  )}

                  <div
                    className={`max-w-[75%] min-w-0 p-3 rounded-lg shadow-sm relative group ${
                      message.is_deleted
                        ? "bg-muted text-muted-foreground"
                        : isOwnMessage
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {message.is_deleted ? (
                      <>
                        <p className="text-sm italic">
                          This message was deleted
                        </p>
                        <span className="text-xs text-muted-foreground/60">
                          {formatTimestamp(message.created_at)}
                        </span>
                      </>
                    ) : editingMessageId === message.id ? (
                      <div className="bg-background border border-border rounded-lg p-2">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          onKeyPress={e => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleEditSave()
                            }
                            if (e.key === "Escape") {
                              handleEditCancel()
                            }
                          }}
                          className="w-full px-2 py-1 border border-border rounded bg-background text-foreground"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleEditSave}
                            className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="px-3 py-1 bg-muted text-muted-foreground rounded text-sm hover:bg-muted/80"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={e => toggleEmojiPicker(message.id, e)}
                          className={`absolute top-1/2 -translate-y-1/2 ${isOwnMessage ? "-left-12" : "-right-12"} bg-muted text-muted-foreground rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/80`}
                          title="Add reaction"
                        >
                          😊
                        </button>

                        <button
                          onClick={e => toggleMenu(message.id, e)}
                          className={`absolute top-1/2 -translate-y-1/2 ${isOwnMessage ? "-left-6" : "-right-6"} bg-muted text-muted-foreground rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/80`}
                          title="More actions"
                        >
                          ⋮
                        </button>

                        {openMenuId === message.id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className={`absolute top-0 ${isOwnMessage ? "-left-32" : "-right-32"} bg-background border border-border rounded-lg shadow-lg py-1 z-30 min-w-[120px]`}
                          >
                            <button
                              onClick={() => {
                                handleReply(message)
                                setOpenMenuId(null)
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-muted/50 text-foreground text-sm"
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
                                  className="w-full text-left px-4 py-2 hover:bg-muted/50 text-foreground text-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleDeleteClick(message.id)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-destructive/10 text-destructive text-sm"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {showEmojiPicker === message.id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className={`absolute top-0 ${isOwnMessage ? "-left-48" : "-right-48"} bg-background border border-border rounded-lg shadow-lg p-2 flex gap-1 z-30`}
                          >
                            {commonEmojis.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() =>
                                  handleEmojiClick(message.id, emoji)
                                }
                                className="hover:bg-muted/50 p-1 rounded text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        <p className="break-words whitespace-pre-wrap">
                          {message.content}
                        </p>

                        {message.attachments &&
                          message.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.attachments.map(attachment => (
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
                              isOwnMessage
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatTimestamp(message.created_at)}
                          </span>
                          {message.edited_at && (
                            <span
                              className={`text-xs italic ${
                                isOwnMessage
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              (edited)
                            </span>
                          )}
                          {isOwnMessage && isRead && (
                            <span className="text-xs text-primary-foreground/70">
                              ✓✓
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {!message.is_deleted &&
                    Object.keys(reactionGroups).length > 0 && (
                      <div
                        className={`flex flex-wrap gap-1 mt-1 ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                        {Object.entries(reactionGroups).map(
                          ([emoji, reactions]) => {
                            const userReaction = reactions.find(
                              r => r.user_id === currentUserId,
                            )
                            return (
                              <button
                                key={emoji}
                                onClick={() => {
                                  if (userReaction) {
                                    handleReactionClick(
                                      message.id,
                                      userReaction.id,
                                      currentUserId!,
                                    )
                                  } else {
                                    onAddReaction(message.id, emoji)
                                  }
                                }}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${
                                  userReaction
                                    ? "bg-primary/20 border border-primary/30"
                                    : "bg-muted/30 border border-muted"
                                } hover:bg-primary/30 transition`}
                              >
                                <span className="text-xs">{emoji}</span>
                                <span className="text-xs">
                                  {reactions.length}
                                </span>
                              </button>
                            )
                          },
                        )}
                      </div>
                    )}
                </div>
              </div>
            )
          })}

          {typingUsers.length > 0 && (
            <div className="text-sm text-muted-foreground italic">
              {typingUsers.map(u => u.userName).join(", ")}{" "}
              {typingUsers.length === 1 ? "is" : "are"} typing...
            </div>
          )}

          <div ref={messagesEndRef} />

          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:opacity-90 transition-colors"
            >
              ↓
            </button>
          )}
        </div>

        {replyingTo && (
          <div className="px-4 py-2 bg-muted/20 border-t border-b flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">
                Replying to{" "}
                {replyingTo.sender
                  ? `${replyingTo.sender.first_name} ${replyingTo.sender.last_name}`
                  : "Unknown"}
              </span>
              <p className="text-muted-foreground truncate">
                {replyingTo.content}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20">
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-background border border-border rounded px-3 py-1"
                >
                  <span className="text-sm truncate max-w-[200px]">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-destructive hover:text-destructive/80"
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
              disabled={
                isSending || selectedFiles.length >= MAX_FILES_PER_MESSAGE
              }
              className="px-4 py-2 border rounded-lg hover:bg-muted/50 disabled:opacity-50\"
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
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none"
            />
            <button
              onClick={handleSendMessage}
              disabled={
                (!input.trim() && selectedFiles.length === 0) || isSending
              }
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
          <div className="text-xs text-muted-foreground mt-1\">
            {input.length}/{MAX_MESSAGE_LENGTH} characters
          </div>
        </div>
      </section>

      {messageToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete Message</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this message? This action cannot
              be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 border border-border rounded hover:bg-muted/50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:opacity-90 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
