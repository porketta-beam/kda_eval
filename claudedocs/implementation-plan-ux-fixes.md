# UX 이슈 수정 구현 계획 — Ralph Loop용

> 작성일: 2026-03-16
> 기반 문서: `claudedocs/ux-friction-report.md`
> 목적: 발견된 UX/기능 이슈를 ralph-loop로 순차 수정. 각 Phase는 독립 실행 가능.

---

## 전체 구조

```
Phase 3 (P0 기능 버그) — ralph-loop 먼저 실행
  ├── 3-A. input_scope:'team' 구현
  ├── 3-B. composite formula 기본값 + 오류 표시
  └── 3-C. 기수 생성 후 자동 이동

Phase 4 (P1/P2 UX 개선) — Phase 3 완료 후 실행
  ├── 4-A. 빈 상태 온보딩
  ├── 4-B. composite 카테고리 생성 시 formula 안내
  └── 4-C. ▶ - / ▶ 0.0 / ▶ ⚠ 표기 구분
```

---

## Phase 3-A: `input_scope: 'team'` 팀 입력 모드 구현

### 성공 기준 (E2E 테스트 기준)

```
tests/e2e/team-score-input.spec.js: 5 passed
```

### 테스트 시나리오

```javascript
// tests/e2e/team-score-input.spec.js

test('1. 팀 입력 카테고리 eval 페이지 — 팀 행 표시')
  // input_scope:'team' 카테고리 접근
  // ✅ 테이블 행 수 === 팀 수 (3행, 학생 8행 아님)
  // ✅ 행 이름이 팀 이름 ('1팀-큠', '2팀-펜타곤', '3팀-업어키움')
  // ✅ 학생 이름 행 없음

test('2. 팀 점수 입력 → teamId 키로 저장')
  // 1팀 완성도 입력 → blur
  // ✅ PUT /scores/[catId] 응답 200
  // ✅ GET /scores 결과에서 raw_scores[catId]의 키가 teamId ('team-qm')
  // ✅ raw_scores[catId]에 studentId 키 없음

test('3. 팀 점수 → 같은 팀 학생 동일 calculated 점수')
  // 팀 점수 입력 후 GET /scores?calculated=true
  // ✅ 1팀 학생 A, B, C의 calculated 동일
  // ✅ 2팀 학생과는 다른 점수

test('4. 팀 입력 모드 배지 표시')
  // ✅ [data-testid="input-scope-badge"] 표시

test('5. 팀별 가중치 행 — 팀 단위 weight 설정 가능')
  // ✅ 가중치 행이 존재하고 팀별로 설정 가능
```

### 구현 범위

| 파일 | 변경 내용 |
|------|---------|
| `src/components/eval/EvalNode.jsx` | `input_scope === 'team'`일 때 `students` 대신 `teams`를 행 데이터로 전달 |
| `src/components/eval/DataTable.jsx` | `rows` prop 추가 (students 배열 또는 teams 배열) — 행 렌더 분리 |
| `src/lib/scoring-engine/methods/user-input.js` | `input_scope === 'team'`일 때 teamId 키로 저장하도록 score 집계 수정 |

### 구현 힌트

```javascript
// EvalNode.jsx — 팀 모드일 때 rows를 teams로 교체
const isTeamScope = category?.input_scope === 'team';
const tableRows = isTeamScope
  ? (config?.teams || [])        // { id, name, members[] }
  : (students?.students || []);  // { id, name, ... }

// DataTable.jsx — studentId → rowId로 추상화
// rows = [{ id, name }] 형태로 통일
// cellData, overrides의 키도 rowId 기준

// 팀 점수 → 학생 calculated 매핑은 scoring engine에서 처리
// team-input spec의 기존 로직 참고: scores[teamId] → members 전파
```

---

## Phase 3-B: Composite Formula 기본값 + 오류 UI 표시

### 성공 기준 (E2E 테스트 기준)

```
tests/e2e/composite-formula.spec.js: 4 passed
```

### 테스트 시나리오

