# 재귀적 테이블 구조 분석 리포트

> **요약**: 현재 시스템은 "대시보드(집계) ↔ 개별 카테고리(입력)"의 **2레벨 고정 구조**로 설계되어 있어, Notion처럼 동일한 컴포넌트 인스턴스가 무한 depth로 상하위 관계를 형성하는 것이 **구조적으로 불가능**합니다. 이 리포트는 그 원인을 7개 영역으로 분류하여 분석합니다.

---

## 1. 두 개의 세계: Dashboard vs Eval Page

### 현재 구조

```
/cohort/[id]/page.jsx        → "집계 뷰" (Summary)
/cohort/[id]/eval/[catId]/   → "입력 뷰" (Detail)
```

이 두 페이지는 **완전히 다른 렌더링 로직**을 사용합니다:


| 속성       | Dashboard (page.jsx:68-78)           | Eval Page (page.jsx:174-176)                         |
| -------- | ------------------------------------ | ---------------------------------------------------- |
| 칼럼 소스    | `categories.map(cat => COMPUTED)`    | `buildTableColumns(inputFields, subCategories)`      |
| 칼럼 타입    | 전부 COMPUTED                          | INPUT + COMPUTED 혼합                                  |
| 셀 데이터    | `totals[sid].breakdown[catId].score` | `rawScores[sid][fieldId]` + `calcResults.sub_scores` |
| 결과 칼럼    | 총점 + 순위                              | 카테고리 점수 + (순위)                                       |
| 점수 입력    | 불가                                   | 가능                                                   |
| Override | 없음                                   | 있음                                                   |


### 문제

Notion에서는 모든 페이지가 **동일한 Page 컴포넌트**의 인스턴스입니다. 페이지 안에 하위 페이지가 있으면 그것도 같은 Page입니다. 하지만 현재 시스템에서:

- **Dashboard는 "카테고리를 칼럼으로"** 배치합니다 → 집계 전용
- **Eval Page는 "input_fields를 칼럼으로"** 배치합니다 → 입력 전용

이 두 모드가 **하나의 컴포넌트로 통합되어 있지 않기 때문에**, 중간 레벨 노드(예: "1차 프로젝트" 아래의 "멘토평가"가 다시 하위를 가지는 경우)를 **어느 모드로 렌더링할지 결정할 수 없습니다**.

```
현재:
  [Dashboard] ──── categories → COMPUTED 칼럼
       │
  [Eval Page] ──── input_fields → INPUT 칼럼, sub_categories → COMPUTED 칼럼
       │
  [SlidePanel] ── (Eval Page의 축소판, 기능 제한)

필요한 구조:
  [TableNode] ──── children이 있으면 → COMPUTED 칼럼 (집계 뷰)
       │          children이 없으면 → INPUT 칼럼 (입력 뷰)
       │          children + input_fields → 혼합 (현재 composite 뷰)
       │
  [TableNode] ──── (동일한 컴포넌트가 재귀적으로)
       │
  [TableNode] ──── (leaf: 직접 입력)
```

---

## 2. 노드에 "나는 무엇인가"를 알려주는 메타데이터 부재

### 현재 `EvaluationCategory` 구조 (schema.js:72-84)

```javascript
{
  id, name, order, max_score, is_bonus,
  scoring_method,     // 계산 방식
  config,             // 방식별 파라미터
  input_fields,       // 입력 필드 정의
  weight,             // 가중치
  sub_categories,     // 하위 항목 (재귀)
}
```

### 빠진 것들


| 필요한 메타데이터              | 설명                                        | 현재 상태                    |
| ---------------------- | ----------------------------------------- | ------------------------ |
| `display_mode`         | 이 노드를 집계 뷰/입력 뷰/혼합 뷰 중 어떻게 보여줄지           | **없음** — 페이지 URL로 결정     |
| `aggregation_settings` | 자식 노드들을 어떻게 합산할지 (sum, weighted, formula) | **cohort 레벨에만 존재**       |
| `depth` / `level`      | 트리에서의 위치                                  | **없음** — 배열 포함으로만 암시     |
| `parent_id`            | 부모 참조                                     | **없음** — 단방향 트리 (부모→자식만) |
| `result_visibility`    | 순위/점수/override 표시 여부                      | **하드코딩**                 |


현재 시스템은 `scoring_method === 'composite'`인지 여부로 "이 노드가 집계인가?"를 판단합니다. 하지만 이것은 **계산 방식**이지 **표현 방식**이 아닙니다.

예를 들어:

