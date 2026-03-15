# Phase 3-A: input_scope:'team' 팀 입력 모드

## 완료 조건 (테스트가 ground truth)

```bash
npx playwright test tests/e2e/team-score-input.spec.js --reporter=line 2>&1 | tail -30
```
**5 passed** + 회귀 없음:
```bash
npx playwright test tests/e2e/kda-workflow.spec.js tests/e2e/recursive-nav.spec.js --reporter=line 2>&1 | tail -10
```

---

## 테스트가 요구하는 것

1. `/cohort/:id/eval/:catId/:subCatId` — 팀 행 3개 표시 (학생 행 아님), 행 수 = weight row + 3
2. `[data-testid="input-scope-badge"]` — "팀별" 텍스트 포함
3. 점수 저장 시 key = teamId (studentId가 아님)
4. 같은 팀 학생 전원 `calculated` 동일
5. `/cohort/:id/eval` 요약 페이지에서 팀 점수가 composite에 반영됨

---

## 아키텍처 컨텍스트

**데이터 흐름:**
- config의 `teams` 배열 → `[{ id, name, members: [studentId] }]`
- sub-category에 `input_scope: 'team'` 필드 존재
- scoring engine (`src/lib/scoring-engine/index.js`) — `calculateTeamCategory()` 이미 구현됨. UI만 수정하면 됨

**수정 대상 파일:**
- `src/components/eval/DataTable.jsx` — 현재 `students` 배열로 행 렌더. 팀 모드에서 `teams` 배열을 받을 수 있어야 함. 기존 students prop 동작 유지 필수 (하위 호환)
- `src/components/eval/EvalNode.jsx` — `category.input_scope === 'team'` 분기로 DataTable에 teams/students 중 선택 전달. `config?.teams` 접근 방식은 EvalNode 내 기존 config 로딩 패턴 참고

**기존 관련 코드:**
- `EvalNode.jsx:278-286` — `input_scope === 'team'` 배지 표시 이미 있음 (`data-testid="input-scope-badge"`)
- `src/lib/scoring-engine/index.js:60` — `calculateTeamCategory()` 완성됨

---

## 주의사항

- `isTeamScope` 조건이 false일 때 기존 students 경로 그대로 유지
- 점수 저장 key: row.id가 곧 teamId가 되도록 rows 배열 구성
- scoring engine은 **수정하지 않는다**