```javascript
// tests/e2e/composite-formula.spec.js

test('1. composite 카테고리 생성 직후 — formula 자동 생성')
  // POST /config/categories { scoring_method: 'composite', ... }
  // GET /config 확인
  // ✅ category.config.final_formula가 비어있지 않음
  // ✅ 기본값 = '_cat0 + _cat1 + ...' (sub_categories 수에 맞게)
  //    (sub_categories 없으면 빈 문자열 허용, 추가 시 자동 갱신)

test('2. formula 없거나 빈 문자열 상태 → eval 페이지 경고 UI 표시')
  // formula: '' 인 composite 카테고리 eval 페이지 접근
  // ✅ [data-testid="formula-warning"] 요소 표시
  // ✅ 경고 텍스트에 "최종 공식" 또는 "설정" 언급

test('3. ⚙ 설정 패널 — 변수명 힌트 목록 표시')
  // composite 카테고리 eval 페이지 → ⚙ 설정 열기
  // ✅ [data-testid="formula-var-hints"] 요소 존재
  // ✅ "_cat0 = 팀 평가" 형태의 텍스트 포함

test('4. 유효한 formula 저장 → 집계 정상 동작')
  // ⚙ 설정 → formula 입력 '_cat0 + _cat1' → 저장
  // sub-category 점수 입력 후
  // ✅ 계산 결과 calculated > 0
  // ✅ error 필드 없음
  // ✅ 전체 평가 사이드바에 해당 학생 총점 반영
```

### 구현 범위

| 파일 | 변경 내용 |
|------|---------|
| `src/lib/scoring-engine/methods/composite.js` | `final_formula`가 빈 문자열이면 sub scores 단순 합산으로 fallback |
| `src/components/eval/EvalNode.jsx` | formula 미설정 경고 UI 추가 (`data-testid="formula-warning"`) |
| `src/components/eval/InlineSettings.jsx` | composite 방식일 때 `data-testid="formula-var-hints"` 변수명 힌트 표시 |
| `src/lib/schema.js` | `createCategory`에서 composite 방식 선택 시 `final_formula` 기본값 생성 로직 |

### 구현 힌트

```javascript
// composite.js — formula fallback
const safeFormula = final_formula?.trim() || subCategories.map((_, i) => `_cat${i}`).join(' + ');

// EvalNode.jsx — 경고 조건
const showFormulaWarning =
  !isRoot &&
  category?.scoring_method === 'composite' &&
  !category?.config?.final_formula?.trim();

// InlineSettings.jsx — 힌트 렌더
{method === SCORING_METHOD.COMPOSITE && (
  <div data-testid="formula-var-hints" className="text-xs text-muted-foreground mt-1">
    {subCategories.map((s, i) => `_cat${i} = ${s.name}`).join(' | ')}
  </div>
)}
```

---

## Phase 3-C: 기수 생성 후 자동 이동

### 성공 기준 (E2E 테스트 기준)

```
tests/e2e/kda-workflow.spec.js: 10 passed  (기존 테스트 회귀 없음)
tests/e2e/cohort-creation.spec.js: 2 passed
```

### 테스트 시나리오

```javascript
// tests/e2e/cohort-creation.spec.js

test('1. 기수 생성 후 자동으로 해당 기수 대시보드로 이동')
  // 홈 → "새 기수 만들기" → 이름 입력 → 생성
  // ✅ URL이 /cohort/[생성된-id] 로 변경됨 (홈 유지 아님)
  // ✅ 페이지에 기수 이름 표시

test('2. 생성 시 오류 (중복 이름) — 다이얼로그 유지, 이동 없음')
  // 중복 이름으로 생성 시도
  // ✅ alert 또는 인라인 오류 메시지 표시
  // ✅ URL 변경 없음 (홈 유지)
```

### 구현 범위

| 파일 | 변경 내용 |
|------|---------|
| `src/app/page.js` | `handleCreate()` 성공 후 `router.push('/cohort/' + newId)` 추가 (라인 73 근처) |

### 구현 힌트

```javascript
// page.js handleCreate() 내부
const data = await res.json();
if (data.id) {
  router.push(`/cohort/${encodeURIComponent(data.id)}`);  // 자동 이동
}
```

---

## Phase 4-A: 빈 상태 온보딩

### 성공 기준

```
tests/e2e/empty-state.spec.js: 3 passed
```

### 테스트 시나리오

