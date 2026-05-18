// PostgREST `.or()` 표현식 값에 사용자 입력을 직접 보간할 때, PostgREST 메타문자가
// 들어가면 predicate 경계를 벗어날 수 있어 인젝션 가능. 예:
//   query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
//   에서 search="*,is.null" 입력 시 두번째 predicate가 깨지고 `is.null` 분기로 우회됨.
//
// `.ilike.` value 안에서 위험한 5종 메타문자(`,` predicate 구분자, `(` `)` 그룹,
// `*` like 와일드카드 — PostgREST는 *를 %로 변환, `\` escape)를 제거.
// LIKE 와일드카드(`%`, `_`)는 fuzzy match 의도가 있을 수 있으므로 그대로 유지.
//
// 사용 예: query.or(`name.ilike.%${escapePostgrestLikeValue(search)}%`)
export const escapePostgrestLikeValue = (input: string): string =>
  input.replace(/[,()*\\]/g, "")
