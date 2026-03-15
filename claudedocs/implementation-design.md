# 구현 설계 보고서

> 분석 기반: `recursive-table-analysis.md`, 사용자 요구사항 명확화, Google Sheet 구조 분석, 전체 소스코드 검토

---

## 구현 진행 현황

| Phase | 설명 | 상태 |
|-------|------|------|
| Phase 1 | 팀 입력 모드 (input_scope) 스코어링 엔진 구현 | ✅ 완료 |
| Phase 2 | EvalNode 재귀 네비게이션 (catch-all URL) | ⏳ 대기 |

### Phase 1 완료 내역 (2026-03-16)

**수정 파일:**
- `src/lib/schema.js` — `EvaluationCategory`에 `input_scope` 필드 추가, `createCategory()` 기본값 `'student'` 추가
- `src/lib/scoring-engine/index.js` — `calculateTeamCategory()` 함수 추가, `calculateCategory()` 분기 추가
- `src/lib/scoring-engine/methods/composite.js` — expr-eval 한글 변수명 미지원 버그 수정

**테스트 결과:**
```
test:scoring  → 20 passed, 0 failed  (기존 회귀 없음)
test:team     → 14 passed, 0 failed  (신규 팀 입력 모드 전부 통과)
```

**발견된 추가 이슈 및 수정:**
> `composite.js`에서 하위 카테고리 이름이 한글(예: '팀평가', '동료평가')인 경우
> `expr-eval`이 `Unknown character "팀"` 오류를 던지며 `calculated: 0`을 반환하는 문제 발견.
>
> **원인:** expr-eval은 ASCII 식별자만 지원함.
>
> **해결:** 수식 평가 전, 각 하위 카테고리 이름을 `_cat0`, `_cat1`, ...으로 치환한 뒤 평가.
> ASCII 이름은 단어 경계(`\b`)로, 한글 이름은 정확한 문자열 매칭으로 치환.
> 기존 영문 변수명 수식(`(team + individual) * 15 / 100`)도 동일하게 동작 확인.

---

## 목표 아키텍처 요약

```
현재                              목표
──────────────────────────────    ──────────────────────────────────────────
Dashboard (집계 전용)              EvalNode (통합 재귀 컴포넌트)
 └─ EvalPage (입력 전용)            └─ /eval/[[...path]] (catch-all URL)
     └─ SlidePanel (기능 제한)          └─ 팀 입력 / 학생 입력 모드 지원
```

### 핵심 설계 원칙

1. **하나의 컴포넌트, 무한 depth** — EvalNode가 루트든 하위 노드든 동일하게 동작
2. **scope로 분리** — 팀 단위 입력과 학생 단위 입력을 `input_scope` 속성으로 구분
3. **기존 composite 재활용** — 팀 점수 + 개인 점수 혼합은 새 타입이 아닌 composite 구조로 해결
4. **최소 변경** — 스코어링 엔진 핵심 로직, API 라우트, 저장 서비스는 최대한 유지

---

## 1. 데이터 모델 변경

### 1-1. EvaluationCategory 스키마 추가 (`schema.js`)

```javascript
// 기존 필드 유지, 아래 1개만 추가
EvaluationCategory: {
  id, name, order, max_score, is_bonus,
  scoring_method, config,
  input_fields,
  weight,
  sub_categories,

  // ★ NEW: 입력 단위 (없으면 'student' 기본값)
  input_scope: 'student' | 'team',
}
```

**변경 범위:** `schema.js`의 typedef 주석 + `createCategory()` 팩토리 함수에 기본값 추가.

### 1-2. 점수 저장 구조 — 변경 없음

현재 구조:
```json
{
  "raw_scores": {
    "[categoryId]": {
      "[entityId]": {
        "[fieldId]": value
      }
    }
  }
}
```

`input_scope === 'team'`인 카테고리: **entityId 자리에 teamId가 들어갑니다.**

- `bulkUpdateScores()`는 entityId를 그대로 저장 → 서비스 레이어 변경 없음
- API 라우트 변경 없음
- 스코어링 엔진이 `input_scope`를 보고 teamId로 해석

**이유:** 팀ID와 학생ID 모두 UUID라 키 충돌 없음. 서비스가 타입을 몰라도 됨.

---

## 2. 스코어링 엔진 변경

### 2-1. `calculateCategory` 분기 추가 (`scoring-engine/index.js`)

```
현재 흐름:
  composite? → composite.calculate()
  sub_categories? → augmented 경로
  기본 → method.calculate()

추가할 분기:
  input_scope === 'team' → calculateTeamCategory()
```

```javascript
// 새로 추가할 함수
function calculateTeamCategory(category, allRawScores, students, teams) {
  const teamScores = allRawScores[category.id] || {};

  // 팀별 계산
  const teamResults = {};
  for (const team of teams) {
    const singleTeamScores = { [team.id]: teamScores[team.id] || {} };
    const result = method.calculate(
      category,
      singleTeamScores,
      [{ id: team.id, name: team.name }], // 팀을 단일 엔티티처럼 처리
      []
    );
    teamResults[team.id] = result[team.id] ?? { raw: null, calculated: 0 };
  }

  // 팀 점수를 학생에게 배분
  const studentResults = {};
  for (const student of students) {
    const teamId = student.team_id;
    studentResults[student.id] = teamResults[teamId]
      ?? { raw: null, calculated: 0 };
  }
  return studentResults;
}
```

**핵심:** 팀에 속하지 않은 학생은 0점. 팀이 변경되면 재계산 시 반영.

### 2-2. COMPOSITE에서 팀 sub_category 처리

`composite.js`는 이미 `calculateCategory(sub, ...)`를 재귀 호출합니다. sub-category가 `input_scope: 'team'`이면 위의 `calculateTeamCategory`가 호출되고, 결과를 학생별로 반환하므로 **composite 로직 변경 없음.**

### 2-3. 실제 2차 프로젝트 구성 예시

```
2차 프로젝트 (COMPOSITE, 20점)
  config.final_formula: "(팀평가 / 70 * 14) + (팀내동료평가 / 30 * 6)"

  sub_categories:
    [A] 팀 평가 (WEIGHTED_AVERAGE, input_scope: 'team', 70점)
        input_fields: [키움평가(60점), 학생평가(10점)]

    [B] 팀내 동료평가 (SUM_DIVIDE, input_scope: 'student', 30점)
        input_fields: [동료평가점수(30점)]
```

- [A]에 팀별로 입력 → 팀원 모두 동일 점수 배분
- [B]에 학생별로 입력 → 개인별 다름
- COMPOSITE formula가 합산 → 학생별 최종 점수

이것이 "팀 점수 공유 + 개인 편차" 구조입니다. **새 scoring method 불필요.**

---

## 3. DataTable 팀 모드 추가

### 3-1. 새 prop 추가

```javascript
// DataTable.jsx props 추가
<DataTable
  rowMode="team"          // ★ NEW: 'student'(기본) | 'team'
  teams={teams}           // ★ NEW: rowMode==='team'일 때 필요
  // 기존 props 모두 유지...
/>
```

### 3-2. 팀 모드 렌더링 차이

| 속성 | student 모드 (현재) | team 모드 (신규) |
|------|-------------------|----------------|
| 행 구성 | 학생 배열 | 팀 배열 |
| 행 ID | student.id | team.id |
| 셀 데이터 키 | cellData[studentId] | cellData[teamId] |
| 이름 표시 | 학생명 | 팀명 |
| 정렬 | 학생명/점수 | 팀명/점수 |
| 중도퇴소 토글 | 있음 | 없음 |

**변경 범위:** DataTable 내부에서 `rowMode === 'team'`일 때 `rows` 배열을 `students` 대신 `teams`로 교체. 기존 렌더링 로직(칼럼, 셀, 결과 칼럼)은 entityId만 바뀌므로 재활용 가능.

