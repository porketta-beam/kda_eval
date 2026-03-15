/**
 * Phase 4-C: 셀 값 표기 구분 E2E 테스트
 *
 * 검증 항목:
 *   1. 미입력 상태 → ▶ - 표시, data-cell-state="empty"
 *   2. 입력 + 계산 성공 → ▶ 6.0 표시, data-cell-state="ok"
 *   3. formula 오류 있는 composite → ▶ ⚠ 또는 오류 표시, data-cell-state="error"
 */

import { test, expect } from '@playwright/test';

let cohortId;
let leafCatId;      // 일반 leaf 카테고리
let errorCatId;     // formula 오류 composite
let studentId;

test.beforeAll(async ({ request }) => {
  cohortId = (await (await request.post('/api/cohorts', {
    data: { name: 'cell-display-test' },
  })).json()).id;

  const sRes = await request.post(`/api/cohorts/${cohortId}/students`, {
    data: { name: '테스트학생' },
  });
  studentId = (await sRes.json()).student?.id;

  // leaf 카테고리
  const leafRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: { name: '출석률', scoring_method: 'weighted_average', max_score: 10, is_bonus: false },
  });
  leafCatId = (await leafRes.json()).category?.id ?? (await leafRes.json()).id;

  // formula 오류 composite
  const errRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: { name: '오류카테고리', scoring_method: 'composite', max_score: 10, is_bonus: false },
  });
  errorCatId = (await errRes.json()).category?.id ?? (await errRes.json()).id;

  // formula를 빈 문자열로 강제 설정
  const cfg = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
  const errCat = cfg.evaluation_categories.find(c => c.id === errorCatId);
  const sub1Id = `esub-${Date.now()}`;
  await request.put(`/api/cohorts/${cohortId}/config/categories/${errorCatId}`, {
    data: {
      ...errCat,
      config: { final_formula: '' }, // 빈 formula → TEOF 오류
      sub_categories: [
        {
          id: sub1Id,
          name: '서브A',
          scoring_method: 'user_input',
          input_scope: 'student',
          max_score: 10, is_bonus: false, order: 1, weight: 1, config: {},
          input_fields: [{ id: 'ef1', name: '점수', type: 'number', per: 'student' }],
          sub_categories: [],
        },
      ],
    },
  });
  // sub 점수 입력
  await request.put(`/api/cohorts/${cohortId}/scores/${sub1Id}`, {
    data: { scores: { [studentId]: { ef1: 5 } } },
  });
});

test.afterAll(async ({ request }) => {
  if (cohortId) await request.delete(`/api/cohorts/${cohortId}`);
});

test.describe('셀 값 표기 구분', () => {

  test('1. 미입력 상태 — ▶ - 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval`);
    await page.waitForLoadState('networkidle');

    // 출석률 컬럼 셀: 점수 없음 → ▶ -
    const emptyCell = page.locator('table td button').filter({ hasText: '▶ -' }).first();
    await expect(emptyCell).toBeVisible();

    // data-cell-state="empty" 속성
    const emptyAttr = page.locator('[data-cell-state="empty"]').first();
    await expect(emptyAttr).toBeVisible();
  });

  test('2. 점수 입력 후 — ▶ [숫자] 표시, data-cell-state="ok"', async ({ page, request }) => {
    // 점수 입력
    const cfg = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
    const leaf = cfg.evaluation_categories.find(c => c.id === leafCatId);
    const fieldId = leaf?.input_fields?.[0]?.id;

    if (fieldId) {
      await request.put(`/api/cohorts/${cohortId}/scores/${leafCatId}`, {
        data: { scores: { [studentId]: { [fieldId]: 6 } } },
      });
    }

    await page.goto(`/cohort/${cohortId}/eval`);
    await page.waitForLoadState('networkidle');

    // ▶ 6.0 셀
    const filledCell = page.locator('table td button').filter({ hasText: '▶ 6.0' }).first();
    await expect(filledCell).toBeVisible();

    // data-cell-state="ok"
    const okAttr = page.locator('[data-cell-state="ok"]').first();
    await expect(okAttr).toBeVisible();
  });

  test('3. formula 오류 composite — ▶ ⚠ 또는 오류 표시, data-cell-state="error"', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval`);
    await page.waitForLoadState('networkidle');

    // formula 오류가 있는 composite 셀에 오류 표시
    const errorCell = page.locator('[data-cell-state="error"]').first()
      .or(page.locator('table td button').filter({ hasText: /⚠/ }).first());
    await expect(errorCell).toBeVisible();
  });

});
