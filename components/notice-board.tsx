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
import { Pencil, Trash2, X } from "lucide-react"

interface Notice {
  id: string
  title: string
  content: string
  created_at: string
  created_by: string | null
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
  const [isSubmitting, setIsSubmitting] = useState(false)

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

      if (editingNotice) {
        // Update existing notice
        const { error: updateError } = await supabase
          .from("notices")
          .update({
            title: title.trim(),
            content: content.trim(),
          })
          .eq("id", editingNotice.id)

        if (updateError) throw updateError
      } else {
        // Create new notice
        const { error: insertError } = await supabase.from("notices").insert({
          building_id: buildingId,
          title: title.trim(),
          content: content.trim(),
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
        <h3 className="font-semibold text-lg">Notices</h3>
        {isManager && !showAddForm && (
          <Button
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            + Add Notice
          </Button>
        )}
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
                <Label htmlFor="title">Title</Label>
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
                <Label htmlFor="content">Content</Label>
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
        {notices.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-sm text-gray-500">
                No notices yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          notices.map(notice => (
            <Card key={notice.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-sm font-semibold">
                      {notice.title}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {notice.author
                        ? `${notice.author.first_name} ${notice.author.last_name}`
                        : "Unknown"}{" "}
                      ·{" "}
                      {new Date(notice.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </CardDescription>
                  </div>
                  {isManager && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(notice)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(notice.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
