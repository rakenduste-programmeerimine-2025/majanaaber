export interface Message {
  id: string
  content: string
  created_at: string
  sender_id: string
  sender: {
    first_name: string
    last_name: string
  } | null
}

export interface Building {
  id: string
  name: string
}
