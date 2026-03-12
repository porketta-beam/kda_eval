/**
 * Boolean: truthy → true_score, falsy → false_score
 */
export function calculate(category, rawScores, students) {
  const { true_score = 1, false_score = 0 } = category.config;
  const fieldId = category.input_fields[0]?.id;
  const results = {};

  for (const student of students) {
    const scores = rawScores[student.id] || {};
    const value = scores[fieldId];
    const isTruthy = value === true || value === 1 || value === '1' || value === 'true';

    results[student.id] = {
      raw: value ?? null,
      calculated: isTruthy ? true_score : false_score,
    };
  }

  return results;
}
