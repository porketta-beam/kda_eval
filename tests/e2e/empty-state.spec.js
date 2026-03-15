/**
 * Phase 4-A: 빈 상태 온보딩 E2E 테스트
 *
 * 검증 항목:
 *   1. 빈 기수(학생 0, 카테고리 0) eval 접근 → 학생 추가 안내 표시
 *   2. 학생 있고 카테고리 없는 경우 → 항목 추가 안내 표시
 *   3. 학생 + 카테고리 모두 있는 정상 상태 → 온보딩 메시지 없음
 */

import { test, expect } from '@playwright/test';

let cohortIdEmpty;    // 완전 빈 기수
let cohortIdStudents; // 학생만 있는 기수
let cohortIdFull;     // 학생 + 카테고리 모두 있는 기수

test.beforeAll(async ({ request }) => {
  // 1. 완전 빈 기수
  cohortIdEmpty = (await (await request.post('/api/cohorts', {
    data: { name: '빈기수온보딩테스트' },
  })).json()).id;

  // 2. 학생만 있는 기수
  cohortIdStudents = (await (await request.post('/api/cohorts', {
    data: { name: '학생만있는기수온보딩테스트' },
  })).json()).id;
  await request.post(`/api/cohorts/${cohortIdStudents}/students`, {
    data: { name: '테스트학생' },
  });

  // 3. 정상 기수 (학생 + 카테고리)
  cohortIdFull = (await (await request.post('/api/cohorts', {
    data: { name: '정상기수온보딩테스트' },
  })).json()).id;
  await request.post(`/api/cohorts/${cohortIdFull}/students`, {
    data: { name: '테스트학생' },
  });
  await request.post(`/api/cohorts/${cohortIdFull}/config/categories`, {
    data: { name: '테스트항목', scoring_method: 'weighted_average', max_score: 10, is_bonus: false },
  });
});

test.afterAll(async ({ request }) => {
  for (const id of [cohortIdEmpty, cohortIdStudents, cohortIdFull]) {
    if (id) await request.delete(`/api/cohorts/${id}`);
  }
});

test.describe('빈 상태 온보딩', () => {

  test('1. 빈 기수(학생 0, 카테고리 0) — 학생 추가 안내 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortIdEmpty}/eval`);
    await page.waitForLoadState('networkidle');

    // 학생 추가를 유도하는 텍스트
    const guidance = page.getByText(/학생/).filter({ hasText: /추가|먼저|없습니다/ });
    await expect(guidance.first()).toBeVisible();

    // 학생 관리 탭 링크가 존재
    const studentLink = page.getByRole('link', { name: /학생/ });
    await expect(studentLink.first()).toBeVisible();
  });

  test('2. 학생 있고 카테고리 없는 경우 — 항목 추가 안내 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortIdStudents}/eval`);
    await page.waitForLoadState('networkidle');

    // 평가 항목 추가 안내 텍스트
    const guidance = page.getByText(/평가|항목/).filter({ hasText: /추가|없습니다|설정/ });
    await expect(guidance.first()).toBeVisible();
  });

  test('3. 학생 + 카테고리 있는 정상 상태 — 온보딩 없음, 테이블 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortIdFull}/eval`);
    await page.waitForLoadState('networkidle');

    // 테이블이 표시됨
    await expect(page.locator('table')).toBeVisible();

    // 온보딩 안내 요소 없음
    const onboardingText = page.getByText(/학생을 먼저|평가 항목을 추가/).first();
    await expect(onboardingText).toHaveCount(0);
  });

});
