"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { EventProductSort } from "@/lib/events-utils"

interface Props {
  categoryId: string
  currentSort: EventProductSort
}

const SORT_OPTIONS: { value: EventProductSort; label: string }[] = [
  { value: "admin", label: "추천순" },
  { value: "newest", label: "최신순" },
  { value: "price_asc", label: "낮은가격순" },
]

const EventSortSelect = ({ categoryId, currentSort }: Props) => {
  const router = useRouter()

  const handleChange = (next: string) => {
    const params = new URLSearchParams()
    // 'admin'은 기본값이므로 query string에 포함하지 않음 (URL 단순화)
    if (next !== "admin") params.set("sort", next)
    const qs = params.toString()
    router.push(`/events/${categoryId}${qs ? `?${qs}` : ""}`)
  }

  return (
    <Select value={currentSort} onValueChange={handleChange}>
      <SelectTrigger className="w-[130px] h-9 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default EventSortSelect
