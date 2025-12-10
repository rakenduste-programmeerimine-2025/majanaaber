import {
  Calendar,
  DollarSign,
  Megaphone,
  ShieldAlert,
  Wrench,
} from "lucide-react"
import { Priority, Category, PriorityConfig, CategoryConfig } from "./types"

export const MAX_FILES_PER_NOTICE = 5

export const priorityConfig: Record<Priority, PriorityConfig> = {
  urgent: {
    label: "Urgent",
    color: "text-destructive",
    badgeVariant: "destructive",
  },
  normal: {
    label: "Normal",
    color: "text-muted-foreground",
    badgeVariant: "default",
  },
  low: {
    label: "Low",
    color: "text-primary",
    badgeVariant: "secondary",
  },
}

export const categoryConfig: Record<Category, CategoryConfig> = {
  general: {
    label: "General",
    icon: Megaphone,
    color: "text-muted-foreground",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
  },
  meeting: {
    label: "Meeting",
    icon: Calendar,
    color: "text-purple-600 dark:text-purple-400",
  },
  payment: {
    label: "Payment",
    icon: DollarSign,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  safety: {
    label: "Safety",
    icon: ShieldAlert,
    color: "text-destructive",
  },
  event: {
    label: "Event",
    icon: Calendar,
    color: "text-primary",
  },
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export function formatDateHeader(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday = date.toDateString() === today.toDateString()
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  if (isToday) return "Today"
  if (isYesterday) return "Yesterday"
  if (isTomorrow) return "Tomorrow"

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long", 
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  })
}

export function getDateKey(dateString: string): string {
  return new Date(dateString).toDateString()
}
