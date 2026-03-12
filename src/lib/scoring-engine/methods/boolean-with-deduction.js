/**
 * Boolean + 차감 (출석 가산점 등)
 *
 * Step 1: 기본 조건 판별 (결석=0 AND 지각=0 AND 조퇴=0 AND 외출=0) → base_score
 * Step 2: base_score가 있을 때만 공과 차감 적용
 *   - 각 deduction_rule: FLOOR(count / per_count) × deduction
 */
export function calculate(category, rawScores, students) {
  const { base_score = 2, condition_fields = [], deduction_rules = [] } = category.config;
  const results = {};

  for (const student of students) {
    const scores = rawScores[student.id] || {};

    // Step 1: 조건 체크 - 조건 필드들이 모두 0이어야 base_score 부여
    let meetsCondition = true;
    for (const fieldId of condition_fields) {
      const val = Number(scores[fieldId]) || 0;
      if (val > 0) {
        meetsCondition = false;
        break;
      }
    }

    if (!meetsCondition) {
      results[student.id] = { raw: scores, calculated: 0 };
      continue;
    }

    // Step 2: 공과 차감
    let totalDeduction = 0;
    for (const rule of deduction_rules) {
      const count = Number(scores[rule.field_id]) || 0;
      const deductionTimes = Math.floor(count / rule.per_count);
      totalDeduction += deductionTimes * rule.deduction;
    }

    const calculated = Math.max(0, base_score - totalDeduction);
    results[student.id] = { raw: scores, calculated };
  }

  return results;
}
