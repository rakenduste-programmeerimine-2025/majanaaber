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

export interface Message {
  id: string
  content: string
  created_at: string
  sender_id: string
  sender: {
    first_name: string
    last_name: string
  } | null
  reactions?: Reaction[]
  read_receipts?: ReadReceipt[]
}

export interface Building {
  id: string
  name: string
}
