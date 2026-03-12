/**
 * 합산: SUM(fields) / divisor
 * null → 0 처리
 */
export function calculate(category, rawScores, students) {
  const { divisor = 1 } = category.config;
  const fieldIds = category.input_fields.map(f => f.id);
  const results = {};

  for (const student of students) {
    const studentScores = rawScores[student.id] || {};
    const sum = fieldIds.reduce((acc, fid) => {
      const v = studentScores[fid];
      return acc + (Number(v) || 0);
    }, 0);

    const calculated = sum / divisor;
    results[student.id] = { raw: sum, calculated };
  }

  return results;
}
