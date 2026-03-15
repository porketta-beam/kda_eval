# 테스트 전략 및 Ralph Loop 실행 계획

> 목적: Phase 1 (팀 입력), Phase 2 (EvalNode 재귀)를 TDD로 구현하고, ralph-loop로 반복 검증

---

## 실행 결과 요약

| Phase | 테스트 파일 | 결과 |
|-------|------------|------|
| Phase 1 | `tests/team-scoring.test.js` | ✅ 14 passed, 0 failed |
| Phase 1 | `tests/scoring-engine.test.js` (회귀) | ✅ 20 passed, 0 failed |
| Phase 2 | `tests/e2e/recursive-nav.spec.js` | ⏳ 미구현 |
| Phase 2 | `tests/e2e/team-input.spec.js` | ⏳ 서버 필요 |

---

## 1. 현재 테스트 인프라 현황

### 기존 테스트 파일

| 파일 | 방식 | 역할 | 실행 커맨드 |
|------|------|------|------------|
| `tests/scoring-engine.test.js` | Node.js 자체 실행 | 스코어링 엔진 유닛 테스트 (8개 메서드) | `npm run test:scoring` |
| `tests/e2e/kda-workflow.spec.js` | Playwright | 전체 워크플로우 E2E (10개 시나리오) | `npx playwright test` |
| `tests/loader.js` | ESM 로더 | `@/` 경로 별칭 해석 | (내부 의존) |

### 주요 특징 (설계 시 고려사항)

- 스코어링 엔진 테스트는 **Node.js 직접 실행** — 프레임워크 없음, 직접 assert 함수 사용
- E2E 테스트는 **localhost:3000 서버 필요** — `reuseExistingServer: true`로 기존 서버 재사용
- 두 테스트 모두 **현재 스코어링 메서드만** 검증, 팀 입력/재귀 구조 미포함
- **`test:e2e` 스크립트 없음** — package.json에 추가 필요

---

## 2. 필요한 신규 테스트

### 2-1. Phase 1: 팀 입력 스코어링 유닛 테스트

**파일:** `tests/team-scoring.test.js`

