import { Metadata } from 'next'
import Link from 'next/link'
import { PackageX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false },
}

const NotFound = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <PackageX size={64} className="mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-bold mt-6">페이지를 찾을 수 없습니다</h1>
        <p className="text-muted-foreground mt-2">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <Button asChild>
            <Link href="/">홈으로 돌아가기</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/products">전체 상품 보기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NotFound
