import { describe, it, expect } from "vitest"
import {
  CLAIM_DRIVEN_TRANSITIONS,
  claimRequestedOrderStatus,
  claimTerminalOrderStatus,
  ADMIN_ORDER_STATUS_ALLOWED,
  ADMIN_ORDER_STATUS_BULK_ALLOWED,
  isAdminOrderStatusAllowed,
  isAdminOrderStatusBulkAllowed,
  isTerminalOrderStatus,
} from "./status-transitions"

// US-013: claim 구동 전이 SSOT가 어드민 직접 전이 화이트리스트와 분리되어 있는지 회귀 고정.
describe("CLAIM_DRIVEN_TRANSITIONS (claim → orders.status SSOT)", () => {
  it("RETURN: requested=RETURN_REQUESTED, terminal=RETURNED", () => {
    expect(CLAIM_DRIVEN_TRANSITIONS.RETURN).toEqual({
      requested: "RETURN_REQUESTED",
      terminal: "RETURNED",
    })
  })

  it("EXCHANGE: requested=EXCHANGE_REQUESTED, terminal=EXCHANGED", () => {
    expect(CLAIM_DRIVEN_TRANSITIONS.EXCHANGE).toEqual({
      requested: "EXCHANGE_REQUESTED",
      terminal: "EXCHANGED",
    })
  })

  it("claimRequestedOrderStatus 헬퍼 매핑", () => {
    expect(claimRequestedOrderStatus("RETURN")).toBe("RETURN_REQUESTED")
    expect(claimRequestedOrderStatus("EXCHANGE")).toBe("EXCHANGE_REQUESTED")
  })

  it("claimTerminalOrderStatus 헬퍼 매핑", () => {
    expect(claimTerminalOrderStatus("RETURN")).toBe("RETURNED")
    expect(claimTerminalOrderStatus("EXCHANGE")).toBe("EXCHANGED")
  })
})

describe("어드민 직접 전이 화이트리스트 — claim 전이와 분리", () => {
  it("claim 4종 status는 어드민 PATCH/bulk 화이트리스트에서 제외 (status만 바꾸는 진입로 차단)", () => {
    for (const s of [
      "RETURN_REQUESTED",
      "RETURNED",
      "EXCHANGE_REQUESTED",
      "EXCHANGED",
    ]) {
      expect(isAdminOrderStatusAllowed(s)).toBe(false)
      expect(isAdminOrderStatusBulkAllowed(s)).toBe(false)
    }
  })

  it("ADMIN_ORDER_STATUS_ALLOWED는 배송 운영 흐름만", () => {
    expect([...ADMIN_ORDER_STATUS_ALLOWED]).toEqual([
      "PREPARING",
      "SHIPPING",
      "DELIVERED",
    ])
  })

  it("bulk는 더 좁게 — DELIVERED 제외", () => {
    expect([...ADMIN_ORDER_STATUS_BULK_ALLOWED]).toEqual(["PREPARING", "SHIPPING"])
    expect(isAdminOrderStatusBulkAllowed("DELIVERED")).toBe(false)
  })

  it("isAdminOrderStatusAllowed: 비문자열/CANCELLED 거부", () => {
    expect(isAdminOrderStatusAllowed("SHIPPING")).toBe(true)
    expect(isAdminOrderStatusAllowed("CANCELLED")).toBe(false)
    expect(isAdminOrderStatusAllowed(123)).toBe(false)
    expect(isAdminOrderStatusAllowed(null)).toBe(false)
  })
})

describe("TERMINAL_ORDER_STATUSES", () => {
  it("CANCELLED/DELIVERED는 terminal", () => {
    expect(isTerminalOrderStatus("CANCELLED")).toBe(true)
    expect(isTerminalOrderStatus("DELIVERED")).toBe(true)
  })

  it("운영 중 status는 non-terminal", () => {
    expect(isTerminalOrderStatus("SHIPPING")).toBe(false)
    expect(isTerminalOrderStatus("RETURN_REQUESTED")).toBe(false)
    expect(isTerminalOrderStatus(undefined)).toBe(false)
  })
})
