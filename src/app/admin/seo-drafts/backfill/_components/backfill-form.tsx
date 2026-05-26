"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronLeft, Play, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

type Scope = "active" | "active_no_seo"

interface BackfillResponse {
  dry_run?: boolean
  poc_mode?: boolean
  queued?: number
  would_queue?: number
  products?: number
  skipped?: number
  estimated_cost_usd: number
  month_cost_usd: number
  remaining_budget_usd: number
  cap_usd: number
  message?: string
}

const BackfillForm = () => {
  const { toast } = useToast()
  const [scope, setScope] = useState<Scope>("active_no_seo")
  const [limit, setLimit] = useState(500)
  const [pocMode, setPocMode] = useState(false)
  const [submitting, setSubmitting] = useState<null | "dry" | "exec">(null)
  const [result, setResult] = useState<BackfillResponse | null>(null)

  const call = async (dryRun: boolean) => {
    setSubmitting(dryRun ? "dry" : "exec")
    setResult(null)
    try {
      const res = await fetch("/api/admin/seo-drafts/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          limit,
          dry_run: dryRun,
          poc_mode: pocMode,
        }),
      })
      const data = (await res.json()) as BackfillResponse & { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setResult(data)
      toast({
        title: dryRun ? "예산 확인 완료" : "Backfill 큐 등록 완료",
        description: dryRun
          ? `대상 ${data.would_queue ?? 0}건, 예상 비용 $${data.estimated_cost_usd.toFixed(4)}`
          : `큐 ${data.queued ?? 0}건 등록 (제외 ${data.skipped ?? 0}건)`,
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: dryRun ? "예산 확인 실패" : "Backfill 실패",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/seo-drafts">
            <ChevronLeft className="h-4 w-4 mr-1" />
            목록
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">SEO Backfill</h1>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">대상 범위 (scope)</Label>
          <div className="flex gap-2 flex-wrap">
            {(["active_no_seo", "active"] as const).map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 text-sm cursor-pointer border rounded px-3 py-2 has-[:checked]:bg-muted"
              >
                <input
                  type="radio"
                  name="scope"
                  value={s}
                  checked={scope === s}
                  onChange={() => setScope(s)}
                />
                <span>
                  {s === "active_no_seo"
                    ? "ACTIVE 중 SEO 미생성 (권장)"
                    : "모든 ACTIVE (재생성 포함)"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="limit" className="text-xs">
            최대 건수 (1~500)
          </Label>
          <Input
            id="limit"
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="max-w-[120px]"
          />
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pocMode}
              onChange={(e) => setPocMode(e.target.checked)}
              className="mt-0.5"
            />
            <div className="text-sm">
              <div className="font-medium flex items-center gap-2">
                D3 PoC 모드 (각 상품에 preserve + replace 2개 draft 생성)
                <Badge variant="secondary" className="text-[10px]">
                  PoC
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                description 정책 비교 검수용. 큐 row 2배 + 비용 사전 검증 2배.
                일반 backfill에는 사용 금지 — PoC trigger 전용 (3건 명시 선정 권장).
              </p>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => call(true)}
            disabled={submitting !== null}
          >
            <Search className="h-4 w-4 mr-1.5" />
            {submitting === "dry" ? "확인 중..." : "예산 확인 (dry_run)"}
          </Button>
          <Button onClick={() => call(false)} disabled={submitting !== null}>
            <Play className="h-4 w-4 mr-1.5" />
            {submitting === "exec" ? "큐 등록 중..." : "실행"}
          </Button>
        </div>
      </div>

      {result && (
        <div className="border rounded-lg p-4 space-y-2 text-sm">
          <div className="font-medium text-xs text-muted-foreground border-b pb-2">
            {result.dry_run ? "dry_run 결과" : "실행 결과"}
            {result.poc_mode && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                PoC
              </Badge>
            )}
          </div>
          {result.message && (
            <div className="text-muted-foreground">{result.message}</div>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {result.dry_run ? (
              <>
                <dt className="text-muted-foreground">would_queue</dt>
                <dd>{result.would_queue}건</dd>
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">queued</dt>
                <dd>
                  {result.queued}건
                  {result.products !== undefined &&
                    result.products !== result.queued && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({result.products} 상품 × 2 mode)
                      </span>
                    )}
                </dd>
                <dt className="text-muted-foreground">skipped</dt>
                <dd>{result.skipped}건</dd>
              </>
            )}
            <dt className="text-muted-foreground">예상 비용</dt>
            <dd>${result.estimated_cost_usd.toFixed(4)}</dd>
            <dt className="text-muted-foreground">이번 달 누적</dt>
            <dd>${result.month_cost_usd.toFixed(4)}</dd>
            <dt className="text-muted-foreground">남은 예산</dt>
            <dd>${result.remaining_budget_usd.toFixed(4)}</dd>
            <dt className="text-muted-foreground">월 예산 한도</dt>
            <dd>${result.cap_usd.toFixed(4)}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}

export default BackfillForm
