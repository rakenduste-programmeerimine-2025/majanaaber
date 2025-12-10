"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Archive,
  ArchiveRestore,
  Clock,
  Eye,
  FileText,
  ImageIcon,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react"
import { Notice } from "./types"
import { priorityConfig, categoryConfig } from "./config"
import { AttachmentDisplay } from "./notice-attachment"
import { useNoticeReadReceipts } from "@/hooks/use-notice-read-receipts"

interface NoticeCardProps {
  notice: Notice
  isManager: boolean
  totalResidents?: number
  onEdit: (notice: Notice) => void
  onDelete: (noticeId: string) => void
  onTogglePin: (noticeId: string, currentlyPinned: boolean) => void
  onToggleArchive: (noticeId: string, currentlyArchived: boolean) => void
}

export function NoticeCard({
  notice,
  isManager,
  totalResidents,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleArchive,
}: NoticeCardProps) {
  const { readReceipts, readCount } = useNoticeReadReceipts(notice.id)
  const [showReaders, setShowReaders] = useState(false)

  return (
    <Card
      className={
        notice.is_pinned
          ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10"
          : ""
      }
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              {notice.is_pinned && (
                <Pin className="h-3 w-3 text-amber-600 dark:text-amber-500" />
              )}
              {notice.title}
              {notice.priority !== "normal" && (
                <Badge
                  variant={priorityConfig[notice.priority].badgeVariant}
                  className="ml-1 text-[10px] px-1.5 py-0"
                >
                  {priorityConfig[notice.priority].label}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-1 flex items-center gap-1 flex-wrap">
              <span>
                {notice.author
                  ? `${notice.author.first_name} ${notice.author.last_name}`
                  : "Unknown"}
              </span>
              <span>·</span>
              <span>
                {new Date(notice.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
              <span>·</span>
              <span
                className={`flex items-center gap-0.5 ${categoryConfig[notice.category].color}`}
              >
                {(() => {
                  const Icon = categoryConfig[notice.category].icon
                  return <Icon className="h-3 w-3" />
                })()}
                {categoryConfig[notice.category].label}
              </span>
              {notice.expires_at && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
                    <Clock className="h-3 w-3" />
                    Expires{" "}
                    {new Date(notice.expires_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
          {isManager && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTogglePin(notice.id, notice.is_pinned)}
                className={`h-8 w-8 p-0 ${notice.is_pinned ? "text-amber-600 hover:text-amber-700" : ""}`}
                title={notice.is_pinned ? "Unpin notice" : "Pin notice"}
              >
                {notice.is_pinned ? (
                  <PinOff className="h-3 w-3" />
                ) : (
                  <Pin className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(notice)}
                className="h-8 w-8 p-0"
                title="Edit notice"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleArchive(notice.id, notice.is_archived)}
                className="h-8 w-8 p-0"
                title={notice.is_archived ? "Restore notice" : "Archive notice"}
              >
                {notice.is_archived ? (
                  <ArchiveRestore className="h-3 w-3" />
                ) : (
                  <Archive className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(notice.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                title="Delete notice permanently"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {notice.content}
        </p>

        {/* Display attachments with inline image preview */}
        {notice.attachments && notice.attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {notice.attachments.map(attachment => (
              <AttachmentDisplay
                key={attachment.id}
                attachment={attachment}
              />
            ))}
          </div>
        )}

        {/* Legacy single attachment support */}
        {!notice.attachments?.length &&
          notice.attachment_url &&
          notice.attachment_name && (
            <a
              href={notice.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-3 p-2 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors text-sm"
            >
              {notice.attachment_type?.startsWith("image/") ? (
                <ImageIcon className="h-4 w-4 text-primary" />
              ) : (
                <FileText className="h-4 w-4 text-destructive" />
              )}
              <span className="text-foreground truncate flex-1">
                {notice.attachment_name}
              </span>
              <span className="text-xs text-muted-foreground">View</span>
            </a>
          )}

        {/* Read Receipts */}
        {isManager && readCount > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowReaders(!showReaders)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>
                {readCount} {readCount === 1 ? "person has" : "people have"}{" "}
                read this
                {totalResidents && totalResidents > 0
                  ? ` (${Math.round((readCount / totalResidents) * 100)}%)`
                  : ""}
              </span>
            </button>

            {showReaders && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {readReceipts.map(receipt => (
                  <div
                    key={receipt.id}
                    className="text-xs text-muted-foreground flex items-center justify-between"
                  >
                    <span>
                      {receipt.reader
                        ? `${receipt.reader.first_name} ${receipt.reader.last_name}`
                        : "Unknown"}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(receipt.read_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
