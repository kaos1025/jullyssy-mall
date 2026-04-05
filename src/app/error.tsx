'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const Error = ({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle size={64} className="mx-auto text-destructive" />
        <h1 className="text-2xl font-bold mt-6">문제가 발생했습니다</h1>
        <p className="text-muted-foreground mt-2">
          일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <Button onClick={() => reset()}>다시 시도</Button>
          <Button variant="outline" asChild>
            <Link href="/">홈으로 돌아가기</Link>
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-4 text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
      </div>
    </div>
  )
}

export default Error
