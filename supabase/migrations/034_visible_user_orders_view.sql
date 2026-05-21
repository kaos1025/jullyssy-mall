-- =============================================
-- P1-20 후속 hotfix: 마이페이지에 payments row 없는 CANCELLED 비노출
-- =============================================
-- 사용자 시나리오: 결제창 X로 닫음 + cron 자동 만료 누적분이 마이페이지 "취소완료"로 노출되어
-- "결제 안 한 주문이 취소완료에 있다"는 멘탈모델 충돌. 결제 시도가 한 번이라도 있었던
-- 주문(payments row 존재)만 사용자에게 의미가 있으므로 그것만 노출한다.
--
-- 어드민 노출 정책은 변경하지 않는다 (운영자 모니터링 가치 유지).
-- security_invoker = on (Postgres 15+): view 호출자의 권한으로 RLS 적용 → orders_select_own
-- 정책이 그대로 적용되어 사용자는 본인 주문만 본다.

CREATE OR REPLACE VIEW visible_user_orders
WITH (security_invoker = on) AS
SELECT o.*
FROM public.orders o
WHERE o.status <> 'CANCELLED'
   OR EXISTS (
     SELECT 1 FROM public.payments p WHERE p.order_id = o.id
   );

GRANT SELECT ON visible_user_orders TO authenticated;
