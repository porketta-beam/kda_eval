import { SCORING_METHOD } from '@/lib/schema';

import * as weightedAverage from './methods/weighted-average.js';
import * as sumDivide from './methods/sum-divide.js';
import * as rankDifferential from './methods/rank-differential.js';
import * as formula from './methods/formula.js';
import * as booleanMethod from './methods/boolean.js';
import * as booleanWithDeduction from './methods/boolean-with-deduction.js';
import * as userInput from './methods/user-input.js';
import * as composite from './methods/composite.js';

const METHOD_MAP = {
  [SCORING_METHOD.WEIGHTED_AVERAGE]: weightedAverage,
  [SCORING_METHOD.SUM_DIVIDE]: sumDivide,
  [SCORING_METHOD.RANK_DIFFERENTIAL]: rankDifferential,
  [SCORING_METHOD.FORMULA]: formula,
  [SCORING_METHOD.BOOLEAN]: booleanMethod,
  [SCORING_METHOD.BOOLEAN_WITH_DEDUCTION]: booleanWithDeduction,
  [SCORING_METHOD.USER_INPUT]: userInput,
  [SCORING_METHOD.COMPOSITE]: composite,
};

/**
 * 하위항목을 가상 input_field로 변환하여 기존 필드에 병합
 */
function buildAugmentedCategory(category, subCategories) {
  const virtualFields = subCategories.map(sub => ({
    id: sub.id,
    name: sub.name,
    type: 'number',
    per: 'student',
    weight: sub.weight ?? 1,
  }));

  return {
    ...category,
    input_fields: [...(category.input_fields || []), ...virtualFields],
  };
}

/**
 * raw 입력값 + 하위항목 calculated 값을 병합한 스코어 생성
 */
function buildAugmentedScores(categoryScores, subResults, subCategories, students) {
  const augmented = {};
  for (const student of students) {
    augmented[student.id] = {
      ...(categoryScores[student.id] || {}),
    };
    for (const sub of subCategories) {
      augmented[student.id][sub.id] = subResults[sub.id]?.[student.id]?.calculated ?? 0;
    }
  }
  return augmented;
}

/**
 * 팀 입력 모드 계산: 팀 단위로 계산 후 팀원 학생에게 배분
 */
function calculateTeamCategory(category, allRawScores, students, teams, method) {
  const teamScores = allRawScores[category.id] || {};

  // 팀별 계산
  const teamResultMap = {};
  for (const team of teams) {
    const singleEntityScores = { [team.id]: teamScores[team.id] || {} };
    const result = method.calculate(
      category,
      singleEntityScores,
      [{ id: team.id, name: team.name, is_dropout: false }],
      []
    );
    teamResultMap[team.id] = result[team.id] ?? { raw: null, calculated: 0 };
  }

  // 팀 점수를 학생에게 배분
  const studentResults = {};
  for (const student of students) {
    const teamId = student.team_id;
    studentResults[student.id] = teamResultMap[teamId] ?? { raw: null, calculated: 0 };
  }
  return studentResults;
}

/**
 * 단일 카테고리 계산
 * @param {import('@/lib/schema').EvaluationCategory} category
 * @param {Object} allRawScores - scores.json의 raw_scores 전체
 * @param {import('@/lib/schema').Student[]} students
 * @param {import('@/lib/schema').Team[]} teams
 * @param {Object} [overrides] - { [categoryId]: { [studentId]: number|null } } (per D-04)
 * @returns {Object<string, {raw: *, calculated: number}>}
 */
