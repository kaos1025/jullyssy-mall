"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { MaterialCandidate } from "@/lib/product/material-backfill"

interface MaterialBackfillClientProps {
  initialCandidates: MaterialCandidate[]
}

const truncate = (s: string | null, n: number) =>
  !s ? "" : s.length > n ? `${s.slice(0, n)}…` : s

const MaterialBackfillClient = ({
  initialCandidates,
}: MaterialBackfillClientProps) => {
  const router = useRouter()
  const { toast } = useToast()
  const cands = initialCandidates
  // 검수완료(approved) 출처는 기본 선택, 미검수는 §7.1.5 material 사실오류 거를 기회 → 수동 체크
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        initialCandidates
          .filter((c) => c.source === "approved")
          .map((c) => c.product_id),
      ),
  )
  const [submitting, setSubmitting] = useState(false)

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allSel = cands.length > 0 && selected.size === cands.length
  const toggleAll = () =>
    setSelected(allSel ? new Set() : new Set(cands.map((c) => c.product_id)))

  const apply = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/products/material-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "적용 실패")
      toast({
        title:
          `${data.applied}건 소재 backfill` +
          (data.failed?.length ? ` · 실패 ${data.failed.length}` : ""),
      })
      setSelected(new Set())
      router.refresh()
    } catch (e) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "적용 실패",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">소재 backfill</h1>
          <Badge variant="outline" className="text-sm">
            후보 {cands.length}건
          </Badge>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/products">← 상품 관리</Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        draft에서 추출된 소재/세탁을 products로 채웁니다(빈 값만 — 기존 값 보존).{" "}
        <b>검수완료</b> 출처는 기본 선택, <b>미검수</b> 출처는 사실오류 가능성이 있어
        확인 후 선택하세요.
      </p>

      {cands.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-muted-foreground">
          채울 후보가 없습니다.
        </div>
      ) : (
        <>
          <Button
            size="sm"
            onClick={apply}
            disabled={submitting || selected.size === 0}
          >
            {submitting ? "적용 중..." : `선택 ${selected.size}건 적용`}
          </Button>

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 w-10">
                    <Checkbox checked={allSel} onCheckedChange={toggleAll} />
                  </th>
                  <th className="p-2 text-left">제품</th>
                  <th className="p-2 text-center w-24">출처</th>
                  <th className="p-2 text-left">소재</th>
                  <th className="p-2 text-left hidden md:table-cell">세탁</th>
                </tr>
              </thead>
              <tbody>
                {cands.map((c) => (
                  <tr
                    key={c.product_id}
                    className={cn(
                      "border-t hover:bg-muted/30",
                      selected.has(c.product_id) && "bg-muted/40",
                    )}
                  >
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(c.product_id)}
                        onCheckedChange={() => toggle(c.product_id)}
                      />
                    </td>
                    <td className="p-2 max-w-[260px]">
                      <div className="truncate font-medium">{c.name}</div>
                    </td>
                    <td className="p-2 text-center">
                      <Badge
                        variant={c.source === "approved" ? "default" : "secondary"}
                        className="text-[11px]"
                      >
                        {c.source === "approved" ? "검수완료" : "미검수"}
                      </Badge>
                    </td>
                    <td className="p-2 max-w-[220px]">
                      <div className="truncate">{c.material}</div>
                    </td>
                    <td className="p-2 max-w-[200px] hidden md:table-cell text-muted-foreground">
                      <div className="truncate">{truncate(c.wash_care, 40) || "—"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default MaterialBackfillClient
