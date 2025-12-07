import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"
import { Category } from "./types"
import { categoryConfig } from "./config"

interface NoticeFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filterCategory: Category | "all"
  onCategoryChange: (category: Category | "all") => void
}

export function NoticeFilters({
  searchQuery,
  onSearchChange,
  filterCategory,
  onCategoryChange,
}: NoticeFiltersProps) {
  return (
    <div className="flex gap-2 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search notices..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-8 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        />
      </div>
      <Select
        value={filterCategory}
        onValueChange={onCategoryChange}
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
  )
}
