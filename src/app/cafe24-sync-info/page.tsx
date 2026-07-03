import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cafe24 상품 연동 안내",
  description: "SmartStore 상품을 Cafe24 상품 허브로 연동하기 위한 인증 안내 페이지입니다.",
  robots: {
    index: false,
    follow: false,
  },
}

const scopes = ["mall.read_product", "mall.write_product", "mall.read_store"]

const buildAuthorizeUrl = () => {
  const mallId = process.env.CAFE24_MALL_ID
  const clientId = process.env.CAFE24_CLIENT_ID
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const redirectUri =
    process.env.CAFE24_REDIRECT_URI ||
    (siteUrl ? `${siteUrl.replace(/\/$/, "")}/api/cafe24/oauth/callback` : "")

  if (!mallId || !clientId || !redirectUri) return null

  const url = new URL(`https://${mallId}.cafe24api.com/api/v2/oauth/authorize`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("state", process.env.CAFE24_OAUTH_STATE || "jullyssy-cafe24-sync")
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("scope", scopes.join(","))
  return url.toString()
}

const Cafe24SyncInfoPage = () => {
  const authorizeUrl = buildAuthorizeUrl()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://자사몰도메인"
  const redirectUri =
    process.env.CAFE24_REDIRECT_URI || `${siteUrl}/api/cafe24/oauth/callback`

  return (
    <main className="min-h-screen bg-white px-5 py-16 text-neutral-900">
      <div className="mx-auto max-w-3xl space-y-10">
        <section className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
            Cafe24 Sync
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            SmartStore → Cafe24 상품 연동 안내
          </h1>
          <p className="text-base leading-7 text-neutral-600">
            이 페이지는 쥴리씨 SmartStore 상품 정보를 Cafe24 상품 허브로 연동하기 위한
            Cafe24 Developers 앱 안내 페이지입니다. Cafe24에 등록된 상품은 에이블리 등
            외부 채널 연동의 중간 상품 마스터로 사용할 예정입니다.
          </p>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="text-lg font-semibold">Cafe24 Developers 입력값</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-neutral-700">App URL</dt>
              <dd className="mt-1 rounded-lg bg-white p-3 font-mono text-xs text-neutral-700">
                {siteUrl}/cafe24-sync-info
              </dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-700">Redirect URI</dt>
              <dd className="mt-1 rounded-lg bg-white p-3 font-mono text-xs text-neutral-700">
                {redirectUri}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-700">필요 권한</dt>
              <dd className="mt-1 rounded-lg bg-white p-3 font-mono text-xs text-neutral-700">
                {scopes.join(", ")}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">연동 방식</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-neutral-700">
            <li>SmartStore 상품 정보를 VPS worker에서 조회합니다.</li>
            <li>상품명, 가격, 재고, 이미지, 상세설명, 옵션을 Cafe24 등록 후보로 변환합니다.</li>
            <li>Cafe24에는 초기에 진열안함/판매안함 상태로만 등록합니다.</li>
            <li>관리자 검수 후 Cafe24와 에이블리 연동 상태를 확인합니다.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950">
          <h2 className="font-semibold">운영 안전장치</h2>
          <p className="mt-2">
            상품 등록/수정은 외부 판매 채널에 영향을 줄 수 있으므로 자동 진열 또는 판매 시작은
            하지 않습니다. 최초 테스트는 상품 1개를 Cafe24 비진열/판매안함 상태로 등록한 뒤
            사람이 직접 확인합니다.
          </p>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold">Cafe24 인증 시작</h2>
          {authorizeUrl ? (
            <>
              <p className="mt-2 text-sm leading-7 text-neutral-600">
                아래 버튼은 Cafe24 Developers 환경변수가 설정된 배포 환경에서만 정상 동작합니다.
              </p>
              <a
                href={authorizeUrl}
                className="mt-4 inline-flex rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
              >
                Cafe24 OAuth 인증 시작
              </a>
            </>
          ) : (
            <p className="mt-2 text-sm leading-7 text-neutral-600">
              아직 <code>CAFE24_MALL_ID</code>, <code>CAFE24_CLIENT_ID</code>, 또는
              <code> NEXT_PUBLIC_SITE_URL</code>/<code>CAFE24_REDIRECT_URI</code> 환경변수가
              설정되지 않았습니다. Cafe24 Developers 앱 등록 후 Vercel 환경변수에 추가하세요.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export default Cafe24SyncInfoPage