```javascript
/**
 * 팀 입력 모드 스코어링 검증
 * 실행: node --import ./tests/register-loader.js tests/team-scoring.test.js
 */

import { calculateCategory } from '@/lib/scoring-engine/index.js';
import { SCORING_METHOD, INPUT_FIELD_TYPE, INPUT_SCOPE } from '@/lib/schema.js';

// ─── 테스트 1: 팀 입력 → 팀원 점수 배분 ─────────────────────
// 검증: input_scope='team'인 카테고리는 팀별로 계산 후 팀원에게 동일 점수 배분

const 팀평가카테고리 = {
  id: 'team_eval',
  name: '팀 평가',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  input_scope: 'team',                          // ★ 팀 입력 모드
  config: { multiplier: 1, exclude_empty: false },
  input_fields: [
    { id: 'score_a', name: '키움평가', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.TEAM },
    { id: 'score_b', name: '학생평가', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.TEAM },
  ],
};

const teams = [
  { id: 'team-1', name: '1팀-KFC', members: ['s1', 's2'] },
  { id: 'team-2', name: '2팀-큠', members: ['s3', 's4'] },
];

const students = [
  { id: 's1', name: '학생A', team_id: 'team-1', is_dropout: false },
  { id: 's2', name: '학생B', team_id: 'team-1', is_dropout: false },
  { id: 's3', name: '학생C', team_id: 'team-2', is_dropout: false },
  { id: 's4', name: '학생D', team_id: 'team-2', is_dropout: false },
];

// 팀 단위로 저장된 raw_scores (entityId = teamId)
const teamRawScores = {
  'team_eval': {
    'team-1': { score_a: 8, score_b: 6 },   // 1팀 평균 = 7
    'team-2': { score_a: 9, score_b: 9 },   // 2팀 평균 = 9
  }
};

const results = calculateCategory(팀평가카테고리, teamRawScores, students, teams);

// 1팀 두 학생 모두 동일 점수
assert(results['s1'].calculated === 7, '1팀 학생A → 7');
assert(results['s2'].calculated === 7, '1팀 학생B → 7 (동일 팀 점수 공유)');
// 2팀 두 학생 모두 동일 점수
assert(results['s3'].calculated === 9, '2팀 학생C → 9');
assert(results['s4'].calculated === 9, '2팀 학생D → 9 (동일 팀 점수 공유)');

// ─── 테스트 2: 팀 없는 학생 처리 ────────────────────────────
// 검증: team_id가 null인 학생은 0점 처리

const 팀없는학생 = { id: 'no-team', name: '무소속', team_id: null, is_dropout: false };
const 학생들with팀없음 = [...students, 팀없는학생];
const results2 = calculateCategory(팀평가카테고리, teamRawScores, 학생들with팀없음, teams);

assert(results2['no-team'].calculated === 0, '팀 없는 학생 → 0점');

// ─── 테스트 3: 2차 프로젝트 복합 구조 ─────────────────────────
// 검증: 팀 점수 sub + 개인 점수 sub → composite 합산
// Google Sheet 2차 프로젝트 구조와 동일

const 이차프로젝트 = {
  id: '2nd_proj',
  name: '2차 프로젝트',
  scoring_method: SCORING_METHOD.COMPOSITE,
  input_scope: 'student',
  config: {
    final_formula: '(팀평가 / 70 * 14) + (팀내동료평가 / 30 * 6)',
  },
  input_fields: [],
  sub_categories: [
    {
      id: 'team_score',
      name: '팀평가',
      scoring_method: SCORING_METHOD.SUM_DIVIDE,
      input_scope: 'team',                       // ★ 하위 sub가 팀 입력
      config: { divisor: 1 },
      input_fields: [
        { id: 'kiwooom', name: '키움평가', type: INPUT_FIELD_TYPE.NUMBER },
        { id: 'peer',    name: '학생평가', type: INPUT_FIELD_TYPE.NUMBER },
      ],
    },
    {
      id: 'peer_eval',
      name: '팀내동료평가',
      scoring_method: SCORING_METHOD.USER_INPUT,
      input_scope: 'student',                    // ★ 개인 입력
      config: {},
      input_fields: [
        { id: 'peer_score', name: '동료평가점수', type: INPUT_FIELD_TYPE.NUMBER },
      ],
    },
  ],
};

const compositeRawScores = {
  'team_score': {
    'team-1': { kiwooom: 50, peer: 10 },  // 팀1 합계 = 60점 (70점 만점)
    'team-2': { kiwooom: 60, peer: 8 },   // 팀2 합계 = 68점
  },
  'peer_eval': {
    's1': { peer_score: 25 },   // 개인 동료평가 (30점 만점)
    's2': { peer_score: 5 },
    's3': { peer_score: 20 },
    's4': { peer_score: 10 },
  }
};

const compResults = calculateCategory(이차프로젝트, compositeRawScores, students, teams);

// 학생A: (60/70*14) + (25/30*6) = 12.0 + 5.0 = 17.0
assertApprox(compResults['s1'].calculated, 17.0, '학생A 2차 프로젝트 = 17.0');
// 학생B: (60/70*14) + (5/30*6) = 12.0 + 1.0 = 13.0
assertApprox(compResults['s2'].calculated, 13.0, '학생B 2차 프로젝트 = 13.0 (같은 팀, 다른 동료평가)');
// 학생C: (68/70*14) + (20/30*6) = 13.6 + 4.0 = 17.6
assertApprox(compResults['s3'].calculated, 17.6, '학생C 2차 프로젝트 = 17.6');
```

---

### 2-2. Phase 1: 팀 입력 E2E 테스트

**파일:** `tests/e2e/team-input.spec.js`

검증 시나리오:

