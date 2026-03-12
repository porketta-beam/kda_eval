/**
 * 점수 계산 엔진 검증 테스트
 * scoring_system.md 기준 테스트 케이스
 *
 * 실행: node --import ./tests/loader.js tests/scoring-engine.test.js
 */

import { SCORING_METHOD, INPUT_FIELD_TYPE, INPUT_SCOPE } from '@/lib/schema.js';
import { calculateCategory } from '@/lib/scoring-engine/index.js';

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
  assert(Math.abs(actual - expected) < tolerance, `${message} (expected ${expected}, got ${actual})`);
}

// ─── 테스트 1: 출석률 (formula - attendance_deduction) ──────

console.log('\n[1] 출석률 차감법');

const attendanceCategory = {
  id: 'att',
  name: '출석률',
  scoring_method: SCORING_METHOD.FORMULA,
  config: {
    formula_type: 'attendance_deduction',
    params: { base: 20, threshold: 90, cap: 10 },
  },
  input_fields: [{ id: 'rate', name: '출석률(%)', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT }],
};

const attStudents = [
  { id: 's1', name: '학생1', is_dropout: false },
  { id: 's2', name: '학생2', is_dropout: false },
  { id: 's3', name: '학생3', is_dropout: false },
  { id: 's4', name: '학생4', is_dropout: false },
];

const attScores = {
  s1: { rate: 91.7 },
  s2: { rate: 85 },
  s3: { rate: 79 },
  s4: { rate: 95.5 },
};

const attResults = calculateCategory(attendanceCategory, { att: attScores }, attStudents);

assertApprox(attResults.s1.calculated, 20, '출석률 91.7% → 20');
assertApprox(attResults.s2.calculated, 15, '출석률 85% → 15');
assertApprox(attResults.s3.calculated, 0, '출석률 79% → 0 (cap 초과)');
assertApprox(attResults.s4.calculated, 20, '출석률 95.5% → 20');

// ─── 테스트 2: 순위 차등배점 5인 (하한 20) ─────────────────

console.log('\n[2] 순위 차등배점 - 5인팀 (하한 20)');

const rankCategory = {
  id: 'rank1',
  name: '개인평가',
  scoring_method: SCORING_METHOD.RANK_DIFFERENTIAL,
  config: {
    scope: 'all',
    top_score: 40,
    interval: 5,
    has_floor: true,
    floor_value: 20,
    rank_source: 'direct',
  },
  input_fields: [{ id: 'score', name: '점수', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT }],
};

const fiveStudents = [
  { id: 'r1', name: '1위', is_dropout: false },
  { id: 'r2', name: '2위', is_dropout: false },
  { id: 'r3', name: '3위', is_dropout: false },
  { id: 'r4', name: '4위', is_dropout: false },
  { id: 'r5', name: '5위', is_dropout: false },
];

const rankScores5 = {
  r1: { score: 95 },
  r2: { score: 85 },
  r3: { score: 75 },
  r4: { score: 65 },
  r5: { score: 55 },
};

const rankResults5 = calculateCategory(rankCategory, { rank1: rankScores5 }, fiveStudents);

assertApprox(rankResults5.r1.calculated, 40, '5인팀 1위 → 40');
assertApprox(rankResults5.r2.calculated, 35, '5인팀 2위 → 35');
assertApprox(rankResults5.r3.calculated, 30, '5인팀 3위 → 30');
assertApprox(rankResults5.r4.calculated, 25, '5인팀 4위 → 25');
assertApprox(rankResults5.r5.calculated, 20, '5인팀 5위 → 20');

// ─── 테스트 3: 6인팀 (하한 20 적용) ────────────────────────

console.log('\n[3] 순위 차등배점 - 6인팀 (하한 20 적용)');

const sixStudents = [
  ...fiveStudents,
  { id: 'r6', name: '6위', is_dropout: false },
];

const rankScores6 = {
  ...rankScores5,
  r6: { score: 45 },
};

const rankResults6 = calculateCategory(rankCategory, { rank1: rankScores6 }, sixStudents);

assertApprox(rankResults6.r1.calculated, 40, '6인팀 1위 → 40');
assertApprox(rankResults6.r5.calculated, 20, '6인팀 5위 → 20');
assertApprox(rankResults6.r6.calculated, 20, '6인팀 6위 → 20 (하한 적용)');

// ─── 테스트 4: Boolean ─────────────────────────────────────

console.log('\n[4] Boolean (복수강사추천)');

const boolCategory = {
  id: 'bool1',
  name: '복수강사추천',
  scoring_method: SCORING_METHOD.BOOLEAN,
  config: { true_score: 1, false_score: 0 },
  input_fields: [{ id: 'rec', name: '추천', type: INPUT_FIELD_TYPE.BOOLEAN, per: INPUT_SCOPE.STUDENT }],
};

const boolStudents = [
  { id: 'b1', name: '추천', is_dropout: false },
  { id: 'b2', name: '비추천', is_dropout: false },
];

const boolScores = { b1: { rec: 1 }, b2: { rec: 0 } };
const boolResults = calculateCategory(boolCategory, { bool1: boolScores }, boolStudents);

