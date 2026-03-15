/**
 * Phase 2: EvalNode 재귀 네비게이션 E2E 테스트
 *
 * 전제:
 *   - 서버가 localhost:3000에서 실행 중
 *   - Phase 1 팀 입력 모드 구현 완료
 *
 * 검증 항목:
 *   1. catch-all URL /eval/[...path] 접근 가능
 *   2. Sub-category가 있는 노드: COMPUTED 칼럼으로 표시
 *   3. COMPUTED 칼럼 클릭 → SlidePanel 아닌 URL 이동
 *   4. Breadcrumb 자동 구성 (depth별)
 *   5. Leaf 노드: INPUT 칼럼 + 점수 입력 가능
 *   6. SlidePanel이 DOM에 없음
 */

import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'cohorts');

// ─── 테스트 데이터 셋업 ─────────────────────────────────────────────────────

let cohortId;
let compositeCatId;   // sub_categories를 가진 COMPOSITE 카테고리
let leafCatId;        // input_fields만 가진 leaf 카테고리
let subCatId;         // compositeCat의 하위 카테고리

test.beforeAll(async ({ request }) => {
  // 기수 생성
  const cohortRes = await request.post('/api/cohorts', {
    data: { name: '재귀네비테스트' },
  });
  const cohort = await cohortRes.json();
  cohortId = cohort.id;

  // 학생 추가
  await request.post(`/api/cohorts/${cohortId}/students`, {
    data: { name: '테스트학생1' },
  });

  // Leaf 카테고리 생성 (수업참여도: sub_categories 없음)
  const leafRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: {
      name: '수업참여도',
      scoring_method: 'weighted_average',
      max_score: 20,
      is_bonus: false,
    },
  });
  const leafCat = await leafRes.json();
  leafCatId = leafCat.category?.id ?? leafCat.id;

  // Composite 카테고리 생성
  const compRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: {
      name: '2차 프로젝트',
      scoring_method: 'composite',
      max_score: 20,
      is_bonus: false,
    },
  });
  const compCat = await compRes.json();
  compositeCatId = compCat.category?.id ?? compCat.id;

  // Sub-category 추가 (composite 하위)
  const config = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
  const composite = config.evaluation_categories.find(c => c.id === compositeCatId);
  if (composite) {
    const updatedSubs = [
      {
        id: `sub-${Date.now()}`,
        name: '팀 평가',
        scoring_method: 'user_input',
        input_scope: 'student',
        max_score: 14,
        is_bonus: false,
        config: {},
        input_fields: [{ id: `f-${Date.now()}`, name: '팀점수', type: 'number', per: 'student' }],
        sub_categories: [],
        order: 1,
        weight: 1,
      },
    ];
    subCatId = updatedSubs[0].id;
    await request.put(`/api/cohorts/${cohortId}/config/categories/${compositeCatId}`, {
      data: { ...composite, sub_categories: updatedSubs },
    });
  }
});

test.afterAll(async ({ request }) => {
  if (cohortId) {
    await request.delete(`/api/cohorts/${cohortId}`);
  }
});

// ─── 테스트 시나리오 ─────────────────────────────────────────────────────────