- weighted_average 메서드를 사용하는 중간 노드도 자식들의 점수를 집계 테이블로 보여줘야 할 수 있음
- composite가 아닌데도 sub_categories를 가진 노드의 표시 방식이 모호함

---

## 3. 평면적 네비게이션 (2-level URL)

### 현재 라우팅

```
/cohort/[id]                    → Dashboard (항상 전체 top-level 요약)
/cohort/[id]/eval/[categoryId]  → Eval (항상 단일 카테고리 상세)
/cohort/[id]/students           → 학생 관리
```

### 문제

sub_category를 클릭하면 **SlidePanel**(오버레이)로 열리거나, `onFullPage`로 같은 `/eval/[subCatId]` URL로 이동합니다. 하지만 이 URL 구조에는 **부모-자식 관계 정보가 없습니다**.

```
현재: /cohort/abc/eval/sub-123
      → sub-123이 어디에 속한 건지 URL만으로 알 수 없음
      → breadcrumb은 코드에서 findCategory()로 트리 탐색해서 구성

필요: /cohort/abc/eval/cat-456/sub-123
      또는 /cohort/abc/eval/[...path]  (catch-all route)
      → URL 자체가 트리 경로를 표현
```

`findCategory()` (eval page:273-282)가 재귀 탐색으로 카테고리를 찾긴 하지만, **해당 카테고리의 부모 컨텍스트가 유실됩니다**. 부모가 누구인지, 형제는 뭔지, 내가 트리의 몇 번째 레벨인지 알 수 없어서 적절한 집계 뷰를 구성할 수 없습니다.

---

## 4. `calculateTotals`는 top-level만 집계

### scoring-engine/index.js:136-186

```javascript
export function calculateTotals(config, rawScores, students, overrides = {}) {
  const categoryResults = calculateAllCategories(config, rawScores, students);

  for (const student of activeStudents) {
    // ⚠️ top-level evaluation_categories만 순회
    for (const category of config.evaluation_categories) {
      const score = overrides[category.id]?.[student.id] ?? result?.calculated ?? 0;
      if (category.is_bonus) bonusTotal += score;
      else total += score;
    }
  }
}
```

### 문제

이 함수는 `**config.evaluation_categories` (top-level 배열)만** 순회합니다.

만약 3레벨 구조가 있다면:

```
Level 0: 총점 (calculateTotals가 여기만 커버)
Level 1: "프로젝트 평가" (aggregation_settings 없음!)
Level 2: "기획", "개발", "발표" (실제 입력)
```

Level 1 → Level 2의 집계는 `calculateCategory` 내부에서 composite/augmented 방식으로 처리됩니다. 하지만:

- Level 1 자체의 `**aggregation_settings`가 없음** (cohort 레벨에만 존재)
- Level 0 → Level 1의 집계는 `calculateTotals`가 처리하지만, **override도 top-level만 지원**
- **중간 레벨에서의 순위 산정, 가산점 처리, 총점 제한 등이 불가능**

`calculateCategory`는 재귀적으로 잘 동작하지만, `calculateTotals`/`calculateProjectedScores`는 재귀적이지 않습니다.

---

## 5. SlidePanel은 2등 시민

### SlidePanel vs Eval Page 기능 비교


| 기능              | Eval Page                  | SlidePanel                 |
| --------------- | -------------------------- | -------------------------- |
| 점수 입력           | ✅ 직접 입력 + bulk paste       | ✅ 직접 입력 + bulk paste       |
| Weight 행        | ✅ 표시 + 편집                  | ❌ 미구현                      |
| Override 칼럼     | ✅ 표시 + 편집                  | ❌ 미구현                      |
| InlineSettings  | ✅ 저장 → fetchConfig         | ⚠️ 저장은 하지만 fetchConfig 미호출 |
| FieldManager    | ✅ 필드 관리                    | ❌ 미구현                      |
| Conflict Dialog | ✅ 충돌 해결                    | ❌ 미구현                      |
| 폭               | 전체 화면 (max-w-4xl)          | 600-700px 고정               |
| 점수 저장 경로        | `PUT /scores/[categoryId]` | 부모의 onScoreChange 위임       |


### 핵심 문제

SlidePanel의 `onScoreChange`는 **부모 Eval Page의 `saveToCategoryScores`를 그대로 사용**합니다 (eval page:265). 이 함수는 `categoryId`를 **부모 카테고리의 ID**로 고정합니다 (eval page:59).

