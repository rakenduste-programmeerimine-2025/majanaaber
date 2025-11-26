"use client"

import { useState, memo } from "react"
import { createClient } from "@/lib/supabase/client"
import { FileText } from "lucide-react"
import { NoticeAttachment } from "./types"
import { formatFileSize } from "./config"

export const AttachmentDisplay = memo(
  ({ attachment }: { attachment: NoticeAttachment }) => {
    const [imageError, setImageError] = useState(false)
    const supabase = createClient()

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("notice-attachments")
      .getPublicUrl(attachment.file_path)

    const isImage = attachment.file_type.startsWith("image/")

    if (isImage && !imageError) {
      return (
        <div className="relative">
          <img
            src={publicUrl}
            alt={attachment.file_name}
            className="max-w-full max-h-64 w-auto h-auto rounded cursor-pointer hover:opacity-90"
            onClick={() => window.open(publicUrl, "_blank")}
            onError={() => setImageError(true)}
          />
          <div className="text-xs text-gray-500 mt-1">
            {attachment.file_name}
          </div>
        </div>
      )
    }

    return (
      <a
        href={publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
      >
        <FileText className="h-4 w-4 text-red-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-gray-700 dark:text-gray-300 truncate">
            {attachment.file_name}
          </div>
          <div className="text-xs text-gray-500">
            {formatFileSize(attachment.file_size)}
          </div>
        </div>
        <span className="text-xs text-gray-500">View</span>
      </a>
    )
  },
)

AttachmentDisplay.displayName = "AttachmentDisplay"