export function calculateCategory(category, allRawScores, students, teams = [], overrides = {}) {
  const method = METHOD_MAP[category.scoring_method];
  if (!method) {
    throw new Error(`Unknown scoring method: ${category.scoring_method}`);
  }

  // 활성 학생만 계산 (중도퇴소 제외)
  const activeStudents = students.filter(s => !s.is_dropout);

  // ★ 팀 입력 모드: composite보다 먼저 분기
  if (category.input_scope === 'team') {
    return calculateTeamCategory(category, allRawScores, activeStudents, teams, method);
  }

  // composite는 하위 카테고리 접근을 위해 전체 rawScores 필요
  if (category.scoring_method === SCORING_METHOD.COMPOSITE) {
    return method.calculate(category, allRawScores, activeStudents, teams);
  }

  const categoryScores = allRawScores[category.id] || {};
  const subCategories = category.sub_categories || [];

  // 하위항목이 있는 비-composite 카테고리 → augmented 경로
  if (subCategories.length > 0) {
    // 1. 하위항목 재귀 계산
    const subResults = {};
    for (const sub of subCategories) {
      subResults[sub.id] = calculateCategory(sub, allRawScores, students, teams, overrides);
    }

    // 하위항목 override 적용 (per D-04)
    for (const sub of subCategories) {
      for (const student of activeStudents) {
        const overrideVal = overrides[sub.id]?.[student.id];
        if (overrideVal != null && subResults[sub.id]?.[student.id]) {
          subResults[sub.id][student.id].calculated = overrideVal;
        }
      }
    }

    // 2. augmented category 생성 (input_fields + 하위항목을 가상 필드로 병합)
    const augmentedCategory = buildAugmentedCategory(category, subCategories);

    // 3. augmented scores 생성 (raw 입력값 + 하위항목 calculated 병합)
    const augmentedScores = buildAugmentedScores(categoryScores, subResults, subCategories, activeStudents);

    // 4. 기존 method로 계산
    const results = method.calculate(augmentedCategory, augmentedScores, activeStudents, teams);

    // 5. 결과에 sub_scores 첨부 + 현재 노드 override 적용 (per D-04)
    for (const student of activeStudents) {
      if (results[student.id]) {
        results[student.id].sub_scores = {};
        for (const sub of subCategories) {
          results[student.id].sub_scores[sub.id] = subResults[sub.id]?.[student.id] ?? { calculated: 0 };
        }
        const ownOverride = overrides[category.id]?.[student.id];
        if (ownOverride != null) {
          results[student.id].calculated = ownOverride;
        }
      }
    }

    return results;
  }

  // 일반 방식: 해당 카테고리의 raw scores만 추출
  const results = method.calculate(category, categoryScores, activeStudents, teams);
  // leaf 노드 override 적용 (per D-04)
  for (const student of activeStudents) {
    const ownOverride = overrides[category.id]?.[student.id];
    if (ownOverride != null && results[student.id]) {
      results[student.id].calculated = ownOverride;
    }
  }
  return results;
}

/**
 * 전체 카테고리 계산
 * @param {Object} [overrides] - { [categoryId]: { [studentId]: number|null } }
 * @returns {Object<string, Object<string, {raw: *, calculated: number}>>}
 */
export function calculateAllCategories(config, rawScores, students, overrides = {}) {
  const results = {};
  const teams = config.teams || [];

  for (const category of config.evaluation_categories) {
    results[category.id] = calculateCategory(category, rawScores, students, teams, overrides);
  }

  return results;
}

/**
 * 총점 + 순위 계산
 * aggregation_settings: { method: 'sum'|'weighted', max_score, bonus_limit }
 * @param {Object} [overrides] - { [categoryId]: { [studentId]: number|null } }
 */
