"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { SeoDraftListItem } from "@/types/seo"

interface BulkReviewClientProps {
  initialDrafts: SeoDraftListItem[]
  initialTotal: number
  limit: number
}

const truncate = (s: string | null | undefined, n: number) =>
  !s ? "" : s.length > n ? `${s.slice(0, n)}…` : s

const BulkReviewClient = ({
  initialDrafts,
  initialTotal,
  limit,
}: BulkReviewClientProps) => {
  const { toast } = useToast()
  const [drafts, setDrafts] = useState<SeoDraftListItem[]>(initialDrafts)
  const [total, setTotal] = useState(initialTotal)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 같은 제품에 draft가 여러 개 → 승인 시 충돌(서버에서 skip)
  const multiProductIds = useMemo(() => {
    const c = new Map<string, number>()
    for (const d of drafts) c.set(d.product_id, (c.get(d.product_id) ?? 0) + 1)
    return new Set(
      Array.from(c.entries())
        .filter(([, n]) => n > 1)
        .map(([pid]) => pid),
    )
  }, [drafts])

  // 제품명 → 모드 → 생성일 순 정렬 (동일 제품 draft 인접 노출)
  const sorted = useMemo(
    () =>
      [...drafts].sort(
        (a, b) =>
          a.product_name.localeCompare(b.product_name) ||
          a.description_mode.localeCompare(b.description_mode) ||
          a.created_at.localeCompare(b.created_at),
      ),
    [drafts],
  )

  const allSelected = drafts.length > 0 && selected.size === drafts.length
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(drafts.map((d) => d.id)))
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const collisionSelectedCount = useMemo(
    () =>
      Array.from(selected).filter((id) => {
        const d = drafts.find((x) => x.id === id)
        return d ? multiProductIds.has(d.product_id) : false
      }).length,
    [selected, drafts, multiProductIds],
  )

  const refetch = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/seo-drafts?limit=${limit}&offset=0`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "목록 조회 실패")
      setDrafts(data.drafts ?? [])
      setTotal(data.total ?? 0)
      setSelected(new Set())
    } catch (e) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "조회 실패",
      })
    } finally {
      setLoading(false)
    }
  }

  const bulkApprove = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/seo-drafts/bulk/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "승인 실패")
      toast({
        title:
          `승인 ${data.approved}건` +
          (data.skipped?.length ? ` · 건너뜀 ${data.skipped.length}` : "") +
          (data.failed?.length ? ` · 실패 ${data.failed.length}` : ""),
      })
      await refetch()
    } catch (e) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "승인 실패",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const bulkReject = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (!confirm(`${ids.length}건을 일괄 거절할까요?`)) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/seo-drafts/bulk/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "거절 실패")
      toast({ title: `거절 ${data.rejected}건` })
      await refetch()
    } catch (e) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "거절 실패",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">일괄 검수</h1>
          <Badge variant="outline" className="text-sm">
            pending: {total}건
          </Badge>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/seo-drafts">← 단건 상세</Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        meta·설명·태그·소재를 훑어보고 다중 선택해 일괄 승인/거절합니다. 같은 제품에
        draft가 여러 개면(⚠️) 승인 시 건너뜁니다 — 단건 상세에서 처리하세요.
      </p>

      {/* 일괄 액션 바 */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 p-3 bg-muted/80 backdrop-blur rounded-lg border flex-wrap">
          <span className="text-sm font-medium">{selected.size}건 선택</span>
          {collisionSelectedCount > 0 && (
            <span className="text-xs text-amber-600">
              ⚠️ 동일제품 중복 {collisionSelectedCount}건 승인 시 건너뜀
            </span>
          )}
          <Button size="sm" onClick={bulkApprove} disabled={submitting}>
            {submitting ? "처리 중..." : "일괄 승인"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={bulkReject}
            disabled={submitting}
          >
            일괄 거절
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            disabled={submitting}
          >
            선택 해제
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="p-2 text-left">제품</th>
              <th className="p-2 text-center w-20">모드</th>
              <th className="p-2 text-left">meta_title</th>
              <th className="p-2 text-left hidden lg:table-cell">
                meta_description
              </th>
              <th className="p-2 text-center w-16 hidden md:table-cell">태그</th>
              <th className="p-2 text-left hidden xl:table-cell">소재</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  불러오는 중...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  검토 대기중인 draft가 없습니다
                </td>
              </tr>
            ) : (
              sorted.map((d) => {
                const isCollision = multiProductIds.has(d.product_id)
                return (
                  <tr
                    key={d.id}
                    className={cn(
                      "border-t hover:bg-muted/30",
                      selected.has(d.id) && "bg-muted/40",
                    )}
                  >
                    <td className="p-2 align-top">
                      <Checkbox
                        checked={selected.has(d.id)}
                        onCheckedChange={() => toggleOne(d.id)}
                      />
                    </td>
                    <td className="p-2 align-top max-w-[220px]">
                      <div className="flex items-start gap-2">
                        {d.product_thumbnail ? (
                          <Image
                            src={d.product_thumbnail}
                            alt=""
                            width={36}
                            height={36}
                            className="rounded object-cover w-9 h-9 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded bg-muted shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {d.product_name}
                          </div>
                          {isCollision && (
                            <span className="text-[11px] text-amber-600">
                              ⚠️ 동일제품 복수 draft
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-center align-top">
                      <Badge
                        variant={
                          d.description_mode === "replace"
                            ? "default"
                            : "secondary"
                        }
                        className="text-[11px]"
                      >
                        {d.description_mode}
                      </Badge>
                    </td>
                    <td className="p-2 align-top max-w-[240px]">
                      <div className="truncate">
                        {d.meta_title || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 align-top max-w-[320px] hidden lg:table-cell text-muted-foreground">
                      {truncate(d.meta_description, 120) || "—"}
                    </td>
                    <td className="p-2 text-center align-top hidden md:table-cell">
                      {d.search_tags?.length ?? 0}
                    </td>
                    <td className="p-2 align-top max-w-[180px] hidden xl:table-cell text-muted-foreground">
                      {truncate(d.spec_metadata?.material, 60) || "—"}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BulkReviewClient
