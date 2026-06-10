-- =============================================
-- P1-16 RETURN-EXCHANGE-FLOW: order_claims (반품/교환 클레임)
-- =============================================
-- spec v0.2 §2. 주문 단위 claim. item-level 부분 반품은 P2 claim_items로 분리(현 비범위).
-- user_id→profiles (members 아님 — Phase0 item9 실측), order_id→orders.
-- 활성 claim 1건 보장(partial unique). RLS: 사용자=본인 SELECT/INSERT(REQUESTED)/
-- UPDATE(REQUESTED→WITHDRAWN만), 어드민 처리=service_role API 경유(shared cache 진입 금지).

CREATE TABLE order_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('RETURN', 'EXCHANGE')),
  status text NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'COLLECTED',
                      'REFUNDED', 'RESHIPPED', 'COMPLETED', 'WITHDRAWN')),
  reason_category text NOT NULL
    CHECK (reason_category IN ('CHANGE_OF_MIND', 'SIZE_MISMATCH', 'DEFECT', 'WRONG_ITEM', 'OTHER')),
  reason_detail text,
  prev_order_status text NOT NULL,            -- 거절/철회 시 orders.status 원복용
  proposed_deduction int NOT NULL DEFAULT 0,  -- 서버 제안 차감액 (비구속)
  confirmed_deduction int,                    -- 운영자 승인 시 확정 (구속)
  refund_amount int,                          -- 환불 실행 시 서버계산 (paid − confirmed_deduction)
  toss_cancel_idempotency_key text,           -- Toss 성공 기록 = RPC 재시도 시 Toss skip 마커
  toss_cancel_response jsonb,
  exchange_to_option_id uuid REFERENCES product_options(id),
  reship_tracking_number text,
  reship_courier text,
  rejected_reason text,
  processed_by uuid REFERENCES profiles(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  collected_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 주문당 활성 claim 1건 (종결 status REFUNDED/COMPLETED/REJECTED/WITHDRAWN 제외)
CREATE UNIQUE INDEX uniq_active_claim_per_order ON order_claims (order_id)
  WHERE status IN ('REQUESTED', 'APPROVED', 'COLLECTED', 'RESHIPPED');
CREATE INDEX idx_order_claims_status ON order_claims (status);
CREATE INDEX idx_order_claims_user_id ON order_claims (user_id); -- 마이페이지 본인 claim 조회용

-- updated_at 자동갱신 (001_initial_schema.sql 함수 재사용)
CREATE TRIGGER order_claims_updated_at
  BEFORE UPDATE ON order_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE order_claims ENABLE ROW LEVEL SECURITY;

-- 본인 claim 조회
CREATE POLICY order_claims_select_own ON order_claims
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 본인 claim 생성 (REQUESTED 상태로만). 서버 라우트가 자격/차감액 검증 후 INSERT.
CREATE POLICY order_claims_insert_own ON order_claims
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'REQUESTED');

-- 사용자는 본인 REQUESTED claim을 WITHDRAWN으로만 전이 가능.
-- USING: 전이 전 상태(본인+REQUESTED). WITH CHECK: 전이 후 status는 REQUESTED/WITHDRAWN만
-- → 사용자가 APPROVED/REFUNDED 등으로 자가 승급 불가. 어드민 처리는 service_role(RLS 우회).
CREATE POLICY order_claims_update_withdraw ON order_claims
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'REQUESTED')
  WITH CHECK (auth.uid() = user_id AND status IN ('REQUESTED', 'WITHDRAWN'));
