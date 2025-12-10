"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Building } from "@/lib/types/chat"
import { useBuildingMessages } from "@/hooks/use-building-messages"
import { ChatBox } from "@/components/chat-box"
import { NoticeBoard } from "@/components/notices"
import { BuildingCalendar } from "@/components/building-calendar"
import Link from "next/link"
import { MessageSquare } from "lucide-react"

interface ResidentBuilding extends Building {
  full_address: string
}

export default function ResidentDashboard() {
  const [building, setBuilding] = useState<ResidentBuilding | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const buildingIdFromUrl = searchParams.get("building")
  const supabase = createClient()

  const {
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
  } = useBuildingMessages(building?.id ?? null)

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

        // If building ID is specified in URL, try to load that specific building
        if (buildingIdFromUrl) {
          // Verify user has access to this building (as resident or manager)
          const { data: residentAccess } = await supabase
            .from("building_residents")
            .select(
              "building_id, buildings!building_residents_building_id_fkey(id, full_address)",
            )
            .eq("profile_id", user.id)
            .eq("building_id", buildingIdFromUrl)
            .eq("is_approved", true)
            .single()

          if (residentAccess) {
            userBuilding = residentAccess.buildings as any
          } else {
            // Check if they manage this building
            const { data: managerAccess } = await supabase
              .from("buildings")
              .select("id, full_address")
              .eq("id", buildingIdFromUrl)
              .eq("manager_id", user.id)
              .single()

            if (managerAccess) {
              userBuilding = managerAccess
            }
          }
        }

        // If no specific building from URL or no access, fall back to default logic
        if (!userBuilding) {
          // For /residence page, prioritize residential building over managed building
          // Check for resident building first
          const { data: residentData, error: residentError } = await supabase
            .from("building_residents")
            .select(
              "building_id, buildings!building_residents_building_id_fkey(id, full_address)",
            )
            .eq("profile_id", user.id)
            .eq("is_approved", true)
            .limit(1)
            .single()

          if (!residentError && residentData) {
            userBuilding = residentData.buildings as any
          } else {
            // If no resident building, check if they manage a building (fallback)
            const { data: managerBuilding } = await supabase
              .from("buildings")
              .select("id, full_address")
              .eq("manager_id", user.id)
              .limit(1)
              .single()

            if (managerBuilding) {
              userBuilding = managerBuilding
            }
          }
        }

        if (!userBuilding) {
          setError("You are not assigned to any building yet")
          setLoading(false)
          return
        }

        setBuilding({
          id: userBuilding.id,
          full_address: userBuilding.full_address,
        })
      } catch (err: any) {
        console.error("Error loading building:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadBuilding()
  }, [buildingIdFromUrl])

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
          <p className="text-muted-foreground mb-6">
            {error ||
              "You need to create a building or be assigned to one to access the chat."}
          </p>
          <div className="space-y-3">
            <a
              href="/resident"
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded hover:opacity-90 transition"
            >
              Go to My Apartments
            </a>
            <p className="text-sm text-muted-foreground">
              Create a building or ask your building manager to add you as a
              resident.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Building Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">{building.full_address}</h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex justify-center items-start gap-10 px-6 mt-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start justify-center w-full max-w-[2000px]">
          {/* Left: Notices + Calendar */}
          <section className="flex flex-col md:flex-row bg-card p-6 shadow-lg w-full lg:w-[60%] h-auto md:h-[500px] lg:h-[70vh] border border-border rounded-lg">
            {/* Notices */}
            <div className="w-full md:w-1/2 h-[500px] md:h-auto pb-6 md:pb-0 md:pr-6 border-b md:border-b-0 md:border-r border-border flex flex-col overflow-y-auto">
              <NoticeBoard buildingId={building.id} />
            </div>

            {/* Calendar */}
            <div className="w-full md:w-1/2 pt-6 md:pt-0 md:pl-6 flex flex-col items-center">
              <BuildingCalendar buildingId={building.id} />
            </div>
          </section>

          {/* Right: Chat */}
          <ChatBox
            buildingName={building.full_address}
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={sendMessage}
            onDeleteMessage={deleteMessage}
            onEditMessage={editMessage}
            isSending={isSending}
            typingUsers={typingUsers}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            onAddReaction={addReaction}
            onRemoveReaction={removeReaction}
            onMarkAsRead={markMessageAsRead}
            headerAction={
              <Link
                href={`/residence/messages?building=${building.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 transition-opacity"
              >
                <MessageSquare className="h-4 w-4" />
                Direct Messages
              </Link>
            }
            className="w-full lg:w-[30%] h-[500px] lg:h-[70vh]"
          />
        </div>
      </main>

      <div className="h-[10vh]" />
    </div>
  )
}
