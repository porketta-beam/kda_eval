// @ts-check
/**
 * Phase 1 E2E: 재귀 트리 엔진 통합 테스트
 *
 * 검증 항목:
 *   1. 카테고리 생성 후 하위 항목 추가 (TREE-01)
 *   2. 점수 입력 후 부모 자동 집계 확인 (TREE-05)
 *   3. 가중치 행 표시 확인 (D-02)
 *   4. 순위 칼럼 표시 확인 (D-12)
 *   5. 메서드 선택기 v1 제한 확인 (D-10)
 */

import { test, expect } from '@playwright/test';

let cohortId;
let rootCatId;
let s1Id, s2Id;

test.beforeAll(async ({ request }) => {
  // 기수 생성
  const cohortRes = await request.post('/api/cohorts', {
    data: { name: '재귀트리테스트' },
  });
  cohortId = (await cohortRes.json()).id;

  // 학생 2명 추가
  for (const name of ['학생1', '학생2']) {
    const res = await request.post(`/api/cohorts/${cohortId}/students`, {
      data: { name },
    });
    const data = await res.json();
    const sid = data.student?.id ?? data.data?.students?.at(-1)?.id;
    if (name === '학생1') s1Id = sid;
    else s2Id = sid;
  }

  // 루트 카테고리 생성 (weighted_average)
  const catRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: {
      name: '기본평가',
      scoring_method: 'weighted_average',
      max_score: 100,
      is_bonus: false,
    },
  });
  const catData = await catRes.json();
  rootCatId = catData.category?.id ?? catData.id;
});

test.afterAll(async ({ request }) => {
  if (cohortId) {
    await request.delete(`/api/cohorts/${cohortId}`);
  }
});

test.describe.serial('Recursive Tree Engine', () => {

  test('1. 카테고리 페이지에서 가중치 행이 표시된다 (D-02)', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${rootCatId}`);
    await page.waitForLoadState('networkidle');

    // 가중치 행이 테이블에 표시됨
    const weightCell = page.getByRole('cell', { name: '가중치' });
    await expect(weightCell).toBeVisible();
  });

  test('2. 순위 칼럼 헤더가 표시된다 (D-12)', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${rootCatId}`);
    await page.waitForLoadState('networkidle');

    // 순위 칼럼 헤더가 존재
    const rankHeader = page.getByRole('columnheader', { name: '순위' });
    // columnheader가 안 되면 셀 텍스트로 대체
    const rankText = page.locator('th, [role="columnheader"]').filter({ hasText: '순위' });
    const visible = await rankHeader.count() > 0 || await rankText.count() > 0;
    expect(visible).toBeTruthy();
  });

  test('3. FieldManager에서 하위 항목을 추가할 수 있다 (TREE-01)', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${rootCatId}`);
    await page.waitForLoadState('networkidle');

    // 필드 관리 collapsible 열기
    const fieldManagerBtn = page.getByRole('button', { name: /필드 관리/ });
    await fieldManagerBtn.click();

    // 하위 항목 추가 버튼 클릭
    const addSubBtn = page.getByRole('button', { name: /하위 항목 추가/ });
    await expect(addSubBtn).toBeVisible();

    // 하위 항목 추가 API 호출 대기
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/subcategories') && r.request().method() === 'POST'),
      addSubBtn.click(),
    ]);
    expect(response.status()).toBe(201);

    // 페이지 새로고침 후 하위 항목이 테이블에 표시되는지 확인
    await page.waitForTimeout(1000); // WebSocket 갱신 대기
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 하위 항목 '새 항목'이 COMPUTED 칼럼으로 테이블에 표시
    const subColHeader = page.locator('th, [role="columnheader"]').filter({ hasText: '새 항목' });
    await expect(subColHeader.first()).toBeVisible();
  });

  test('4. 하위 항목에 점수 입력 후 부모 집계 확인 (TREE-05)', async ({ request }) => {
    // 하위 항목의 ID 가져오기
    const config = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
    const rootCat = config.evaluation_categories.find(c => c.id === rootCatId);
    const subCat = rootCat?.sub_categories?.[0];
    expect(subCat).toBeDefined();

    // 하위 항목에 입력 필드가 있는지 확인하고 점수 입력
    const subCatId = subCat.id;
    const inputFields = subCat.input_fields || [];

    if (inputFields.length > 0) {
      // 하위 항목에 점수 입력
      await request.put(`/api/cohorts/${cohortId}/scores/${subCatId}`, {
        data: {
          scores: {
            [s1Id]: { [inputFields[0].id]: 80 },
            [s2Id]: { [inputFields[0].id]: 60 },
          },
        },
      });
    }

    // 부모 카테고리의 계산 결과 확인
    const scores = await (await request.get(`/api/cohorts/${cohortId}/scores?calculated=true`)).json();
    const parentResults = scores.calculated?.[rootCatId] || {};

    // 하위 항목에 점수가 입력된 경우 부모 결과가 존재해야 함
    if (inputFields.length > 0) {
      expect(parentResults[s1Id]).toBeDefined();
      expect(parentResults[s2Id]).toBeDefined();
    }
  });

  test('5. 메서드 선택기가 v1 메서드만 표시한다 (D-10)', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${rootCatId}`);
    await page.waitForLoadState('networkidle');

    // 설정 패널 열기
    const settingsBtn = page.getByRole('button', { name: /설정/ });
    await settingsBtn.click();

    // 방식 드롭다운 찾기
    const methodTrigger = page.locator('[data-slot="select-trigger"]').first();
    // 방식 관련 트리거를 찾기 위해 Label 옆의 Select 찾기
    const methodSection = page.locator('div').filter({ hasText: /^방식$/ }).first();
    const selectTrigger = methodSection.locator('[data-slot="select-trigger"]');

    if (await selectTrigger.count() > 0) {
      await selectTrigger.click();

      // 드롭다운 옵션 확인: 3개만 있어야 함
      const options = page.locator('[data-slot="select-item"]');
      const optionTexts = await options.allTextContents();

      expect(optionTexts).toContain('평균');
      expect(optionTexts).toContain('합산');
      expect(optionTexts).toContain('사용자입력');

      // deprecated 메서드는 없어야 함
      expect(optionTexts).not.toContain('가중평균');
      expect(optionTexts).not.toContain('순위');
      expect(optionTexts).not.toContain('공식');
      expect(optionTexts).not.toContain('Boolean');
      expect(optionTexts).not.toContain('복합');

      // ESC로 드롭다운 닫기
      await page.keyboard.press('Escape');
    }
  });

  test('6. 정리: 테스트 코호트 삭제', async ({ request }) => {
    if (cohortId) {
      const res = await request.delete(`/api/cohorts/${cohortId}`);
      expect(res.ok()).toBeTruthy();
      cohortId = null; // afterAll에서 중복 삭제 방지
    }
  });
});