```javascript
test.describe.serial('팀 입력 모드', () => {

  test('1. 팀 생성 및 팀원 배정', async ({ page, request }) => {
    // 학생 4명 + 팀 2개 구성
    // 팀1: 학생A, 학생B / 팀2: 학생C, 학생D
  });

  test('2. 팀 입력 카테고리 생성', async ({ page }) => {
    // FieldManager에서 input_scope = 'team' 선택
    // 카테고리 저장 후 설정 확인
  });

  test('3. 팀 단위 점수 입력 테이블 표시', async ({ page }) => {
    // eval 페이지에서 학생 행 대신 팀 행이 표시됨을 검증
    // "1팀-KFC", "2팀-큠" 행이 있어야 함
    // 학생 이름 행이 없어야 함
  });

  test('4. 팀 점수 저장 및 팀원 공유 확인', async ({ page, request }) => {
    // 1팀에 점수 입력
    // API로 raw_scores 확인: teamId 키로 저장됨
    // 결과 계산 후: 1팀 소속 두 학생 모두 동일 calculated 점수
  });

  test('5. Composite: 팀 sub + 개인 sub 합산', async ({ page, request }) => {
    // 2차 프로젝트 구조 구성
    // 팀 점수 입력 → 개인 동료평가 입력
    // 최종 점수 = formula 결과 검증
  });
});
```

---

### 2-3. Phase 2: EvalNode 재귀 네비게이션 E2E 테스트

**파일:** `tests/e2e/recursive-nav.spec.js`

```javascript
test.describe.serial('재귀 네비게이션 (EvalNode)', () => {

  test('1. catch-all URL 직접 접근 가능', async ({ page }) => {
    // /cohort/[id]/eval 접근 → 전체 카테고리 요약 테이블
    // /cohort/[id]/eval/[catId] → 해당 카테고리 페이지
    // /cohort/[id]/eval/[catId]/[subId] → sub 카테고리 페이지 (3레벨)
  });

  test('2. Sub-category가 있는 노드: COMPUTED 칼럼 + 클릭 네비게이션', async ({ page }) => {
    // COMPOSITE 카테고리 eval 페이지
    // sub_categories가 COMPUTED 칼럼으로 표시됨
    // 칼럼 클릭 → URL이 /eval/catId/subId로 변경
    // SlidePanel이 열리지 않음 (대신 페이지 이동)
  });

  test('3. Leaf 노드: INPUT 칼럼 표시', async ({ page }) => {
    // sub_categories 없는 카테고리
    // input_fields가 INPUT 칼럼으로 표시됨
    // 점수 입력 가능
  });

  test('4. Breadcrumb 자동 구성', async ({ page }) => {
    // /eval/catId/subId에서:
    // breadcrumb: [루트] > [catId.name] > subId.name
    // 각 breadcrumb 클릭 → 해당 depth로 이동
  });

  test('5. 깊이 3레벨 데이터 저장/조회', async ({ page, request }) => {
    // 3레벨 트리 구성
    // 최하위 leaf에 점수 입력
    // API 확인: raw_scores[leafCatId][studentId][fieldId]
    // 최상위 카테고리 calculated가 3레벨 집계된 값
  });

  test('6. SlidePanel 없이 sub-category 접근', async ({ page }) => {
    // SlidePanel 컴포넌트가 DOM에 없어야 함
    // sub-category 접근은 URL 이동으로만
  });
});
```

---

### 2-4. Google Sheet 동등성 검증 테스트 (통합)

**파일:** `tests/google-sheet-parity.test.js`

이 파일이 핵심입니다 — "Google Sheet와 동일한 결과를 내는가?"를 검증합니다.

