/**
 * 합산: SUM(value_i × weight_i) / divisor
 * field.weight ?? 1 기본값 → weight 없는 기존 데이터 100% 호환
 */
export function calculate(category, rawScores, students) {
  const { divisor = 1 } = category.config;
  const fields = category.input_fields;
  const results = {};

  for (const student of students) {
    const studentScores = rawScores[student.id] || {};
    let sum = 0;

    for (const field of fields) {
      const v = studentScores[field.id];
      const w = field.weight ?? 1;
      sum += (Number(v) || 0) * w;
    }

    const calculated = sum / divisor;
    results[student.id] = { raw: sum, calculated };
  }

  return results;
}