```javascript
// eval/[categoryId]/page.jsx:57-73
const saveToCategoryScores = useCallback(async (body) => {
  const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores/${enc(categoryId)}`, {
    // ⚠️ categoryId는 항상 URL의 부모 카테고리 ID
  });
}, [cohortId, categoryId, ...]);
```

즉, SlidePanel에서 sub-category의 점수를 입력하면 **부모 카테고리의 raw_scores에 저장**됩니다. 이것은 sub-category가 독립적인 점수 저장소를 갖지 못한다는 의미입니다.

`scores.json` 구조:

```json
{
  "raw_scores": {
    "parent-cat-id": {
      "student-1": {
        "field-1": 85,    // 부모의 input_field
        "field-2": 90     // 부모의 input_field
      }
    }
    // sub-category의 점수도 여기에 저장되어야 하지만...
    // sub-category가 독립 노드로 점수를 저장하려면 별도 categoryId가 필요
  }
}
```

composite 방식에서는 `allRawScores`를 통해 하위 카테고리의 scores에 접근하므로 **하위 카테고리가 독립 ID로 score를 저장해야** 재귀가 작동합니다. 하지만 SlidePanel의 저장 경로가 이를 지원하지 않습니다.

---

## 6. 설정값 변경 후 즉시 반영의 한계

### 현재 지원

- `aggregation_settings`로 **총점 집계 방식** 변경 (sum vs weighted)
- `scoring_method` + `config`로 개별 카테고리의 **계산 방식** 변경
- Override로 **수동 점수 조정**
- Projected mode로 **미입력 항목을 평균으로 대체**

### 문제

위 설정들은 **이미 변경 가능**하지만, 변경의 효과를 확인하려면 **반드시 저장 → 재계산 → 페이지 갱신** 순서를 거쳐야 합니다. 이 흐름 자체는 문제가 없지만, 재귀 구조가 없는 현재 상태에서는 중간 레벨 노드의 `max_score`, `weight`, 계산 방식을 바꿔도 **상위 집계 결과에 어떻게 영향을 미치는지 한눈에 볼 수 없습니다**.

예를 들어, 특정 sub-category의 가중치를 바꾸면:
- sub-category 결과는 재계산됨
- 그 결과가 부모 category에 반영됨
- 부모 category 결과가 총점에 반영됨

이 전파 과정이 **각각 다른 페이지/패널에 분산**되어 있어서, 변경 전후의 총점 차이를 직관적으로 파악하기 어렵습니다. 재귀적 테이블 구조가 구현되면 이 문제는 자연스럽게 해소됩니다 — 하나의 페이지 안에서 트리 전체의 결과를 볼 수 있기 때문입니다.

---

## 7. DataTable 컴포넌트 자체는 범용적이지만, 사용 방식이 제한적

### DataTable의 실제 능력

DataTable 컴포넌트는 사실 **매우 범용적**입니다:

- `columns` 배열을 받아서 INPUT/COMPUTED 칼럼 모두 렌더링
- `resultColumns`로 결과 칼럼 추가
- `onColumnClick`으로 COMPUTED 칼럼 클릭 시 drill-down
- `showWeightRow`로 가중치 행 토글

### 하지만 사용하는 쪽에서 제한

```javascript
// Dashboard: 카테고리를 COMPUTED 칼럼으로만 사용
const summaryColumns = categories.map(cat => ({
  type: COLUMN_TYPE.COMPUTED,  // 항상 COMPUTED
  clickable: true,
}));

// Eval Page: buildTableColumns()로 input_fields + sub_categories 매핑
// → input_fields는 INPUT, sub_categories는 COMPUTED
```

만약 **하나의 재귀 컴포넌트**가 자신의 children을 칼럼으로 배치하고, 각 child가 leaf인지 branch인지에 따라 INPUT/COMPUTED를 결정한다면, DataTable은 그대로 사용할 수 있습니다. **문제는 DataTable이 아니라, DataTable을 감싸는 페이지 로직**입니다.

---

## 근본 원인 종합

```
┌─────────────────────────────────────────────────────────────────┐
│                    "2레벨 벽"의 근본 원인                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 두 개의 렌더링 모드 (Summary vs Detail)가                      │
│     하나의 재귀 컴포넌트로 통합되지 않음                              │
│                                                                 │
│  2. EvaluationCategory에 display/aggregation 메타데이터가 없어서    │
│     노드 자신이 "어떻게 보여져야 하는지" 모름                         │
│                                                                 │
│  3. URL 구조가 2레벨 고정이라 깊은 트리를 표현 불가                    │
│                                                                 │
│  4. calculateTotals가 top-level만 집계하여                         │
│     중간 레벨 집계/순위/override 불가                                │
│                                                                 │
│  5. SlidePanel이 기능 제한된 2등 시민이라                            │
│     깊은 레벨 편집이 완전하지 않음                                   │
│                                                                 │
│  6. 점수 저장 경로가 부모 categoryId에 묶여                          │
│     하위 카테고리의 독립적 점수 관리 불가                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Notion 모델과의 비교