```javascript
/**
 * Google Sheet KDA 2기 평가_계산식 동등성 검증
 * Google Sheet에서 읽은 실제 값을 정답(expected)으로 사용
 *
 * 실행: node --import ./tests/register-loader.js tests/google-sheet-parity.test.js
 */

import { calculateCategory, calculateTotals } from '@/lib/scoring-engine/index.js';
import { SCORING_METHOD } from '@/lib/schema.js';

// ─── Google Sheet 실제 데이터 (종합 시트에서 읽은 값) ──────────
const EXPECTED_TOTALS = {
  '강일구': 70.03,
  '강주연': 85.85,
  '곽나연': 74.87,
  '오준협': 88.20,
  '윤세인': 98.82,
  '한현비': 96.88,
  // ... 전체 34명
};

const EXPECTED_RANKS = {
  '윤세인': 1,
  '한현비': 2,
  '오준협': 3,
};

// ─── 테스트 1: 수업참여도 (20점 만점) ────────────────────────
// Google Sheet: 강주연 17.67, 강일구 13.33
// 공식: SUM(강사별점수) / 출석가능강사수 * (20/10)

const 수업참여도 = {
  id: 'class_participation',
  name: '수업참여도',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  config: { multiplier: 2, exclude_empty: true },
  input_fields: [
    { id: 'f_python', name: '김자영_파이썬', type: 'number' },
    { id: 'f_sql',    name: '김자영_SQL',    type: 'number' },
    { id: 'f_fin',    name: '김병철_금융',   type: 'number' },
    { id: 'f_ux',     name: '심은숙_UX',     type: 'number' },
    { id: 'f_ai',     name: '심은숙_AI',     type: 'number' },
    { id: 'f_assist', name: '이정수보조',    type: 'number' },
  ],
};

// Google Sheet 실제 입력값 (수업참여도 시트에서)
const rawScores_수업참여도 = {
  '강주연': { f_python: 10, f_sql: 8, f_fin: 10, f_ux: 8, f_ai: 8, f_assist: 9 },  // 기대: 17.67
  '강일구': { f_python: 6,  f_sql: 7, f_fin: 8,  f_ux: 7, f_ai: 7, f_assist: 5  }, // 기대: 13.33
  '구미경': { f_python: 8,  f_sql: 8, f_fin: 9,  f_ux: 9                          }, // 기대: 17.00 (4과목만)
};

// 이 테스트로 multiplier + exclude_empty 조합이 Google Sheet 공식과 일치하는지 검증

// ─── 테스트 2: 1차 프로젝트 팀 순위배점 (15점 만점) ──────────
// Google Sheet: 1팀(보험) 60점→1위→15점, 2팀(블록체인) 55점→2위→?

const 일차프로젝트 = {
  id: '1st_proj',
  name: '1차 프로젝트',
  scoring_method: SCORING_METHOD.COMPOSITE,
  config: {
    final_formula: '팀순위배점',
  },
  sub_categories: [
    {
      id: 'team_rank',
      name: '팀순위배점',
      scoring_method: SCORING_METHOD.RANK_DIFFERENTIAL,
      input_scope: 'team',
      config: {
        scope: 'all',
        top_score: 15,
        interval: 2.5,  // (15-0)/6팀 = 2.5
        has_floor: true,
        floor_value: 2.5,
        rank_source: 'direct',
      },
      input_fields: [{ id: 'team_total', name: '팀종합점수' }],
    },
  ],
};

// Google Sheet 실제: 보험팀 60, 블록체인 55, 은행1 45, 증권1 40, 은행2 50, 증권2 35
// 1위 60 → 15점, 2위 55 → 12.5점, ...

// ─── 테스트 3: 2차 프로젝트 (20점 만점) ─────────────────────
// Google Sheet: 강일구 11.20 = (45/70*14) + (5/30*6) = 9.0 + 1.0 = 10.0?
// → 실제 공식 역산 필요

// ─── 최종: calculateTotals로 전체 총점 검증 ─────────────────
// config 전체를 넘기면 calculateTotals가 모든 카테고리를 계산
// EXPECTED_TOTALS와 비교

test('전체 총점이 Google Sheet와 동일', () => {
  const { totals } = calculateTotals(fullConfig, rawScores, students);
  for (const [name, expected] of Object.entries(EXPECTED_TOTALS)) {
    const student = students.find(s => s.name === name);
    assertApprox(totals[student.id].total, expected, `${name} 총점`);
  }
});
```

**이 테스트의 역할:** 구현이 완료되었을 때 Google Sheet의 숫자와 일치하는지 자동 검증. 공식 역산 작업이 필요한 부분(2차 프로젝트 가중치 등)은 사전에 수동으로 확인 후 채워야 합니다.

---

## 3. package.json 테스트 스크립트 추가

```json
{
  "scripts": {
    "test:scoring":    "node --import ./tests/register-loader.js tests/scoring-engine.test.js",
    "test:team":       "node --import ./tests/register-loader.js tests/team-scoring.test.js",
    "test:parity":     "node --import ./tests/register-loader.js tests/google-sheet-parity.test.js",
    "test:unit":       "npm run test:scoring && npm run test:team && npm run test:parity",
    "test:e2e":        "npx playwright test",
    "test:e2e:team":   "npx playwright test tests/e2e/team-input.spec.js",
    "test:e2e:nav":    "npx playwright test tests/e2e/recursive-nav.spec.js",
    "test:all":        "npm run test:unit && npm run test:e2e"
  }
}
```

