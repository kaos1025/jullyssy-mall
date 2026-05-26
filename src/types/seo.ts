// SEO 도메인 공유 타입.
// admin draft 검토 UI / GET·PATCH·approve API / description-parser 가 함께 사용.

/** description HTML 내 특정 img 위치에 alt 주입할 때 사용. */
export interface AltInjection {
  /** 0-based img tag index (querySelectorAll 'img' 순서). */
  imageIndex: number
  altText: string
}

/**
 * D3 PoC — description-parser가 임포트 HTML에서 추출한 구조화 spec.
 * 정보 손실 0 원칙: 추출 못한 필드는 undefined로 비움 (오류 throw 금지).
 * seo_metadata_drafts.spec_metadata JSONB 컬럼 + AI hint 양쪽 공유.
 */
export interface SpecMetadata {
  /** 사이즈 옵션 (예: ['S', 'M', 'L', 'FREE']) 또는 단일 치수 문자열 배열. */
  size?: string[]
  /** 소재 (예: '폴리에스터 95%, 스판덱스 5%'). */
  material?: string
  /** 세탁법 (예: '드라이클리닝 권장', '30도 손세탁'). */
  washCare?: string
  /** 모델 착장 정보 (예: '모델 신장 168cm, M 사이즈 착용'). 외모/인종/나이 추정 금지. */
  modelInfo?: string
}

/** seo_metadata_drafts.image_alt_texts JSONB 행 구조 (AI 산출). */
export interface DraftImageAlt {
  image_index: number
  alt_text: string
}

/** /admin/seo-drafts 목록 행. */
export interface SeoDraftListItem {
  id: string
  product_id: string
  product_name: string
  product_thumbnail: string | null
  meta_title: string | null
  meta_description: string | null
  search_tags: string[] | null
  image_alt_texts: DraftImageAlt[] | null
  model: string
  prompt_version: string
  cost_usd: number
  image_count: number
  created_at: string
  /** D3 PoC — replace 정책 draft 식별. preserve = baseline 동작. */
  description_mode: "preserve" | "replace"
  /** D3 PoC — replace mode 자연어 본문 (200~400자). preserve mode는 NULL. */
  product_description: string | null
  /** D3 PoC — replace mode 구조화 spec. preserve mode는 NULL. */
  spec_metadata: SpecMetadata | null
}

export interface SeoDraftListResponse {
  drafts: SeoDraftListItem[]
  total: number
}

/** draft 상세 — 미리보기/편집 패널에서 사용 (전체 product_images 포함). */
export interface SeoDraftProductImage {
  id: string
  url: string
  sort_order: number | null
  alt_text: string | null
}

export type SeoDraftStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "failed"

export interface SeoDraftDetail extends SeoDraftListItem {
  status: SeoDraftStatus
  product_slug: string
  product_images: SeoDraftProductImage[]
}
