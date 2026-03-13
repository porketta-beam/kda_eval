/**
 * 가중평균: SUM(value_i × weight_i) / SUM(weight_i) × multiplier
 * exclude_empty=true → 빈 값 제외 후 가중평균
 * field.weight ?? 1 기본값 → weight 없는 기존 데이터 100% 호환
 */
export function calculate(category, rawScores, students) {
  const { multiplier = 1, exclude_empty = true } = category.config;
  const fields = category.input_fields;
  const results = {};

  for (const student of students) {
    const studentScores = rawScores[student.id] || {};
    let weightedSum = 0;
    let totalWeight = 0;

    for (const field of fields) {
      const v = studentScores[field.id];
      if (exclude_empty && (v === null || v === undefined || v === '')) continue;
      const numVal = Number(v) || 0;
      const w = field.weight ?? 1;
      weightedSum += numVal * w;
      totalWeight += w;
    }

    if (totalWeight === 0) {
      results[student.id] = { raw: null, calculated: 0 };
      continue;
    }

    const avg = weightedSum / totalWeight;
    const calculated = avg * multiplier;
    results[student.id] = { raw: avg, calculated };
  }

  return results;
}