---

## 4. Ralph Loop 전략

### 핵심 원칙

Ralph Loop는 **"명확한 성공 기준 + 반복 실행"** 구조입니다:

```
PROMPT.md → Claude 실행 → 파일 수정 → 테스트 실행 → 실패하면 반복
                                                  ↓ 통과하면
                                          <promise>DONE</promise>
```

Ralph Loop가 효과적인 조건:
- ✅ 테스트로 성공 여부를 자동 판단 가능
- ✅ 각 반복이 이전 결과를 볼 수 있음 (파일에 남음)
- ✅ 실패가 예측 가능한 방식으로 발생

---

### Phase 1용 Ralph Loop

#### PROMPT.md 내용

```markdown
# Phase 1: 팀 입력 모드 구현

## 목표
`claudedocs/implementation-design.md`의 Phase 1 설계를 구현한다.

## 현재 상태 확인
먼저 다음을 실행하여 현재 테스트 결과를 확인하라:
```bash
npm run test:team
```

## 구현해야 할 것
1. `src/lib/schema.js` — EvaluationCategory에 `input_scope: 'student' | 'team'` 추가
2. `src/lib/scoring-engine/index.js` — `calculateTeamCategory()` 함수 추가 및 분기 삽입
3. `src/lib/table-helpers.js` — `buildTeamCellData()` 추가
4. `src/components/eval/DataTable.jsx` — `rowMode`, `teams` prop 추가, 팀 행 렌더링
5. `src/components/eval/FieldManager.jsx` — input_scope 선택 UI 추가

## 성공 기준
다음 명령이 모두 exit code 0으로 종료되어야 한다:
```bash
npm run test:team && npm run test:scoring
```

성공하면 반드시 출력하라:
<promise>PHASE1 COMPLETE</promise>

## 참고 문서
- `claudedocs/implementation-design.md` — 전체 설계
- `claudedocs/recursive-table-analysis.md` — 문제 분석
- `tests/team-scoring.test.js` — 통과해야 할 테스트
```

#### ralph-loop 실행 커맨드

```bash
/ralph-loop "Phase 1: 팀 입력 모드 구현. 상세 내용은 PROMPT.md 참조. npm run test:team 성공 시 완료." --completion-promise "PHASE1 COMPLETE" --max-iterations 15
```

---

### Phase 2용 Ralph Loop

#### PROMPT.md 내용

```markdown
# Phase 2: EvalNode 재귀 네비게이션 구현

## 목표
`claudedocs/implementation-design.md`의 Phase 2 설계를 구현한다.

## 현재 상태 확인
먼저 다음을 실행하라 (서버가 실행 중이어야 함):
```bash
npm run test:e2e:nav 2>&1 | tail -30
```

## 구현해야 할 것
1. `src/app/cohort/[id]/eval/[[...path]]/page.jsx` — catch-all 라우트 (신규)
2. `src/components/eval/EvalNode.jsx` — 통합 재귀 컴포넌트 (신규)
3. `src/app/cohort/[id]/eval/[categoryId]/page.jsx` — 삭제 (catch-all이 대체)
4. `src/components/layout/SlidePanel.jsx` — 삭제

## 케이스 구현 순서 (반드시 이 순서로)
1. Case C (leaf 입력 노드) — 현재 EvalPage를 EvalNode로 이식
2. Case B (순수 집계 노드) — sub_categories가 COMPUTED 칼럼
3. Case A (root, path=[]) — 대시보드 총점 테이블
4. Case D (혼합 노드) — input_fields + sub_categories 동시

## 성공 기준
```bash
npm run test:e2e:nav
```
모든 테스트 통과 후:
<promise>PHASE2 COMPLETE</promise>

## 주의사항
- 기존 `npm run test:e2e` (kda-workflow.spec.js)도 깨지면 안 됨
- 기존 점수 입력, override, weight 기능 모두 유지
```

#### ralph-loop 실행 커맨드

