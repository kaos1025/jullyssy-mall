import { createAdminClient } from "@/lib/supabase/admin"

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

// ── 인라인 헬퍼 ──────────────────────────────────────────────────────────────

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

const toRFC822 = (iso: string): string => new Date(iso).toUTCString()

const mimeByExt = (url: string): string => {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
  if (ext === "png") return "image/png"
  if (ext === "gif") return "image/gif"
  if (ext === "webp") return "image/webp"
  return "image/jpeg"
}

const toAbsUrl = (url: string): string =>
  url.startsWith("http") ? url : `${SITE_URL}${url}`

// CDATA 내부에 ]]> 가 들어오면 섹션이 조기 종료돼 XML이 깨진다 → 분할로 무력화.
const safeCdata = (s: string): string => s.replace(/]]>/g, "]]]]><![CDATA[>")

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface ProductRow {
  name: string
  slug: string | null
  created_at: string
  meta_description: string | null
  product_images: { url: string; is_thumbnail: boolean; sort_order: number }[]
}

// ── RSS 빌드 ─────────────────────────────────────────────────────────────────

const buildRss = (products: ProductRow[]): string => {
  const now = new Date().toUTCString()

  const items = products
    .filter((p): p is ProductRow & { slug: string } => Boolean(p.slug))
    .map((p) => {
      const link = `${SITE_URL}/products/${p.slug}`

      // 썸네일: is_thumbnail=true 우선, 없으면 sort_order 최소값
      const sorted = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)
      const thumb =
        p.product_images.find((img) => img.is_thumbnail)?.url ??
        sorted[0]?.url ??
        null

      const description = p.meta_description?.trim() || p.name
      const enclosure = thumb
        ? `\n      <enclosure url="${xmlEscape(toAbsUrl(thumb))}" type="${mimeByExt(thumb)}" />`
        : ""

      return `
    <item>
      <title>${xmlEscape(p.name)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description><![CDATA[${safeCdata(description)}]]></description>
      <pubDate>${toRFC822(p.created_at)}</pubDate>${enclosure}
    </item>`
    })
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>쥴리씨</title>
    <link>${SITE_URL}</link>
    <description>쥴리씨 — 20~40대 여성을 위한 데일리 캐주얼 패션</description>
    <language>ko-KR</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export const GET = async (): Promise<Response> => {
  let products: ProductRow[] = []

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("products")
      .select(
        "name, slug, created_at, meta_description, product_images(url, is_thumbnail, sort_order)",
      )
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(30)

    products = (data ?? []) as unknown as ProductRow[]
  } catch {
    // Supabase 조회 실패 시 빈 채널 반환
  }

  const xml = buildRss(products)
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  })
}
