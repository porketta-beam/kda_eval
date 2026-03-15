# Phase 3-B: Composite Formula 기본값 + 오류 UI

## 완료 조건 (테스트가 ground truth)

```bash
npx playwright test tests/e2e/composite-formula.spec.js --reporter=line 2>&1 | tail -30
```
**4 passed** + 회귀 없음:
```bash
npx playwright test tests/e2e/kda-workflow.spec.js tests/e2e/recursive-nav.spec.js --reporter=line 2>&1 | tail -10
```

---

## 테스트가 요구하는 것

1. `config.final_formula === ''` 인 composite → `[data-testid="formula-warning"]` 표시
2. 설정 패널 열기 → `[data-testid="formula-var-hints"]` 에 `_cat0`, `_cat1`, 서브카테고리 이름 포함
3. formula 저장 후 → `calculated > 0`, `error` 없음
4. formula 있는 composite → 처음부터 집계 정상 (`calculated === 8`)

---

## 아키텍처 컨텍스트

**문제 원인:**
- `src/lib/scoring-engine/methods/composite.js` — `final_formula`가 빈 문자열이면 parser가 `unexpected TEOF: EOF` 오류를 던짐
- sub-category 변수명은 `_cat0`, `_cat1`, ... (인덱스 기반)

**수정 대상 파일:**
- `src/lib/scoring-engine/methods/composite.js` — formula 빈 경우 fallback 합산 로직 추가. 기존 formula가 있으면 기존 동작 유지 (override 금지)
- `src/components/eval/EvalNode.jsx` — composite이고 formula 미설정 시 경고 배너 렌더
- `src/components/eval/InlineSettings.jsx` — composite 방식 formula 입력 영역 아래 변수명 힌트 추가

**기존 관련 코드:**
- `InlineSettings.jsx` — `category` prop 받는 방식, COMPOSITE case 처리 위치 확인 필요
- `EvalNode.jsx` — `category?.config?.final_formula` 접근 경로, 기존 isRoot 분기 구조

**주의사항:**
- `final_formula?.trim()` 으로 undefined/null/빈문자열 모두 처리
- fallback이 동작하면 Phase 4-C 테스트 3과 충돌 가능 → 테스트 3은 `data-cell-state="error"` OR `⚠` 둘 중 하나면 통과하므로 확인 필요
