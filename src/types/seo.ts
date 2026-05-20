// SEO 도메인 공유 타입.
// admin draft 검토 UI / GET·PATCH·approve API / description-parser 가 함께 사용.

/** description HTML 내 특정 img 위치에 alt 주입할 때 사용. */
export interface AltInjection {
  /** 0-based img tag index (querySelectorAll 'img' 순서). */
  imageIndex: number
  altText: string
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
