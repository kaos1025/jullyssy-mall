"use client"

import { useState, useEffect, useCallback } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import dayjs from "dayjs"

interface MemberRow {
  id: string
  email: string
  name: string | null
  phone: string | null
  grade: string
  point: number
  created_at: string
  order_count: number
}

const AdminMembersPage = () => {
  const { toast } = useToast()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  // 포인트 지급 다이얼로그
  const [pointTarget, setPointTarget] = useState<MemberRow | null>(null)
  const [pointAmount, setPointAmount] = useState("")
  const [pointReason, setPointReason] = useState("")

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)

    const res = await fetch(`/api/admin/members?${params}`)
    const data = await res.json()
    setMembers(data.error ? [] : data)
    setLoading(false)
  }, [search])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handlePointAction = async () => {
    if (!pointTarget || !pointAmount || !pointReason) return
    const amount = parseInt(pointAmount, 10)
    if (isNaN(amount) || amount === 0) return

    const res = await fetch(`/api/admin/members/${pointTarget.id}/point`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        reason: pointReason,
        currentPoint: pointTarget.point,
      }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      toast({ variant: "destructive", title: "포인트 처리 실패", description: error })
      return
    }

    toast({
      title: `포인트 ${amount > 0 ? "지급" : "차감"} 완료`,
      description: `${pointTarget.name || pointTarget.email}에게 ${Math.abs(amount).toLocaleString()}P ${amount > 0 ? "지급" : "차감"}`,
    })

    setPointTarget(null)
    setPointAmount("")
    setPointReason("")
    fetchMembers()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">회원 관리</h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="이름, 이메일, 핸드폰 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">이름</th>
              <th className="p-3 text-left">이메일</th>
              <th className="p-3 text-left hidden md:table-cell">연락처</th>
              <th className="p-3 text-center">등급</th>
              <th className="p-3 text-right">포인트</th>
              <th className="p-3 text-right hidden md:table-cell">주문수</th>
              <th className="p-3 text-left hidden md:table-cell">가입일</th>
              <th className="p-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  회원이 없습니다.
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{member.name || "-"}</td>
                  <td className="p-3 text-muted-foreground">{member.email}</td>
                  <td className="p-3 hidden md:table-cell">
                    {member.phone || "-"}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline">{member.grade}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    {member.point.toLocaleString()}P
                  </td>
                  <td className="p-3 text-right hidden md:table-cell">
                    {member.order_count}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                    {dayjs(member.created_at).format("YYYY-MM-DD")}
                  </td>
                  <td className="p-3 text-center">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setPointTarget(member)}
                        >
                          포인트
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            포인트 지급/차감 — {member.name || member.email}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            현재 보유: {member.point.toLocaleString()}P
                          </p>
                          <div>
                            <Label>금액 (양수: 지급, 음수: 차감)</Label>
                            <Input
                              type="number"
                              placeholder="예: 1000 또는 -500"
                              value={pointAmount}
                              onChange={(e) => setPointAmount(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>사유</Label>
                            <Input
                              placeholder="포인트 지급 사유"
                              value={pointReason}
                              onChange={(e) => setPointReason(e.target.value)}
                            />
                          </div>
                          <Button onClick={handlePointAction} className="w-full">
                            처리
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminMembersPage
