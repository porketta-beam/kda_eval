/**
 * Phase 1: 팀 입력 모드 E2E 테스트
 *
 * 전제:
 *   - 서버가 localhost:3000에서 실행 중
 *   - teams 기능이 구현되어 있음 (팀 생성 API)
 *
 * 검증 항목:
 *   1. 팀 입력 카테고리 생성 (input_scope: 'team')
 *   2. Eval 페이지에서 팀 행 테이블 표시
 *   3. 팀 점수 입력 → teamId로 저장
 *   4. 팀원 전체가 동일 calculated 점수를 받음
 *   5. Composite: 팀 sub 점수 + 개인 sub 점수 올바르게 합산
 */

import { test, expect } from '@playwright/test';

let cohortId;
let teamCatId;    // input_scope='team' 카테고리
let team1Id;
let team2Id;
let s1Id, s2Id, s3Id, s4Id;

test.beforeAll(async ({ request }) => {
  // 기수 생성
  const cohortRes = await request.post('/api/cohorts', {
    data: { name: '팀입력테스트' },
  });
  cohortId = (await cohortRes.json()).id;

  // 학생 4명 추가
  const names = ['학생A', '학생B', '학생C', '학생D'];
  const ids = [];
  for (const name of names) {
    const res = await request.post(`/api/cohorts/${cohortId}/students`, {
      data: { name },
    });
    const data = await res.json();
    // 단일 추가 응답: { student, data }
    ids.push(data.student?.id ?? data.data?.students?.at(-1)?.id);
  }
  [s1Id, s2Id, s3Id, s4Id] = ids;

  // 팀 2개 생성 (팀 API가 있다고 가정, 없으면 config PUT으로 처리)
  const config = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
  team1Id = `team-${Date.now()}-1`;
  team2Id = `team-${Date.now()}-2`;

  await request.put(`/api/cohorts/${cohortId}/config`, {
    data: {
      ...config,
      teams: [
        { id: team1Id, name: '1팀-KFC',  members: [s1Id, s2Id] },
        { id: team2Id, name: '2팀-큠',   members: [s3Id, s4Id] },
      ],
    },
  });

  // 팀 입력 카테고리 생성
  const catRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
    data: {
      name: '팀 평가',
      scoring_method: 'weighted_average',
      max_score: 10,
      is_bonus: false,
    },
  });
  const cat = await catRes.json();
  teamCatId = cat.category?.id ?? cat.id;

  // 카테고리에 input_scope: 'team' 설정 + input_fields 추가
  const freshConfig = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
  const teamCat = freshConfig.evaluation_categories.find(c => c.id === teamCatId);

  await request.put(`/api/cohorts/${cohortId}/config/categories/${teamCatId}`, {
    data: {
      ...teamCat,
      input_scope: 'team',
      input_fields: [
        { id: 'f1', name: '항목1', type: 'number', per: 'team', min: 0, max: 10 },
        { id: 'f2', name: '항목2', type: 'number', per: 'team', min: 0, max: 10 },
      ],
    },
  });
});

test.afterAll(async ({ request }) => {
  if (cohortId) {
    await request.delete(`/api/cohorts/${cohortId}`);
  }
});

// ─── 테스트 시나리오 ─────────────────────────────────────────────────────────

test.describe.serial('팀 입력 모드', () => {

  test('1. 팀 입력 카테고리 eval 페이지 — 팀 행 테이블 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);
    await page.waitForLoadState('networkidle');

    // 팀 이름이 행(row)으로 표시됨
    await expect(page.getByRole('cell', { name: '1팀-KFC' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2팀-큠' })).toBeVisible();

    // 개별 학생 이름이 행으로 표시되지 않음 (팀 모드이므로)
    await expect(page.getByRole('cell', { name: '학생A' })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: '학생B' })).toHaveCount(0);
  });

  test('2. 팀 입력 모드 배지/레이블 표시', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);
    await page.waitForLoadState('networkidle');

    // 팀 모드임을 알리는 UI 요소 (data-testid 또는 텍스트)
    const badge = page.locator('[data-testid="input-scope-badge"]');
    const hasBadge = await badge.count() > 0;

    const teamText = page.getByText(/팀별/);
    const hasTeamText = await teamText.count() > 0;

    expect(hasBadge || hasTeamText).toBeTruthy();
  });

  test('3. 팀 점수 입력 → API PUT 성공', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval/${teamCatId}`);
    await page.waitForLoadState('networkidle');

    // 1팀 첫 번째 입력칸에 점수 입력
    const inputs = page.locator('table input[type="number"]');
    await expect(inputs.first()).toBeVisible();

    await inputs.first().fill('8');
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/scores/') && r.request().method() === 'PUT'),
      inputs.first().blur(),
    ]);
    expect(response.status()).toBe(200);
  });

  test('4. 저장된 점수가 teamId 키로 raw_scores에 존재', async ({ request }) => {
    // API로 raw_scores 조회
    const scores = await (await request.get(`/api/cohorts/${cohortId}/scores`)).json();
    const catScores = scores.raw_scores?.[teamCatId] || {};

    // teamId 키로 점수가 저장되어 있어야 함
    const hasTeamKey = Object.keys(catScores).some(
      key => key === team1Id || key === team2Id
    );
    expect(hasTeamKey).toBeTruthy();

    // studentId 키로는 저장되지 않음
    const hasStudentKey = Object.keys(catScores).some(
      key => key === s1Id || key === s2Id
    );
    expect(hasStudentKey).toBeFalsy();
  });

  test('5. 계산 결과: 같은 팀 학생들이 동일한 calculated 점수', async ({ request }) => {
    // 팀 점수 입력 (team-1: 8, team-2: 6)
    await request.put(`/api/cohorts/${cohortId}/scores/${teamCatId}`, {
      data: {
        scores: {
          [team1Id]: { f1: 8, f2: 8 },
          [team2Id]: { f1: 6, f2: 6 },
        },
      },
    });

    // 계산 결과 조회
    const scores = await (await request.get(`/api/cohorts/${cohortId}/scores?calculated=true`)).json();
    const catResults = scores.calculated?.[teamCatId] || {};

    // 1팀 두 학생 동일 점수
    const s1Score = catResults[s1Id]?.calculated;
    const s2Score = catResults[s2Id]?.calculated;
    expect(s1Score).toBeDefined();
    expect(s1Score).toEqual(s2Score);

    // 2팀 두 학생 동일 점수
    const s3Score = catResults[s3Id]?.calculated;
    const s4Score = catResults[s4Id]?.calculated;
    expect(s3Score).toBeDefined();
    expect(s3Score).toEqual(s4Score);

    // 1팀과 2팀은 다른 점수
    expect(s1Score).not.toEqual(s3Score);
  });
});
