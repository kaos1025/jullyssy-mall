-- 상품별 무료배송 설정
ALTER TABLE public.products ADD COLUMN free_shipping boolean NOT NULL DEFAULT false;
