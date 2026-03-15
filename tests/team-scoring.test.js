/**
 * Phase 1: 팀 입력 모드 스코어링 검증
 *
 * 실행: node --import ./tests/register-loader.js tests/team-scoring.test.js
 *
 * 검증 항목:
 *   1. input_scope='team' 카테고리 → 팀 단위 계산 → 팀원에게 동일 점수 배분
 *   2. 팀 없는 학생 → 0점
 *   3. Composite: 팀 sub + 학생 sub → 각각 계산 후 formula 합산
 *   4. 기존 student 모드 동작 불변 (회귀)
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

function assertApprox(actual, expected, message, tolerance = 0.05) {
  const ok = typeof actual === 'number' && Math.abs(actual - expected) <= tolerance;
  if (ok) {
    passed++;
    console.log(`  ✓ ${message} (${actual})`);
  } else {
    failed++;
    console.error(`  ✗ ${message} — expected ${expected}, got ${actual}`);
  }
}

// ─── 공통 fixture ────────────────────────────────────────────────────────────

const teams = [
  { id: 'team-1', name: '1팀-KFC',  members: ['s1', 's2'] },
  { id: 'team-2', name: '2팀-큠',   members: ['s3', 's4'] },
];

const students = [
  { id: 's1', name: '학생A', team_id: 'team-1', is_dropout: false },
  { id: 's2', name: '학생B', team_id: 'team-1', is_dropout: false },
  { id: 's3', name: '학생C', team_id: 'team-2', is_dropout: false },
  { id: 's4', name: '학생D', team_id: 'team-2', is_dropout: false },
];

// ─── 테스트 1: 팀 입력 → 팀원 전체 동일 점수 배분 ──────────────────────────

console.log('\n[1] 팀 입력 모드: 팀원 점수 공유');

const 팀평가 = {
  id: 'team_cat',
  name: '팀 평가',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  input_scope: 'team',                           // ← 핵심: 팀 단위 입력
  config: { multiplier: 1, exclude_empty: false },
  input_fields: [
    { id: 'f_a', name: '항목A', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.TEAM },
    { id: 'f_b', name: '항목B', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.TEAM },
  ],
};

// raw_scores: 팀ID를 키로 저장
const rawScores_팀 = {
  team_cat: {
    'team-1': { f_a: 8, f_b: 6 },   // 평균 = 7.0
    'team-2': { f_a: 9, f_b: 9 },   // 평균 = 9.0
  },
};

const res1 = calculateCategory(팀평가, rawScores_팀, students, teams);

// 1팀 두 학생 모두 동일 점수
assertApprox(res1['s1']?.calculated, 7.0, '1팀 학생A → 7.0');
assertApprox(res1['s2']?.calculated, 7.0, '1팀 학생B → 7.0 (팀 점수 공유)');
// 2팀 두 학생 모두 동일 점수
assertApprox(res1['s3']?.calculated, 9.0, '2팀 학생C → 9.0');
assertApprox(res1['s4']?.calculated, 9.0, '2팀 학생D → 9.0 (팀 점수 공유)');

// ─── 테스트 2: 팀 없는 학생 → 0점 ──────────────────────────────────────────

console.log('\n[2] 팀 없는 학생 처리');

const 팀없는학생 = { id: 's_none', name: '무소속', team_id: null, is_dropout: false };
const students_with_none = [...students, 팀없는학생];

const res2 = calculateCategory(팀평가, rawScores_팀, students_with_none, teams);
assertApprox(res2['s_none']?.calculated ?? 0, 0, '팀 없는 학생 → 0점');

// ─── 테스트 3: 팀 점수가 없는 팀의 학생 → 0점 ──────────────────────────────

console.log('\n[3] 점수 미입력 팀 처리');

const rawScores_팀_partial = {
  team_cat: {
    'team-1': { f_a: 8, f_b: 6 }, // 1팀만 입력
    // team-2 미입력
  },
};

const res3 = calculateCategory(팀평가, rawScores_팀_partial, students, teams);
assertApprox(res3['s1']?.calculated, 7.0, '입력된 1팀 학생A → 7.0');
assertApprox(res3['s3']?.calculated ?? 0, 0, '미입력 2팀 학생C → 0');

// ─── 테스트 4: Composite — 팀 sub + 학생 sub 혼합 ───────────────────────────
// Google Sheet 2차 프로젝트 구조:
//   팀 평가 (70점) + 팀내 동료평가 (30점) → 20점으로 환산

console.log('\n[4] Composite: 팀 sub + 개인 sub 혼합 (2차 프로젝트 구조)');

const 이차프로젝트 = {
  id: 'proj2',
  name: '2차 프로젝트',
  scoring_method: SCORING_METHOD.COMPOSITE,
  input_scope: 'student',
  config: {
    // 팀평가(70만점) 14점 기여 + 동료평가(30만점) 6점 기여 = 20점
    final_formula: '(팀평가 / 70 * 14) + (동료평가 / 30 * 6)',
  },
  input_fields: [],
  sub_categories: [
    {
      id: 'sub_team',
      name: '팀평가',
      scoring_method: SCORING_METHOD.SUM_DIVIDE,
      input_scope: 'team',           // ← 팀 단위 입력
      config: { divisor: 1 },
      input_fields: [
        { id: 'kiwooom', name: '키움평가', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.TEAM },
        { id: 'peer_t',  name: '학생평가', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.TEAM },
      ],
      sub_categories: [],
    },
    {
      id: 'sub_peer',
      name: '동료평가',
      scoring_method: SCORING_METHOD.USER_INPUT,
      input_scope: 'student',        // ← 개인 단위 입력
      config: {},
      input_fields: [
        { id: 'peer_score', name: '동료평가점수', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
      ],
      sub_categories: [],
    },
  ],
};

const rawScores_복합 = {
  // 팀평가: 팀ID로 저장 (SUM: kiwooom + peer_t)
  sub_team: {
    'team-1': { kiwooom: 50, peer_t: 10 },  // 합계 60 (70만점)
    'team-2': { kiwooom: 60, peer_t: 8  },  // 합계 68 (70만점)
  },
  // 동료평가: 학생ID로 저장
  sub_peer: {
    's1': { peer_score: 25 },   // 25/30
    's2': { peer_score: 5  },   // 5/30
    's3': { peer_score: 20 },   // 20/30
    's4': { peer_score: 10 },   // 10/30
  },
};

const res4 = calculateCategory(이차프로젝트, rawScores_복합, students, teams);

// 학생A: (60/70*14) + (25/30*6) = 12.0 + 5.0 = 17.0
assertApprox(res4['s1']?.calculated, 17.0, '학생A: 팀60 + 동료25 → 17.0');
// 학생B: (60/70*14) + (5/30*6)  = 12.0 + 1.0 = 13.0
assertApprox(res4['s2']?.calculated, 13.0, '학생B: 팀60 + 동료5  → 13.0 (같은 팀, 다른 동료평가)');
// 학생C: (68/70*14) + (20/30*6) ≈ 13.6 + 4.0 = 17.6
assertApprox(res4['s3']?.calculated, 17.6, '학생C: 팀68 + 동료20 → 17.6');
// 학생D: (68/70*14) + (10/30*6) ≈ 13.6 + 2.0 = 15.6
assertApprox(res4['s4']?.calculated, 15.6, '학생D: 팀68 + 동료10 → 15.6');

// ─── 테스트 5: 기존 student 모드 회귀 테스트 ────────────────────────────────
// input_scope가 없거나 'student'이면 기존과 동일하게 동작

console.log('\n[5] 회귀: input_scope 없음 → 기존 student 모드 그대로');

const 학생모드 = {
  id: 'student_cat',
  name: '수업참여도',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  // input_scope 없음 (또는 'student')
  config: { multiplier: 2, exclude_empty: true },
  input_fields: [
    { id: 'g1', name: '과목1', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
    { id: 'g2', name: '과목2', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
  ],
};

const rawScores_학생 = {
  student_cat: {
    's1': { g1: 8, g2: 9 },   // 평균 8.5 × 2 = 17
    's2': { g1: 7, g2: 7 },   // 평균 7.0 × 2 = 14
  },
};

const res5 = calculateCategory(학생모드, rawScores_학생, students, teams);
assertApprox(res5['s1']?.calculated, 17.0, '학생A 수업참여도 = 17');
assertApprox(res5['s2']?.calculated, 14.0, '학생B 수업참여도 = 14');
// 팀 입력값과 무관하게 학생별 점수 유지
assert(res5['s1']?.calculated !== res5['s2']?.calculated, '팀 점수 공유 없음 (학생별 독립)');

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
