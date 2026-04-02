/** 공통 UI 셀렉터 */
export const SEL = {
  // Auth
  emailInput: "#email",
  passwordInput: "#password",
  passwordConfirmInput: "#passwordConfirm",
  nameInput: "#name",
  phoneInput: "#phone",
  loginButton: 'button:has-text("로그인")',
  signupButton: 'button:has-text("회원가입")',
  kakaoButton: 'button:has-text("카카오로 시작하기")',

  // Cart
  addToCartButton: 'button:has-text("장바구니")',
  buyNowButton: 'button:has-text("바로구매")',
  orderButton: 'button:has-text("주문하기")',
  emptyCartText: "장바구니가 비어있습니다",

  // Checkout
  payButton: "결제하기",
  couponSelectButton: "쿠폰 선택",
  pointApplyButton: 'button:has-text("적용")',
  pointUseAllButton: 'button:has-text("전액사용")',

  // Admin
  adminHeader: "쥴리씨 관리자",
  saveButton: 'button:has-text("저장")',
  newProductButton: "상품 등록",
  searchButton: 'button:has-text("검색")',

  // Toast (Radix Toast)
  toast: "[data-radix-toast-viewport] li",
} as const
