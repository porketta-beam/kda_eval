/**
 * Phase 3-A: input_scope:'team' 팀 입력 모드 E2E 테스트
 *
 * 전제:
 *   - 서버가 localhost:3000에서 실행 중
 *   - composite 카테고리 하위에 input_scope:'team' sub-category 존재
 *
 * 검증 항목:
 *   1. 팀 입력 페이지에 팀 행(3개)이 표시됨 — 학생 행(8개) 아님
 *   2. 팀 점수 입력 → teamId 키로 raw_scores에 저장
 *   3. 팀 점수 → 같은 팀 학생 전원 동일 calculated 점수
 *   4. 팀 입력 배지(data-testid="input-scope-badge") 표시
 *   5. 다른 팀은 독립적으로 다른 점수
 */

import { test, expect } from '@playwright/test';

let cohortId;
let teamCatId;   // composite 카테고리
let subTeamCatId; // input_scope:'team' sub-category
let team1Id = 'team-qm';
let team2Id = 'team-pg';
let team3Id = 'team-uk';
let s1Id, s2Id, s3Id, s4Id, s5Id, s6Id, s7Id, s8Id;

test.beforeAll(async ({ request }) => {
  // 기수 생성
  const cohortRes = await request.post('/api/cohorts', {
    data: { name: '팀입력모드테스트' },
  });
  cohortId = (await cohortRes.json()).id;

  // 학생 8명 추가
  const names = ['윤세인', '한현비', '강주연', '오준협', '윤철진', '이다후', '윤시윤', '김주휘'];
  const ids = [];
  for (const name of names) {
    const res = await request.post(`/api/cohorts/${cohortId}/students`, {
      data: { name },
    });
    const data = await res.json();
    ids.push(data.student?.id ?? data.data?.students?.at(-1)?.id);
  }
  [s1Id, s2Id, s3Id, s4Id, s5Id, s6Id, s7Id, s8Id] = ids;

  // 팀 3개 구성
  const config = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
  await request.put(`/api/cohorts/${cohortId}/config`, {
    data: {
      config: {
        ...config,
        teams: [
          { id: team1Id, name: '1팀-큠', members: [s1Id, s2Id, s3Id] },
          { id: team2Id, name: '2팀-펜타곤', members: [s4Id, s5Id, s6Id] },
          { id: team3Id, name: '3팀-업어키움', members: [s7Id, s8Id] },
        ],
      },
      expectedVersion: config.version,
    },
  });

  // composite 카테고리 생성
  const catRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: {
      name: '1차 프로젝트',
      scoring_method: 'composite',
      max_score: 15,
      is_bonus: false,
    },
  });
  const cat = await catRes.json();
  teamCatId = cat.category?.id ?? cat.id;

  // sub-category 추가: input_scope:'team'
  const freshConfig = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
  const composite = freshConfig.evaluation_categories.find(c => c.id === teamCatId);
  subTeamCatId = `sub-team-${Date.now()}`;

  await request.put(`/api/cohorts/${cohortId}/config/categories/${teamCatId}`, {
    data: {
      ...composite,
      config: { ...composite.config, final_formula: '_cat0' },
      sub_categories: [
        {
          id: subTeamCatId,
          name: '팀 평가',
          scoring_method: 'user_input',
          input_scope: 'team',
          max_score: 15,
          is_bonus: false,
          order: 1,
          weight: 1,
          config: {},
          input_fields: [
            { id: 'f-score', name: '점수', type: 'number', per: 'team', min: 0, max: 15 },
          ],
          sub_categories: [],
        },
      ],
    },
  });
});

test.afterAll(async ({ request }) => {
  if (cohortId) {
    await request.delete(`/api/cohorts/${cohortId}`);
  }
});

test.describe.serial('팀 입력 모드', () => {

  test('1. 팀 입력 페이지 — 팀 행 3개 표시 (학생 행 아님)', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}/${subTeamCatId}`);
    await page.waitForLoadState('networkidle');

    // 팀 이름이 행으로 표시됨
    await expect(page.getByRole('cell', { name: '1팀-큠' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2팀-펜타곤' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '3팀-업어키움' })).toBeVisible();

    // 학생 이름은 행으로 표시되지 않음
    await expect(page.getByRole('cell', { name: '윤세인' })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: '한현비' })).toHaveCount(0);

    // 행 수: 가중치 행 1 + 팀 행 3 = 4
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(4); // weight row + 3 team rows
  });

  test('2. 팀 입력 모드 배지 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}/${subTeamCatId}`);
    await page.waitForLoadState('networkidle');

    const badge = page.locator('[data-testid="input-scope-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('팀별');
  });

  test('3. 팀 점수 입력 → teamId 키로 raw_scores에 저장', async ({ page, request }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}/${subTeamCatId}`);
    await page.waitForLoadState('networkidle');

    // 1팀 행의 첫 번째 입력칸
    const inputs = page.locator('table input[type="number"]');
    await expect(inputs.first()).toBeVisible();
    await inputs.first().fill('12');

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/scores/') && r.request().method() === 'PUT'),
      inputs.first().blur(),
    ]);
    expect(response.status()).toBe(200);

    // teamId 키로 저장됐는지 확인
    const scores = await (await request.get(`/api/cohorts/${cohortId}/scores`)).json();
    const catScores = scores.raw_scores?.[subTeamCatId] || {};

    const savedWithTeamId = Object.keys(catScores).some(
      key => key === team1Id || key === team2Id || key === team3Id
    );
    expect(savedWithTeamId).toBeTruthy();

    // studentId 키로는 저장 안됨
    const savedWithStudentId = Object.keys(catScores).some(
      key => key === s1Id || key === s2Id || key === s3Id
    );
    expect(savedWithStudentId).toBeFalsy();
  });

  test('4. 팀 점수 → 같은 팀 학생 전원 동일 calculated 점수', async ({ request }) => {
    // 팀별 점수 직접 설정
    await request.put(`/api/cohorts/${cohortId}/scores/${subTeamCatId}`, {
      data: {
        scores: {
          [team1Id]: { 'f-score': 12 },
          [team2Id]: { 'f-score': 9 },
          [team3Id]: { 'f-score': 6 },
        },
      },
    });

    const result = await (await request.get(`/api/cohorts/${cohortId}/scores?calculated=true`)).json();
    const catResults = result.calculated?.[teamCatId] || {};

    // 1팀: s1, s2, s3 동일 점수
    const s1Score = catResults[s1Id]?.calculated;
    const s2Score = catResults[s2Id]?.calculated;
    const s3Score = catResults[s3Id]?.calculated;
    expect(s1Score).toBeDefined();
    expect(s1Score).toEqual(s2Score);
    expect(s1Score).toEqual(s3Score);

    // 2팀과는 다른 점수
    const s4Score = catResults[s4Id]?.calculated;
    expect(s1Score).not.toEqual(s4Score);
  });

  test('5. 전체 평가 요약 — 팀 점수 기반으로 composite 집계 반영', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval`);
    await page.waitForLoadState('networkidle');

    // 1차 프로젝트 컬럼에 0이 아닌 값이 있어야 함
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // 1팀 학생 중 적어도 한 명의 1차 프로젝트 점수가 0이 아님
    // (전체 평가 컬럼에서 해당 셀이 ▶ 0.0이 아닌 ▶ 12.0 또는 유사값)
    const nonZeroCells = page.locator('table button').filter({ hasText: /▶ [^0]/ });
    await expect(nonZeroCells.first()).toBeVisible();
  });

});
