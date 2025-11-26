"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Archive,
  ArchiveRestore,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Image,
  Megaphone,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Search,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from "lucide-react"

type Priority = "urgent" | "normal" | "low"
type Category = "general" | "maintenance" | "meeting" | "payment" | "safety" | "event"

const priorityConfig: Record<
  Priority,
  { label: string; color: string; badgeVariant: "destructive" | "default" | "secondary" }
> = {
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

const categoryConfig: Record<
  Category,
  { label: string; icon: typeof Megaphone; color: string }
> = {
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

interface Notice {
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
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: string | null
  author?: {
    first_name: string
    last_name: string
  } | null
}

interface NoticeBoardProps {
  buildingId: string
  isManager?: boolean
}

export function NoticeBoard({
  buildingId,
  isManager = false,
}: NoticeBoardProps) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)

  // Form state
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState<Priority>("normal")
  const [category, setCategory] = useState<Category>("general")
  const [expiresAt, setExpiresAt] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [existingAttachment, setExistingAttachment] = useState<{
    url: string
    name: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all")
  const [showArchived, setShowArchived] = useState(false)

  // Filter notices based on search, category, expiration, and archive status
  const filteredNotices = notices.filter(notice => {
    // Filter by archive status
    if (!showArchived && notice.is_archived) {
      return false
    }
    if (showArchived && !notice.is_archived) {
      return false
    }
    // Hide expired notices (unless archived view)
    if (
      !showArchived &&
      notice.expires_at &&
      new Date(notice.expires_at) < new Date()
    ) {
      return false
    }
    const matchesSearch =
      searchQuery === "" ||
      notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notice.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      filterCategory === "all" || notice.category === filterCategory
    return matchesSearch && matchesCategory
  })

  const loadNotices = async () => {
    try {
      const supabase = createClient()
      const { data, error: noticesError } = await supabase
        .from("notices")
        .select(
          `
          *,
          author:profiles!created_by(first_name, last_name)
        `,
        )
        .eq("building_id", buildingId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })

      if (noticesError) {
        throw noticesError
      }

      setNotices(data || [])
    } catch (err: any) {
      setError(err.message || "Failed to load notices")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (buildingId) {
      loadNotices()

      const supabase = createClient()

      // Subscribe to notices changes for this building
      const channel = supabase.channel(`notices_${buildingId}`)

      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notices",
            filter: `building_id=eq.${buildingId}`,
          },
          (payload: any) => {
            console.log("Notice change detected:", payload)
            loadNotices()
          },
        )
        .subscribe((status: string) => {
          console.log("Subscription status:", status)
        })

      // Cleanup subscription on unmount
      return () => {
        channel.unsubscribe()
      }
    }
  }, [buildingId])

  const resetForm = () => {
    setTitle("")
    setContent("")
    setPriority("normal")
    setCategory("general")
    setExpiresAt("")
    setAttachment(null)
    setExistingAttachment(null)
    setShowAddForm(false)
    setEditingNotice(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("You must be logged in to add notices")
      }

      // Verify user is the building manager before attempting insert/update
      const { data: building, error: buildingError } = await supabase
        .from("buildings")
        .select("manager_id")
        .eq("id", buildingId)
        .single()

      if (buildingError || !building) {
        throw new Error("Building not found")
      }

      if (building.manager_id !== user.id) {
        throw new Error(
          "You are not authorized to manage notices for this building",
        )
      }

      // Handle attachment upload
      let attachmentUrl: string | null = existingAttachment?.url || null
      let attachmentName: string | null = existingAttachment?.name || null
      let attachmentType: string | null = null

      if (attachment) {
        const fileExt = attachment.name.split(".").pop()
        const fileName = `${buildingId}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("notice-attachments")
          .upload(fileName, attachment)

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from("notice-attachments").getPublicUrl(fileName)

        attachmentUrl = publicUrl
        attachmentName = attachment.name
        attachmentType = attachment.type
      }

      if (editingNotice) {
        // Update existing notice
        const { error: updateError } = await supabase
          .from("notices")
          .update({
            title: title.trim(),
            content: content.trim(),
            priority,
            category,
            expires_at: expiresAt || null,
            attachment_url: attachmentUrl,
            attachment_name: attachmentName,
            attachment_type: attachmentType || editingNotice.attachment_type,
          })
          .eq("id", editingNotice.id)

        if (updateError) throw updateError
      } else {
        // Create new notice
        const { error: insertError } = await supabase.from("notices").insert({
          building_id: buildingId,
          title: title.trim(),
          content: content.trim(),
          priority,
          category,
          expires_at: expiresAt || null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
          created_by: user.id,
        })

        if (insertError) throw insertError
      }

      resetForm()
      loadNotices()
    } catch (err: any) {
      setError(err.message || "Failed to save notice")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice)
    setTitle(notice.title)
    setContent(notice.content)
    setPriority(notice.priority)
    setCategory(notice.category)
    setExpiresAt(
      notice.expires_at
        ? new Date(notice.expires_at).toISOString().split("T")[0]
        : "",
    )
    setAttachment(null)
    setExistingAttachment(
      notice.attachment_url && notice.attachment_name
        ? { url: notice.attachment_url, name: notice.attachment_name }
        : null,
    )
    setShowAddForm(true)
  }

  const handleDelete = async (noticeId: string) => {
    if (!confirm("Are you sure you want to delete this notice?")) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("notices")
        .delete()
        .eq("id", noticeId)

      if (error) throw error

      loadNotices()
    } catch (err: any) {
      setError(err.message || "Failed to delete notice")
    }
  }

  const handleTogglePin = async (noticeId: string, currentlyPinned: boolean) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("notices")
        .update({ is_pinned: !currentlyPinned })
        .eq("id", noticeId)

      if (error) throw error

      loadNotices()
    } catch (err: any) {
      setError(err.message || "Failed to update pin status")
    }
  }

  const handleToggleArchive = async (
    noticeId: string,
    currentlyArchived: boolean,
  ) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("notices")
        .update({ is_archived: !currentlyArchived })
        .eq("id", noticeId)

      if (error) throw error

      loadNotices()
    } catch (err: any) {
      setError(err.message || "Failed to update archive status")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-gray-500">Loading notices...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          {showArchived ? "Archived Notices" : "Notices"}
        </h3>
        <div className="flex gap-2">
          {isManager && (
            <Button
              size="sm"
              variant={showArchived ? "default" : "outline"}
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="h-4 w-4 mr-1" />
              {showArchived ? "View Active" : "View Archive"}
            </Button>
          )}
          {isManager && !showAddForm && !showArchived && (
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              + Add Notice
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search notices..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={filterCategory}
          onValueChange={(value: Category | "all") => setFilterCategory(value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryConfig).map(([key, config]) => {
              const Icon = config.icon
              return (
                <SelectItem
                  key={key}
                  value={key}
                >
                  <span className={`flex items-center gap-1.5 ${config.color}`}>
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && isManager && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">
                {editingNotice ? "Edit Notice" : "Add New Notice"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="space-y-3"
            >
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="title">Title</Label>
                  <span
                    className={`text-xs ${title.length > 90 ? "text-amber-600" : "text-gray-400"}`}
                  >
                    {title.length}/100
                  </span>
                </div>
                <Input
                  id="title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Notice title"
                  maxLength={100}
                  required
                />
              </div>
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="content">Content</Label>
                  <span
                    className={`text-xs ${content.length > 900 ? "text-amber-600" : "text-gray-400"}`}
                  >
                    {content.length}/1000
                  </span>
                </div>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setContent(e.target.value)
                  }
                  placeholder="Notice content"
                  rows={3}
                  maxLength={1000}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(value: Priority) => setPriority(value)}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">
                        <span className="text-red-600">Urgent</span>
                      </SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">
                        <span className="text-blue-600">Low</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={category}
                    onValueChange={(value: Category) => setCategory(value)}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryConfig).map(([key, config]) => {
                        const Icon = config.icon
                        return (
                          <SelectItem
                            key={key}
                            value={key}
                          >
                            <span className={`flex items-center gap-1.5 ${config.color}`}>
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="expires_at">Expires On (optional)</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for no expiration
                </p>
              </div>
              <div>
                <Label htmlFor="attachment">Attachment (optional)</Label>
                <Input
                  id="attachment"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={e => setAttachment(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {existingAttachment && !attachment && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <Paperclip className="h-4 w-4" />
                    <span>{existingAttachment.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-red-600"
                      onClick={() => setExistingAttachment(null)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
                {attachment && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <Paperclip className="h-4 w-4" />
                    <span>{attachment.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-red-600"
                      onClick={() => setAttachment(null)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Supported: PDF, PNG, JPG, GIF, WebP
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingNotice
                      ? "Update"
                      : "Add"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notices List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredNotices.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-sm text-gray-500">
                {notices.length === 0
                  ? "No notices yet."
                  : "No notices match your search."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotices.map(notice => (
            <Card
              key={notice.id}
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
                        {new Date(notice.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
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
                            {new Date(notice.expires_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
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
                        onClick={() => handleTogglePin(notice.id, notice.is_pinned)}
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
                        onClick={() => handleEdit(notice)}
                        className="h-8 w-8 p-0"
                        title="Edit notice"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleToggleArchive(notice.id, notice.is_archived)
                        }
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
                        onClick={() => handleDelete(notice.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete notice permanently"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {notice.content}
                </p>
                {notice.attachment_url && notice.attachment_name && (
                  <a
                    href={notice.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 mt-3 p-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    {notice.attachment_type?.startsWith("image/") ? (
                      <Image className="h-4 w-4 text-blue-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                      {notice.attachment_name}
                    </span>
                    <span className="text-xs text-gray-500">View</span>
                  </a>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
