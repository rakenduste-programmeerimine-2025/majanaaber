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
    color: "text-red-600 dark:text-red-400",
    badgeVariant: "destructive",
  },
  normal: {
    label: "Normal",
    color: "text-gray-600 dark:text-gray-400",
    badgeVariant: "default",
  },
  low: {
    label: "Low",
    color: "text-blue-600 dark:text-blue-400",
    badgeVariant: "secondary",
  },
}

export const categoryConfig: Record<Category, CategoryConfig> = {
  general: {
    label: "General",
    icon: Megaphone,
    color: "text-gray-600 dark:text-gray-400",
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
    color: "text-green-600 dark:text-green-400",
  },
  safety: {
    label: "Safety",
    icon: ShieldAlert,
    color: "text-red-600 dark:text-red-400",
  },
  event: {
    label: "Event",
    icon: Calendar,
    color: "text-blue-600 dark:text-blue-400",
  },
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}
