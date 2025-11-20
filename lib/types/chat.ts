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
  name: string
}

