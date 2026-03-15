# Phase 2: EvalNode 재귀 네비게이션 구현

## 이 파일은 ralph-loop가 매 반복마다 참조한다

## 1. 현재 상태 확인 (매 반복 시작 시 반드시 실행)

```bash
npx playwright test tests/e2e/recursive-nav.spec.js --reporter=line 2>&1 | tail -30
```

모든 테스트가 통과하면:
```
<promise>PHASE2 COMPLETE</promise>
```

기존 E2E도 깨지면 안 됨:
```bash
npx playwright test tests/e2e/kda-workflow.spec.js --reporter=line 2>&1 | tail -10
```

## 2. 구현 목표

`tests/e2e/recursive-nav.spec.js`의 9개 테스트를 모두 통과시킨다.

## 3. 설계 문서 참조

- `claudedocs/implementation-design.md` — 섹션 4 (EvalNode), 섹션 3 (URL)
- `claudedocs/recursive-table-analysis.md` — 섹션 1, 3

## 4. 구현 순서

### Step A: catch-all 라우트 생성

**디렉토리 생성:** `src/app/cohort/[id]/eval/[[...path]]/`
**파일 생성:** `src/app/cohort/[id]/eval/[[...path]]/page.jsx`

```javascript
'use client';
import { use } from 'react';
import EvalNode from '@/components/eval/EvalNode';

export default function EvalCatchAllPage({ params }) {
  const { id: cohortId, path = [] } = use(params);
  return <EvalNode cohortId={cohortId} path={path} />;
}
```

### Step B: EvalNode 컴포넌트 생성

**파일 생성:** `src/components/eval/EvalNode.jsx`

`EvalNode`는 현재 `eval/[categoryId]/page.jsx`의 로직을 계승하되,
`path` 배열을 받아 트리에서 현재 카테고리를 찾는다.

**핵심 로직:**
```javascript
// path가 비어있으면 → 대시보드와 동일한 전체 요약 뷰
// path가 있으면 → config 트리에서 해당 카테고리 찾기

function findCategoryByPath(categories, path) {
  if (path.length === 0) return null;
  const [head, ...tail] = path;
  const found = categories.find(c => c.id === head);
  if (!found) return null;
  if (tail.length === 0) return found;
  return findCategoryByPath(found.sub_categories || [], tail);
}
```

**렌더링 케이스:**
- `path = []` (root): 모든 top-level 카테고리를 COMPUTED 칼럼으로 → 현재 Dashboard와 동일
- `sub_categories.length > 0 && input_fields.length === 0` (순수 집계): sub를 COMPUTED 칼럼으로 표시
- `sub_categories.length === 0` (leaf): input_fields를 INPUT 칼럼으로 표시
- 혼합: 두 가지 모두

**Breadcrumb:**
```javascript
// path에서 breadcrumb 구성
// data-testid="eval-breadcrumb" 반드시 추가
const breadcrumbItems = path.map((id, idx) => {
  const partial = path.slice(0, idx + 1);
  const cat = findCategoryByPath(config.evaluation_categories, partial);
  return { id, name: cat?.name || id, href: `/cohort/${cohortId}/eval/${partial.join('/')}` };
});
```

**COMPUTED 칼럼 클릭 → URL 이동 (SlidePanel 아님):**
```javascript
// onColumnClick에서 router.push 사용
const handleColumnClick = (col) => {
  const newPath = [...path, col.id].join('/');
  router.push(`/cohort/${cohortId}/eval/${newPath}`);
};
```

### Step C: 기존 eval/[categoryId]/page.jsx 처리

catch-all `[[...path]]`는 단일 세그먼트(`[categoryId]`)를 포함하므로
`eval/[categoryId]/page.jsx` 파일이 충돌한다.

**처리 방법:** 기존 파일을 삭제한다.
```bash
rm src/app/cohort/[id]/eval/[categoryId]/page.jsx
rmdir src/app/cohort/[id]/eval/[categoryId]  # 비어있으면
```

### Step D: SlidePanel 사용 제거

`src/app/cohort/[id]/eval/[categoryId]/page.jsx`가 삭제되므로 SlidePanel도 더 이상 사용되지 않는다.
`SlidePanel.jsx` 파일은 그대로 두어도 되고 삭제해도 된다.

### Step E: 점수 저장 경로 수정

EvalNode에서 점수를 저장할 때 `categoryId`는 현재 노드(path의 마지막)를 사용한다:
```javascript
const categoryId = path[path.length - 1];
// PUT /api/cohorts/${cohortId}/scores/${categoryId}
```

## 5. 필수 data-testid 속성

테스트에서 참조하는 속성들. 반드시 추가할 것:

```jsx
// Breadcrumb 컨테이너
<nav data-testid="eval-breadcrumb" ...>

// 팀 입력 모드 배지 (Phase 1에서 추가할 항목)
<span data-testid="input-scope-badge" aria-label="팀별 입력 모드">팀별</span>
```

## 6. 실패 패턴별 대응

**테스트 1 실패 (URL 접근 불가 / 404):**
→ `[[...path]]` 폴더명이 맞는지 확인. Next.js optional catch-all은 `[[...param]]` (대괄호 2중)

**테스트 3 실패 (COMPUTED 칼럼이 없음):**
→ composite 카테고리 렌더링 케이스 확인. sub_categories를 COMPUTED 칼럼으로 변환하는 로직.

**테스트 4 실패 (SlidePanel이 열림):**
→ `handleColumnClick`이 `setPanelCategory` 대신 `router.push`를 호출하는지 확인.

**테스트 6 실패 (breadcrumb 없음):**
→ `data-testid="eval-breadcrumb"`이 있는지 확인. path.length >= 2일 때만 표시하도록 조건 확인.

**기존 kda-workflow.spec.js 실패:**
→ 대시보드 총점 테이블이 기존과 동일하게 동작해야 함. EvalNode의 root 케이스 확인.
→ 점수 입력 저장 경로(`categoryId`)가 올바른지 확인.

## 7. 완료 조건

```
recursive-nav.spec.js: 9 passed
kda-workflow.spec.js: 10 passed  (회귀 없음)
```

```
<promise>PHASE2 COMPLETE</promise>
```
