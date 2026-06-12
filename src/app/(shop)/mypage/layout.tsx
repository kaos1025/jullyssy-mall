import type { Metadata } from "next"
import type { ReactNode } from "react"

// 마이페이지(개인 영역) 전체 색인 제외. 하위 (with-sidebar)/(focused) 라우트가 모두 상속한다.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const MyPageLayout = ({ children }: { children: ReactNode }) => {
  return <>{children}</>
}

export default MyPageLayout
