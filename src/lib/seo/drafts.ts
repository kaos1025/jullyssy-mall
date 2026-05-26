// SEO draft admin 헬퍼.
// service_role 사용 (seo_metadata_drafts RLS는 service_role 전용).

import { createAdminClient } from "@/lib/supabase/admin"
import type {
  DraftImageAlt,
  SeoDraftDetail,
  SeoDraftListItem,
  SeoDraftListResponse,
  SeoDraftStatus,
  SpecMetadata,
} from "@/types/seo"

interface DraftRow {
  id: string
  product_id: string
  meta_title: string | null
  meta_description: string | null
  search_tags: string[] | null
  image_alt_texts: DraftImageAlt[] | null
  model: string
  prompt_version: string
  cost_usd: number | string | null
  image_count: number | null
  created_at: string
  description_mode: "preserve" | "replace"
  product_description: string | null
  spec_metadata: SpecMetadata | null
  products: {
    name: string
    product_images: Array<{ url: string; sort_order: number | null }> | null
  } | null
}

export async function getSeoDraftsPendingPaginatedAdmin(
  limit: number,
  offset: number,
): Promise<SeoDraftListResponse> {
  const supabase = createAdminClient()

  const { count, error: countError } = await supabase
    .from("seo_metadata_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review")

  if (countError) throw new Error(countError.message)

  const { data, error } = await supabase
    .from("seo_metadata_drafts")
    .select(
      `id, product_id, meta_title, meta_description, search_tags,
       image_alt_texts, model, prompt_version, cost_usd, image_count, created_at,
       description_mode, product_description, spec_metadata,
       products!inner ( name, product_images ( url, sort_order ) )`,
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  const drafts: SeoDraftListItem[] = ((data ?? []) as unknown as DraftRow[]).map(
    (row) => {
      const images = (row.products?.product_images ?? [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      return {
        id: row.id,
        product_id: row.product_id,
        product_name: row.products?.name ?? "",
        product_thumbnail: images[0]?.url ?? null,
        meta_title: row.meta_title,
        meta_description: row.meta_description,
        search_tags: row.search_tags,
        image_alt_texts: row.image_alt_texts,
        model: row.model,
        prompt_version: row.prompt_version,
        cost_usd: Number(row.cost_usd ?? 0),
        image_count: row.image_count ?? 0,
        created_at: row.created_at,
        description_mode: row.description_mode,
        product_description: row.product_description,
        spec_metadata: row.spec_metadata,
      }
    },
  )

  return { drafts, total: count ?? 0 }
}

interface DraftDetailRow {
  id: string
  product_id: string
  status: SeoDraftStatus
  meta_title: string | null
  meta_description: string | null
  search_tags: string[] | null
  image_alt_texts: DraftImageAlt[] | null
  model: string
  prompt_version: string
  cost_usd: number | string | null
  image_count: number | null
  created_at: string
  description_mode: "preserve" | "replace"
  product_description: string | null
  spec_metadata: SpecMetadata | null
  products: {
    name: string
    slug: string
    product_images: Array<{
      id: string
      url: string
      sort_order: number | null
      alt_text: string | null
    }> | null
  } | null
}

export async function getSeoDraftDetailAdmin(
  id: string,
): Promise<SeoDraftDetail | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("seo_metadata_drafts")
    .select(
      `id, product_id, status, meta_title, meta_description, search_tags,
       image_alt_texts, model, prompt_version, cost_usd, image_count, created_at,
       description_mode, product_description, spec_metadata,
       products!inner (
         name, slug,
         product_images ( id, url, sort_order, alt_text )
       )`,
    )
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as unknown as DraftDetailRow
  const images = (row.products?.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return {
    id: row.id,
    product_id: row.product_id,
    status: row.status,
    product_name: row.products?.name ?? "",
    product_slug: row.products?.slug ?? "",
    product_thumbnail: images[0]?.url ?? null,
    product_images: images,
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    search_tags: row.search_tags,
    image_alt_texts: row.image_alt_texts,
    model: row.model,
    prompt_version: row.prompt_version,
    cost_usd: Number(row.cost_usd ?? 0),
    image_count: row.image_count ?? 0,
    created_at: row.created_at,
    description_mode: row.description_mode,
    product_description: row.product_description,
    spec_metadata: row.spec_metadata,
  }
}