```bash
/ralph-loop "Phase 2: EvalNode 재귀 네비게이션 구현. PROMPT.md 참조. npm run test:e2e:nav 성공 시 완료." --completion-promise "PHASE2 COMPLETE" --max-iterations 20
```

---

### Google Sheet 동등성용 Ralph Loop

이 단계는 Phase 1, 2 완료 후 실행합니다.

```bash
/ralph-loop "Google Sheet 동등성 검증. tests/google-sheet-parity.test.js가 통과하도록 설정값과 공식을 조정하라. npm run test:parity 성공 시 완료." --completion-promise "PARITY COMPLETE" --max-iterations 10
```

**이 루프의 특성:** 코드 변경이 아닌 **카테고리 설정값(config, formula, weights) 조정**이 주 작업. Claude가 Google Sheet 값과의 차이를 보고 공식/가중치를 역산합니다.

---

## 5. Ralph Loop 실행 전 체크리스트

### Phase 1 시작 전

```bash
# 1. 현재 테스트가 통과하는지 확인 (기준선)
npm run test:scoring

# 2. team-scoring.test.js 파일이 존재하는지 확인
ls tests/team-scoring.test.js

# 3. 실행하면 실패해야 함 (아직 구현 안 됐으니까)
npm run test:team || echo "정상: 아직 실패"

# 4. Git 상태 확인 (깨끗해야 함)
git status

# 5. 브랜치 생성
git checkout -b feature/team-input
```

### Phase 2 시작 전

```bash
# 1. Phase 1이 완전히 머지됐는지 확인
git log --oneline -5

# 2. 기존 E2E 통과 확인
npm run dev &   # 백그라운드로 서버 실행
npx playwright test tests/e2e/kda-workflow.spec.js

# 3. 브랜치 생성
git checkout -b feature/eval-node
```

---

## 6. 테스트 작성 권장 순서 (TDD)

```
① tests/team-scoring.test.js 작성 (실패 상태로)
   → npm run test:team → 실패 확인
   → /ralph-loop Phase 1 실행
   → 자동으로 구현 → 통과

② tests/e2e/team-input.spec.js 작성 (실패 상태로)
   → npx playwright test team-input.spec.js → 실패 확인
   → Phase 1 ralph-loop에 E2E도 포함하거나 별도 루프

③ tests/e2e/recursive-nav.spec.js 작성 (실패 상태로)
   → /ralph-loop Phase 2 실행

④ tests/google-sheet-parity.test.js 작성 (Google Sheet 값 채워넣기)
   → /ralph-loop Parity 실행
```

---

## 7. 각 단계별 Ralph Loop 유효성

| 단계 | Ralph Loop 적합도 | 이유 |
|------|-----------------|------|
| Phase 1 스코어링 | ★★★★★ | 유닛 테스트 = 즉각적 피드백, 명확한 성공 기준 |
| Phase 1 E2E | ★★★★☆ | 서버 필요하지만 재현 가능한 시나리오 |
| Phase 2 EvalNode | ★★★★☆ | UI 변경이라 E2E가 필요, 브라우저 검증 자동화 |
| Google Sheet 동등성 | ★★★☆☆ | 공식 역산 부분은 수동 확인 필요 |

---

## 8. UX 검증 전략

기능 테스트(로직이 맞는가)와 별도로, **사용자가 헷갈리지 않는가**를 자동으로 검증해야 합니다.
Playwright는 브라우저를 직접 제어하므로 다음 UX 관점을 모두 테스트할 수 있습니다.

### 8-1. 팀 입력 모드 UX

**파일:** `tests/e2e/ux-team-input.spec.js`

