"use client"

import { useState, useEffect, useRef } from "react"
import type { Message } from "@/lib/types/chat"
import { formatTimestamp } from "@/lib/utils/date-formatting"

const MAX_MESSAGE_LENGTH = 1000

interface ChatBoxProps {
  buildingName: string
  messages: Message[]
  currentUserId: string | null
  onSendMessage: (content: string) => Promise<void>
  onDeleteMessage: (messageId: string) => Promise<void>
  isSending: boolean
}

export function ChatBox({
  buildingName,
  messages,
  currentUserId,
  onSendMessage,
  onDeleteMessage,
  isSending,
}: ChatBoxProps) {
  const [input, setInput] = useState("")
  const [showScrollButton, setShowScrollButton] = useState(false)
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

  const handleDeleteMessage = (messageId: string) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      onDeleteMessage(messageId)
    }
  }

  return (
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
            className="flex-1 overflow-y-auto border rounded p-3 space-y-2 bg-gray-50 absolute inset-0"
          >
          {messages.length === 0 ? (
            <p className="text-gray-500 text-sm text-center">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map(msg => {
              const isOwnMessage = msg.sender_id === currentUserId
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
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
                        onClick={() => handleDeleteMessage(msg.id)}
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
                    <span
                      className={`text-xs mt-1 block ${
                        isOwnMessage ? "text-blue-100" : "text-gray-500"
                      }`}
                    >
                      {formatTimestamp(msg.created_at)}
                    </span>
                  </div>
                </div>
              )
            })
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
              }
            }}
            onKeyPress={handleKeyPress}
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
    </section>
  )
}
