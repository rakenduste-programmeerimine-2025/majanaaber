import { Notice } from "./types"
import { NoticeCard } from "./notice-card"
import { formatDateHeader, getDateKey } from "./config"

interface NoticeSectionProps {
  title: string
  notices: Notice[]
  isManager: boolean
  totalResidents: number
  onEdit: (notice: Notice) => void
  onDelete: (noticeId: string) => void
  onTogglePin: (noticeId: string, currentlyPinned: boolean) => void
  onToggleArchive: (noticeId: string, currentlyArchived: boolean) => void
  emptyMessage?: string
}

interface DateGroup {
  dateKey: string
  dateLabel: string
  notices: Notice[]
}

function groupNoticesByDate(notices: Notice[]): DateGroup[] {
  const groups: Map<string, Notice[]> = new Map()

  notices.forEach(notice => {
    const dateKey = getDateKey(notice.created_at)
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(notice)
  })

  return Array.from(groups.entries()).map(([dateKey, notices]) => ({
    dateKey,
    dateLabel: formatDateHeader(notices[0].created_at),
    notices,
  }))
}

export function NoticeSection({
  title,
  notices,
  isManager,
  totalResidents,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleArchive,
  emptyMessage = "No notices.",
}: NoticeSectionProps) {
  if (notices.length === 0) {
    return null
  }

  // Separate pinned notices (show at top without date grouping)
  const pinnedNotices = notices.filter(n => n.is_pinned)
  const unpinnedNotices = notices.filter(n => !n.is_pinned)
  const dateGroups = groupNoticesByDate(unpinnedNotices)

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
        {title} ({notices.length})
      </h4>

      {/* Pinned notices at top */}
      {pinnedNotices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Pinned</p>
          {pinnedNotices.map(notice => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              isManager={isManager}
              totalResidents={totalResidents}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onToggleArchive={onToggleArchive}
            />
          ))}
        </div>
      )}

      {/* Date-grouped notices */}
      {dateGroups.map(group => (
        <div key={group.dateKey} className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            {group.dateLabel}
          </p>
          {group.notices.map(notice => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              isManager={isManager}
              totalResidents={totalResidents}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onToggleArchive={onToggleArchive}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
