-- =============================================
-- event_categories 시드 (멱등)
-- =============================================
-- name 기준 NOT EXISTS 패턴 — 재실행 시 중복 INSERT 방지
-- 운영 데이터 보존 우선 (이미 같은 name이 있으면 스킵)

INSERT INTO public.event_categories (name, emoji, color, link_url, display_order, is_active)
SELECT '벚꽃놀이코디', '🌸', '#FFB7C5', '/products?search=봄코디', 1, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_categories WHERE name = '벚꽃놀이코디'
);
