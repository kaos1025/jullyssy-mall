/**
 * GSC (Google Search Console) 스냅샷 테이블 행 타입
 * migration: 051_gsc_search_performance.sql
 * 소비처: /api/cron/gsc-sync, /api/cron/gsc-backfill, /admin/seo-performance
 */

/** gsc_query_metrics — date+query 복합 PK, 일별 쿼리 집계 */
export interface GscQueryMetric {
  date: string;          // DATE → ISO string (YYYY-MM-DD)
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;           // NUMERIC(6,4) — 0.0000 ~ 1.0000
  position: number;      // NUMERIC(6,2) — 평균 순위
  data_state: string;    // 'all' | 'final'
  fetched_at: string;    // TIMESTAMPTZ → ISO string
}

/** gsc_page_metrics — date+page_path 복합 PK, 일별 페이지 집계 */
export interface GscPageMetric {
  date: string;          // DATE → ISO string (YYYY-MM-DD)
  page_path: string;     // 경로만(도메인 strip), ex) /products/some-slug
  clicks: number;
  impressions: number;
  ctr: number;           // NUMERIC(6,4)
  position: number;      // NUMERIC(6,2)
  data_state: string;
  fetched_at: string;    // TIMESTAMPTZ → ISO string
}

/** gsc_url_inspections — url_path PK, URL당 최신 1행 */
export interface GscUrlInspection {
  url_path: string;
  verdict: string | null;         // PASS | PARTIAL | FAIL | NEUTRAL
  coverage_state: string | null;  // INDEXED | EXCLUDED | NOT_INDEXED ...
  indexing_state: string | null;  // INDEXING_ALLOWED | BLOCKED_...
  last_crawl_time: string | null; // TIMESTAMPTZ → ISO string, 미크롤 시 null
  crawled_as: string | null;      // DESKTOP | MOBILE
  inspected_at: string;           // TIMESTAMPTZ → ISO string
}

/** gsc_sync_log — BIGINT IDENTITY PK, 동기화 이력 */
export interface GscSyncLog {
  id: number;
  job_type: string;               // 'daily'(lock) | 'query_metrics' | 'page_metrics' | 'url_inspection' | 'backfill'
  date_target: string | null;     // DATE → ISO string, url_inspection 등은 null
  status: string;                 // 'in_progress' | 'success' | 'error' | 'skipped_lock'
  rows_upserted: number;
  api_calls_used: number;
  error_message: string | null;   // 성공 시 null
  started_at: string;             // TIMESTAMPTZ → ISO string
  finished_at: string | null;     // 실행 중이면 null
}