### 3-3. `buildCellData` / `buildTableColumns` — 변경 없음

팀 모드에서 EvalNode가 cellData를 `teamId` 키로 구성해서 넘겨주면 됨. 헬퍼 함수 자체는 entityId를 알 필요 없음.

---

## 4. EvalNode 통합 컴포넌트 (핵심 신규)

### 4-1. 기존 파일 처리

| 기존 파일 | 처리 |
|-----------|------|
| `app/cohort/[id]/page.jsx` | 유지 — 학생 관리, 집계 설정, 총점 요약 테이블만 남김 |
| `app/cohort/[id]/eval/[categoryId]/page.jsx` | **삭제** |
| `components/layout/SlidePanel.jsx` | **삭제** (URL 기반 네비게이션으로 대체) |
| `app/cohort/[id]/eval/[[...path]]/page.jsx` | **신규** |
| `components/eval/EvalNode.jsx` | **신규** |

### 4-2. URL 구조 변경

```
현재:
  /cohort/[id]/eval/[categoryId]       → 단일 레벨 고정

변경 후:
  /cohort/[id]/eval/[[...path]]        → Next.js catch-all optional
    path = []                          → 전체 카테고리 요약 (현재 Dashboard 역할)
    path = ['cat-abc']                 → Level 1 카테고리
    path = ['cat-abc', 'sub-xyz']      → Level 2 (sub-category)
    path = ['cat-abc', 'sub-xyz', 'sub-def'] → Level 3 (깊이 제한 없음)
```

### 4-3. EvalNode 렌더링 로직

```
EvalNode({ path })
  ↓
  category = path.length === 0
    ? null (root view)
    : findCategoryByPath(config, path)

  ─────────────────────────────────
  Case A: Root view (path = [])
    → Dashboard 총점 테이블과 동일한 렌더링
    → 모든 top-level 카테고리가 COMPUTED 칼럼
    → 클릭 → navigate('/eval/[catId]')

  Case B: sub_categories가 있고 input_fields가 없음 (순수 집계 노드)
    → sub_categories를 COMPUTED 칼럼으로 표시
    → 각 sub의 calculated 점수 표시
    → 클릭 → navigate('/eval/[...path, subId]')
    → 결과 칼럼: 이 카테고리의 최종 점수

  Case C: input_fields가 있고 sub_categories가 없음 (leaf 입력 노드)
    → input_fields를 INPUT 칼럼으로 표시
    → rowMode: category.input_scope ('student' | 'team')
    → 점수 직접 입력

  Case D: input_fields + sub_categories 모두 있음 (혼합 노드, 현재 composite)
    → INPUT 칼럼 + COMPUTED 칼럼 혼합
    → 현재 Eval Page와 동일한 동작
```

### 4-4. 네비게이션 (breadcrumb)

URL path에서 직접 구성:
```
/eval/cat-abc/sub-xyz/sub-def
  ↓
[루트] › [cat-abc.name] › [sub-xyz.name] › sub-def.name
```

각 breadcrumb 항목 클릭 → 해당 depth의 URL로 navigate.
`panelStack` 상태 관리 불필요. URL이 단일 source of truth.

---

## 5. FieldManager 확장

### 5-1. input_scope 선택 UI 추가

```
LeafManager (input_fields 편집)
  ├─ [기존] 필드 목록, 추가/삭제
  └─ [NEW] 입력 단위: ○ 학생별  ● 팀별
              (input_scope 선택)
```

팀별 선택 시: "이 카테고리의 점수는 팀 단위로 입력됩니다" 안내.

---

## 6. 점수 저장 흐름 비교

### 학생 모드 (기존, 변경 없음)
```
DataTable 셀 입력 (studentId, fieldId, value)
  → PUT /scores/[catId] { scores: { [studentId]: { [fieldId]: value } } }
  → raw_scores[catId][studentId][fieldId] = value
```

