---
name: pr
description: Pull Request를 생성합니다. "PR", "풀리퀘스트", "PR 만들어줘", "머지 요청", "pull request" 등의 요청 시 자동 실행.
---

# Pull Request 생성

## 실행 절차

### Step 1: 현재 상태 확인

```bash
git branch --show-current
git log main..HEAD --oneline
git diff main --name-only --stat
```

main 브랜치에서 직접 PR을 만들려고 하면 **중단**하고 피처 브랜치 생성을 제안하라.

### Step 2: 미커밋 변경사항 처리

```bash
git status --short
```

미커밋 변경사항이 있으면 **먼저 commit 스킬을 실행**하라.

### Step 3: 원격 푸시

```bash
BRANCH=$(git branch --show-current)
git push origin $BRANCH
```

### Step 4: PR 본문 생성

아래 템플릿에 따라 PR 본문을 작성하라:

```markdown
## 📋 작업 요약
## 🔄 변경 내역
### 추가 / 수정 / 삭제
## 📁 변경 파일
| 파일 | 변경 내용 |
|------|-----------|
## 🧪 테스트
- [ ] TypeScript 타입 체크 통과
- [ ] ESLint 통과
- [ ] 로컬 빌드 성공
- [ ] 주요 기능 수동 테스트 완료
## 🏷️ 카테고리
- [ ] 🆕 새 기능 / 🐛 버그 수정 / ♻️ 리팩토링 / 💄 스타일 / 🗃️ DB / ⚙️ 설정
## 📝 참고사항
```

### Step 5: PR 타이틀

Conventional Commits: `<type>(<scope>): <한국어 설명>`

### Step 6: PR 생성

```bash
gh pr create --title "<타이틀>" --body "<본문>" --base main --head $(git branch --show-current)
```

gh CLI가 없으면: `https://github.com/kaos1025/jullyssy-mall/compare/main...<브랜치명>`

## 주의사항

- DB 마이그레이션 포함 시 ⚠️ 경고 추가
- 결제 로직 변경 시 ⚠️ 경고 추가
- 환경변수 변경 시 ⚠️ Vercel 업데이트 필요 경고 추가
