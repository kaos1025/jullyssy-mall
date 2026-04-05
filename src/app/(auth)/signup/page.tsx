"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatPhoneNumber } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

const SignupPage = () => {
  const router = useRouter()
  const { toast } = useToast()

  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    phone: "",
  })
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    marketing: false,
  })
  const [loading, setLoading] = useState(false)

  const allRequired = agreements.terms && agreements.privacy
  const allChecked = agreements.terms && agreements.privacy && agreements.marketing

  const handleAllAgree = (checked: boolean) => {
    setAgreements({ terms: checked, privacy: checked, marketing: checked })
  }

  const updateAgreement = (field: keyof typeof agreements, checked: boolean) => {
    setAgreements((prev) => ({ ...prev, [field]: checked }))
  }

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (form.password !== form.passwordConfirm) {
      toast({
        variant: "destructive",
        title: "비밀번호 불일치",
        description: "비밀번호와 비밀번호 확인이 일치하지 않습니다.",
      })
      return
    }

    if (form.password.length < 6) {
      toast({
        variant: "destructive",
        title: "비밀번호 오류",
        description: "비밀번호는 6자 이상이어야 합니다.",
      })
      return
    }

    if (!allRequired) {
      toast({
        variant: "destructive",
        title: "필수 약관에 동의해주세요",
      })
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
          phone: form.phone,
          marketing_agreed: agreements.marketing,
        },
      },
    })

    if (error) {
      toast({
        variant: "destructive",
        title: "회원가입 실패",
        description: error.message,
      })
      setLoading(false)
      return
    }

    toast({
      title: "회원가입 완료",
      description: "이메일 인증 후 로그인해주세요.",
    })
    router.push("/login")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">회원가입</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일 *</Label>
            <Input
              id="email"
              type="email"
              placeholder="이메일을 입력하세요"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호 *</Label>
            <Input
              id="password"
              type="password"
              placeholder="6자 이상 입력하세요"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passwordConfirm">비밀번호 확인 *</Label>
            <Input
              id="passwordConfirm"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={form.passwordConfirm}
              onChange={(e) => updateField("passwordConfirm", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              type="text"
              placeholder="이름을 입력하세요"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">연락처</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => updateField("phone", formatPhoneNumber(e.target.value))}
              maxLength={13}
            />
          </div>

          {/* 약관 동의 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="agreeAll"
                checked={allChecked}
                onCheckedChange={(checked) => handleAllAgree(!!checked)}
              />
              <Label htmlFor="agreeAll" className="font-medium">
                전체 동의
              </Label>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Checkbox
                id="agreeTerms"
                checked={agreements.terms}
                onCheckedChange={(checked) => updateAgreement("terms", !!checked)}
              />
              <Label htmlFor="agreeTerms" className="text-sm font-normal">
                <span className="text-primary">[필수]</span> 이용약관 동의
              </Label>
              <Link
                href="/terms"
                target="_blank"
                className="text-xs underline text-muted-foreground ml-auto"
              >
                보기
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="agreePrivacy"
                checked={agreements.privacy}
                onCheckedChange={(checked) => updateAgreement("privacy", !!checked)}
              />
              <Label htmlFor="agreePrivacy" className="text-sm font-normal">
                <span className="text-primary">[필수]</span> 개인정보 수집·이용 동의
              </Label>
              <Link
                href="/privacy"
                target="_blank"
                className="text-xs underline text-muted-foreground ml-auto"
              >
                보기
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="agreeMarketing"
                checked={agreements.marketing}
                onCheckedChange={(checked) => updateAgreement("marketing", !!checked)}
              />
              <Label htmlFor="agreeMarketing" className="text-sm font-normal">
                <span className="text-muted-foreground">[선택]</span> 마케팅 정보 수신 동의
              </Label>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !allRequired}>
            {loading ? "가입 중..." : "회원가입"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          이미 회원이신가요?{" "}
          <Link href="/login" className="text-primary hover:underline">
            로그인
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default SignupPage
