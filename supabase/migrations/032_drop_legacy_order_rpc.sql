-- =============================================
-- 032: legacy create_order_with_items overload DROP
-- =============================================
-- 배경: Day 18 (2026-05-14) PR #12 hotfix bb59225에서
--   create_order_with_items가 named-arg dispatch + 7개 인자 신 시그니처
--   (013_recalc_shipping_fee.sql)로 변경됨. 003/012의 6개 인자 구 시그니처는
--   호출처 0건 상태로 +1주 안정화 완료 (2026-05-21, Sentry orders 7일 0건 확증).
-- 목적: 구 overload 제거로 향후 시그니처 변경 시 overload 충돌 가능성 차단.
-- 보존: 013 시그니처 (UUID, JSONB, JSONB, INT, INT, UUID, INT) — 현 운영 dispatch 대상.
-- 안전 마진: IF EXISTS — 시그니처 정확성 보험.

DROP FUNCTION IF EXISTS create_order_with_items(
  UUID, JSONB, JSONB, UUID, INT, INT
);