```javascript
// tests/e2e/empty-state.spec.js

test('1. 빈 기수 eval 페이지 — 온보딩 안내 표시')
  // 신규 기수 (학생 0명, 카테고리 0개) eval 접근
  // ✅ "학생을 먼저 추가하세요" 또는 유사 안내 텍스트 표시
  // ✅ 학생 관리 탭으로 이동하는 링크 존재

test('2. 학생 있고 카테고리 없는 경우 — 항목 추가 안내')
  // 학생 1명, 카테고리 0개인 기수 eval 접근
  // ✅ "평가 항목을 추가하세요" 또는 유사 안내 텍스트 표시
  // ✅ "항목 관리" 패널이 자동으로 펼쳐져 있거나 안내 링크 존재

test('3. 정상 상태 — 온보딩 메시지 없음')
  // 학생 + 카테고리 모두 있는 기수
  // ✅ 온보딩 메시지 없음, 정상 테이블 표시
```

### 구현 범위

| 파일 | 변경 내용 |
|------|---------|
| `src/components/eval/EvalNode.jsx` | root 뷰(`isRoot`)에서 빈 상태 분기 추가 |

### 구현 힌트

```javascript
// EvalNode.jsx — root 뷰 빈 상태 처리
if (isRoot) {
  const hasStudents = (students?.students?.length ?? 0) > 0;
  const hasCategories = sortedCategories.length > 0;

  if (!hasStudents) return (
    <div className="p-8 text-center text-muted-foreground">
      <p>학생을 먼저 추가해야 평가를 시작할 수 있습니다.</p>
      <Link href={`/cohort/${cohortId}/students`}>→ 학생 관리로 이동</Link>
    </div>
  );

  if (!hasCategories) return (
    <div className="p-8 text-center text-muted-foreground">
      <p>평가 항목이 없습니다. 항목을 추가하세요.</p>
      {/* CategoryCard(항목 관리) 컴포넌트를 기본 열림 상태로 렌더 */}
    </div>
  );
}
```

---

## Phase 4-B: composite 카테고리 생성 flow — formula 안내

### 성공 기준

```
tests/e2e/composite-creation-flow.spec.js: 2 passed
```

### 테스트 시나리오

```javascript
// tests/e2e/composite-creation-flow.spec.js

test('1. composite 카테고리 추가 다이얼로그 — formula 입력 필드 표시')
  // "평가항목 추가" 다이얼로그 열기 → 방식을 "복합"으로 선택
  // ✅ formula 입력 필드가 다이얼로그 내에 표시됨
  // ✅ 입력 필드에 placeholder 또는 힌트 텍스트 존재

test('2. 다이얼로그에서 formula 없이 생성 → eval 페이지에서 경고')
  // composite 카테고리 생성 (formula 없이)
  // eval 페이지 접근
  // ✅ formula 경고 표시 (Phase 3-B test 2와 동일 조건)
```

### 구현 범위

| 파일 | 변경 내용 |
|------|---------|
| `src/components/eval/CategoryCard.jsx` | 추가 다이얼로그에서 `scoring_method === 'composite'` 선택 시 formula 입력 필드 노출 |

---

## Phase 4-C: 셀 값 표기 구분 (`▶ -` / `▶ 0.0` / `▶ ⚠`)

### 성공 기준

```
tests/e2e/cell-display.spec.js: 3 passed
```

### 테스트 시나리오

```javascript
// tests/e2e/cell-display.spec.js

test('1. 미입력 상태 — ▶ - 표시')
  // 아무 점수도 없는 카테고리 셀
  // ✅ 셀 텍스트 = "▶ -"
  // ✅ [data-cell-state="empty"] 속성

test('2. 입력됨 + 계산 성공 — ▶ 6.0 표시')
  // 점수 입력 후 정상 계산된 셀
  // ✅ 셀 텍스트 = "▶ 6.0" (숫자)
  // ✅ [data-cell-state="ok"] 속성

test('3. composite formula 오류 — ▶ ⚠ 표시')
  // formula 오류 있는 composite 카테고리 셀
  // ✅ 셀에 ⚠ 아이콘 또는 오류 표시
  // ✅ [data-cell-state="error"] 속성
```

### 구현 범위

