# Phase 4-C: 셀 값 표기 구분 (▶ - / ▶ 6.0 / ▶ ⚠)

## 완료 조건 (테스트가 ground truth)

```bash
npx playwright test tests/e2e/cell-display.spec.js --reporter=line 2>&1 | tail -20
```
**3 passed** + 회귀 없음:
```bash
npx playwright test tests/e2e/kda-workflow.spec.js tests/e2e/recursive-nav.spec.js --reporter=line 2>&1 | tail -10
```

---

## 테스트가 요구하는 것

1. 미입력 셀 → `▶ -` 텍스트 + `data-cell-state="empty"` 속성
2. 점수 입력 후 → `▶ 6.0` 텍스트 + `data-cell-state="ok"` 속성
3. formula 오류 composite 셀 → `[data-cell-state="error"]` 또는 `⚠` 포함

---

## 아키텍처 컨텍스트

**수정 대상 파일:**
- `src/components/eval/DataTable.jsx` — 셀 렌더 버튼에 `data-cell-state` 속성 추가 + 값 표시 로직

**기존 관련 코드:**
- `DataTable.jsx` — 현재 셀 값 표시 방식(`formatValue` 또는 유사 함수), 셀 데이터 접근 경로 먼저 파악
- `src/lib/table-helpers.js:36` — `buildCellData()` — 셀 데이터 구조 확인
- scoring engine이 반환하는 `{ calculated, error }` 구조가 DataTable까지 전달되는지 추적

**데이터 흐름 확인 포인트:**
- `scores?calculated=true` API 응답 → `calculated[catId][studentId]` 구조
- 이 데이터가 DataTable의 cellData prop으로 어떻게 변환되는지
- `error` 필드가 중간 어디서 유실되는지 확인

**주의사항:**
- 미입력 셀: `calculated === null` vs `calculated === 0` 구분 — `null/undefined`일 때 `-` 표시
- `▶ ` prefix는 현재 이미 있을 수 있음 — 기존 패턴 확인 후 최소 변경
- Phase 3-B fallback이 적용된 경우 formula 오류가 사라질 수 있음 → 테스트 3은 `data-cell-state="error"` OR `⚠` 둘 중 하나면 통과
