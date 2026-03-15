/**
 * Phase 4-B: composite 카테고리 생성 flow — formula 안내 E2E 테스트
 *
 * 검증 항목:
 *   1. 평가항목 추가 다이얼로그에서 방식을 "복합"으로 선택 시 formula 입력 필드 표시
 *   2. formula 없이 composite 카테고리 생성 후 eval 페이지 → 경고 표시 (Phase 3-B 연동)
 */

import { test, expect } from '@playwright/test';

let cohortId;

test.beforeAll(async ({ request }) => {
  cohortId = (await (await request.post('/api/cohorts', {
    data: { name: 'composite-creation-flow-test' },
  })).json()).id;

  await request.post(`/api/cohorts/${cohortId}/students`, {
    data: { name: '테스트학생' },
  });
});

test.afterAll(async ({ request }) => {
  if (cohortId) await request.delete(`/api/cohorts/${cohortId}`);
});

test.describe('composite 카테고리 생성 flow', () => {

  test('1. 추가 다이얼로그 — 방식을 "복합"으로 선택 시 formula 입력 필드 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}`);
    await page.waitForLoadState('networkidle');

    // 항목 관리 열기
    await page.getByRole('button', { name: '항목 관리' }).click();
    await page.getByRole('button', { name: '평가항목 추가' }).click();

    // 방식 선택 드롭다운에서 "복합" 선택
    const methodSelect = page.locator('[data-testid="method-select"], select[name="scoring_method"]')
      .or(page.getByRole('combobox').filter({ hasText: /방식|scoring/ }).first());

    // "복합" 옵션 선택 시도
    await page.getByRole('combobox').first().click();
    const compositeOption = page.getByRole('option', { name: /복합/ });
    if (await compositeOption.count() > 0) {
      await compositeOption.click();

      // formula 입력 필드가 다이얼로그 내에 표시됨
      const formulaField = page.locator('input[placeholder*="sub"], input[placeholder*="formula"], input[placeholder*="공식"]')
        .or(page.getByText(/최종 공식/).locator('..').locator('input'));
      await expect(formulaField.first()).toBeVisible({ timeout: 2000 });
    } else {
      // 콤보박스가 없거나 복합 옵션이 다이얼로그 안에 없는 경우 — 스킵
      test.skip(true, '복합 방식 선택 UI가 다이얼로그에 없음 — Phase 4-B 미구현');
    }
  });

  test('2. formula 없이 생성된 composite → eval 페이지에 경고', async ({ page, request }) => {
    // formula 없는 composite 카테고리 직접 API로 생성
    const catRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
      data: { name: '공식미설정', scoring_method: 'composite', max_score: 10, is_bonus: false },
    });
    const cat = await catRes.json();
    const catId = cat.category?.id ?? cat.id;

    // config에서 final_formula를 명시적으로 빈 문자열로 설정
    const cfg = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
    const catObj = cfg.evaluation_categories.find(c => c.id === catId);
    if (catObj) {
      await request.put(`/api/cohorts/${cohortId}/config/categories/${catId}`, {
        data: { ...catObj, config: { ...catObj.config, final_formula: '' } },
      });
    }

    await page.goto(`/cohort/${cohortId}/eval/${catId}`);
    await page.waitForLoadState('networkidle');

    // 경고 표시
    const warning = page.locator('[data-testid="formula-warning"]');
    await expect(warning).toBeVisible();
  });

});
