/**
 * Phase 3-B: Composite formula 기본값 + 오류 UI 표시 E2E 테스트
 *
 * 검증 항목:
 *   1. formula 없는 composite 카테고리 → eval 페이지에 경고 UI 표시
 *   2. ⚙ 설정 패널에 변수명 힌트 목록 표시
 *   3. 유효한 formula 저장 → 집계 정상 동작 (calculated > 0)
 *   4. composite 카테고리 생성 직후 기본 formula 자동 설정 (있을 경우)
 */

import { test, expect } from '@playwright/test';

let cohortId;
let noFormulaCatId;   // formula 없는 composite
let withFormulaCatId; // formula 있는 composite
let subCat1Id = `sub1-${Date.now()}`;
let subCat2Id = `sub2-${Date.now()}`;
let studentId;

test.beforeAll(async ({ request }) => {
  // 기수 생성
  const cohortRes = await request.post('/api/cohorts', {
    data: { name: 'composite-formula-test' },
  });
  cohortId = (await cohortRes.json()).id;

  // 학생 1명
  const sRes = await request.post(`/api/cohorts/${cohortId}/students`, {
    data: { name: '테스트학생' },
  });
  const sData = await sRes.json();
  studentId = sData.student?.id;

  // formula 없는 composite 카테고리
  const noFormulaRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: { name: '공식없음', scoring_method: 'composite', max_score: 10, is_bonus: false },
  });
  const nf = await noFormulaRes.json();
  noFormulaCatId = nf.category?.id ?? nf.id;

  // sub-categories 추가 (공식없음)
  const cfg1 = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
  const nfCat = cfg1.evaluation_categories.find(c => c.id === noFormulaCatId);
  await request.put(`/api/cohorts/${cohortId}/config/categories/${noFormulaCatId}`, {
    data: {
      ...nfCat,
      config: { final_formula: '' }, // 빈 formula
      sub_categories: [
        {
          id: subCat1Id,
          name: '항목A',
          scoring_method: 'user_input',
          input_scope: 'student',
          max_score: 5, is_bonus: false, order: 1, weight: 1, config: {},
          input_fields: [{ id: 'fa1', name: '점수A', type: 'number', per: 'student' }],
          sub_categories: [],
        },
        {
          id: subCat2Id,
          name: '항목B',
          scoring_method: 'user_input',
          input_scope: 'student',
          max_score: 5, is_bonus: false, order: 2, weight: 1, config: {},
          input_fields: [{ id: 'fb1', name: '점수B', type: 'number', per: 'student' }],
          sub_categories: [],
        },
      ],
    },
  });

  // formula 있는 composite 카테고리
  const withFormulaRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: { name: '공식있음', scoring_method: 'composite', max_score: 10, is_bonus: false },
  });
  const wf = await withFormulaRes.json();
  withFormulaCatId = wf.category?.id ?? wf.id;

  const cfg2 = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
  const wfCat = cfg2.evaluation_categories.find(c => c.id === withFormulaCatId);
  const sub3Id = `sub3-${Date.now()}`;
  await request.put(`/api/cohorts/${cohortId}/config/categories/${withFormulaCatId}`, {
    data: {
      ...wfCat,
      config: { final_formula: '_cat0' },
      sub_categories: [
        {
          id: sub3Id,
          name: '항목C',
          scoring_method: 'user_input',
          input_scope: 'student',
          max_score: 10, is_bonus: false, order: 1, weight: 1, config: {},
          input_fields: [{ id: 'fc1', name: '점수C', type: 'number', per: 'student' }],
          sub_categories: [],
        },
      ],
    },
  });

  // 점수 입력 (항목C에 8점)
  await request.put(`/api/cohorts/${cohortId}/scores/${sub3Id}`, {
    data: { scores: { [studentId]: { fc1: 8 } } },
  });
});

test.afterAll(async ({ request }) => {
  if (cohortId) {
    await request.delete(`/api/cohorts/${cohortId}`);
  }
});

test.describe.serial('Composite Formula', () => {

  test('1. formula 빈 문자열 상태 → eval 페이지 경고 UI 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${noFormulaCatId}`);
    await page.waitForLoadState('networkidle');

    // 경고 요소가 있어야 함
    const warning = page.locator('[data-testid="formula-warning"]');
    await expect(warning).toBeVisible();
  });

  test('2. ⚙ 설정 패널 — 변수명 힌트 목록 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${noFormulaCatId}`);
    await page.waitForLoadState('networkidle');

    // 설정 패널 열기
    await page.getByRole('button', { name: /설정/ }).first().click();

    // 변수명 힌트 표시
    const hints = page.locator('[data-testid="formula-var-hints"]');
    await expect(hints).toBeVisible();

    // _cat0, _cat1 형태의 변수명 포함
    await expect(hints).toContainText('_cat0');
    await expect(hints).toContainText('_cat1');
    // sub-category 이름도 표시
    await expect(hints).toContainText('항목A');
    await expect(hints).toContainText('항목B');
  });

  test('3. formula 저장 → 집계 정상 동작 (calculated > 0)', async ({ page, request }) => {
    // 먼저 sub-category 점수 입력
    await request.put(`/api/cohorts/${cohortId}/scores/${subCat1Id}`, {
      data: { scores: { [studentId]: { fa1: 4 } } },
    });
    await request.put(`/api/cohorts/${cohortId}/scores/${subCat2Id}`, {
      data: { scores: { [studentId]: { fb1: 3 } } },
    });

    await page.goto(`/cohort/${cohortId}/eval/${noFormulaCatId}`);
    await page.waitForLoadState('networkidle');

    // 설정 패널 열기
    await page.getByRole('button', { name: /설정/ }).first().click();

    // formula 입력
    const formulaInput = page.locator('[data-testid="formula-warning"]')
      .locator('..') // 경고 주변
      || page.locator('input[placeholder*="sub"]')
      || page.getByRole('textbox').last();

    // InlineSettings의 formula 입력칸 직접 찾기
    await page.locator('input').filter({ hasText: '' }).last().fill('_cat0 + _cat1');
    await page.getByRole('button', { name: '설정 저장' }).click();
    await page.waitForTimeout(500);

    // 집계 결과 확인
    const scores = await (await request.get(`/api/cohorts/${cohortId}/scores?calculated=true`)).json();
    const catResult = scores.calculated?.[noFormulaCatId]?.[studentId];
    expect(catResult?.calculated).toBeGreaterThan(0);
    expect(catResult?.error).toBeUndefined();
  });

  test('4. formula 있는 composite — 처음부터 집계 정상 동작', async ({ request }) => {
    const scores = await (await request.get(`/api/cohorts/${cohortId}/scores?calculated=true`)).json();
    const catResult = scores.calculated?.[withFormulaCatId]?.[studentId];

    expect(catResult).toBeDefined();
    expect(catResult?.calculated).toBe(8);
    expect(catResult?.error).toBeUndefined();
  });

});
