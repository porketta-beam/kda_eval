# Phase 4-A: 빈 상태 온보딩

## 완료 조건 (테스트가 ground truth)

```bash
npx playwright test tests/e2e/empty-state.spec.js --reporter=line 2>&1 | tail -20
```
**3 passed** + 회귀 없음:
```bash
npx playwright test tests/e2e/kda-workflow.spec.js tests/e2e/recursive-nav.spec.js --reporter=line 2>&1 | tail -10
```

---

## 테스트가 요구하는 것

1. 학생 0명 기수 eval → `getByText(/학생/).filter({ hasText: /추가|먼저|없습니다/ })` + `getByRole('link', { name: /학생/ })`
2. 학생 있고 카테고리 없는 기수 eval → `getByText(/평가|항목/).filter({ hasText: /추가|없습니다|설정/ })`
3. 학생 + 카테고리 있는 기수 eval → `<table>` 보임, "학생을 먼저"/"평가 항목을 추가" 텍스트 없음

---

## 아키텍처 컨텍스트

**수정 대상 파일:**
- `src/components/eval/EvalNode.jsx` — `isRoot` 분기 내 빈 상태 조건부 렌더

**기존 관련 코드:**
- `EvalNode.jsx` — `isRoot` 판단 로직, `students?.students` 배열 접근 경로, `sortedCategories` 파악
- eval 페이지 파일: `src/app/cohort/[id]/eval/[[...path]]/page.jsx` — EvalNode에 전달되는 props 확인 (cohortId prop 존재 여부)

**주의사항:**
- 학생 관리 링크는 `<a>` 또는 `<Link>` — `role='link'` 필요 (`<button>` 불가)
- href: `/cohort/${cohortId}/students` 형태
- 온보딩 분기는 isRoot + 조건부 → 정상 상태에서 기존 테이블 렌더 경로 방해 금지
- cohortId를 EvalNode에서 어떻게 접근하는지 먼저 확인 (prop vs URL)
