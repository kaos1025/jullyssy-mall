// SEO 운영 dashboard 통계 helper.
// admin/page.tsx Server Component에서 호출.

import { createAdminClient } from "@/lib/supabase/admin"

export interface SeoDashboardStats {
  month_cost_usd: number
  cap_usd: number          // SEO_AI_MONTHLY_USD_CAP env, 미설정 시 0
  usage_ratio: number      // 0~1+ (cap=0이면 0)
  cap_set: boolean         // env 등록 여부
  draft_counts: {
    pending_review: number
    approved: number
    rejected: number
    failed: number
  }
}

export async function getSeoDashboardStats(): Promise<SeoDashboardStats> {
  const supabase = createAdminClient()

  const [monthCostResult, draftsResult] = await Promise.all([
    supabase.rpc("seo_monthly_cost_usd"),
    supabase.from("seo_metadata_drafts").select("status"),
  ])

  const monthCost = Number(monthCostResult.data ?? 0)
  const capRaw = process.env.SEO_AI_MONTHLY_USD_CAP
  const cap = parseFloat(capRaw ?? "")
  const capSet = Number.isFinite(cap) && cap > 0

  const counts: SeoDashboardStats["draft_counts"] = {
    pending_review: 0,
    approved: 0,
    rejected: 0,
    failed: 0,
  }
  for (const row of (draftsResult.data ?? []) as Array<{ status: string }>) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] += 1
    }
  }

  return {
    month_cost_usd: monthCost,
    cap_usd: capSet ? cap : 0,
    usage_ratio: capSet ? monthCost / cap : 0,
    cap_set: capSet,
    draft_counts: counts,
  }
}
