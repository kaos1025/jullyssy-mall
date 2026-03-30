-- =============================================
-- 쥴리씨 자사몰 초기 스키마
-- =============================================

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- updated_at 자동갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 1. profiles (auth.users 확장)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  height SMALLINT,
  weight SMALLINT,
  marketing_agreed BOOLEAN DEFAULT FALSE,
  grade TEXT DEFAULT 'NORMAL' CHECK (grade IN ('NORMAL', 'SILVER', 'GOLD', 'VIP')),
  point INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- auth.users 생성 시 자동으로 profiles에 INSERT
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 2. addresses (배송지)
-- =============================================
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '기본 배송지',
  recipient TEXT NOT NULL,
  phone TEXT NOT NULL,
  zipcode TEXT NOT NULL,
  address1 TEXT NOT NULL,
  address2 TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- 기본배송지 1개 보장 트리거
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE addresses
    SET is_default = FALSE
    WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER address_default_trigger
  BEFORE INSERT OR UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_address();

-- =============================================
-- 3. categories (계층 구조)
-- =============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- 초기 카테고리 데이터
INSERT INTO categories (id, parent_id, name, slug, sort_order) VALUES
  -- 1depth
  ('a0000000-0000-0000-0000-000000000001', NULL, '상의', 'top', 1),
  ('a0000000-0000-0000-0000-000000000002', NULL, '하의', 'bottom', 2),
  ('a0000000-0000-0000-0000-000000000003', NULL, '아우터', 'outer', 3),
  ('a0000000-0000-0000-0000-000000000004', NULL, '원피스/세트', 'dress', 4),
  ('a0000000-0000-0000-0000-000000000005', NULL, '가방/악세서리', 'acc', 5),
  -- 상의 하위
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '티셔츠', 'top-tshirt', 1),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '니트', 'top-knit', 2),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '셔츠', 'top-shirt', 3),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '블라우스', 'top-blouse', 4),
  -- 하의 하위
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', '팬츠', 'bottom-pants', 1),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', '스커트', 'bottom-skirt', 2),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', '레깅스', 'bottom-leggings', 3),
  -- 아우터 하위
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', '자켓', 'outer-jacket', 1),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', '코트', 'outer-coat', 2),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', '패딩', 'outer-padding', 3);

-- =============================================
-- 4. products (상품)
-- =============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INT NOT NULL,
  sale_price INT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SOLDOUT', 'HIDDEN', 'DELETED')),
  material TEXT,
  care_info TEXT,
  origin TEXT,
  naver_product_no TEXT,
  view_count INT DEFAULT 0,
  sell_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_naver_product_no ON products(naver_product_no);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 5. product_images (상품 이미지)
-- =============================================
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_thumbnail BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- =============================================
-- 6. product_options (색상×사이즈 조합)
-- =============================================
CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  stock INT DEFAULT 0,
  extra_price INT DEFAULT 0,
  sku TEXT,
  naver_option_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, color, size)
);

CREATE INDEX idx_product_options_product_id ON product_options(product_id);

-- =============================================
-- 7. orders (주문)
-- =============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  order_no TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'PAID', 'PREPARING', 'SHIPPING', 'DELIVERED',
    'CONFIRMED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED',
    'EXCHANGE_REQUESTED', 'EXCHANGED'
  )),
  total_amount INT NOT NULL,
  discount_amount INT DEFAULT 0,
  point_used INT DEFAULT 0,
  shipping_fee INT DEFAULT 0,
  paid_amount INT NOT NULL,
  -- 배송지 스냅샷
  recipient TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  zipcode TEXT NOT NULL,
  address1 TEXT NOT NULL,
  address2 TEXT,
  delivery_memo TEXT,
  -- 배송 정보
  courier TEXT,
  tracking_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_no ON orders(order_no);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 8. order_items (주문 상품 — 스냅샷)
-- =============================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_option_id UUID REFERENCES product_options(id) ON DELETE SET NULL,
  -- 스냅샷 필드
  product_name TEXT NOT NULL,
  product_image TEXT,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- =============================================
-- 9. payments (결제)
-- =============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_key TEXT UNIQUE,
  method TEXT CHECK (method IN ('CARD', 'TRANSFER', 'VIRTUAL_ACCOUNT', 'KAKAOPAY', 'NAVERPAY', 'TOSSPAY')),
  amount INT NOT NULL,
  status TEXT DEFAULT 'READY' CHECK (status IN ('READY', 'DONE', 'CANCELLED', 'PARTIAL_CANCELLED', 'ABORTED', 'EXPIRED')),
  raw_response JSONB,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_payment_key ON payments(payment_key);

-- =============================================
-- 10. coupons (쿠폰 템플릿)
-- =============================================
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('FIXED', 'PERCENT')),
  discount_value INT NOT NULL,
  min_order_amount INT DEFAULT 0,
  max_discount INT,
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_issues INT,
  issued_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);

-- =============================================
-- 11. user_coupons (유저 쿠폰 발급)
-- =============================================
CREATE TABLE user_coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, coupon_id)
);

CREATE INDEX idx_user_coupons_user_id ON user_coupons(user_id);

-- =============================================
-- 12. point_histories (포인트 내역)
-- =============================================
CREATE TABLE point_histories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_point_histories_user_id ON point_histories(user_id);

-- =============================================
-- 13. reviews (리뷰)
-- =============================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT,
  height SMALLINT,
  weight SMALLINT,
  purchased_size TEXT,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);

-- =============================================
-- 14. review_images (리뷰 이미지)
-- =============================================
CREATE TABLE review_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_images_review_id ON review_images(review_id);

-- =============================================
-- 15. naver_sync_logs (스마트스토어 동기화 이력)
-- =============================================
CREATE TABLE naver_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('IMPORT', 'EXPORT', 'STOCK_SYNC')),
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
  total_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  fail_count INT DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