| 파일 | 변경 내용 |
|------|---------|
| `src/components/eval/DataTable.jsx` | `formatValue`에 오류 상태 추가, 셀에 `data-cell-state` 속성 부여 |
| `src/lib/table-helpers.js` | `buildCellData`에서 계산 오류 정보 셀 데이터에 포함 |

### 구현 힌트

```javascript
// DataTable.jsx
const formatValue = (v, error) => {
  if (error) return '⚠';
  if (v == null) return '-';
  if (typeof v === 'number') return v.toFixed(1);
  return v;
};

// 셀 렌더
<button
  data-cell-state={error ? 'error' : v == null ? 'empty' : 'ok'}
  onClick={() => onColumnClick?.(col)}
>
  ▶ {formatValue(v, error)}
</button>
```

---

## Ralph Loop 실행 순서

### Phase 3 (먼저 실행 — 기능 broken 수정)

```bash
# PROMPT_phase3a.md 생성 후:
/ralph-loop "PROMPT_phase3a.md를 읽고 팀 입력 모드를 구현한다" \
  --completion-promise "PHASE3A COMPLETE" \
  --max-iterations 10

# 완료 후:
/ralph-loop "PROMPT_phase3b.md를 읽고 composite formula 기본값과 오류 UI를 구현한다" \
  --completion-promise "PHASE3B COMPLETE" \
  --max-iterations 8

# 완료 후:
/ralph-loop "PROMPT_phase3c.md를 읽고 기수 생성 후 자동 이동을 구현한다" \
  --completion-promise "PHASE3C COMPLETE" \
  --max-iterations 4
```

### Phase 4 (Phase 3 완료 후)

```bash
/ralph-loop "PROMPT_phase4.md를 읽고 UX 개선 항목들을 순서대로 구현한다" \
  --completion-promise "PHASE4 COMPLETE" \
  --max-iterations 12
```

---

## 각 PROMPT_phase 파일 공통 구조

```markdown
# Phase X: [제목]

## 1. 현재 상태 확인 (매 반복 시작 시 실행)
npx playwright test tests/e2e/[spec파일] --reporter=line 2>&1 | tail -20

모든 테스트 통과 시:
<promise>PHASE_X COMPLETE</promise>

기존 테스트 회귀 없음 확인:
npx playwright test tests/e2e/kda-workflow.spec.js --reporter=line 2>&1 | tail -5

## 2. 구현 목표
[성공 기준 테스트 목록]

## 3. 설계 참조
claudedocs/implementation-plan-ux-fixes.md — Phase X 섹션

## 4. 구현 순서
[파일별 변경 내용 + 힌트]

## 5. 완료 조건
[spec파일]: N passed
kda-workflow.spec.js: 10 passed (회귀 없음)
```

---

## 테스트 파일별 의존성

```
kda-workflow.spec.js        ← 기존 (회귀 감지용, 모든 phase에서 통과 필수)
team-input.spec.js          ← 기존 (Phase 3-A 완료 기준)
recursive-nav.spec.js       ← 기존 (Phase 3 전체에서 통과 유지)

team-score-input.spec.js    ← Phase 3-A 신규 작성 필요
composite-formula.spec.js   ← Phase 3-B 신규 작성 필요
cohort-creation.spec.js     ← Phase 3-C 신규 작성 필요
empty-state.spec.js         ← Phase 4-A 신규 작성 필요
composite-creation-flow.spec.js ← Phase 4-B 신규 작성 필요
cell-display.spec.js        ← Phase 4-C 신규 작성 필요
```

---

## 우선순위 요약

| Phase | 이슈 | 난이도 | 예상 iterations |
|-------|------|--------|----------------|
| 3-A | 팀 입력 모드 구현 | 높음 (DataTable rows 추상화 필요) | 6~10 |
| 3-B | formula 기본값 + 오류 UI | 중간 | 4~6 |
| 3-C | 기수 생성 자동 이동 | 낮음 (1줄 수정) | 2~3 |
| 4-A | 빈 상태 온보딩 | 낮음 | 2~4 |
| 4-B | composite 생성 flow | 중간 | 4~6 |
| 4-C | 셀 표기 구분 | 낮음 | 2~4 |
