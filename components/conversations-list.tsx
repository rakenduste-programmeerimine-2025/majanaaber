"use client"

import { formatTimestamp } from "@/lib/utils/date-formatting"
import type { Conversation } from "@/lib/types/chat"

interface ConversationsListProps {
  conversations: Conversation[]
  isLoading: boolean
  currentConversationId: string | null
  onSelectConversation: (conversationId: string, otherUserId: string) => void
}

export function ConversationsList({
  conversations,
  isLoading,
  currentConversationId,
  onSelectConversation,
}: ConversationsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-lg font-medium">No conversations yet</p>
        <p className="text-sm mt-2">Start a new conversation to get started</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => {
        const otherParticipant = conversation.other_participant
        const lastMessage = conversation.last_message
        const isUnread = (conversation.unread_count || 0) > 0
        const isActive = conversation.id === currentConversationId

        if (!otherParticipant) return null

        const otherUserId =
          conversation.participant1_id === otherParticipant.id
            ? conversation.participant1_id
            : conversation.participant2_id

        return (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id, otherUserId)}
            className={`w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
              isActive ? "bg-blue-50 border-l-4 border-blue-500" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm font-medium truncate ${
                      isUnread ? "font-semibold" : ""
                    }`}
                  >
                    {otherParticipant.first_name} {otherParticipant.last_name}
                  </h3>
                  {isUnread && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
                {lastMessage && (
                  <p
                    className={`text-sm mt-1 truncate ${
                      isUnread ? "font-medium text-gray-900" : "text-gray-600"
                    }`}
                  >
                    {lastMessage.content}
                  </p>
                )}
              </div>
              {lastMessage && (
                <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                  {formatTimestamp(lastMessage.created_at)}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
