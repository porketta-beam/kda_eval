import { Parser } from 'expr-eval';
import { calculateCategory } from '../index.js';

const parser = new Parser();

/**
 * 복합 방식: 하위 카테고리를 재귀 계산 후 final_formula로 결합
 * eval() 대신 expr-eval 사용
 */
export function calculate(category, rawScores, students, teams = []) {
  const { final_formula } = category.config;
  const subCategories = category.sub_categories || [];
  const results = {};

  // Step 1: 각 하위 카테고리 계산
  const subResults = {};
  for (const sub of subCategories) {
    subResults[sub.id] = calculateCategory(sub, rawScores, students, teams);
  }

  // Step 2: 학생별 final_formula 평가
  for (const student of students) {
    const variables = {};

    for (const sub of subCategories) {
      // 변수명으로 하위 카테고리의 name(공백→_)이나 id 사용
      const varName = sub.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_가-힣]/g, '');
      const subResult = subResults[sub.id]?.[student.id];
      variables[varName] = subResult?.calculated ?? 0;
      // id 기반 변수도 등록 (공식에서 사용할 수 있도록)
      variables[sub.id] = subResult?.calculated ?? 0;
    }

    try {
      const expr = parser.parse(final_formula);
      const calculated = expr.evaluate(variables);
      results[student.id] = {
        raw: variables,
        calculated: Math.round(calculated * 100) / 100, // 소수점 2자리
        sub_scores: {},
      };

      // 하위 점수 기록
      for (const sub of subCategories) {
        results[student.id].sub_scores[sub.id] = subResults[sub.id]?.[student.id] ?? { calculated: 0 };
      }
    } catch (err) {
      results[student.id] = { raw: variables, calculated: 0, error: err.message };
    }
  }

  return results;
}
