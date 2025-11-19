"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Building } from "@/lib/types/chat"
import { useBuildingMessages } from "@/hooks/use-building-messages"
import { ChatBox } from "@/components/chat-box"
import { NoticeBoardDisplay } from "@/components/notice-board-display"
import { BuildingCalendar } from "@/components/building-calendar"

export default function ResidentDashboard() {
  const [building, setBuilding] = useState<Building | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  const { messages, sendMessage } = useBuildingMessages(building?.id ?? null)

  useEffect(() => {
    const loadBuilding = async () => {
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

        const { data: managerBuilding } = await supabase
          .from("buildings")
          .select("id, name")
          .eq("manager_id", user.id)
          .limit(1)
          .single()

        if (managerBuilding) {
          userBuilding = managerBuilding
        } else {
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
      } catch (err: any) {
        console.error("Error loading building:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadBuilding()
  }, [])

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
      <main className="flex justify-center items-start gap-10 px-6 mt-[15vh]">
        <section className="flex bg-white p-6 shadow-lg w-[60%] h-[70vh] border border-gray-300">
          <NoticeBoardDisplay buildingName={building.name} />
          <BuildingCalendar />
        </section>

        <ChatBox
          buildingName={building.name}
          messages={messages}
          currentUserId={currentUserId}
          onSendMessage={sendMessage}
        />
      </main>

      <div className="h-[10vh]" />
    </div>
  )
}
