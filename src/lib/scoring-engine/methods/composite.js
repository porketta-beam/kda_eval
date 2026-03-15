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

  // Step 1.5: 한글 등 비ASCII 변수명을 expr-eval이 지원하는 안전한 이름으로 대체
  // expr-eval은 ASCII 식별자만 지원하므로, 각 sub를 _cat0, _cat1, ... 로 치환
  const safeVarMap = {}; // rawName → safeVar
  for (let i = 0; i < subCategories.length; i++) {
    const sub = subCategories[i];
    const rawName = sub.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_가-힣]/g, '');
    const safeVar = `_cat${i}`;
    safeVarMap[rawName] = safeVar;
  }

  // 수식에서 rawName → safeVar 치환 (한글은 직접, ASCII는 단어 경계 사용)
  // formula 없으면 모든 sub-category 합산으로 fallback
  let safeFormula = final_formula?.trim()
    || (subCategories.length > 0 ? subCategories.map((_, i) => `_cat${i}`).join(' + ') : '0');
  for (const [rawName, safeVar] of Object.entries(safeVarMap)) {
    const isAscii = /^[a-zA-Z0-9_]+$/.test(rawName);
    const pattern = isAscii
      ? new RegExp(`\\b${rawName}\\b`, 'g')
      : new RegExp(rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    safeFormula = safeFormula.replace(pattern, safeVar);
  }

  // Step 2: 학생별 final_formula 평가
  for (const student of students) {
    const variables = {};

    for (let i = 0; i < subCategories.length; i++) {
      const sub = subCategories[i];
      const safeVar = `_cat${i}`;
      const subResult = subResults[sub.id]?.[student.id];
      variables[safeVar] = subResult?.calculated ?? 0;
    }

    try {
      const expr = parser.parse(safeFormula);
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
