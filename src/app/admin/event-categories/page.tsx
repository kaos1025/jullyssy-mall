"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dayjs from "dayjs"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import EventCategoryChip from "@/components/events/EventCategoryChip"
import type { EventCategory } from "@/lib/events-utils"

type EventCategoryWithCount = EventCategory & { product_count: number }

const formatPeriod = (cat: EventCategory): string => {
  const { starts_at, ends_at } = cat
  if (!starts_at && !ends_at) return "상시"

  const fmt = (iso: string) => dayjs(iso).format("YY.MM.DD HH:mm")
  const now = new Date()

  if (starts_at && ends_at) {
    if (new Date(ends_at) < now) return `종료 (${fmt(ends_at)})`
    return `${fmt(starts_at)} ~ ${fmt(ends_at)}`
  }
  if (starts_at) {
    if (new Date(starts_at) > now) return `예약 (${fmt(starts_at)} ~)`
    return `${fmt(starts_at)} ~`
  }
  if (ends_at) {
    if (new Date(ends_at) < now) return `종료 (${fmt(ends_at)})`
    return `~ ${fmt(ends_at)}`
  }
  return "상시"
}

const AdminEventCategoriesPage = () => {
  const router = useRouter()
  const { toast } = useToast()
  const [categories, setCategories] = useState<EventCategoryWithCount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/event-categories")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "이벤트 카테고리 목록 불러오기 실패",
        description: data.error ?? `HTTP ${res.status}`,
      })
      setCategories([])
      setLoading(false)
      return
    }
    const data = (await res.json()) as EventCategoryWithCount[]
    setCategories(data)
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleToggleActive = async (cat: EventCategoryWithCount, next: boolean) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_active: next } : c))
    )
    const res = await fetch(`/api/admin/event-categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === cat.id ? { ...c, is_active: cat.is_active } : c
        )
      )
      const data = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "활성 상태 변경 실패",
        description: data.error ?? `HTTP ${res.status}`,
      })
      return
    }
    toast({ title: next ? "활성화됨" : "비활성화됨" })
  }

  const handleDelete = async (cat: EventCategoryWithCount) => {
    if (!confirm(`"${cat.name}" 이벤트 카테고리를 삭제하시겠습니까?`)) return

    const res = await fetch(`/api/admin/event-categories/${cat.id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: data.error ?? `HTTP ${res.status}`,
      })
      return
    }
    setCategories((prev) => prev.filter((c) => c.id !== cat.id))
    toast({ title: "삭제 완료" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">이벤트 카테고리 관리</h1>
        <Button asChild>
          <Link href="/admin/event-categories/new">
            <Plus className="h-4 w-4 mr-2" />
            신규 등록
          </Link>
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-center w-16">정렬</th>
              <th className="p-3 text-center w-20">활성</th>
              <th className="p-3 text-left w-48">미리보기</th>
              <th className="p-3 text-left">이름</th>
              <th className="p-3 text-center w-24 hidden md:table-cell">매칭</th>
              <th className="p-3 text-left hidden lg:table-cell">노출 기간</th>
              <th className="p-3 text-center w-32">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-10 text-muted-foreground"
                >
                  불러오는 중...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <div className="space-y-3">
                    <p className="text-muted-foreground">
                      등록된 이벤트 카테고리가 없습니다
                    </p>
                    <Button asChild size="sm">
                      <Link href="/admin/event-categories/new">
                        <Plus className="h-4 w-4 mr-2" />
                        신규 등록
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 text-center font-mono text-xs">
                    {cat.display_order}
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={cat.is_active}
                      onCheckedChange={(v) => handleToggleActive(cat, v)}
                    />
                  </td>
                  <td className="p-3">
                    <EventCategoryChip category={cat} asLink={false} />
                  </td>
                  <td className="p-3">{cat.name}</td>
                  <td className="p-3 text-center hidden md:table-cell">
                    <span
                      className={`text-xs ${
                        cat.product_count === 0
                          ? "text-muted-foreground/60"
                          : "font-medium"
                      }`}
                    >
                      {cat.product_count}건
                    </span>
                  </td>
                  <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {formatPeriod(cat)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/admin/event-categories/${cat.id}`)
                        }
                      >
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cat)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminEventCategoriesPage
