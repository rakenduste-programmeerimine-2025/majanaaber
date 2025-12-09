"use client"

import { RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileText, ImageIcon, Paperclip, X } from "lucide-react"
import { Priority, Category, Notice, NoticeAttachment } from "./types"
import { categoryConfig, MAX_FILES_PER_NOTICE, formatFileSize } from "./config"

interface NoticeFormProps {
  editingNotice: Notice | null
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  // Form state
  title: string
  setTitle: (value: string) => void
  content: string
  setContent: (value: string) => void
  priority: Priority
  setPriority: (value: Priority) => void
  category: Category
  setCategory: (value: Category) => void
  expiresAt: string
  setExpiresAt: (value: string) => void
  selectedFiles: File[]
  existingAttachments: NoticeAttachment[]
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileSelect: () => void
  onRemoveSelectedFile: (index: number) => void
  onRemoveExistingAttachment: (id: string) => void
}

export function NoticeForm({
  editingNotice,
  onClose,
  onSubmit,
  isSubmitting,
  title,
  setTitle,
  content,
  setContent,
  priority,
  setPriority,
  category,
  setCategory,
  expiresAt,
  setExpiresAt,
  selectedFiles,
  existingAttachments,
  fileInputRef,
  onFileSelect,
  onRemoveSelectedFile,
  onRemoveExistingAttachment,
}: NoticeFormProps) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">
            {editingNotice ? "Edit Notice" : "Add New Notice"}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="space-y-3"
        >
          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="title">Title</Label>
              <span
                className={`text-xs ${title.length > 90 ? "text-amber-600" : "text-muted-foreground"}`}
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
                className={`text-xs ${content.length > 900 ? "text-amber-600" : "text-muted-foreground"}`}
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
                onValueChange={setPriority}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">
                    <span className="text-destructive">Urgent</span>
                  </SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">
                    <span className="text-primary">Low</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={setCategory}
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
                        <span
                          className={`flex items-center gap-1.5 ${config.color}`}
                        >
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
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for no expiration
            </p>
          </div>

          {/* Multiple Files Upload */}
          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="attachments">Attachments (optional)</Label>
              <span className="text-xs text-muted-foreground">
                {selectedFiles.length + existingAttachments.length}/
                {MAX_FILES_PER_NOTICE}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-1"
              onClick={onFileSelect}
              disabled={
                selectedFiles.length + existingAttachments.length >=
                MAX_FILES_PER_NOTICE
              }
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Add Files
            </Button>

            {/* Existing attachments (when editing) */}
            {existingAttachments.length > 0 && (
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                <p className="text-xs text-muted-foreground font-medium">
                  Current attachments:
                </p>
                {existingAttachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 p-2 bg-muted/20 rounded border"
                  >
                    {attachment.file_type.startsWith("image/") ? (
                      <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    <span className="text-sm truncate flex-1">
                      {attachment.file_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
                      onClick={() => onRemoveExistingAttachment(attachment.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                <p className="text-xs text-muted-foreground font-medium">
                  New files to upload:
                </p>
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-primary/10 rounded border border-primary/20"
                  >
                    {file.type.startsWith("image/") ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <FileText className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground\">
                      {formatFileSize(file.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
                      onClick={() => onRemoveSelectedFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-1\">
              Supported: PDF, PNG, JPG, GIF, WebP (max {MAX_FILES_PER_NOTICE}{" "}
              files)
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : editingNotice ? "Update" : "Add"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
