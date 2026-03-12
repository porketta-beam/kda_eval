/**
 * 공식 기반 계산
 * 현재 지원: attendance_deduction (출석률 차감법)
 */
export function calculate(category, rawScores, students) {
  const { formula_type, params = {} } = category.config;
  const results = {};

  for (const student of students) {
    const scores = rawScores[student.id] || {};

    switch (formula_type) {
      case 'attendance_deduction':
        results[student.id] = calcAttendanceDeduction(scores, category.input_fields, params);
        break;
      default:
        results[student.id] = { raw: null, calculated: 0 };
    }
  }

  return results;
}

/**
 * 출석률 차감법
 * base=20, threshold=90, cap=10
 * 차감 = MAX(0, threshold - FLOOR(출석률))
 * 차감 > cap → 0점
 * 그 외 → base - 차감
 */
function calcAttendanceDeduction(scores, inputFields, params) {
  const { base = 20, threshold = 90, cap = 10 } = params;
  const fieldId = inputFields[0]?.id;
  const rawValue = scores[fieldId];

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return { raw: null, calculated: null };
  }

  const rate = Number(rawValue);
  const floored = Math.floor(rate);
  const deduction = Math.max(0, threshold - floored);

  let calculated;
  if (deduction > cap) {
    calculated = 0;
  } else if (deduction <= 0) {
    calculated = base;
  } else {
    calculated = base - deduction;
  }

  return { raw: rate, floored, deduction, calculated };
}
