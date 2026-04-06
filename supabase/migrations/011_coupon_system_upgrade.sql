-- =============================================
-- 쿠폰 시스템 스키마 업그레이드
-- 기존 coupons / user_coupons 테이블 컬럼 정비 + orders.coupon_id 추가
-- =============================================

-- 1. coupons 컬럼명 변경 (기존 → 요청 사양)
ALTER TABLE coupons RENAME COLUMN discount_value TO value;
ALTER TABLE coupons RENAME COLUMN min_order_amount TO min_order_price;
ALTER TABLE coupons RENAME COLUMN max_issues TO total_quantity;

-- 2. starts_at: DEFAULT now() 추가
ALTER TABLE coupons ALTER COLUMN starts_at SET DEFAULT now();

-- 3. expires_at: NOT NULL 제거 (NULL이면 무기한)
ALTER TABLE coupons ALTER COLUMN expires_at DROP NOT NULL;

-- 4. updated_at 컬럼 추가 + 트리거
ALTER TABLE coupons ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. orders 테이블에 coupon_id 추가
ALTER TABLE orders ADD COLUMN coupon_id UUID REFERENCES coupons(id);
