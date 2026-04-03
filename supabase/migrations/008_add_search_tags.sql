-- 상품 검색태그 (SEO + 내부 검색 + 네이버 EP 연동)
ALTER TABLE public.products ADD COLUMN search_tags text[] DEFAULT '{}';

-- 검색 성능을 위한 GIN 인덱스
CREATE INDEX idx_products_search_tags ON public.products USING GIN (search_tags);
