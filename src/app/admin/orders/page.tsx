"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ORDER_STATUS_LABEL } from "@/constants"
import {
  ADMIN_ORDER_STATUS_OPTIONS,
  isTerminalOrderStatus,
} from "@/lib/order/status-transitions"
import {
  ADMIN_CANCEL_REASONS,
  CANCELLATION_REASON_LABEL,
  type AdminCancelReason,
  type CancellationActor,
  type CancellationReason,
} from "@/lib/order/cancellation"
import { COURIER_SUGGESTIONS } from "@/lib/order/courier-suggestions"
import { InlineTrackingCell } from "@/components/admin/inline-tracking-cell"
import dayjs from "dayjs"

const STATUS_TABS = [
  { value: "ALL", label: "전체" },
  { value: "PAID", label: "결제완료" },
  { value: "PREPARING", label: "준비중" },
  { value: "SHIPPING", label: "배송중" },
  { value: "DELIVERED", label: "배송완료" },
  { value: "CANCELLED", label: "취소/교환/반품" },
]

interface OrderRow {
  id: string
  order_no: string
  status: string
  paid_amount: number
  created_at: string
  recipient: string
  recipient_phone: string
  courier: string | null
  tracking_no: string | null
  cancellation_actor: CancellationActor | null
  cancellation_reason: CancellationReason | null
  cancellation_note: string | null
  order_items: { product_name: string; quantity: number }[]
}

