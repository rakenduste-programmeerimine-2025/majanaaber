"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

interface Message {
  id: string
  content: string
  created_at: string
  sender_id: string
  sender: {
    first_name: string
    last_name: string
  } | null
}

interface Building {
  id: string
  name: string
}

export default function ResidentDashboard() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [building, setBuilding] = useState<Building | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch user's building and messages
  useEffect(() => {
    const loadBuildingAndMessages = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setError("You must be logged in")
          setLoading(false)
          return
        }

        setCurrentUserId(user.id)
        let userBuilding = null

        // First, check if user is a manager of any building
        const { data: managerBuilding } = await supabase
          .from("buildings")
          .select("id, name")
          .eq("manager_id", user.id)
          .limit(1)
          .single()

        if (managerBuilding) {
          userBuilding = managerBuilding
        } else {
          // If not a manager, check if they're an approved resident
          const { data: residentData, error: residentError } = await supabase
            .from("building_residents")
            .select("building_id, buildings(id, name)")
            .eq("profile_id", user.id)
            .eq("is_approved", true)
            .limit(1)
            .single()

          if (residentError || !residentData) {
            setError("You are not assigned to any building yet")
            setLoading(false)
            return
          }

          userBuilding = (residentData.buildings as any)
        }

        if (!userBuilding) {
          setError("You are not assigned to any building yet")
          setLoading(false)
          return
        }

        setBuilding({ id: userBuilding.id, name: userBuilding.name })

        // Fetch messages for this building
        await loadMessages(userBuilding.id)
      } catch (err: any) {
        console.error("Error loading building:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadBuildingAndMessages()
  }, [])

  // Real-time subscription for new messages
  useEffect(() => {
    if (!building) return

    const channel = supabase
      .channel(`building_messages:${building.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "building_messages",
          filter: `building_id=eq.${building.id}`,
        },
        async payload => {
          // Fetch the full message with sender info
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
  }, [building])

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

  const sendMessage = async () => {
    if (!input.trim() || !building) return

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from("building_messages").insert({
        building_id: building.id,
        sender_id: user.id,
        content: input.trim(),
      })

      if (error) throw error

      setInput("")
      // Real-time subscription will automatically add the new message
    } catch (err: any) {
      console.error("Error sending message:", err)
      alert("Failed to send message: " + err.message)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const messageDate = new Date(timestamp)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const messageDay = new Date(
      messageDate.getFullYear(),
      messageDate.getMonth(),
      messageDate.getDate(),
    )

    if (messageDay.getTime() === today.getTime()) {
      return messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    }

    if (messageDay.getTime() === yesterday.getTime()) {
      return `Yesterday ${messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    }

    return `${messageDate.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    })} ${messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    )
  }

  if (error || !building) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">No Building Found</h2>
          <p className="text-gray-600 mb-6">
            {error || "You need to create a building or be assigned to one to access the chat."}
          </p>
          <div className="space-y-3">
            <a
              href="/protected"
              className="inline-block bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 transition"
            >
              Go to Building Management
            </a>
            <p className="text-sm text-gray-500">
              Create a building or ask your building manager to add you as a resident.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="flex justify-center items-start gap-10 px-6 mt-[15vh]">
        {/* Left: Notices + Calendar */}
        <section className="flex bg-white p-6 shadow-lg w-[60%] h-[70vh] border border-gray-300">
          {/* Notices */}
          <div className="w-1/2 pr-6 border-r border-gray-300 flex flex-col">
            <h2 className="text-xl font-bold mb-3">{building.name}</h2>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Notices</h3>
            </div>
            <ul className="space-y-2 overflow-y-auto max-h-[60vh]">
              <li className="p-2 bg-gray-100 rounded text-gray-500 text-sm">
                No notices yet
              </li>
            </ul>
          </div>

          {/* Calendar */}
          <div className="w-1/2 pl-6 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-3">
              <button>{"<"}</button>
              <h3 className="font-semibold">November 2025</h3>
              <button>{">"}</button>
            </div>
            <div className="grid grid-cols-7 gap-2 w-full">
              {[...Array(30)].map((_, i) => (
                <button
                  key={i}
                  className="p-2 bg-gray-100 rounded hover:bg-blue-100 text-sm"
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Chat + User Info */}
        <section className="flex flex-col bg-white p-6 shadow-lg border border-gray-300 w-[30%] h-[70vh]">
          {/* Username + Icons + Nav buttons */}
          <div className="flex flex-col mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-lg">{building.name}</span>
              </div>
            </div>
          </div>

          {/* Chat box */}
          <div className="flex flex-col flex-1 min-h-0">
            <h3 className="text-xl font-semibold mb-2">Building Chat</h3>
            <div className="flex-1 overflow-y-auto border rounded p-3 mb-2 space-y-2 bg-gray-50 min-h-0">
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
                        className={`max-w-[75%] p-3 rounded-lg shadow-sm ${
                          isOwnMessage
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-800"
                        }`}
                      >
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
            <div className="flex gap-2">
              <input
                type="text"
                className="border rounded p-2 flex-1"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Empty space at bottom */}
      <div className="h-[10vh]" />
    </div>
  )
}
