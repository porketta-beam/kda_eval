/**
 * Phase 1: 재귀 트리 엔진 검증
 *
 * 실행: node --import ./tests/register-loader.js tests/recursive-tree.test.js
 *
 * 검증 항목:
 *   TREE-01: 임의 깊이 중첩
 *   TREE-05: 부모 자동 집계
 *   TREE-06: 임의 깊이 override
 *   TREE-07: 하이브리드 노드 (input_fields + sub_categories)
 *   CONF-01: 코호트 독립성
 *   D-12: 카테고리별 순위
 */

import { SCORING_METHOD, V1_SCORING_METHOD } from '@/lib/schema.js';
import { calculateCategory, computeCategoryRanks } from '@/lib/scoring-engine/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertApprox(actual, expected, message, tolerance = 0.01) {
  const ok = typeof actual === 'number' && Math.abs(actual - expected) <= tolerance;
  if (ok) {
    passed++;
    console.log(`  ✓ ${message} (expected ${expected}, got ${actual})`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected ${expected}, got ${actual}`);
  }
}

// ─── 공통 fixture ────────────────────────────────────────────

const students = [
  { id: 's1', name: '학생1', is_dropout: false },
  { id: 's2', name: '학생2', is_dropout: false },
  { id: 's3', name: '학생3', is_dropout: false },
];

// leaf1: weighted_average 카테고리 (입력필드 1개, multiplier=1)
const leaf1 = {
  id: 'leaf1',
  name: '항목A',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  config: { multiplier: 1, exclude_empty: true },
  input_fields: [{ id: 'f1', name: '점수', type: 'number', per: 'student', weight: 1 }],
  sub_categories: [],
  weight: 1,
};

// leaf2: sum_divide 카테고리 (입력필드 1개, divisor=1)
const leaf2 = {
  id: 'leaf2',
  name: '항목B',
  scoring_method: SCORING_METHOD.SUM_DIVIDE,
  config: { divisor: 1 },
  input_fields: [{ id: 'f2', name: '점수', type: 'number', per: 'student', weight: 1 }],
  sub_categories: [],
  weight: 1,
};

// parentAvg: weighted_average 부모 (leaf1 + leaf2를 하위항목으로 가짐)
const parentAvg = {
  id: 'parentAvg',
  name: '평균 부모',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  config: { multiplier: 1, exclude_empty: true },
  input_fields: [],
  sub_categories: [leaf1, leaf2],
  weight: 1,
};

// parentSum: sum_divide 부모 (leaf1 + leaf2)
const parentSum = {
  id: 'parentSum',
  name: '합산 부모',
  scoring_method: SCORING_METHOD.SUM_DIVIDE,
  config: { divisor: 1 },
  input_fields: [],
  sub_categories: [leaf1, leaf2],
  weight: 1,
};

// grandparent: weighted_average 최상위 (parentAvg를 하위항목으로 가짐, 3 depth)
const grandparent = {
  id: 'grandparent',
  name: '최상위',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  config: { multiplier: 1, exclude_empty: true },
  input_fields: [],
  sub_categories: [parentAvg],
  weight: 1,
};

// hybridNode: input_fields + sub_categories 동시 보유
const hybridNode = {
  id: 'hybridNode',
  name: '하이브리드',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  config: { multiplier: 1, exclude_empty: true },
  input_fields: [{ id: 'hf1', name: '직접점수', type: 'number', per: 'student', weight: 1 }],
  sub_categories: [leaf1],
  weight: 1,
};

// raw scores
const rawScores = {
  leaf1: {
    s1: { f1: 80 },
    s2: { f1: 90 },
    s3: { f1: 70 },
  },
  leaf2: {
    s1: { f2: 60 },
    s2: { f2: 40 },
    s3: { f2: 50 },
  },
};

// ─── [TREE-01] 3-level deep nesting ─────────────────────────

console.log('\n[TREE-01] 임의 깊이 중첩: 3-level grandparent → parentAvg → leaf');

const tree01Results = calculateCategory(grandparent, rawScores, students);
assert(tree01Results.s1 != null, 'TREE-01: s1 결과 존재');
assert(tree01Results.s2 != null, 'TREE-01: s2 결과 존재');
assert(tree01Results.s3 != null, 'TREE-01: s3 결과 존재');
// grandparent→parentAvg: avg(leaf1, leaf2) → s1: avg(80,60)=70
assertApprox(tree01Results.s1.calculated, 70, 'TREE-01: s1 grandparent = avg(avg(80,60)) = 70');

// ─── [TREE-05] 부모 자동 집계: 평균 ──────────────────────────

console.log('\n[TREE-05] 부모 자동 집계: weighted_average');

const tree05AvgResults = calculateCategory(parentAvg, rawScores, students);
// parentAvg: weighted_average of [leaf1, leaf2] (weight=1 each)
// s1: avg(80, 60) = 70
// s2: avg(90, 40) = 65
// s3: avg(70, 50) = 60
assertApprox(tree05AvgResults.s1.calculated, 70, 'TREE-05 Avg: s1 = avg(80,60) = 70');
assertApprox(tree05AvgResults.s2.calculated, 65, 'TREE-05 Avg: s2 = avg(90,40) = 65');
assertApprox(tree05AvgResults.s3.calculated, 60, 'TREE-05 Avg: s3 = avg(70,50) = 60');

// ─── [TREE-05] 부모 자동 집계: 합산 ──────────────────────────

console.log('\n[TREE-05] 부모 자동 집계: sum_divide');

const tree05SumResults = calculateCategory(parentSum, rawScores, students);
// parentSum: sum_divide (divisor=1) of [leaf1, leaf2]
// s1: 80 + 60 = 140
// s2: 90 + 40 = 130
// s3: 70 + 50 = 120
assertApprox(tree05SumResults.s1.calculated, 140, 'TREE-05 Sum: s1 = 80+60 = 140');
assertApprox(tree05SumResults.s2.calculated, 130, 'TREE-05 Sum: s2 = 90+40 = 130');
assertApprox(tree05SumResults.s3.calculated, 120, 'TREE-05 Sum: s3 = 70+50 = 120');

// ─── [TREE-06] Override at depth-2 ──────────────────────────

console.log('\n[TREE-06] 임의 깊이 override: leaf override → 부모 변경');

// Override leaf1 for s1: 80 → 100
const overrides1 = { leaf1: { s1: 100 } };
const tree06Results = calculateCategory(parentAvg, rawScores, students, [], overrides1);
// s1: avg(100, 60) = 80 (not 70)
assertApprox(tree06Results.s1.calculated, 80, 'TREE-06: s1 override leaf1=100 → avg(100,60) = 80');
// s2, s3 unchanged
assertApprox(tree06Results.s2.calculated, 65, 'TREE-06: s2 unchanged = 65');

// ─── [TREE-06] Override at depth-1 ──────────────────────────

console.log('\n[TREE-06] 부모 노드 직접 override → 조부모 변경');

// Override parentAvg for s1 to 999
const overrides2 = { parentAvg: { s1: 999 } };
const tree06GpResults = calculateCategory(grandparent, rawScores, students, [], overrides2);
// grandparent only has parentAvg as child, so s1 = avg(999) = 999
assertApprox(tree06GpResults.s1.calculated, 999, 'TREE-06: s1 override parentAvg=999 → grandparent=999');

// ─── [TREE-06] Clear override (null) ──────────────────────────

console.log('\n[TREE-06] override 해제: null → 원래 계산값 복원');

// Override with null → should not replace (null means no override)
const overrides3 = { leaf1: { s1: null } };
const tree06ClearResults = calculateCategory(parentAvg, rawScores, students, [], overrides3);
// s1: avg(80, 60) = 70 (original, null override is ignored)
assertApprox(tree06ClearResults.s1.calculated, 70, 'TREE-06: null override → s1 reverts to 70');

// ─── [TREE-07] 하이브리드 노드 ──────────────────────────────

console.log('\n[TREE-07] 하이브리드 노드: input_fields + sub_categories 동시');

// hybridNode has:
//   input_fields: [hf1] (weight=1)
//   sub_categories: [leaf1] (weight=1)
// So augmented fields = [hf1, leaf1-virtual], both weight=1
// s1: hf1=50, leaf1=80 → avg(50, 80) = 65
const hybridScores = {
  ...rawScores,
  hybridNode: {
    s1: { hf1: 50 },
    s2: { hf1: 60 },
    s3: { hf1: 40 },
  },
};
const tree07Results = calculateCategory(hybridNode, hybridScores, students);
assertApprox(tree07Results.s1.calculated, 65, 'TREE-07: s1 hybrid = avg(50,80) = 65');
assertApprox(tree07Results.s2.calculated, 75, 'TREE-07: s2 hybrid = avg(60,90) = 75');
assertApprox(tree07Results.s3.calculated, 55, 'TREE-07: s3 hybrid = avg(40,70) = 55');

// ─── [CONF-01] 코호트 독립성 ──────────────────────────────

console.log('\n[CONF-01] 코호트 독립성: 다른 config, 같은 rawScores → 독립 결과');

// Config A: parentAvg (weighted_average)
const configA_results = calculateCategory(parentAvg, rawScores, students);

// Config B: parentSum (sum_divide) with same raw data
const configB_results = calculateCategory(parentSum, rawScores, students);

// They should produce different results
assert(configA_results.s1.calculated !== configB_results.s1.calculated,
  'CONF-01: 다른 config → s1 결과 다름 (avg=70 vs sum=140)');
assertApprox(configA_results.s1.calculated, 70, 'CONF-01: configA s1 = 70');
assertApprox(configB_results.s1.calculated, 140, 'CONF-01: configB s1 = 140');

// ─── [D-12] 순위 계산: standard competition ranking ─────────

console.log('\n[D-12] 카테고리별 순위: standard competition ranking (1,1,3)');

const rankInput = {
  s1: { calculated: 90 },
  s2: { calculated: 90 },
  s3: { calculated: 80 },
};
const ranks = computeCategoryRanks(rankInput);
assert(ranks.s1 === 1, 'D-12: s1(90점) → rank 1');
assert(ranks.s2 === 1, 'D-12: s2(90점) → rank 1 (공동 1위)');
assert(ranks.s3 === 3, 'D-12: s3(80점) → rank 3 (1위가 2명이므로 3위)');

// ─── [D-12] Null 순위 ──────────────────────────────────────

console.log('\n[D-12] null 점수 → null 순위');

const rankWithNull = {
  s1: { calculated: 90 },
  s2: { calculated: null },
};
const ranksWithNull = computeCategoryRanks(rankWithNull);
assert(ranksWithNull.s1 === 1, 'D-12 null: s1(90점) → rank 1');
assert(ranksWithNull.s2 === null, 'D-12 null: s2(null) → rank null');

// ─── 결과 ──────────────────────────────────────────────────

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
