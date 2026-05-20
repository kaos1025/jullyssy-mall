"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

type Scope = "active" | "active_no_seo"

interface BackfillResponse {
  dry_run?: boolean
  would_queue?: number
  queued?: number
  skipped?: number
  estimated_cost_usd?: number
  month_cost_usd?: number
  remaining_budget_usd?: number
  cap_usd?: number
  error?: string
  code?: string
  message?: string
}

const SeoBackfillTrigger = () => {
  const { toast } = useToast()
  const [scope, setScope] = useState<Scope>("active_no_seo")
  const [limit, setLimit] = useState<number>(100)
  const [loading, setLoading] = useState<null | "dry" | "exec">(null)
  const [lastResult, setLastResult] = useState<BackfillResponse | null>(null)

  const callBackfill = async (dryRun: boolean) => {
    if (!dryRun) {
      if (
        !confirm(
          `정말 실행하시겠습니까?\nscope=${scope}, limit=${limit}\n예상 비용은 dry-run에서 확인하세요.`,
        )
      ) {
        return
      }
    }
    setLoading(dryRun ? "dry" : "exec")
    setLastResult(null)
    try {
      const res = await fetch("/api/admin/seo-drafts/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, limit, dry_run: dryRun }),
      })
      const data = (await res.json()) as BackfillResponse
      setLastResult(data)
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: `Backfill 실패 (${res.status})`,
          description: data.error ?? data.message ?? `HTTP ${res.status}`,
        })
      } else {
        toast({
          title: dryRun ? "Dry-run 완료" : "Backfill 실행 완료",
          description: dryRun
            ? `would_queue: ${data.would_queue}, 예상 비용 $${data.estimated_cost_usd?.toFixed(4)}`
            : `queued: ${data.queued} / skipped: ${data.skipped}`,
        })
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "네트워크 오류",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Scope</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active_no_seo">
                ACTIVE + SEO 미생성 (권장)
              </SelectItem>
              <SelectItem value="active">ACTIVE 전체 (재생성 포함)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Limit (1~500)</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10) || 100)}
          />
        </div>
        <Button
          variant="outline"
          disabled={loading !== null}
          onClick={() => callBackfill(true)}
        >
          {loading === "dry" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Dry-run"
          )}
        </Button>
        <Button
          disabled={loading !== null}
          onClick={() => callBackfill(false)}
        >
          {loading === "exec" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "실행"
          )}
        </Button>
      </div>

      {lastResult && (
        <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(lastResult, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default SeoBackfillTrigger
