"use client"

import { useState, useEffect } from "react"
import { useConversations } from "@/hooks/use-conversations"
import { usePeerMessages } from "@/hooks/use-peer-messages"
import { ConversationsList } from "@/components/conversations-list"
import { PeerChatBox } from "@/components/peer-chat-box"
import { createClient } from "@/lib/supabase/client"

export default function ManagerMessagesPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(null)
  const [otherUserName, setOtherUserName] = useState<string>("")
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [residents, setResidents] = useState<Array<{id: string, first_name: string, last_name: string}>>([])
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  const supabase = createClient()
  const { conversations, isLoading, getOrCreateConversation, refreshConversations } = useConversations()

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
    const checkAuthorization = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsAuthorized(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profile?.role === "building_manager" || profile?.role === "building_owner") {
        setCurrentUserId(user.id)
        setIsAuthorized(true)
      } else {
        setIsAuthorized(false)
      }
    }
    checkAuthorization()
  }, [])

  if (isAuthorized === null) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  if (isAuthorized === false) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center h-64">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access this page.</p>
          <p className="text-gray-600 mt-2">Only building managers can access direct messages here.</p>
          <a href="/resident/messages" className="mt-4 text-blue-600 hover:underline">
            Go to Resident Messages
          </a>
        </div>
      </div>
    )
  }

  const handleSelectConversation = async (conversationId: string, otherUserId: string) => {
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: managedBuildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("manager_id", user.id)

    if (!managedBuildings || managedBuildings.length === 0) return

    const buildingIds = managedBuildings.map(b => b.id)

    const { data: buildingResidents } = await supabase
      .from("building_residents")
      .select(`
        profile_id,
        profiles!inner(id, first_name, last_name)
      `)
      .in("building_id", buildingIds)
      .eq("is_approved", true)
      .neq("profile_id", user.id)

    if (buildingResidents) {
      // Remove duplicates
      const uniqueResidents = buildingResidents.reduce((acc: any[], br: any) => {
        if (!acc.find(r => r.id === br.profiles.id)) {
          acc.push({
            id: br.profiles.id,
            first_name: br.profiles.first_name,
            last_name: br.profiles.last_name,
          })
        }
        return acc
      }, [])

      setResidents(uniqueResidents)
      setShowNewMessageModal(true)
    }
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Message
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white rounded-lg border overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
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
            <div className="h-[600px] border rounded-lg bg-white flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg font-medium">No conversation selected</p>
                <p className="text-sm mt-2">Select a conversation or start a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">New Message</h2>
              <button
                onClick={() => setShowNewMessageModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {residents.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No residents found</p>
              ) : (
                residents.map((resident) => (
                  <button
                    key={resident.id}
                    onClick={() => handleCreateConversation(resident.id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg border"
                  >
                    <span className="font-medium">
                      {resident.first_name} {resident.last_name}
                    </span>
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
