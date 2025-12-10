import { LucideIcon } from "lucide-react"

export type Priority = "urgent" | "normal" | "low"
export type Category =
  | "general"
  | "maintenance"
  | "meeting"
  | "payment"
  | "safety"
  | "event"

export interface NoticeAttachment {
  id: string
  notice_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  created_at: string
}

export interface Notice {
  id: string
  title: string
  content: string
  created_at: string
  created_by: string | null
  is_pinned: boolean
  is_archived: boolean
  priority: Priority
  category: Category
  expires_at: string | null
  event_date?: string | null
  // Legacy single attachment fields (for backwards compatibility)
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: string | null
  // New multiple attachments
  attachments?: NoticeAttachment[]
  author?: {
    first_name: string
    last_name: string
  } | null
}

export interface PriorityConfig {
  label: string
  color: string
  badgeVariant: "destructive" | "default" | "secondary"
}

export interface CategoryConfig {
  label: string
  icon: LucideIcon
  color: string
}
