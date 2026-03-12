/**
 * 가중평균: AVERAGE(fields) × multiplier
 * exclude_empty=true → 빈 값 제외 후 평균
 */
export function calculate(category, rawScores, students) {
  const { multiplier = 1, exclude_empty = true } = category.config;
  const fieldIds = category.input_fields.map(f => f.id);
  const results = {};

  for (const student of students) {
    const studentScores = rawScores[student.id] || {};
    const values = fieldIds
      .map(fid => studentScores[fid])
      .filter(v => {
        if (exclude_empty) return v !== null && v !== undefined && v !== '';
        return true;
      })
      .map(v => Number(v) || 0);

    if (values.length === 0) {
      results[student.id] = { raw: null, calculated: 0 };
      continue;
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const calculated = avg * multiplier;
    results[student.id] = { raw: avg, calculated };
  }

  return results;
}
