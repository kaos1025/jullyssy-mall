"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import dayjs from "dayjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import EventCategoryChip from "@/components/events/EventCategoryChip"
import { isValidHexColor, type EventCategory } from "@/lib/events-utils"

interface Props {
  category?: EventCategory
}

interface FormState {
  name: string
  emoji: string
  color: string
  link_url: string
  is_active: boolean
  starts_at: string
  ends_at: string
  display_order: number
}

const DEFAULT_COLOR = "#FF6B9D"

const toLocalInput = (iso: string | null | undefined): string =>
  iso ? dayjs(iso).format("YYYY-MM-DDTHH:mm") : ""

const toIsoOrNull = (local: string): string | null =>
  local ? new Date(local).toISOString() : null

const EventCategoryForm = ({ category }: Props) => {
  const router = useRouter()
  const { toast } = useToast()

  const [form, setForm] = useState<FormState>({
    name: category?.name ?? "",
    emoji: category?.emoji ?? "",
    color: category?.color ?? DEFAULT_COLOR,
    link_url: category?.link_url ?? "",
    is_active: category?.is_active ?? true,
    starts_at: toLocalInput(category?.starts_at),
    ends_at: toLocalInput(category?.ends_at),
    display_order: category?.display_order ?? 0,
  })
  const [submitting, setSubmitting] = useState(false)

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "이름을 입력하세요" })
      return
    }
    if (!isValidHexColor(form.color)) {
      toast({
        variant: "destructive",
        title: "색상은 #RRGGBB 형식이어야 합니다",
      })
      return
    }
    const trimmedUrl = form.link_url.trim()
    if (!trimmedUrl) {
      toast({ variant: "destructive", title: "링크 URL을 입력하세요" })
      return
    }
    if (!/^https?:\/\//i.test(trimmedUrl) && !trimmedUrl.startsWith("/")) {
      toast({
        variant: "destructive",
        title: "링크 URL은 http(s):// 또는 / 로 시작해야 합니다",
      })
      return
    }
    if (
      form.starts_at &&
      form.ends_at &&
      new Date(form.starts_at) >= new Date(form.ends_at)
    ) {
      toast({
        variant: "destructive",
        title: "종료 일시는 시작 일시보다 이후여야 합니다",
      })
      return
    }

    const body = {
      name: form.name.trim(),
      emoji: form.emoji.trim() || null,
      color: form.color,
      link_url: trimmedUrl,
      is_active: form.is_active,
      starts_at: toIsoOrNull(form.starts_at),
      ends_at: toIsoOrNull(form.ends_at),
      display_order: form.display_order,
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        category
          ? `/api/admin/event-categories/${category.id}`
          : "/api/admin/event-categories",
        {
          method: category ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: "destructive",
          title: "저장 실패",
          description: data.error ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: category ? "수정 완료" : "등록 완료" })
      router.push("/admin/event-categories")
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  // 실시간 미리보기용 가짜 객체
  const previewCategory = {
    name: form.name.trim() || "이벤트 이름",
    emoji: form.emoji.trim() || null,
    color: isValidHexColor(form.color) ? form.color : DEFAULT_COLOR,
    link_url: form.link_url || "/",
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">미리보기</Label>
        <div className="rounded border p-4 bg-muted/20">
          <EventCategoryChip category={previewCategory} asLink={false} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          GNB에 노출될 칩 모양을 실시간으로 확인합니다
        </p>
      </div>

      <Separator />

      {/* 이름 (필수) */}
      <div>
        <Label htmlFor="name">이름 *</Label>
        <Input
          id="name"
          maxLength={50}
          placeholder="예: 벚꽃놀이코디"
          value={form.name}
          onChange={(e) => updateForm("name", e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-1">
          {form.name.length} / 50
        </div>
      </div>

      {/* 이모지 */}
      <div>
        <Label htmlFor="emoji">이모지</Label>
        <Input
          id="emoji"
          maxLength={8}
          placeholder="예: 🌸 (Mac: ⌃⌘Space / Win: ⊞ + .)"
          value={form.emoji}
          onChange={(e) => updateForm("emoji", e.target.value)}
        />
      </div>

      {/* 색상 — color picker + hex 텍스트 양방향 동기화 */}
      <div>
        <Label htmlFor="color_hex">색상 *</Label>
        <div className="flex items-center gap-3">
          <input
            id="color_picker"
            type="color"
            className="h-10 w-14 rounded border cursor-pointer"
            value={isValidHexColor(form.color) ? form.color : DEFAULT_COLOR}
            onChange={(e) => updateForm("color", e.target.value.toUpperCase())}
            aria-label="색상 선택"
          />
          <Input
            id="color_hex"
            className="font-mono uppercase"
            placeholder="#FF6B9D"
            maxLength={7}
            value={form.color}
            onChange={(e) => updateForm("color", e.target.value.toUpperCase())}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          #RRGGBB 형식 (단축형 #FFF 비허용)
        </p>
      </div>

      {/* 링크 URL (필수) */}
      <div>
        <Label htmlFor="link_url">링크 URL *</Label>
        <Input
          id="link_url"
          maxLength={500}
          placeholder="/products?search=봄코디"
          value={form.link_url}
          onChange={(e) => updateForm("link_url", e.target.value)}
        />
        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <p>
            내부 페이지: <code>/products?search=봄코디</code> (상품 검색) 또는{" "}
            <code>/events/봄코디</code>
          </p>
          <p>
            외부 링크: <code>https://example.com</code> (자동으로 새 탭에서 열림)
          </p>
        </div>
      </div>

      {/* 활성화 */}
      <div className="flex items-center gap-3">
        <Switch
          id="is_active"
          checked={form.is_active}
          onCheckedChange={(v) => updateForm("is_active", v)}
        />
        <Label htmlFor="is_active">활성화</Label>
      </div>

      {/* 노출 기간 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="starts_at">시작 일시 (선택)</Label>
          <Input
            id="starts_at"
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => updateForm("starts_at", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">비우면 즉시</p>
        </div>
        <div>
          <Label htmlFor="ends_at">종료 일시 (선택)</Label>
          <Input
            id="ends_at"
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => updateForm("ends_at", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">비우면 무기한</p>
        </div>
      </div>

      {/* 정렬 순서 */}
      <div>
        <Label htmlFor="display_order">정렬 순서</Label>
        <Input
          id="display_order"
          type="number"
          min={0}
          max={9999}
          value={form.display_order}
          onChange={(e) =>
            updateForm("display_order", parseInt(e.target.value) || 0)
          }
        />
        <p className="text-xs text-muted-foreground mt-1">
          낮을수록 GNB에서 먼저 노출
        </p>
      </div>

      {/* 액션 */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/event-categories")}
          disabled={submitting}
        >
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "저장 중..." : category ? "수정" : "등록"}
        </Button>
      </div>
    </div>
  )
}

export default EventCategoryForm
