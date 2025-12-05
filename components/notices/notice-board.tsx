"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Archive } from "lucide-react"
import { Notice, Priority, Category, NoticeAttachment } from "./types"
import { MAX_FILES_PER_NOTICE } from "./config"
import { NoticeFilters } from "./notice-filters"
import { NoticeForm } from "./notice-form"
import { NoticeCard } from "./notice-card"
import { useNoticeReadReceipts } from "@/hooks/use-notice-read-receipts"

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
  const [totalResidents, setTotalResidents] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { markAsRead } = useNoticeReadReceipts(null)

  // Form state
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState<Priority>("normal")
  const [category, setCategory] = useState<Category>("general")
  const [expiresAt, setExpiresAt] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<
    NoticeAttachment[]
  >([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all")
  const [showArchived, setShowArchived] = useState(false)

  // Filter notices based on search, category, expiration, and archive status
  const filteredNotices = notices.filter(notice => {
    if (!showArchived && notice.is_archived) return false
    if (showArchived && !notice.is_archived) return false
    // Check expiration - compare at end of day so same-day notices still show
    if (!showArchived && notice.expires_at) {
      const expiryDate = new Date(notice.expires_at)
      expiryDate.setHours(23, 59, 59, 999) // End of expiry day
      if (expiryDate < new Date()) return false
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
          author:profiles!created_by(first_name, last_name),
          attachments:notice_attachments(id, notice_id, file_name, file_path, file_type, file_size, created_at)
        `,
        )
        .eq("building_id", buildingId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })

      if (noticesError) throw noticesError
      setNotices(data || [])

      // Load total residents count (for read receipt percentage)
      const { count } = await supabase
        .from("building_residents")
        .select("*", { count: "exact", head: true })
        .eq("building_id", buildingId)
        .eq("is_approved", true)

      // Add 1 for the manager
      setTotalResidents((count || 0) + 1)
    } catch (err: any) {
      setError(err.message || "Failed to load notices")
    } finally {
      setLoading(false)
    }
  }

  // Mark notices as read for non-managers
  useEffect(() => {
    if (!isManager && notices.length > 0) {
      // Mark all visible non-archived notices as read
      const visibleNotices = notices.filter(
        n =>
          !n.is_archived &&
          (!n.expires_at || new Date(n.expires_at) > new Date()),
      )
      visibleNotices.forEach(notice => {
        markAsRead(notice.id)
      })
    }
  }, [notices, isManager, markAsRead])

  useEffect(() => {
    if (buildingId) {
      loadNotices()

      const supabase = createClient()
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
          () => loadNotices(),
        )
        .subscribe()

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
    setSelectedFiles([])
    setExistingAttachments([])
    setShowAddForm(false)
    setEditingNotice(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const currentCount = selectedFiles.length + existingAttachments.length
    const availableSlots = MAX_FILES_PER_NOTICE - currentCount

    if (availableSlots <= 0) {
      alert(`Maximum ${MAX_FILES_PER_NOTICE} files per notice`)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const filesToAdd = files.slice(0, availableSlots)
    if (files.length > availableSlots) {
      alert(
        `Only adding ${availableSlots} file(s). Maximum ${MAX_FILES_PER_NOTICE} files per notice.`,
      )
    }

    setSelectedFiles(prev => [...prev, ...filesToAdd])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadFiles = async (noticeId: string, files: File[]) => {
    const supabase = createClient()

    for (const file of files) {
      const fileExt = file.name.split(".").pop()
      const fileName = `${buildingId}/${noticeId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from("notice-attachments")
        .upload(fileName, file)

      if (uploadError) {
        console.error("Error uploading file:", uploadError)
        continue
      }

      const { error: dbError } = await supabase
        .from("notice_attachments")
        .insert({
          notice_id: noticeId,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
        })

      if (dbError) console.error("Error creating attachment record:", dbError)
    }
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

      if (!user) throw new Error("You must be logged in to add notices")

      const { data: building, error: buildingError } = await supabase
        .from("buildings")
        .select("manager_id")
        .eq("id", buildingId)
        .single()

      if (buildingError || !building) throw new Error("Building not found")
      if (building.manager_id !== user.id)
        throw new Error(
          "You are not authorized to manage notices for this building",
        )

      if (editingNotice) {
        const { error: updateError } = await supabase
          .from("notices")
          .update({
            title: title.trim(),
            content: content.trim(),
            priority,
            category,
            expires_at: expiresAt || null,
          })
          .eq("id", editingNotice.id)

        if (updateError) throw updateError

        // Delete removed attachments
        const existingIds = existingAttachments.map(a => a.id)
        const originalIds = editingNotice.attachments?.map(a => a.id) || []
        const removedIds = originalIds.filter(id => !existingIds.includes(id))

        if (removedIds.length > 0) {
          for (const id of removedIds) {
            const attachment = editingNotice.attachments?.find(a => a.id === id)
            if (attachment) {
              await supabase.storage
                .from("notice-attachments")
                .remove([attachment.file_path])
            }
          }
          await supabase
            .from("notice_attachments")
            .delete()
            .in("id", removedIds)
        }

        if (selectedFiles.length > 0) {
          await uploadFiles(editingNotice.id, selectedFiles)
        }
      } else {
        const { data: newNotice, error: insertError } = await supabase
          .from("notices")
          .insert({
            building_id: buildingId,
            title: title.trim(),
            content: content.trim(),
            priority,
            category,
            expires_at: expiresAt || null,
            created_by: user.id,
          })
          .select()
          .single()

        if (insertError) throw insertError

        if (selectedFiles.length > 0 && newNotice) {
          await uploadFiles(newNotice.id, selectedFiles)
        }

        // Send email notifications for new notices (not edits)
        if (newNotice) {
          try {
            await fetch("/api/send-notice-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                notice_id: newNotice.id,
                building_id: buildingId,
              }),
            })
          } catch (emailError) {
            console.error("Failed to send email notifications:", emailError)
            // Don't throw - email failure shouldn't break notice creation
          }
        }
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
    setSelectedFiles([])
    setExistingAttachments(notice.attachments || [])
    setShowAddForm(true)
  }

  const handleDelete = async (noticeId: string) => {
    if (!confirm("Are you sure you want to delete this notice?")) return

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

  const handleTogglePin = async (
    noticeId: string,
    currentlyPinned: boolean,
  ) => {
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
        <p className="text-sm text-muted-foreground">Loading notices...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
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

      <div className="flex-shrink-0">
        <NoticeFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterCategory={filterCategory}
          onCategoryChange={setFilterCategory}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex-shrink-0">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {showAddForm && isManager ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <NoticeForm
            editingNotice={editingNotice}
            onClose={resetForm}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            priority={priority}
            setPriority={setPriority}
            category={category}
            setCategory={setCategory}
            expiresAt={expiresAt}
            setExpiresAt={setExpiresAt}
            selectedFiles={selectedFiles}
            existingAttachments={existingAttachments}
            fileInputRef={fileInputRef}
            onFileSelect={() => fileInputRef.current?.click()}
            onRemoveSelectedFile={index =>
              setSelectedFiles(prev => prev.filter((_, i) => i !== index))
            }
            onRemoveExistingAttachment={id =>
              setExistingAttachments(prev => prev.filter(a => a.id !== id))
            }
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {filteredNotices.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-sm text-muted-foreground">
                  {notices.length === 0
                    ? "No notices yet."
                    : "No notices match your search."}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredNotices.map(notice => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                isManager={isManager}
                totalResidents={totalResidents}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
                onToggleArchive={handleToggleArchive}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
