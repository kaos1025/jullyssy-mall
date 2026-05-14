/**
 * URL-safe slug 유틸리티
 *
 * 사용처:
 * - supabase/migrations/024_backfill_product_slugs.sql 생성 스크립트
 * - src/app/api/admin/naver/import/route.ts (Naver import 시 slug 자동 생성)
 * - src/app/(shop)/products/[id]/page.tsx (UUID → slug 301/308 redirect)
 *
 * 외부 라이브러리(slugify 등) 의존 없이 자립 구현.
 */

/**
 * 상품명을 URL-safe slug로 변환한다.
 *
 * 알고리즘(순서 엄수):
 *   1) trim + toLowerCase
 *   2) 한글 음절(U+AC00~U+D7A3) + 영숫자 + 공백/하이픈만 보존
 *   3) 공백 → 하이픈
 *   4) 다중 하이픈 압축
 *   5) 양끝 하이픈 제거
 *   6) 80자 slice
 *
 * 왜 한글을 보존하나:
 *   구글/네이버는 한글 URL 색인을 지원한다. 인코딩은 브라우저가 자동 처리하므로
 *   slug 자체에는 원문 한글을 두어 검색 노출과 가독성을 확보한다.
 *
 * 왜 80자 제한인가:
 *   한글 1자는 URL 인코딩(`%E1%84%80...`) 시 약 9 bytes. 80자 × 9 ≈ 720 bytes로
 *   브라우저 URL 한계(약 2048 bytes) 대비 충분한 마진을 둔다.
 *
 * 엣지케이스:
 *   변환 후 빈 문자열이 되면 호출 측이 알 수 있도록 throw.
 *
 * 예시:
 *   - "한파대비 기모 융털 레그워머"      → "한파대비-기모-융털-레그워머"
 *   - "Oversized Knit (BLACK)"             → "oversized-knit-black"
 *   - "셔츠/블라우스 -- 화이트"            → "셔츠블라우스-화이트"
 *   - "플리츠 스커트 44 55 66"             → "플리츠-스커트-44-55-66"
 *   - "  --셔츠 블라우스--  "              → "셔츠-블라우스"
 *
 * @throws 변환 결과가 빈 문자열인 경우
 */
export function toSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)

  if (slug.length === 0) {
    throw new Error(`Slug 생성 실패 (변환 후 빈 문자열). 원본: "${name}"`)
  }

  return slug
}

/**
 * slug 중복 충돌 시 `-2`, `-3`, ... `-99` 까지 suffix를 부여한다.
 *
 * 시그니처 의도:
 *   pure function. 호출 측이 결과를 받아 `existing.add(result)`를 직접 호출하도록 한다.
 *   - 부수효과 없이 단위 테스트 가능
 *   - Naver import 트랜잭션 내에서 add 타이밍을 caller가 제어 가능
 *
 * 예시:
 *   - existing=∅,                base="니트" → "니트"
 *   - existing={"니트"},          base="니트" → "니트-2"
 *   - existing={"니트","니트-2"}, base="니트" → "니트-3"
 *
 * @throws -2 ~ -99 가 모두 사용 중인 경우 (실무상 거의 발생 불가, 발생 시 즉시 인지 필요)
 */
export function dedupeSlug(base: string, existing: Set<string>): string {
  if (!existing.has(base)) {
    return base
  }

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`
    if (!existing.has(candidate)) {
      return candidate
    }
  }

  throw new Error(`Slug dedupe 실패 (suffix -2 ~ -99 모두 사용 중). base: "${base}"`)
}

/**
 * Supabase `gen_random_uuid()` v4 UUID 패턴.
 *
 * 사용처: `products/[id]/page.tsx`에서 `params.id`가 UUID 형태이면
 *         DB 조회 후 slug 경로로 308 permanent redirect.
 */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
