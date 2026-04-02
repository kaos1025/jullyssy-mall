export const TEST_USER = {
  email: "e2e-user@test.jullyssy.com",
  password: "TestPass123!",
  name: "E2E테스트유저",
  phone: "01099990001",
}

export const TEST_ADMIN = {
  email: "e2e-admin@test.jullyssy.com",
  password: "TestPass123!",
  name: "E2E관리자",
}

export const TEST_ADDRESS = {
  recipient: "테스트수령인",
  phone: "01012345678",
  zipcode: "06234",
  address1: "서울 강남구 테헤란로 123",
  address2: "테스트 상세주소 101호",
  memo: "문 앞에 놓아주세요",
}

export const PREFIXES = {
  auth: "[E2E-auth]",
  order: "[E2E-order]",
  adminProd: "[E2E-admin-prod]",
  adminOrder: "[E2E-admin-order]",
  coupon: "[E2E-coupon]",
} as const