```javascript
test.describe('팀 입력 UX', () => {

  test('팀 모드 테이블에 팀명 행이 표시되고, 학생명 행은 없음', async ({ page }) => {
    // 팀 입력 카테고리 eval 페이지 접근
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);

    // 테이블에 팀명이 보여야 함
    await expect(page.getByRole('cell', { name: '1팀-KFC' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2팀-큠' })).toBeVisible();

    // 개별 학생명은 이 테이블에 없어야 함 (팀 모드이므로)
    await expect(page.getByRole('cell', { name: '강일구' })).toHaveCount(0);
  });

  test('팀 모드임을 알리는 배지/레이블이 표시됨', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);

    // "팀별 입력" 또는 아이콘 등 모드 표시 존재 여부
    const badge = page.locator('[data-testid="input-scope-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/팀별/);
  });

  test('팀 점수 입력 후 "팀원 전체에 반영됨" 시각적 피드백', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);

    // 팀 행의 첫 번째 입력칸에 값 입력
    const firstInput = page.locator('table input').first();
    await firstInput.fill('8');
    await firstInput.blur();

    // 저장 완료 후 결과 칼럼(점수)이 팀 행에 표시됨
    const scoreCell = page.locator('[data-col="score"]').first();
    await expect(scoreCell).not.toBeEmpty();
  });

  test('Composite: 팀 점수 sub는 팀 행, 개인 점수 sub는 학생 행으로 각각 표시', async ({ page }) => {
    // 2차 프로젝트 eval 페이지
    await page.goto(`/cohort/${cohortId}/eval/${proj2CatId}`);

    // 두 개의 COMPUTED 칼럼이 sub_categories로 표시됨
    const computedCols = page.locator('th[data-col-type="computed"]');
    await expect(computedCols).toHaveCount(2);

    // 첫 번째 sub(팀 평가) 클릭 → 팀 행 테이블
    await computedCols.first().click();
    await expect(page.getByRole('cell', { name: '1팀-KFC' })).toBeVisible();

    // 뒤로 → 두 번째 sub(동료평가) 클릭 → 학생 행 테이블
    await page.goBack();
    await computedCols.last().click();
    await expect(page.getByRole('cell', { name: '강일구' })).toBeVisible();
  });
});
```

---

### 8-2. 재귀 네비게이션 UX

**파일:** `tests/e2e/ux-recursive-nav.spec.js`

```javascript
test.describe('재귀 네비게이션 UX', () => {

  test('breadcrumb이 현재 depth를 정확히 표현함', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${catId}/${subId}`);

    // breadcrumb 구조 확인
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    const items = breadcrumb.locator('li');
    await expect(items).toHaveCount(3); // 루트 > 카테고리 > 서브카테고리
    await expect(items.last()).toHaveText(subName);
  });

  test('breadcrumb 중간 항목 클릭 시 해당 depth로 이동', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${catId}/${subId}`);

    // 두 번째 breadcrumb 항목 (부모 카테고리) 클릭
    const items = page.locator('[data-testid="breadcrumb"] li');
    await items.nth(1).click();

    // URL이 subId 없이 catId까지만
    await expect(page).toHaveURL(new RegExp(`/eval/${catId}$`));
  });

  test('COMPUTED 칼럼 클릭 시 SlidePanel이 아닌 페이지 이동', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${catId}`);

    // sheet(SlidePanel)가 DOM에 없어야 함
    await expect(page.locator('[data-slot="sheet"]')).toHaveCount(0);

    // COMPUTED 칼럼 헤더 클릭
    const computedHeader = page.locator('th[data-col-type="computed"]').first();
    await computedHeader.click();

    // URL이 바뀌었어야 함
    await expect(page).not.toHaveURL(new RegExp(`/eval/${catId}$`));

    // 여전히 sheet가 없어야 함 (패널이 열린 게 아님)
    await expect(page.locator('[data-slot="sheet"]')).toHaveCount(0);
  });

  test('leaf 노드에서 뒤로가기(breadcrumb)하면 부모 COMPUTED 칼럼 하이라이트', async ({ page }) => {
    // 3레벨로 진입
    await page.goto(`/cohort/${cohortId}/eval/${catId}/${subId}`);

    // breadcrumb 첫 번째 (부모) 클릭
    await page.locator('[data-testid="breadcrumb"] li').nth(1).click();

    // 방금 방문한 sub에 해당하는 COMPUTED 칼럼이 활성화 표시
    const activeCol = page.locator(`th[data-col-id="${subId}"]`);
    await expect(activeCol).toHaveClass(/active|highlight|ring/);
  });

  test('뒤로가기 후 스크롤 위치가 유지됨 (긴 테이블)', async ({ page }) => {
    // 학생이 많아 스크롤이 필요한 테이블
    await page.goto(`/cohort/${cohortId}/eval/${catId}`);

    // 스크롤 다운
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(100);

    // sub 클릭 후 뒤로가기
    await page.locator('th[data-col-type="computed"]').first().click();
    await page.goBack();

    // 스크롤 위치가 복원됨 (완벽하지 않아도 0이 아니어야 함)
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });
});
```

---

### 8-3. 스크린샷 기반 시각적 회귀 테스트

Playwright의 `toHaveScreenshot()`을 활용합니다. 구현 완료 후 **기준 스크린샷을 생성**하고, 이후 변경 시 자동 비교합니다.

```javascript
// tests/e2e/visual-regression.spec.js

