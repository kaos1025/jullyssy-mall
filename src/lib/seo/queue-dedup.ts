// SEO 생성 큐 backfill 재적재 시 제외할 product_id 집합 계산 (SEO-QUEUE-FIX-1 #3).
//
// - pending 행: 항상 제외 (이미 대기 중 — 중복 적재 방지).
// - processing 행: 비-stale일 때만 제외. started_at이 staleMs를 초과해 경과하면
//   stuck으로 간주하여 제외 목록에서 빼 재적재를 허용한다.
//   (worker가 시간한계로 종료돼 status='processing'에 영구 잔존하는 row가
//    backfill을 영구히 막는 것을 방지. 5분 cron stuck-recover와 별개의 방어선.)
// - started_at이 null/파싱불가인 processing 행: 경과 시간을 알 수 없으므로 보수적으로
//   제외 (방금 claim된 정상 row일 수 있어 중복 적재를 피한다).

export interface QueueDedupRow {
  product_id: string
  status: string
  started_at: string | null
}

export const computeExcludedProductIds = (
  rows: QueueDedupRow[],
  staleMs: number,
  nowMs: number,
): Set<string> => {
  const excluded = new Set<string>()
  for (const row of rows) {
    if (row.status === "pending") {
      excluded.add(row.product_id)
      continue
    }
    if (row.status !== "processing") {
      continue
    }
    // processing: started_at이 staleMs를 초과해 경과한 경우(stuck)만 제외하지 않아
    // 재적재를 허용한다. null/파싱불가(경과 불명)는 보수적으로 제외(재적재 방지).
    const startedMs = row.started_at === null ? NaN : Date.parse(row.started_at)
    const isStale = !Number.isNaN(startedMs) && nowMs - startedMs > staleMs
    if (!isStale) {
      excluded.add(row.product_id)
    }
  }
  return excluded
}