test.describe.serial('EvalNode 재귀 네비게이션', () => {

  test('1. /eval URL 접근 가능 — 전체 카테고리 요약 테이블', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval`);
    await page.waitForLoadState('networkidle');

    // 404나 오류가 아닌 실제 콘텐츠
    await expect(page.locator('table')).toBeVisible();

    // 생성한 카테고리들이 칼럼으로 표시됨
    await expect(page.getByText('수업참여도')).toBeVisible();
    await expect(page.getByText('2차 프로젝트')).toBeVisible();
  });

  test('2. /eval/[catId] — Leaf 카테고리: INPUT 칼럼 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${leafCatId}`);
    await page.waitForLoadState('networkidle');

    // 입력 가능한 테이블이 있어야 함
    await expect(page.locator('table')).toBeVisible();

    // 학생 행이 있어야 함
    await expect(page.getByRole('cell', { name: '테스트학생1' })).toBeVisible();

    // INPUT 타입 칼럼 (number input) 있어야 함
    await expect(page.locator('table input').first()).toBeVisible();
  });

  test('3. /eval/[catId] — Composite: COMPUTED 칼럼으로 sub_categories 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${compositeCatId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('table')).toBeVisible();

    // sub_category 이름이 COMPUTED 칼럼 헤더로 표시됨
    await expect(page.getByText('팀 평가')).toBeVisible();

    // 직접 INPUT 가능한 칼럼은 없어야 함 (composite 자체에 input_fields 없음, override 제외)
    const inputs = page.locator('table input[type="number"]:not([data-override-row])');
    await expect(inputs).toHaveCount(0);
  });

  test('4. COMPUTED 칼럼 클릭 → SlidePanel 아닌 URL 이동', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${compositeCatId}`);
    await page.waitForLoadState('networkidle');

    // SlidePanel이 열려있지 않음 (초기 상태)
    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toHaveCount(0);

    // COMPUTED 칼럼 클릭 (sub_category 헤더)
    const subHeader = page.getByText('팀 평가');
    await subHeader.click();
    await page.waitForTimeout(500);

    // URL이 sub-category 경로로 바뀜
    const url = page.url();
    expect(url).toContain(`/eval/${compositeCatId}`);
    expect(url).toContain(subCatId);

    // SlidePanel이 여전히 없음 (패널이 아닌 페이지 이동)
    await expect(sheet).toHaveCount(0);
  });

  test('5. /eval/[catId]/[subId] — 3레벨 URL 직접 접근', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${compositeCatId}/${subCatId}`);
    await page.waitForLoadState('networkidle');

    // 오류 없이 렌더링됨
    await expect(page.locator('table')).toBeVisible();

    // Sub 카테고리 이름이 페이지 어딘가에 표시됨
    await expect(page.getByText('팀 평가').first()).toBeVisible();
  });

  test('6. Breadcrumb이 현재 depth를 표현함', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${compositeCatId}/${subCatId}`);
    await page.waitForLoadState('networkidle');

    // breadcrumb 요소 존재
    const breadcrumb = page.locator('[data-testid="eval-breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    // 최소 2개 항목: 부모 > 현재
    const items = breadcrumb.locator('li, a, span').filter({ hasText: /\S/ });
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // 현재 페이지 이름(팀 평가)이 breadcrumb에 있음
    await expect(breadcrumb).toContainText('팀 평가');
    await expect(breadcrumb).toContainText('2차 프로젝트');
  });

  test('7. Breadcrumb 클릭 → 부모 레벨로 이동', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${compositeCatId}/${subCatId}`);
    await page.waitForLoadState('networkidle');

    // 부모 breadcrumb 항목(2차 프로젝트) 클릭
    const breadcrumb = page.locator('[data-testid="eval-breadcrumb"]');
    await breadcrumb.getByText('2차 프로젝트').click();
    await page.waitForLoadState('networkidle');

    // URL이 subId 없이 compositeCatId까지
    await expect(page).toHaveURL(new RegExp(`/eval/${compositeCatId}$`));
  });

  test('8. Leaf에서 점수 입력 → 저장 성공', async ({ page, request }) => {
    await page.goto(`/cohort/${cohortId}/eval/${leafCatId}`);
    await page.waitForLoadState('networkidle');

    const firstInput = page.locator('table input[data-row="0"]').first();
    await firstInput.fill('8');

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/scores/') && r.request().method() === 'PUT'),
      firstInput.blur(),
    ]);
    expect(response.status()).toBe(200);
  });

  test('9. 기존 eval/[catId] URL — 리다이렉트 또는 정상 작동', async ({ page }) => {
    // catch-all 라우트로 인해 기존 단일 세그먼트 URL도 동작해야 함
    await page.goto(`/cohort/${cohortId}/eval/${leafCatId}`);
    await expect(page.locator('table')).toBeVisible();
    // 404가 아님을 확인
    await expect(page.locator('body')).not.toContainText('404');
  });
});
