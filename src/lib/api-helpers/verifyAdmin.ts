import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { adminEmails } from "@/lib/env"

/**
 * 어드민 이메일 화이트리스트 검증.
 * 12개 어드민 라우트에 복제되어 있던 verifyAdmin 함수의 단일 진입점.
 *
 * - 비로그인: null
 * - 비-어드민 이메일: null
 * - 통과: 현재 사용자 (User)
 *
 * 호출부는 null을 403 응답으로 변환할 책임이 있음.
 */
export const verifyAdmin = async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  if (!adminEmails.includes(user.email?.toLowerCase() || "")) return null
  return user
}
