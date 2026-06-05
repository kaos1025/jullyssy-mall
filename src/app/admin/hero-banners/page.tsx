"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dayjs from "dayjs"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import type { HeroBanner } from "@/lib/hero-banners"

const formatPeriod = (banner: HeroBanner): string => {
  const { starts_at, ends_at } = banner
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

const AdminHeroBannersPage = () => {
  const router = useRouter()
  const { toast } = useToast()
  const [banners, setBanners] = useState<HeroBanner[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBanners = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/hero-banners")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "메인 배너 목록 불러오기 실패",
        description: data.error ?? `HTTP ${res.status}`,
      })
      setBanners([])
      setLoading(false)
      return
    }
    setBanners((await res.json()) as HeroBanner[])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchBanners()
  }, [fetchBanners])

  const handleToggleActive = async (banner: HeroBanner, next: boolean) => {
    // optimistic
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, is_active: next } : b))
    )
    const fd = new FormData()
    fd.append("payload", JSON.stringify({ is_active: next }))
    const res = await fetch(`/api/admin/hero-banners/${banner.id}`, {
      method: "PATCH",
      body: fd,
    })
    if (!res.ok) {
      setBanners((prev) =>
        prev.map((b) =>
          b.id === banner.id ? { ...b, is_active: banner.is_active } : b
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

  const handleDelete = async (banner: HeroBanner) => {
    if (!confirm(`"${banner.title ?? "(제목 없음)"}" 배너를 삭제하시겠습니까?`)) return

    const res = await fetch(`/api/admin/hero-banners/${banner.id}`, {
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
    setBanners((prev) => prev.filter((b) => b.id !== banner.id))
    toast({ title: "삭제 완료" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">메인 배너 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            홈 상단 히어로 배너 (권장 PC 1920×400 / 모바일 750×600)
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/hero-banners/new">
            <Plus className="h-4 w-4 mr-2" />
            신규 배너
          </Link>
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-center w-16">정렬</th>
              <th className="p-3 text-center w-20">활성</th>
              <th className="p-3 text-left w-32">미리보기</th>
              <th className="p-3 text-left">제목</th>
              <th className="p-3 text-left hidden md:table-cell">링크</th>
              <th className="p-3 text-left hidden lg:table-cell">노출 기간</th>
              <th className="p-3 text-center w-32">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  불러오는 중...
                </td>
              </tr>
            ) : banners.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <div className="space-y-3">
                    <p className="text-muted-foreground">등록된 메인 배너가 없습니다</p>
                    <Button asChild size="sm">
                      <Link href="/admin/hero-banners/new">
                        <Plus className="h-4 w-4 mr-2" />
                        신규 배너
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              banners.map((banner) => (
                <tr key={banner.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 text-center font-mono text-xs">
                    {banner.sort_order}
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={(v) => handleToggleActive(banner, v)}
                    />
                  </td>
                  <td className="p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner.image_url_pc}
                      alt={banner.title ?? "배너"}
                      className="h-12 w-24 object-cover rounded border bg-muted"
                    />
                  </td>
                  <td className="p-3 max-w-[260px]">
                    {banner.title ? (
                      <span className="line-clamp-2">{banner.title}</span>
                    ) : (
                      <span className="text-muted-foreground">(제목 없음)</span>
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell max-w-[200px]">
                    {banner.cta_link ? (
                      <span className="truncate text-muted-foreground text-xs block">
                        {banner.cta_link}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </td>
                  <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {formatPeriod(banner)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/hero-banners/${banner.id}`)}
                      >
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(banner)}
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

export default AdminHeroBannersPage
