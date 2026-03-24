import { SCORING_METHOD, COLUMN_TYPE } from '@/lib/schema';
import { computeCategoryRanks } from '@/lib/scoring-engine/index.js';

/**
 * 카테고리의 input_fields + sub_categories를 DataTable columns으로 변환
 */
export function buildTableColumns(inputFields, subCategories) {
  const cols = [];
  for (const field of inputFields) {
    cols.push({
      id: field.id,
      name: field.name,
      type: COLUMN_TYPE.INPUT,
      fieldType: field.type || 'number',
      min: field.min,
      max: field.max,
      weight: field.weight,
    });
  }
  for (const sub of subCategories) {
    cols.push({
      id: sub.id,
      name: sub.name,
      type: COLUMN_TYPE.COMPUTED,
      maxScore: sub.max_score,
      isBonus: sub.is_bonus,
      clickable: true,
      weight: sub.weight,
    });
  }
  return cols;
}

/**
 * raw_scores + calculated sub_scores를 병합한 cellData 생성
 */
export function buildCellData(rawScores, calcResults, students, subCategories) {
  const d = {};
  for (const student of students) {
    d[student.id] = { ...(rawScores[student.id] || {}) };
    const result = calcResults[student.id];
    if (result?.sub_scores) {
      for (const sub of subCategories) {
        d[student.id][sub.id] = result.sub_scores[sub.id]?.calculated ?? null;
      }
    }
  }
  return d;
}

/**
 * 결과 칼럼 (순위, 점수) 생성
 * @param {Object} category
 * @param {Object} calcResults - { [studentId]: { calculated, rank, ... } }
 * @param {Object} [overrides] - { [studentId]: number|null }
 * @param {boolean} [showMaxInLabel] - 점수 라벨에 만점 표시 여부
 */
export function buildResultColumns(category, calcResults, overrides, showMaxInLabel = false) {
  const cols = [];
  // 순위 칼럼: 모든 메서드에서 표시 (per D-12)
  const categoryRanks = computeCategoryRanks(calcResults, overrides);
  cols.push({
    id: 'rank',
    label: '순위',
    getValue: (sid) => categoryRanks[sid] ?? null,
  });
  const label = showMaxInLabel && category.max_score != null
    ? `점수 (${category.max_score})`
    : '점수';
  cols.push({
    id: 'score',
    label,
    getValue: (sid) => {
      const overrideVal = overrides?.[sid];
      if (overrideVal != null) return overrideVal;
      return calcResults[sid]?.calculated ?? null;
    },
  });
  return cols;
}
