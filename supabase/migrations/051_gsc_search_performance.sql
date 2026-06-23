-- =============================================
-- GSC 검색성과 스냅샷 테이블 (gsc_query_metrics, gsc_page_metrics, gsc_url_inspections, gsc_sync_log)
-- =============================================
-- Google Search Console Search Analytics(date+query / date+page) 및 URL Inspection 결과를
-- 야간 cron(052_gsc_sync_cron.sql)이 UPSERT 적재하는 스냅샷 테이블.
-- 소비처: /api/cron/gsc-sync 라우트(증분) + /api/cron/gsc-backfill 라우트(초기 백필) +
--         /admin/seo-performance 대시보드(createAdminClient 읽기).
--
-- ⚠️ apply 보류 — 운영자 검토 후 적용.
--    Phase 0 게이트(GCP 서비스계정 + GSC 속성 권한 + Vercel env 3종) 완료 후 적용.
--    052_gsc_sync_cron.sql(pg_cron+pg_net+vault) 은 게이트 완료 후 별도 적용.
--
-- RLS: 전 4테이블 ENABLE + 정책 0 = anon/authenticated 전면 차단.
--      어드민 전용(createAdminClient = service role)만 접근. 기존 보안모델과 동일.
-- =============================================

-- ─── 쿼리별 일별 집계 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gsc_query_metrics (
  date         DATE        NOT NULL,
  query        TEXT        NOT NULL,
  clicks       INT         NOT NULL DEFAULT 0,
  impressions  INT         NOT NULL DEFAULT 0,
  ctr          NUMERIC(6,4) NOT NULL DEFAULT 0,  -- 클릭률 (0.0000 ~ 1.0000)
  position     NUMERIC(6,2) NOT NULL DEFAULT 0,  -- 평균 순위 (1.00 ~ 100.00)
  data_state   TEXT        NOT NULL DEFAULT 'all', -- 'all' | 'final' (GSC data_state)
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, query)
);

-- ─── 페이지별 일별 집계 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gsc_page_metrics (
  date         DATE        NOT NULL,
  page_path    TEXT        NOT NULL,             -- 경로만(도메인 strip) → products.slug 조인 가능
  clicks       INT         NOT NULL DEFAULT 0,
  impressions  INT         NOT NULL DEFAULT 0,
  ctr          NUMERIC(6,4) NOT NULL DEFAULT 0,
  position     NUMERIC(6,2) NOT NULL DEFAULT 0,
  data_state   TEXT        NOT NULL DEFAULT 'all',
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, page_path)
);

-- ─── URL 색인 상태 (URL당 최신 1행, 쿼터 한계로 일별 전수 불가) ─────────────
CREATE TABLE IF NOT EXISTS gsc_url_inspections (
  url_path        TEXT        PRIMARY KEY,       -- 경로만(도메인 strip), ex) /products/some-slug
  verdict         TEXT,                          -- PASS | PARTIAL | FAIL | NEUTRAL (nullable)
  coverage_state  TEXT,                          -- INDEXED | EXCLUDED | NOT_INDEXED ... (nullable)
  indexing_state  TEXT,                          -- INDEXING_ALLOWED | BLOCKED_... (nullable)
  last_crawl_time TIMESTAMPTZ,                   -- nullable (미크롤 시 null)
  crawled_as      TEXT,                          -- DESKTOP | MOBILE (nullable)
  inspected_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 동기화 이력 (멱등성 + 관측성 백본) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS gsc_sync_log (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_type        TEXT        NOT NULL,          -- 'daily' | 'backfill' | 'url_inspect'
  date_target     DATE,                          -- nullable (url_inspect 는 날짜 없음)
  status          TEXT        NOT NULL,          -- 'success' | 'partial' | 'error' | 'skipped_lock'
  rows_upserted   INT         DEFAULT 0,
  api_calls_used  INT         DEFAULT 0,
  error_message   TEXT,                          -- nullable (성공 시 null)
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ                   -- nullable (실행 중이면 null)
);

-- ─── 인덱스 ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gsc_query_date     ON gsc_query_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_page_date      ON gsc_page_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_sync_type_date ON gsc_sync_log(job_type, date_target);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- 정책 0 = anon / authenticated 전면 차단.
-- service role(createAdminClient)은 RLS 우회 → 어드민 라우트 / cron 라우트만 접근.
ALTER TABLE gsc_query_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_page_metrics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_url_inspections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_sync_log         ENABLE ROW LEVEL SECURITY;
