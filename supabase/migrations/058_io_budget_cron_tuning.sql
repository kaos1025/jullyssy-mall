-- 058_io_budget_cron_tuning.sql
-- Disk IO Budget 고갈 대응(2026-06-30 prod 적용, Supabase MCP).
--
-- 배경: Supabase Disk IO Budget 경고 재발. 진단 결과 주범은 고객 트래픽이 아니라
--   "헛도는 SEO 워커 cron"과 "무한 증식 cron 실행로그":
--   - seo_generation_queue outstanding 0건(201 전부 completed)인데 seo 워커 2종이 5분마다
--     헛돎(하루 576회) → net.http_post 쓰기 + cron 로그 churn.
--   - cron.job_run_details 60,920행/29MB, 5/20부터 무정리.
--   큐가 비어 빈도↓ 손해 0. 신규 임포트분은 시간당 naver-sync가 enqueue → 30분 내 처리.
--
-- 주의: jobname은 변경하지 않음(이름의 'every-5-min'/'every-min'은 이제 stale — 스케줄이 SSOT).
-- 1회성 누적로그 정리(DELETE WHERE end_time < now()-7d, 54,844행)는 운영상 별도 실행함(여기 미포함).
--   이후 증식은 아래 주간 purge cron이 영구 바운드.

-- 1) SEO 생성 워커: 5분 → 30분
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'seo-worker-every-min'),
  schedule := '*/30 * * * *');

-- 2) SEO stuck-recover: 5분 → 매시
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'seo-stuck-recover-every-5-min'),
  schedule := '0 * * * *');

-- 3) cron 실행로그 주간 자동정리(일 03:00 UTC, 7일 보존) — job_run_details 영구 바운드.
--    cron.schedule는 동일 jobname 시 upsert → 재적용 멱등.
SELECT cron.schedule(
  'purge-cron-history-weekly',
  '0 3 * * 0',
  $purge$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$purge$);
