# Phase 3-C: 기수 생성 후 자동 이동

## 완료 조건 (테스트가 ground truth)

```bash
npx playwright test tests/e2e/cohort-creation.spec.js --reporter=line 2>&1 | tail -20
```
**2 passed** + 회귀 없음:
```bash
npx playwright test tests/e2e/kda-workflow.spec.js --reporter=line 2>&1 | tail -10
```

---

## 테스트가 요구하는 것

1. 기수 생성 성공 → URL이 `/cohort/[uuid]` 로 자동 이동 (waitForURL timeout 5000ms)
2. 중복 이름 생성 → URL은 `/` 유지, alert 또는 `[role="alert"]` 표시

---

## 아키텍처 컨텍스트

**수정 대상 파일:**
- `src/app/page.js` — `handleCreate()` 함수에서 기수 생성 성공 후 처리 로직

**기존 관련 코드:**
- `page.js` — `handleCreate()` 내 API POST 응답 처리 방식 확인. 현재 성공 시 `fetchCohorts()` 호출 후 홈 유지
- API `POST /api/cohorts` 응답 구조 확인 필요: `{ id: 'uuid' }` 형태인지
- `useRouter` 사용 여부 확인: 이미 import되어 있으면 그대로 활용

**주의사항:**
- 오류 분기(`!res.ok`)에서는 절대 router.push 호출 안 됨 (테스트 2 조건)
- 중복 이름 오류 처리는 현재 방식(alert 또는 인라인) 유지 — 테스트가 둘 다 허용
