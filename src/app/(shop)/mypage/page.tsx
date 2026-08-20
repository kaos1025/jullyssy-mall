import { redirect } from "next/navigation"

// (shop) 레이아웃이 정적(ISR)이 된 뒤에도 /mypage는 서버 307로 유지해야 한다 — 정적 prerender되면
// redirect()가 HTML/RSC에 NEXT_REDIRECT로 구워져 200 + 클라이언트 리다이렉트(하이드레이션 후)로 퇴화.
export const dynamic = "force-dynamic"

const MypagePage = () => {
  redirect("/mypage/orders")
}

export default MypagePage
