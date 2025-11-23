"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { NoticeBoard } from "@/components/notice-board"
import { Button } from "@/components/ui/button"

interface Building {
  id: string
  full_address: string
  manager_id: string
}

export default function ManagerDashboard() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [building, setBuilding] = useState<Building | null>(null)
  const [loading, setLoading] = useState(true)
  const [showResidentsOverlay, setShowResidentsOverlay] = useState(false)
  const searchParams = useSearchParams()
  const buildingId = searchParams.get("building")

  useEffect(() => {
    const loadBuilding = async () => {
      if (!buildingId) {
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()

        // Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError || !user) {
          throw new Error("You must be logged in to access this page")
        }

        // Fetch building and verify ownership
        const { data, error } = await supabase
          .from("buildings")
          .select("id, full_address, manager_id")
          .eq("id", buildingId)
          .single()

        if (error) throw error

        // Verify the current user is the manager
        if (data.manager_id !== user.id) {
          throw new Error("You are not authorized to manage this building")
        }

        setBuilding(data)
      } catch (err: any) {
        console.error("Error loading building:", err)
        setBuilding(null)
      } finally {
        setLoading(false)
      }
    }

    loadBuilding()
  }, [buildingId])

  const sendMessage = () => {
    if (!input.trim()) return
    setMessages([...messages, input])
    setInput("")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    )
  }

  if (!buildingId || !building) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg mb-2">Unable to load building</p>
          <p className="text-sm text-gray-600">
            You may not have permission to manage this building.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Building Header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4 mt-[10vh]">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">{building.full_address}</h1>
          <Button
            variant="outline"
            onClick={() => setShowResidentsOverlay(true)}
          >
            Add/View Residents
          </Button>
        </div>
      </div>

      {/* Residents Overlay */}
      {showResidentsOverlay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold">Residents</h2>
              <button
                onClick={() => setShowResidentsOverlay(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <Button
                  onClick={() => {
                    /* TODO: Add resident */
                  }}
                >
                  Add
                </Button>
              </div>

              {/* Residents List Placeholder */}
              <div className="space-y-2">
                <p className="text-gray-500 text-sm">
                  No residents added yet. Click "Add" to add residents to this
                  building.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex justify-center items-start gap-10 px-6 mt-8">
        {/* Left: Notices + Calendar */}
        <section className="flex bg-white p-6 shadow-lg w-[60%] h-[70vh] border border-gray-300">
          {/* Notices */}
          <div className="w-1/2 pr-6 border-r border-gray-300 flex flex-col">
            <NoticeBoard
              buildingId={buildingId}
              isManager={true}
            />
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
                  className="p-2 bg-gray-100 rounded hover:bg-blue-100"
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Chat + User Info */}
        <div className="flex flex-col w-[30%]">
          {/* Username + Icons + Nav buttons above the chat box */}
          <div className="flex flex-col mb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-lg">John Doe</span>
                <div className="flex gap-2 text-xl">
                  <button>🏠</button>
                  <button>🔔</button>
                  <button>✉️</button>
                </div>
              </div>
            </div>
            <div className="flex justify-between mb-2">
              <button className="text-blue-600">Residents</button>
              <button className="text-blue-600">Invoices</button>
              <button className="text-blue-600">Documents</button>
              <button className="text-red-500">Log Out</button>
            </div>
          </div>

          {/* Chat box */}
          <section className="flex flex-col bg-white p-6 shadow-lg border border-gray-300 h-[70vh]">
            <h3 className="text-xl font-semibold mb-2">
              Talk to your neighbour
            </h3>
            <div className="flex-1 overflow-y-auto border p-2 mb-2 space-y-1">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className="bg-gray-100 p-2"
                >
                  {msg}
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                className="border p-2 flex-1"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 text-white px-4"
              >
                Send
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Empty space at bottom */}
      <div className="h-[10vh]" />
    </div>
  )
}
