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
import TopBannerCarousel from "@/components/banners/TopBannerCarousel"
import type { TopBanner } from "@/lib/banners"

interface Props {
  banner?: TopBanner
}

interface FormState {
  emoji: string
  message: string
  link_url: string
  variant: "normal" | "urgent"
  bg_color: string
  text_color: string
  is_active: boolean
  starts_at: string
  ends_at: string
  sort_order: number
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

const toLocalInput = (iso: string | null | undefined): string =>
  iso ? dayjs(iso).format("YYYY-MM-DDTHH:mm") : ""

const toIsoOrNull = (local: string): string | null =>
  local ? new Date(local).toISOString() : null

const BannerForm = ({ banner }: Props) => {
  const router = useRouter()
  const { toast } = useToast()

  const [form, setForm] = useState<FormState>({
    emoji: banner?.emoji ?? "",
    message: banner?.message ?? "",
    link_url: banner?.link_url ?? "",
    variant: (banner?.variant === "urgent" ? "urgent" : "normal"),
    bg_color: banner?.bg_color ?? "",
    text_color: banner?.text_color ?? "",
    is_active: banner?.is_active ?? true,
    starts_at: toLocalInput(banner?.starts_at),
    ends_at: toLocalInput(banner?.ends_at),
    sort_order: banner?.sort_order ?? 0,
  })
  const [submitting, setSubmitting] = useState(false)

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!form.message.trim()) {
      toast({ variant: "destructive", title: "메시지를 입력하세요" })
      return
    }
    if (form.bg_color && !HEX_COLOR_REGEX.test(form.bg_color)) {
      toast({ variant: "destructive", title: "배경색은 #RRGGBB 형식" })
      return
    }
    if (form.text_color && !HEX_COLOR_REGEX.test(form.text_color)) {
      toast({ variant: "destructive", title: "텍스트색은 #RRGGBB 형식" })
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
      emoji: form.emoji.trim() || null,
      message: form.message.trim(),
      link_url: form.link_url.trim() || null,
      variant: form.variant,
      bg_color: form.bg_color.trim() || null,
      text_color: form.text_color.trim() || null,
      is_active: form.is_active,
      starts_at: toIsoOrNull(form.starts_at),
      ends_at: toIsoOrNull(form.ends_at),
      sort_order: form.sort_order,
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        banner ? `/api/admin/banners/${banner.id}` : "/api/admin/banners",
        {
          method: banner ? "PATCH" : "POST",
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
      toast({ title: banner ? "수정 완료" : "등록 완료" })
      router.push("/admin/banners")
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  // 실시간 미리보기용 가짜 banner 객체 (단일 배너 모드)
  const previewBanner: TopBanner = {
    id: "preview",
    emoji: form.emoji.trim() || null,
    message: form.message.trim() || "미리보기 메시지",
    link_url: null,
    variant: form.variant,
    bg_color: form.bg_color.trim() || null,
    text_color: form.text_color.trim() || null,
    is_active: true,
    starts_at: null,
    ends_at: null,
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">미리보기</Label>
        <div className="rounded overflow-hidden border">
          <TopBannerCarousel banners={[previewBanner]} />
        </div>
      </div>

      <Separator />

      {/* 메시지 (필수) */}
      <div>
        <Label htmlFor="message">메시지 *</Label>
        <textarea
          id="message"
          className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
          rows={2}
          maxLength={200}
          value={form.message}
          onChange={(e) => updateForm("message", e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-1">
          {form.message.length} / 200
        </div>
      </div>

      {/* 이모지 */}
      <div>
        <Label htmlFor="emoji">이모지</Label>
        <Input
          id="emoji"
          maxLength={8}
          placeholder="예: 🎁 (Mac: ⌃⌘Space / Win: ⊞ + .)"
          value={form.emoji}
          onChange={(e) => updateForm("emoji", e.target.value)}
        />
      </div>

      {/* 링크 URL */}
      <div>
        <Label htmlFor="link_url">링크 URL</Label>
        <Input
          id="link_url"
          maxLength={500}
          placeholder="/products?tag=spring 또는 https://..."
          value={form.link_url}
          onChange={(e) => updateForm("link_url", e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          비워두면 클릭해도 이동하지 않습니다
        </p>
      </div>

      {/* variant — segmented Button */}
      <div>
        <Label className="mb-2 block">스타일</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={form.variant === "normal" ? "default" : "outline"}
            onClick={() => updateForm("variant", "normal")}
            size="sm"
          >
            일반
          </Button>
          <Button
            type="button"
            variant={form.variant === "urgent" ? "default" : "outline"}
            onClick={() => updateForm("variant", "urgent")}
            size="sm"
            className={
              form.variant === "urgent" ? "bg-red-600 hover:bg-red-700" : ""
            }
          >
            긴급(빨강)
          </Button>
        </div>
      </div>

      {/* 색상 (선택) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bg_color">배경색 (선택)</Label>
          <Input
            id="bg_color"
            placeholder="#1F2937"
            value={form.bg_color}
            onChange={(e) => updateForm("bg_color", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            비우면 스타일 기본값
          </p>
        </div>
        <div>
          <Label htmlFor="text_color">텍스트색 (선택)</Label>
          <Input
            id="text_color"
            placeholder="#FFFFFF"
            value={form.text_color}
            onChange={(e) => updateForm("text_color", e.target.value)}
          />
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
        <Label htmlFor="sort_order">정렬 순서</Label>
        <Input
          id="sort_order"
          type="number"
          min={0}
          max={9999}
          value={form.sort_order}
          onChange={(e) =>
            updateForm("sort_order", parseInt(e.target.value) || 0)
          }
        />
        <p className="text-xs text-muted-foreground mt-1">
          낮을수록 캐러셀에서 먼저 노출
        </p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/banners")}
          disabled={submitting}
        >
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "저장 중..." : banner ? "수정" : "등록"}
        </Button>
      </div>
    </div>
  )
}

export default BannerForm