### 팀 모드 (신규)
```
DataTable 셀 입력 (teamId, fieldId, value)
  → PUT /scores/[catId] { scores: { [teamId]: { [fieldId]: value } } }
  → raw_scores[catId][teamId][fieldId] = value
  ↓
calculateTeamCategory() 호출 시:
  → 팀 점수 계산 → 팀원 학생에게 배분 → studentResults 반환
```

**API 라우트, bulkUpdateScores 서비스 — 변경 없음.**

---

## 7. 구현 단계 (Phase)

### Phase 1: 팀 입력 모드 (독립 작업)

> 기존 동작에 영향 없이 새 기능 추가. 브랜치 분리 권장.

| 파일 | 작업 | 난이도 |
|------|------|--------|
| `schema.js` | `input_scope` 필드 추가, createCategory 기본값 | 하 |
| `scoring-engine/index.js` | `calculateTeamCategory()` 추가, 분기 삽입 | 중 |
| `components/eval/DataTable.jsx` | `rowMode`, `teams` prop + 팀 행 렌더링 | 중 |
| `lib/table-helpers.js` | `buildTeamCellData()` 추가 | 하 |
| `components/eval/FieldManager.jsx` | `input_scope` 선택 UI | 하 |
| `app/cohort/[id]/eval/[categoryId]/page.jsx` | 팀 모드 시 teams + rowMode 전달 | 하 |

**예상 기간:** 1.5 ~ 2주

**완료 기준:**
- 팀별 입력 카테고리 생성 가능
- 팀 행으로 점수 입력, 저장, 재계산 정상 동작
- Composite 부모가 팀 점수 sub + 학생 점수 sub 올바르게 합산

---

### Phase 2: EvalNode 재귀 네비게이션 (주요 리팩토링)

> 기존 EvalPage를 대체. 기존 URL 삭제로 인해 북마크/링크 깨짐 주의.

| 파일 | 작업 | 난이도 |
|------|------|--------|
| `app/cohort/[id]/eval/[[...path]]/page.jsx` | 신규 catch-all 라우트 | 중 |
| `components/eval/EvalNode.jsx` | 통합 컴포넌트 (A/B/C/D 케이스) | 높음 |
| `app/cohort/[id]/eval/[categoryId]/page.jsx` | 삭제 (또는 catch-all로 redirect) | 하 |
| `components/layout/SlidePanel.jsx` | 삭제 | 하 |
| `app/cohort/[id]/page.jsx` | 총점 테이블의 컬럼 클릭 → `/eval/[catId]` 로 URL 변경 | 하 |
| `components/eval/CategoryCard.jsx` | 클릭 URL 업데이트 | 하 |

**EvalNode 구현 순서 (내부):**
1. Case C (leaf 입력) 먼저 — 현재 EvalPage 동작을 그대로 이식
2. Case B (순수 집계) — Dashboard 동작 이식
3. Case A (root) — 기존 Dashboard와 동일
4. Case D (혼합) — composite 케이스 검증

**예상 기간:** 3 ~ 4주

**완료 기준:**
- `/eval/catId/subId/...` URL로 임의 depth 접근 가능
- breadcrumb이 URL에서 자동 구성
- 기존 모든 평가 기능 (입력, 가중치, override, conflict) 동일하게 동작
- SlidePanel 없이 모든 sub-category 편집 가능

---

### Phase 3: 마무리 정리 (옵션)

| 항목 | 작업 | 필요성 |
|------|------|--------|
| calculateTotals 재귀화 | top-level 외 중간 레벨 순위/override 지원 | 현재 요구사항 없으면 선택 |
| 노드별 aggregation_settings | 중간 레벨에도 가산점 한도 등 설정 | 선택 |
| Export 서비스 팀 입력 지원 | CSV 내보내기에서 팀 점수 처리 | 낮음 (팀→학생 배분 후 동일) |