| 개념     | Notion              | 현재 시스템                  | Gap                        |
| ------ | ------------------- | ----------------------- | -------------------------- |
| 페이지/노드 | 모든 페이지 = 동일 컴포넌트    | Dashboard ≠ Eval Page   | **컴포넌트 통합 필요**             |
| 자식 표시  | 페이지 안에 하위 페이지 목록    | 카테고리 → 칼럼 OR SlidePanel | **재귀 렌더링 필요**              |
| 콘텐츠    | 어떤 페이지든 블록 추가 가능    | leaf만 input_fields 가능   | **모든 노드에 input 허용 필요**     |
| 뷰 전환   | 같은 데이터 → 테이블/보드/갤러리 | 고정 레이아웃                 | **뷰 모드 전환 필요**             |
| 트리 구조  | 무한 depth            | 2레벨 + SlidePanel        | **재귀 URL + 재귀 컴포넌트 필요**    |
| 속성/메타  | 각 페이지에 properties   | 카테고리에 config만           | **display metadata 추가 필요** |


---

## 해결 방향 (구현 X, 방향만)

### A. "TableNode" 통합 컴포넌트

```
EvalNode({ node, depth, parentPath })
  ├─ if node.children.length > 0:
  │    → 자식들을 COMPUTED 칼럼으로 표시 (= 현재 Dashboard의 역할)
  │    → + node 자체의 input_fields도 INPUT 칼럼으로 표시 (혼합)
  │    → + node의 aggregation_settings로 결과 칼럼 구성
  │    → 자식 클릭 → 같은 EvalNode로 재귀 네비게이션
  │
  └─ if node.children.length === 0:
       → input_fields를 INPUT 칼럼으로 표시 (= 현재 Eval Page의 역할)
       → 결과 칼럼 표시
```

### B. EvaluationCategory 확장

```javascript
{
  // 기존 필드...

  // 새로 필요한 메타데이터
  aggregation_settings: {  // 현재 cohort 레벨 → 노드 레벨로 이동
    method: 'sum' | 'weighted' | 'formula',
    max_score: number,
    bonus_limit: number,
  },
  display: {
    show_weight_row: boolean,
    show_override: boolean,
    show_rank: boolean,
    default_view: 'table' | 'summary' | 'auto',
  },
}
```

### C. 재귀 URL 구조

```
/cohort/[id]/eval/[...path]
  → path = ['cat-1']           → Level 1 노드
  → path = ['cat-1', 'sub-2']  → Level 2 노드
  → path = []                  → Root (= 현재 Dashboard)
```

### D. 재귀 calculateTotals

```javascript
function calculateNodeTotals(node, allRawScores, students, overrides) {
  if (node.children.length === 0) {
    return calculateCategory(node, allRawScores, students);
  }

  // 자식들의 결과를 먼저 계산
  const childResults = {};
  for (const child of node.children) {
    childResults[child.id] = calculateNodeTotals(child, allRawScores, students, overrides);
  }

  // 이 노드의 aggregation_settings로 집계
  return aggregateChildren(node, childResults, overrides[node.id]);
}
```

---

## 결론

현재 시스템이 "2레벨까지만 가능하다"고 느껴지는 것은 **단일 컴포넌트의 문제가 아니라, 전체 아키텍처가 2레벨을 전제로 설계**되었기 때문입니다:

1. **페이지 구조**: Dashboard / Eval Page / SlidePanel이 각각 다른 역할을 하드코딩
2. **데이터 구조**: aggregation_settings가 root에만, override가 top-level에만
3. **계산 엔진**: calculateTotals가 top-level만 순회 (calculateCategory는 재귀적이지만)
4. **네비게이션**: URL이 2레벨, SlidePanel이 3레벨+를 보조하지만 기능 제한

scoring engine의 `calculateCategory`는 이미 재귀적이고, DataTable 컴포넌트는 범용적입니다. **이 두 강점을 살려서, 그 위를 감싸는 "페이지 레이어"와 "데이터 구조"를 재귀적으로 재설계**하는 것이 핵심입니다.