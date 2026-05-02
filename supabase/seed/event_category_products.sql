-- =============================================
-- event_category_products 시드 (멱등)
-- =============================================
-- 벚꽃놀이코디 매칭 더미: 봄 분위기 셔츠/스커트/자켓 3건.
-- 상품 ID는 PROMO-3 Step 3.0에서 확인된 실 상품 ID 직접 사용.
-- 운영 시 와이프가 어드민 매칭 UI에서 재매칭 예정 (PROMO-1/2 시드 패턴 동일).
-- 멱등성: 이벤트 누락 / 상품 누락 / 이미 매칭됨 → 모두 안전 스킵.

WITH ec AS (
  SELECT id FROM public.event_categories WHERE name = '벚꽃놀이코디' LIMIT 1
)
INSERT INTO public.event_category_products (event_category_id, product_id, display_order)
SELECT ec.id, candidate.product_id, candidate.ord
FROM ec
CROSS JOIN (VALUES
  ('3af4279a-2930-4562-9c9b-a5d8cc0a81ed'::uuid, 1),  -- 레이어드 셔츠
  ('2e8f0f42-869d-4a58-be0c-aa2635b4be36'::uuid, 2),  -- A라인 미니 스커트
  ('e0ec527b-3d86-4b3b-b1b2-4114463612c1'::uuid, 3)   -- 부클자켓
) AS candidate(product_id, ord)
WHERE EXISTS (
  SELECT 1 FROM public.products p WHERE p.id = candidate.product_id
)
AND NOT EXISTS (
  SELECT 1 FROM public.event_category_products ecp
  WHERE ecp.event_category_id = ec.id
    AND ecp.product_id = candidate.product_id
);

-- 벚꽃놀이코디 link_url을 NULL로 갱신 (URL 단순화 후속, /events/{id} 라우팅 우선)
UPDATE public.event_categories
SET link_url = NULL
WHERE name = '벚꽃놀이코디' AND link_url = '/products?search=봄코디';
