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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg font-medium">No conversations yet</p>
        <p className="text-sm mt-2">Start a new conversation to get started</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {conversations.map(conversation => {
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
            className={`w-full px-4 py-3 hover:bg-muted/30 transition-colors text-left ${
              isActive
                ? "bg-primary/10 border-l-4 border-primary"
                : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm font-medium truncate ${
                      isUnread ? "font-semibold" : "text-foreground"
                    }`}
                  >
                    {otherParticipant.first_name} {otherParticipant.last_name}
                  </h3>
                  {isUnread && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-primary-foreground bg-primary rounded-full">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
                {lastMessage && (
                  <p
                    className={`text-sm mt-1 truncate ${
                      isUnread
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {lastMessage.content}
                  </p>
                )}
              </div>
              {lastMessage && (
                <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
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
