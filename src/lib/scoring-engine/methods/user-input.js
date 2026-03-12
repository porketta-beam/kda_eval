/**
 * 사용자 직접 입력: 입력값 그대로 반환
 */
export function calculate(category, rawScores, students) {
  const fieldId = category.input_fields[0]?.id;
  const results = {};

  for (const student of students) {
    const scores = rawScores[student.id] || {};
    const value = scores[fieldId];
    const numValue = value !== null && value !== undefined && value !== '' ? Number(value) : null;

    results[student.id] = {
      raw: numValue,
      calculated: numValue ?? 0,
    };
  }

  return results;
}