**예상 기간:** 1주 (필요 시)

---

## 8. 리스크 및 주의사항

### 높음

**Phase 2 중 기존 데이터 호환성**

기존 `/eval/[categoryId]` URL로 저장된 북마크나 하드코딩된 링크가 있다면 깨집니다. Redirect 처리 필요:
```javascript
// app/cohort/[id]/eval/[categoryId]/page.jsx 삭제 전:
// redirect(`/cohort/${id}/eval/${categoryId}`) 로 처리하거나
// catch-all이 단일 path segment도 처리하므로 자동 해결
```
사실 `[[...path]]`는 `/eval/catId`도 포함하므로 자동 호환됩니다.

### 중간

**팀 구성 변경 시 기존 점수**

팀이 재편되면 `raw_scores[catId][구teamId]`에 점수가 남아있으나 새 팀원들에게 반영되지 않습니다. 이는 현재 override 시스템으로 수동 보정 가능. 자동 처리는 별도 설계 필요.

**Composite final_formula의 팀 sub-category 변수명**

현재 `composite.js:27`에서 변수명을 `sub.name.replace(/\s+/g, '_')...`으로 생성합니다. 팀 모드 sub-category도 동일하게 처리됩니다. 별도 변경 없음.

### 낮음

**EvalNode의 케이스 분류 모호성**

`sub_categories`가 있으면서 `input_fields`도 있는 경우(Case D)는 현재 composite 방식뿐입니다. `input_scope`가 'team'인 동시에 sub_categories도 있는 경우는 실제로 발생 가능성이 낮습니다. 발생 시 "혼합 케이스"로 처리.

---

## 9. 변경되지 않는 것

다음은 Phase 1~2를 거쳐도 **그대로 유지**됩니다:

- `scores.json` 저장 포맷 (entityId만 teamId가 될 수 있음)
- `bulkUpdateScores()` 서비스 함수
- API 라우트 `/api/cohorts/[id]/scores/[categoryId]`
- Optimistic locking 시스템
- WebSocket 실시간 동기화
- Override 시스템 (top-level 카테고리 기준)
- Projected mode 계산
- 8개 scoring method 내부 로직 (`weighted-average`, `sum-divide` 등)
- `calculateCategory()` 재귀 흐름 (분기만 추가)
- `DataTable.jsx` 기존 기능 (정렬, paste, conflict)

---

## 10. 최종 구현 순서 권장

```
1. Phase 1 (팀 입력) ──────────── feature/team-input 브랜치
   └─ schema 추가
   └─ 스코어링 엔진 팀 모드
   └─ DataTable 팀 행 렌더링
   └─ 검증: 2차 프로젝트 구조 실제 구성 + 점수 입력 테스트
   └─ merge to main

2. Phase 2 (EvalNode) ─────────── feature/eval-node 브랜치
   └─ catch-all 라우트 생성
   └─ EvalNode Case C (leaf) 이식
   └─ EvalNode Case B (집계) 이식
   └─ EvalNode Case A (root) 이식
   └─ SlidePanel 제거
   └─ 전체 기능 회귀 테스트
   └─ merge to main

3. Phase 3 (옵션) ─────────────── 필요 시
```

---

## 요약 체크리스트

- [ ] `schema.js`: `input_scope` 추가
- [ ] `scoring-engine/index.js`: `calculateTeamCategory` + 분기
- [ ] `DataTable.jsx`: `rowMode`, `teams` prop + 팀 행
- [ ] `table-helpers.js`: `buildTeamCellData`
- [ ] `FieldManager.jsx`: scope 선택 UI
- [ ] `eval/[[...path]]/page.jsx`: catch-all 라우트 (신규)
- [ ] `EvalNode.jsx`: 통합 렌더링 컴포넌트 (신규)
- [ ] `eval/[categoryId]/page.jsx`: 삭제
- [ ] `SlidePanel.jsx`: 삭제
