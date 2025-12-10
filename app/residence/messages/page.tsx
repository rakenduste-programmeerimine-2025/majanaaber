"use client"

import { useState, useEffect } from "react"
import { useConversations } from "@/hooks/use-conversations"
import { usePeerMessages } from "@/hooks/use-peer-messages"
import { ConversationsList } from "@/components/conversations-list"
import { PeerChatBox } from "@/components/peer-chat-box"
import { createClient } from "@/lib/supabase/client"

export default function MessagesPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(
    null,
  )
  const [otherUserName, setOtherUserName] = useState<string>("")
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [residents, setResidents] = useState<
    Array<{
      id: string
      first_name: string
      last_name: string
      isManager?: boolean
    }>
  >([])

  const supabase = createClient()
  const {
    conversations,
    isLoading,
    getOrCreateConversation,
    refreshConversations,
  } = useConversations()

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
  } = usePeerMessages(selectedConversationId, selectedOtherUserId)

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    fetchUser()
  }, [])

  const handleSelectConversation = async (
    conversationId: string,
    otherUserId: string,
  ) => {
    setSelectedConversationId(conversationId)
    setSelectedOtherUserId(otherUserId)

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", otherUserId)
      .single()

    if (profile) {
      setOtherUserName(`${profile.first_name} ${profile.last_name}`)
    }
  }

  const handleStartNewConversation = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      console.error("No authenticated user")
      return
    }

    // First, try to get building from building_residents (for regular residents)
    const { data: userBuilding } = await supabase
      .from("building_residents")
      .select("building_id")
      .eq("profile_id", user.id)
      .eq("is_approved", true)
      .limit(1)
      .single()

    // If not a resident, check if user is a manager
    let buildingId = userBuilding?.building_id
    if (!buildingId) {
      const { data: managedBuilding } = await supabase
        .from("buildings")
        .select("id")
        .eq("manager_id", user.id)
        .limit(1)
        .single()

      buildingId = managedBuilding?.id
    }

    if (!buildingId) {
      alert("You are not associated with any building.")
      return
    }

    console.log("Fetching contacts for building:", buildingId)

    // Get all residents in the building using the specific foreign key relationship
    const { data: buildingResidents, error: residentsError } = await supabase
      .from("building_residents")
      .select(
        `
        profile_id,
        profiles!building_residents_profile_id_fkey(id, first_name, last_name)
      `,
      )
      .eq("building_id", buildingId)
      .eq("is_approved", true)
      .neq("profile_id", user.id)

    if (residentsError) {
      console.error("Error fetching residents:", residentsError)
      console.error("Residents error details:", {
        message: residentsError.message,
        details: residentsError.details,
        hint: residentsError.hint,
        code: residentsError.code,
      })
    } else {
      console.log("Successfully fetched residents:", buildingResidents)
    }

    // Also get the building manager
    const { data: building } = await supabase
      .from("buildings")
      .select(
        `
        manager_id,
        profiles:manager_id(id, first_name, last_name)
      `,
      )
      .eq("id", buildingId)
      .single()

    // Combine residents and manager (if not the current user)
    const contactsList: Array<{
      id: string
      first_name: string
      last_name: string
      isManager?: boolean
    }> = []

    // Add manager first if exists and is not current user
    if (building?.profiles && building.manager_id !== user.id) {
      const managerProfile = building.profiles as any
      contactsList.push({
        id: managerProfile.id,
        first_name: managerProfile.first_name,
        last_name: managerProfile.last_name,
        isManager: true,
      })
    }

    // Add residents
    if (buildingResidents && buildingResidents.length > 0) {
      buildingResidents.forEach((br: any) => {
        // Check if profile data exists and don't add if already added as manager
        if (br.profiles && !contactsList.some(c => c.id === br.profiles.id)) {
          contactsList.push({
            id: br.profiles.id,
            first_name: br.profiles.first_name,
            last_name: br.profiles.last_name,
          })
        }
      })
    }

    console.log("Contacts list:", contactsList)
    setResidents(contactsList)
    setShowNewMessageModal(true)
  }

  const handleCreateConversation = async (otherUserId: string) => {
    const conversationId = await getOrCreateConversation(otherUserId)
    if (conversationId) {
      setShowNewMessageModal(false)
      await handleSelectConversation(conversationId, otherUserId)
      refreshConversations()
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Direct Messages</h1>
        <button
          onClick={handleStartNewConversation}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          + New Message
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-card rounded-lg border overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="font-semibold">Conversations</h2>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            <ConversationsList
              conversations={conversations}
              isLoading={isLoading}
              currentConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedConversationId && selectedOtherUserId ? (
            <PeerChatBox
              otherUserName={otherUserName}
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
            />
          ) : (
            <div className="h-[600px] border rounded-lg bg-card flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">No conversation selected</p>
                <p className="text-sm mt-2">
                  Select a conversation or start a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">New Message</h2>
              <button
                onClick={() => setShowNewMessageModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {residents.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No contacts found
                </p>
              ) : (
                residents.map(resident => (
                  <button
                    key={resident.id}
                    onClick={() => handleCreateConversation(resident.id)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/30 rounded-lg border flex items-center justify-between"
                  >
                    <span className="font-medium">
                      {resident.first_name} {resident.last_name}
                    </span>
                    {resident.isManager && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        Manager
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