const AdminOrdersPage = () => {
  const { toast } = useToast()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // 어드민 취소 다이얼로그 — 사유 입력 강제 (Track C)
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState<AdminCancelReason>(
    ADMIN_CANCEL_REASONS[0]
  )
  const [cancelNote, setCancelNote] = useState("")
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (search) params.set("search", search)

    const res = await fetch(`/api/admin/orders?${params}`)
    const data = await res.json()
    setOrders(data.error ? [] : data)
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // CANCELLED는 사유 입력 강제 — 전용 모달로 분기
    if (newStatus === "CANCELLED") {
      setCancelOrderId(orderId)
      setCancelReason(ADMIN_CANCEL_REASONS[0])
      setCancelNote("")
      return
    }

    await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchOrders()
    toast({ title: `주문 상태: ${ORDER_STATUS_LABEL[newStatus]}` })
  }

  const handleCancelSubmit = async () => {
    if (!cancelOrderId) return
    setCancelSubmitting(true)
    const res = await fetch(`/api/admin/orders/${cancelOrderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason, note: cancelNote || null }),
    })
    setCancelSubmitting(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "취소 처리 실패",
        description: err.error || "요청을 처리하지 못했습니다",
      })
      return
    }

    setCancelOrderId(null)
    fetchOrders()
    toast({
      title: `주문 취소 완료 — ${CANCELLATION_REASON_LABEL[cancelReason]}`,
    })
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return
    await fetch("/api/admin/orders/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, status: newStatus }),
    })
    setSelectedIds([])
    fetchOrders()
    toast({ title: `${selectedIds.length}건 상태 변경: ${ORDER_STATUS_LABEL[newStatus]}` })
  }

  // 송장 인라인 입력 후 부분 갱신 — fetchOrders 재호출 없이 row만 업데이트(P0 응답성).
  const updateOrderField = (
    id: string,
    field: "courier" | "tracking_no",
    value: string
  ) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value || null } : o))
    )
  }

  const handleCsvExport = () => {
    const header = "주문번호,주문자,연락처,상품,수량,금액,상태,주문일\n"
    const rows = orders
      .map((o) => {
        const itemName = o.order_items?.[0]?.product_name || ""
        const qty = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
        return `${o.order_no},${o.recipient},${o.recipient_phone},"${itemName}",${qty},${o.paid_amount},${ORDER_STATUS_LABEL[o.status] || o.status},${dayjs(o.created_at).format("YYYY-MM-DD")}`
      })
      .join("\n")

    const bom = "\uFEFF"
    const blob = new Blob([bom + header + rows], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `orders_${dayjs().format("YYYYMMDD")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      {/* 인라인 택배사 셀 공용 datalist (전 row 공유). */}
      <datalist id="courier-suggestions">
        {COURIER_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 관리</h1>
        <Button variant="outline" onClick={handleCsvExport}>
          <Download className="h-4 w-4 mr-2" />
          CSV 다운로드
        </Button>
      </div>

      {/* 상태 탭 */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs md:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 검색 + 일괄 액션 */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="주문번호, 주문자명, 핸드폰번호 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleBulkStatusChange("PREPARING")}>
              준비중 ({selectedIds.length})
            </Button>
            <Button size="sm" onClick={() => handleBulkStatusChange("SHIPPING")}>
              배송중 ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      {/* 취소 사유 다이얼로그 */}
      <Dialog
        open={cancelOrderId !== null}
        onOpenChange={(open) => !open && setCancelOrderId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>주문 취소 — 사유 선택</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">취소 사유</label>
              <Select
                value={cancelReason}
                onValueChange={(v) => setCancelReason(v as AdminCancelReason)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_CANCEL_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {CANCELLATION_REASON_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">메모 (선택)</label>
              <textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                rows={3}
                placeholder="고객 안내용 추가 설명을 입력하세요"
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              onClick={handleCancelSubmit}
              disabled={cancelSubmitting}
              className="w-full"
              variant="destructive"
            >
              {cancelSubmitting ? "처리 중..." : "주문 취소 실행"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 테이블 — 신규 컬럼 2개(택배사 140 + 송장번호 180) 추가로 합산 폭 ↑.
          모바일은 가로 스크롤 정책(데스크탑 주 사용). min-w로 셀 폭 보장 → 좁은 viewport에서도
          input + spinner + ExternalLink가 압축되지 않음. */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.length === orders.length && orders.length > 0}
                  onChange={() =>
                    setSelectedIds(
                      selectedIds.length === orders.length
                        ? []
                        : orders.map((o) => o.id)
                    )
                  }
                  className="h-4 w-4 rounded"
                />
              </th>
              <th className="p-3 text-left">주문번호</th>
              <th className="p-3 text-left">주문자</th>
              <th className="p-3 text-left hidden md:table-cell">상품</th>
              <th className="p-3 text-right">금액</th>
              <th className="p-3 text-center">상태</th>
              <th className="p-3 text-left hidden md:table-cell">일자</th>
              <th className="p-3 text-left w-[140px]">택배사</th>
              <th className="p-3 text-left w-[180px]">송장번호</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  주문이 없습니다.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="h-4 w-4 rounded"
                    />
                  </td>
                  <td className="p-3 font-mono text-xs">{order.order_no}</td>
                  <td className="p-3">
                    <p>{order.recipient}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.recipient_phone}
                    </p>
                  </td>
                  <td className="p-3 hidden md:table-cell max-w-[200px] truncate">
                    {order.order_items?.[0]?.product_name || "-"}
                    {(order.order_items?.length || 0) > 1 &&
                      ` 외 ${order.order_items.length - 1}건`}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {order.paid_amount.toLocaleString()}원
                  </td>
                  <td className="p-3 text-center">
                    <Select
                      value={order.status}
                      onValueChange={(v) => handleStatusChange(order.id, v)}
                      disabled={isTerminalOrderStatus(order.status)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADMIN_ORDER_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {ORDER_STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {order.status === "CANCELLED" && order.cancellation_reason && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {CANCELLATION_REASON_LABEL[order.cancellation_reason]}
                        {order.cancellation_actor === "ADMIN" && " · 판매자"}
                        {order.cancellation_actor === "SYSTEM" && " · 시스템"}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                    {dayjs(order.created_at).format("MM/DD HH:mm")}
                  </td>
                  <td className="p-2">
                    <InlineTrackingCell
                      orderId={order.id}
                      field="courier"
                      initialValue={order.courier}
                      disabled={isTerminalOrderStatus(order.status)}
                      onSaved={(v) => updateOrderField(order.id, "courier", v)}
                    />
                  </td>
                  <td className="p-2">
                    <InlineTrackingCell
                      orderId={order.id}
                      field="tracking_no"
                      initialValue={order.tracking_no}
                      disabled={isTerminalOrderStatus(order.status)}
                      onSaved={(v) =>
                        updateOrderField(order.id, "tracking_no", v)
                      }
                      courierForUrl={order.courier}
                    />
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

export default AdminOrdersPage