export function calculateTotals(config, rawScores, students, overrides = {}) {
  const categoryResults = calculateAllCategories(config, rawScores, students, overrides);
  const activeStudents = students.filter(s => !s.is_dropout);
  const totals = {};
  const aggSettings = config.aggregation_settings || {};
  const bonusLimit = aggSettings.bonus_limit ?? Infinity;

  // 학생별 총점 계산
  for (const student of activeStudents) {
    let total = 0;
    let bonusTotal = 0;
    const breakdown = {};

    for (const category of config.evaluation_categories) {
      const result = categoryResults[category.id]?.[student.id];
      // override가 있으면 해당 값 사용, 없으면 calculated 사용
      const overrideVal = overrides[category.id]?.[student.id];
      const score = (overrideVal != null) ? overrideVal : (result?.calculated ?? 0);
      breakdown[category.id] = {
        name: category.name,
        max_score: category.max_score,
        score,
        is_bonus: category.is_bonus,
      };

      if (category.is_bonus) {
        bonusTotal += score;
      } else {
        total += score;
      }
    }

    // 가산점 한도 적용
    const cappedBonus = Math.min(bonusTotal, bonusLimit);
    total += cappedBonus;

    totals[student.id] = { total: Math.round(total * 100) / 100, breakdown };
  }

  // 순위 산정
  const sorted = Object.entries(totals).sort(([, a], [, b]) => b.total - a.total);
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][1].total !== sorted[i - 1][1].total) {
      currentRank = i + 1;
    }
    totals[sorted[i][0]].rank = currentRank;
  }

  return { categoryResults, totals };
}

/**
 * 예상 점수 계산: 미입력 항목을 전체 평균으로 대체
 */
export function calculateProjectedScores(config, rawScores, students, overrides = {}) {
  const activeStudents = students.filter(s => !s.is_dropout);

  // 먼저 실제 계산 수행
  const actualResults = calculateAllCategories(config, rawScores, activeStudents, overrides);

  // 카테고리별 평균 계산
  const categoryAverages = {};
  for (const category of config.evaluation_categories) {
    const results = actualResults[category.id] || {};
    const scores = Object.values(results)
      .map(r => r.calculated)
      .filter(v => v !== null && v !== undefined);

    categoryAverages[category.id] = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  }

  // 학생별 예상 총점
  const projectedTotals = {};
  for (const student of activeStudents) {
    let total = 0;
    const breakdown = {};

    for (const category of config.evaluation_categories) {
      const result = actualResults[category.id]?.[student.id];
      // override 확인
      const overrideVal = overrides[category.id]?.[student.id];
      const hasOverride = overrideVal != null;
      const hasValue = result?.calculated !== null && result?.calculated !== undefined;
      const score = hasOverride ? overrideVal : (hasValue ? result.calculated : categoryAverages[category.id]);

      breakdown[category.id] = {
        name: category.name,
        max_score: category.max_score,
        score: Math.round(score * 100) / 100,
        is_projected: !hasOverride && !hasValue,
        is_bonus: category.is_bonus,
      };
      total += score;
    }

    projectedTotals[student.id] = { total: Math.round(total * 100) / 100, breakdown };
  }

  // 순위
  const sorted = Object.entries(projectedTotals).sort(([, a], [, b]) => b.total - a.total);
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][1].total !== sorted[i - 1][1].total) {
      currentRank = i + 1;
    }
    projectedTotals[sorted[i][0]].rank = currentRank;
  }

  return { categoryResults: actualResults, totals: projectedTotals };
}

/**
 * 카테고리 내 학생 순위 계산 (standard competition ranking: 1,1,3)
 * @param {Object} calcResults - { [studentId]: { calculated: number } }
 * @param {Object} [overrides] - { [studentId]: number|null }
 * @returns {Object<string, number|null>} - { [studentId]: rank }
 */
export function computeCategoryRanks(calcResults, overrides = {}) {
  const entries = Object.entries(calcResults)
    .map(([sid, r]) => {
      const overrideVal = overrides[sid];
      const score = overrideVal != null ? overrideVal : (r?.calculated ?? null);
      return [sid, score];
    })
    .filter(([, score]) => score != null)
    .sort(([, a], [, b]) => b - a);

  const ranks = {};
  // null score 학생은 순위 없음
  for (const [sid, r] of Object.entries(calcResults)) {
    const overrideVal = overrides[sid];
    const score = overrideVal != null ? overrideVal : (r?.calculated ?? null);
    if (score == null) {
      ranks[sid] = null;
    }
  }

  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i][1] !== entries[i - 1][1]) {
      currentRank = i + 1;
    }
    ranks[entries[i][0]] = currentRank;
  }
  return ranks;
}
