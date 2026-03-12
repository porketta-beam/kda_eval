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
 * 단일 카테고리 계산
 * @param {import('@/lib/schema').EvaluationCategory} category
 * @param {Object} allRawScores - scores.json의 raw_scores 전체
 * @param {import('@/lib/schema').Student[]} students
 * @param {import('@/lib/schema').Team[]} teams
 * @returns {Object<string, {raw: *, calculated: number}>}
 */
export function calculateCategory(category, allRawScores, students, teams = []) {
  const method = METHOD_MAP[category.scoring_method];
  if (!method) {
    throw new Error(`Unknown scoring method: ${category.scoring_method}`);
  }

  // 활성 학생만 계산 (중도퇴소 제외)
  const activeStudents = students.filter(s => !s.is_dropout);

  // composite는 하위 카테고리 접근을 위해 전체 rawScores 필요
  if (category.scoring_method === SCORING_METHOD.COMPOSITE) {
    return method.calculate(category, allRawScores, activeStudents, teams);
  }

  // 일반 방식: 해당 카테고리의 raw scores만 추출
  const categoryScores = allRawScores[category.id] || {};
  return method.calculate(category, categoryScores, activeStudents, teams);
}

/**
 * 전체 카테고리 계산
 * @returns {Object<string, Object<string, {raw: *, calculated: number}>>}
 */
export function calculateAllCategories(config, rawScores, students) {
  const results = {};
  const teams = config.teams || [];

  for (const category of config.evaluation_categories) {
    results[category.id] = calculateCategory(category, rawScores, students, teams);
  }

  return results;
}

/**
 * 총점 + 순위 계산
 * aggregation_settings: { method: 'sum'|'weighted', max_score, bonus_limit }
 */
export function calculateTotals(config, rawScores, students) {
  const categoryResults = calculateAllCategories(config, rawScores, students);
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
      const score = result?.calculated ?? 0;
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
export function calculateProjectedScores(config, rawScores, students) {
  const activeStudents = students.filter(s => !s.is_dropout);

  // 먼저 실제 계산 수행
  const actualResults = calculateAllCategories(config, rawScores, activeStudents);

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
      const hasValue = result?.calculated !== null && result?.calculated !== undefined;
      const score = hasValue ? result.calculated : categoryAverages[category.id];

      breakdown[category.id] = {
        name: category.name,
        max_score: category.max_score,
        score: Math.round(score * 100) / 100,
        is_projected: !hasValue,
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
