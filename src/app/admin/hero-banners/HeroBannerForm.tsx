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
import type { HeroBanner } from "@/lib/hero-banners"

interface Props {
  banner?: HeroBanner
}

const toLocalInput = (iso: string | null | undefined): string =>
  iso ? dayjs(iso).format("YYYY-MM-DDTHH:mm") : ""

const toIsoOrNull = (local: string): string | null =>
  local ? new Date(local).toISOString() : null

const HeroBannerForm = ({ banner }: Props) => {
  const router = useRouter()
  const { toast } = useToast()

  const [title, setTitle] = useState(banner?.title ?? "")
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "")
  const [ctaText, setCtaText] = useState(banner?.cta_text ?? "")
  const [ctaLink, setCtaLink] = useState(banner?.cta_link ?? "")
  const [isActive, setIsActive] = useState(banner?.is_active ?? true)
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.starts_at))
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.ends_at))
  const [sortOrder, setSortOrder] = useState(banner?.sort_order ?? 0)

  const [pcFile, setPcFile] = useState<File | null>(null)
  const [mobileFile, setMobileFile] = useState<File | null>(null)
  const [pcPreview, setPcPreview] = useState(banner?.image_url_pc ?? "")
  const [mobilePreview, setMobilePreview] = useState(banner?.image_url_mobile ?? "")
  const [submitting, setSubmitting] = useState(false)

  const onPickPc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setPcFile(f)
      setPcPreview(URL.createObjectURL(f))
    }
  }
  const onPickMobile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setMobileFile(f)
      setMobilePreview(URL.createObjectURL(f))
    }
  }

  const handleSubmit = async () => {
    // 생성 시 이미지 PC/모바일 둘 다 필수
    if (!banner && (!pcFile || !mobileFile)) {
      toast({
        variant: "destructive",
        title: "PC/모바일 이미지를 모두 업로드하세요",
      })
      return
    }
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      toast({
        variant: "destructive",
        title: "종료 일시는 시작 일시보다 이후여야 합니다",
      })
      return
    }

    const fd = new FormData()
    fd.append(
      "payload",
      JSON.stringify({
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        cta_text: ctaText.trim() || null,
        cta_link: ctaLink.trim() || null,
        is_active: isActive,
        starts_at: toIsoOrNull(startsAt),
        ends_at: toIsoOrNull(endsAt),
        sort_order: sortOrder,
      })
    )
    if (pcFile) fd.append("image_pc", pcFile)
    if (mobileFile) fd.append("image_mobile", mobileFile)

    setSubmitting(true)
    try {
      const res = await fetch(
        banner ? `/api/admin/hero-banners/${banner.id}` : "/api/admin/hero-banners",
        {
          method: banner ? "PATCH" : "POST",
          body: fd,
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
      router.push("/admin/hero-banners")
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 이미지 업로드 (PC/모바일 분리) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>
            PC 이미지 *{" "}
            <span className="text-xs text-muted-foreground">(권장 1920×400)</span>
          </Label>
          <input
            type="file"
            accept="image/*"
            onChange={onPickPc}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5"
          />
          {pcPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pcPreview}
              alt="PC 미리보기"
              className="mt-2 w-full h-32 object-cover rounded border bg-muted"
            />
          )}
        </div>
        <div>
          <Label>
            모바일 이미지 *{" "}
            <span className="text-xs text-muted-foreground">(권장 750×600)</span>
          </Label>
          <input
            type="file"
            accept="image/*"
            onChange={onPickMobile}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5"
          />
          {mobilePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mobilePreview}
              alt="모바일 미리보기"
              className="mt-2 w-40 h-32 object-cover rounded border bg-muted mx-auto"
            />
          )}
        </div>
      </div>
      {banner && (
        <p className="text-xs text-muted-foreground">
          이미지를 다시 선택하지 않으면 기존 이미지가 유지됩니다.
        </p>
      )}

      <Separator />

      {/* 제목 / 부제목 */}
      <div>
        <Label htmlFor="title">제목 (캐치프레이즈)</Label>
        <Input
          id="title"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: SUMMER COLLECTION"
        />
      </div>
      <div>
        <Label htmlFor="subtitle">부제목</Label>
        <Input
          id="subtitle"
          maxLength={200}
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="예: 2025 여름 신상 컬렉션"
        />
      </div>

      {/* CTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cta_text">버튼 텍스트</Label>
          <Input
            id="cta_text"
            maxLength={200}
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="예: 여름 신상 보기"
          />
          <p className="text-xs text-muted-foreground mt-1">
            비우면 버튼이 표시되지 않습니다
          </p>
        </div>
        <div>
          <Label htmlFor="cta_link">버튼 링크</Label>
          <Input
            id="cta_link"
            maxLength={500}
            value={ctaLink}
            onChange={(e) => setCtaLink(e.target.value)}
            placeholder="/products?sort=newest 또는 https://..."
          />
        </div>
      </div>

      {/* 활성화 */}
      <div className="flex items-center gap-3">
        <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="is_active">활성화</Label>
      </div>

      {/* 노출 기간 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="starts_at">시작 일시</Label>
          <Input
            id="starts_at"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">비우면 즉시</p>
        </div>
        <div>
          <Label htmlFor="ends_at">종료 일시</Label>
          <Input
            id="ends_at"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
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
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
        />
        <p className="text-xs text-muted-foreground mt-1">낮을수록 먼저 노출</p>
      </div>

      {/* 액션 */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/hero-banners")}
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

export default HeroBannerForm