assertApprox(boolResults.b1.calculated, 1, 'Boolean true → 1');
assertApprox(boolResults.b2.calculated, 0, 'Boolean false → 0');

// ─── 테스트 5: 가중평균 ────────────────────────────────────

console.log('\n[5] 가중평균 (수업참여도)');

const waCategory = {
  id: 'wa1',
  name: '수업참여도',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  config: { multiplier: 2, exclude_empty: true },
  input_fields: [
    { id: 'f1', name: '과목1', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'f2', name: '과목2', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'f3', name: '과목3', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
  ],
};

const waStudents = [{ id: 'w1', name: '학생', is_dropout: false }];
const waScores = { w1: { f1: 8, f2: 9, f3: 7 } };
const waResults = calculateCategory(waCategory, { wa1: waScores }, waStudents);

assertApprox(waResults.w1.calculated, 16, 'AVERAGE(8,9,7)×2 = 16');

// ─── 테스트 6: 합산/나누기 ─────────────────────────────────

console.log('\n[6] 합산/나누기 (협업및태도)');

const sdCategory = {
  id: 'sd1',
  name: '협업및태도',
  scoring_method: SCORING_METHOD.SUM_DIVIDE,
  config: { divisor: 10 },
  input_fields: [
    { id: 'a1', name: '항목1', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'a2', name: '항목2', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'a3', name: '항목3', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
  ],
};

const sdStudents = [{ id: 'sd1s', name: '학생', is_dropout: false }];
const sdScores = { sd1s: { a1: 30, a2: 25, a3: 20 } };
const sdResults = calculateCategory(sdCategory, { sd1: sdScores }, sdStudents);

assertApprox(sdResults.sd1s.calculated, 7.5, 'SUM(30,25,20)/10 = 7.5');

// ─── 테스트 7: Boolean with deduction ──────────────────────

console.log('\n[7] Boolean with deduction (출석 가산점)');

const bwdCategory = {
  id: 'bwd1',
  name: '출석가산점',
  scoring_method: SCORING_METHOD.BOOLEAN_WITH_DEDUCTION,
  config: {
    base_score: 2,
    condition_fields: ['absence', 'late', 'early_leave', 'outing'],
    deduction_rules: [
      { field_id: 'late_official', per_count: 3, deduction: 0.1 },
      { field_id: 'absence_official', per_count: 1, deduction: 0.1 },
    ],
  },
  input_fields: [
    { id: 'absence', name: '결석', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'late', name: '지각', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'early_leave', name: '조퇴', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'outing', name: '외출', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'late_official', name: '지각공과', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'absence_official', name: '결석공과', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
  ],
};

const bwdStudents = [
  { id: 'bwd1s', name: '완벽출석', is_dropout: false },
  { id: 'bwd2s', name: '완벽+결석공과1', is_dropout: false },
  { id: 'bwd3s', name: '결석있음', is_dropout: false },
];

const bwdScores = {
  bwd1s: { absence: 0, late: 0, early_leave: 0, outing: 0, late_official: 0, absence_official: 0 },
  bwd2s: { absence: 0, late: 0, early_leave: 0, outing: 0, late_official: 0, absence_official: 1 },
  bwd3s: { absence: 1, late: 0, early_leave: 0, outing: 0, late_official: 0, absence_official: 0 },
};

const bwdResults = calculateCategory(bwdCategory, { bwd1: bwdScores }, bwdStudents);

assertApprox(bwdResults.bwd1s.calculated, 2.0, '완벽출석 → 2.0');
assertApprox(bwdResults.bwd2s.calculated, 1.9, '완벽+결석공과1 → 1.9');
assertApprox(bwdResults.bwd3s.calculated, 0, '결석있음 → 0');

// ─── 테스트 8: Composite (1차 프로젝트) ─────────────────────

console.log('\n[8] Composite (1차 프로젝트)');

const compositeCategory = {
  id: 'proj1',
  name: '1차프로젝트',
  scoring_method: SCORING_METHOD.COMPOSITE,
  config: {
    final_formula: '(team + individual) * 15 / 100',
  },
  input_fields: [],
  sub_categories: [
    {
      id: 'team_eval',
      name: 'team',
      scoring_method: SCORING_METHOD.USER_INPUT,
      config: {},
      input_fields: [{ id: 'score', name: '점수', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT }],
    },
    {
      id: 'individual_eval',
      name: 'individual',
      scoring_method: SCORING_METHOD.USER_INPUT,
      config: {},
      input_fields: [{ id: 'score', name: '점수', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT }],
    },
  ],
};

const compStudents = [{ id: 'c1', name: '학생', is_dropout: false }];
const compScores = {
  team_eval: { c1: { score: 60 } },
  individual_eval: { c1: { score: 40 } },
};

const compResults = calculateCategory(compositeCategory, compScores, compStudents);

assertApprox(compResults.c1.calculated, 15, '(60+40)×15/100 = 15');

// ─── 결과 ──────────────────────────────────────────────────

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