test.describe('시각적 회귀 테스트', () => {

  test('팀 입력 테이블 레이아웃', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('team-input-table.png', {
      maxDiffPixels: 100, // 소폭 차이 허용
    });
  });

  test('3레벨 breadcrumb 레이아웃', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${catId}/${subId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="breadcrumb"]'))
      .toHaveScreenshot('breadcrumb-3level.png');
  });

  test('COMPUTED + INPUT 혼합 테이블 (composite 노드)', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${proj2CatId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table'))
      .toHaveScreenshot('composite-mixed-table.png');
  });
});
```

**스크린샷 생성:** `npx playwright test visual-regression.spec.js --update-snapshots`
**이후 회귀 검사:** `npx playwright test visual-regression.spec.js`

---

### 8-4. 접근성 및 키보드 UX

```javascript
test.describe('키보드/접근성 UX', () => {

  test('팀 입력 테이블에서 Tab 키로 다음 셀 이동', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);

    const firstInput = page.locator('table input').first();
    await firstInput.click();
    await firstInput.fill('8');

    // Tab → 같은 행 다음 컬럼 input으로 포커스 이동
    await page.keyboard.press('Tab');
    const focused = page.locator('input:focus');
    await expect(focused).not.toBe(firstInput);
  });

  test('breadcrumb에 ARIA 레이블이 있음', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${catId}/${subId}`);

    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible();
  });

  test('팀 입력 모드 배지가 스크린리더에서 읽힘', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);

    // aria-label이나 role="status" 확인
    const badge = page.locator('[data-testid="input-scope-badge"]');
    const ariaLabel = await badge.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });
});
```

---

### 8-5. UX 테스트를 위한 Ralph Loop

UX는 주관적 요소가 있어 ralph-loop 단독으로는 한계가 있습니다. 다음 구분으로 접근합니다:

| UX 항목 | Ralph Loop 가능 | 수동 확인 필요 |
|---------|----------------|--------------|
| 배지/레이블 표시 여부 | ✅ DOM 존재 확인 | ❌ 디자인이 직관적인가 |
| breadcrumb 구조 | ✅ 항목 수, 텍스트 | ❌ 시각적 위치감 |
| 팀 행 vs 학생 행 구분 | ✅ DOM 내용 확인 | ❌ 한눈에 파악되는가 |
| 스크롤 복원 | ✅ scrollY 값 | ❌ 체감 자연스러움 |
| 키보드 탐색 | ✅ 포커스 이동 | ❌ 흐름이 논리적인가 |
| 시각적 회귀 | ✅ 스크린샷 비교 | ❌ 레이아웃 심미성 |

**UX ralph-loop 커맨드 (Phase 2 이후):**

```bash
/ralph-loop "UX 테스트 통과. npm run test:e2e:ux 성공 시 완료. data-testid 속성 추가, ARIA 레이블, 팀 모드 배지 등 구현 포함." --completion-promise "UX COMPLETE" --max-iterations 8
```

---

## 9. 한계와 주의사항

**Ralph Loop로 해결하기 어려운 것:**
- Google Sheet의 "가중치를 어떻게 정했는가"의 역산 (사람이 봐야 함)
- 팀 구성 변경 시 점수 마이그레이션 정책 결정
- UI/UX 판단이 필요한 케이스 (어떤 모드가 직관적인가)

**ralph-loop 실행 중 Claude가 막히면:**
- `--max-iterations`가 소진되면 멈춤
- 이전 시도의 파일 변경이 남아있어 `git diff`로 확인 가능
- 어디서 막혔는지 분석 후 PROMPT.md를 더 구체적으로 수정하고 재실행
