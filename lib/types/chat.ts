export interface Reaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface ReadReceipt {
  id: string
  message_id: string
  user_id: string
  read_at: string
}

export interface Attachment {
  id: string
  message_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  created_at: string
}

export interface Message {
  id: string
  content: string
  created_at: string
  edited_at?: string | null
  sender_id: string
  sender: {
    first_name: string
    last_name: string
  } | null
  reactions?: Reaction[]
  read_receipts?: ReadReceipt[]
  attachments?: Attachment[]
  reply_to_message_id?: string | null
  replied_message?: {
    id: string
    content: string
    sender: {
      first_name: string
      last_name: string
    } | null
  } | null
}

export interface Building {
  id: string
}

// P2P Messaging Types

export interface Conversation {
  id: string
  participant1_id: string
  participant2_id: string
  created_at: string
  last_message_at: string
  // Populated fields
  other_participant?: {
    id: string
    first_name: string
    last_name: string
  }
  last_message?: {
    content: string
    created_at: string
    sender_id: string
  }
  unread_count?: number
}

export interface PeerReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface PeerReadReceipt {
  id: string
  message_id: string
  user_id: string
  read_at: string
}

export interface PeerAttachment {
  id: string
  message_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  created_at: string
}

export interface PeerMessage {
  id: string
  conversation_id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  edited_at?: string | null
  reply_to_message_id?: string | null
  sender: {
    first_name: string
    last_name: string
  } | null
  receiver: {
    first_name: string
    last_name: string
  } | null
  reactions?: PeerReaction[]
  read_receipts?: PeerReadReceipt[]
  attachments?: PeerAttachment[]
  replied_message?: {
    id: string
    content: string
    sender: {
      first_name: string
      last_name: string
    } | null
  } | null
}
