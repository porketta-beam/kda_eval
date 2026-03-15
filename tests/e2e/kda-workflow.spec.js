import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'cohorts');

// 테스트 전 기존 데이터 정리
test.beforeAll(async () => {
  try {
    const dirs = await fs.readdir(DATA_DIR);
    for (const dir of dirs) {
      await fs.rm(path.join(DATA_DIR, dir), { recursive: true, force: true });
    }
  } catch { /* data dir may not exist */ }
});

// 순차 실행 보장
test.describe.serial('KDA 평가 시스템 E2E 워크플로우', () => {

  test('1. 기수 생성 (ID 자동 생성)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('기수 관리')).toBeVisible();

    await page.getByRole('button', { name: '새 기수 만들기' }).click();

    // ID 입력 필드가 없어야 함
    await expect(page.locator('input#new-id')).toHaveCount(0);

    // 이름만 입력
    await page.locator('input#new-name').fill('테스트 2기');
    await page.getByRole('button', { name: '생성' }).click();

    // 다이얼로그가 닫히고 기수 카드가 나타남
    await expect(page.locator('[data-slot="card"]').filter({ hasText: '테스트 2기' })).toBeVisible();

    // 데이터 디렉토리에 UUID 폴더 확인
    const dirs = await fs.readdir(DATA_DIR);
    expect(dirs.length).toBe(1);
    expect(dirs[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('2. 이름 중복 체크', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-slot="card"]').filter({ hasText: '테스트 2기' })).toBeVisible();

    // alert 핸들러를 BEFORE 클릭에 등록
    const dialogPromise = page.waitForEvent('dialog');

    await page.getByRole('button', { name: '새 기수 만들기' }).click();
    await page.locator('input#new-name').fill('테스트 2기');
    await page.getByRole('button', { name: '생성' }).click();

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('같은 이름의 기수가 이미 존재합니다');
    await dialog.accept();

    // 기수가 1개만 유지됨
    const dirs = await fs.readdir(DATA_DIR);
    expect(dirs.length).toBe(1);
  });

  test('3. 학생 관리 탭 이동 + 학생 추가', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-slot="card"]').filter({ hasText: '테스트 2기' }).click();

    // 탭 네비게이션
    await expect(page.getByRole('link', { name: '학생 관리' })).toBeVisible();
    await page.getByRole('link', { name: '학생 관리' }).click();
    await expect(page).toHaveURL(/\/students$/);

    // 단일 학생 추가
    await page.getByPlaceholder('학생 이름').fill('김민수');
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await expect(page.locator('table').getByText('김민수')).toBeVisible();

    // 일괄 추가
    await page.getByRole('button', { name: '일괄 추가' }).first().click();
    await page.locator('textarea').fill('이서연\n박지호\n최유나');
    // "일괄 추가" textarea 아래의 버튼 클릭
    await page.locator('textarea ~ button').first().click();

    // 4명이 표시됨
    await expect(page.getByText('활성 4명')).toBeVisible();
  });

  test('4. 카테고리 추가', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-slot="card"]').filter({ hasText: '테스트 2기' }).click();
    await expect(page.getByRole('link', { name: '평가 항목' })).toBeVisible();

    // 항목 관리 Collapsible 열기
    await page.getByRole('button', { name: '항목 관리' }).click();
    await page.getByRole('button', { name: '평가항목 추가' }).click();
    await page.getByPlaceholder('예: 수업참여도').fill('수업참여도');
    await page.getByRole('button', { name: '추가' }).last().click();

    // 다이얼로그 닫힘 대기
    await page.waitForTimeout(500);
    await expect(page.getByText('수업참여도').first()).toBeVisible();
  });

  test('5. 점수 입력', async ({ page, request }) => {
    // 먼저 기수 ID 확인
    const cohorts = await (await request.get('/api/cohorts')).json();
    const cohortId = cohorts[0].id;

    // 카테고리 확인 (수업참여도가 있어야 함)
    const config = await (await request.get(`/api/cohorts/${cohortId}/config`)).json();
    const category = config.evaluation_categories.find(c => c.name === '수업참여도');
    expect(category).toBeTruthy();
    expect(category.input_fields.length).toBeGreaterThan(0);

    // 대시보드에서 카테고리 클릭하여 점수 입력 페이지로 이동
    await page.goto(`/cohort/${cohortId}`);
    await page.getByText('수업참여도').click();
    await page.waitForURL(/\/eval\//);

    // 점수 입력 테이블이 표시되어야 함
    await expect(page.locator('table').getByText('김민수')).toBeVisible();

    // 각 학생에게 점수 입력 (data-row 속성으로 점수 입력 셀만 타겟)
    const inputs = page.locator('table input[data-row]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // 첫 번째 학생에 8점 입력
    const input0 = page.locator('table input[data-row="0"]').first();
    await input0.fill('8');
    const [resp1] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/scores/')),
      input0.blur(),
    ]);
    expect(resp1.status()).toBe(200);

    // 두 번째 학생에 6점 입력
    const input1 = page.locator('table input[data-row="1"]').first();
    await input1.fill('6');
    const [resp2] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/scores/')),
      input1.blur(),
    ]);
    expect(resp2.status()).toBe(200);

    // API로 점수 저장 확인
    const scores = await (await request.get(`/api/cohorts/${cohortId}/scores`)).json();
    const catScores = scores.raw_scores?.[category.id] || {};
    const scoredCount = Object.keys(catScores).length;
    expect(scoredCount).toBeGreaterThanOrEqual(2);
  });

  test('6. 카테고리 순서 변경', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-slot="card"]').filter({ hasText: '테스트 2기' }).click();

    // 두 번째 카테고리 추가
    await page.getByRole('button', { name: '항목 관리' }).click();
    await page.getByRole('button', { name: '평가항목 추가' }).click();
    await page.getByPlaceholder('예: 수업참여도').fill('출석률');
    await page.getByRole('button', { name: '추가' }).last().click();
    await page.waitForTimeout(500);

    await expect(page.getByText('출석률').first()).toBeVisible();

    // ↑ 버튼으로 순서 변경
    const upButtons = page.locator('button:has-text("↑")');
    if (await upButtons.count() > 0) {
      await upButtons.last().click();
      await page.waitForTimeout(500);
    }
  });

  test('7. 카테고리 삭제', async ({ page }) => {
    await page.goto('/');
    page.on('dialog', dialog => dialog.accept());
    await page.locator('[data-slot="card"]').filter({ hasText: '테스트 2기' }).click();

    // 항목 관리 Collapsible 열기
    await page.getByRole('button', { name: '항목 관리' }).click();
    await expect(page.getByText('수업참여도').first()).toBeVisible();
    await expect(page.getByText('출석률').first()).toBeVisible();

    // × 버튼으로 삭제 (마지막 카테고리)
    const deleteButtons = page.locator('button:has-text("×")');
    await deleteButtons.last().click();
    await page.waitForTimeout(1000);

    // 하나만 남아야 함 (카테고리 1개 삭제됨)
    const categories = await page.locator('button:has-text("×")').count();
    expect(categories).toBeLessThanOrEqual(1);
  });

  test('8. 사이드바 총점/순위 확인', async ({ page, request }) => {
    const cohorts = await (await request.get('/api/cohorts')).json();
    const cohortId = cohorts[0].id;

    await page.goto(`/cohort/${cohortId}`);

    // 사이드바가 보여야 함 (총점 표시 영역)
    await expect(page.getByText('총점').first()).toBeVisible();

    // 학생 이름이 사이드바에 표시되어야 함 (점수가 입력된 학생)
    // 결과 API 확인
    const resultsRes = await request.get(`/api/cohorts/${cohortId}/results`);
    expect(resultsRes.status()).toBe(200);
    const resultsData = await resultsRes.json();
    expect(resultsData.results).toBeTruthy();
    expect(resultsData.results.totals).toBeTruthy();

    // 사이드바에 학생 이름이 나타나는지 확인
    await expect(page.locator('text=김민수').first()).toBeVisible();

    // 예상 모드 토글
    const modeSwitch = page.locator('#mode-toggle');
    if (await modeSwitch.isVisible()) {
      await modeSwitch.click();
      await page.waitForTimeout(500);
      await expect(page.getByText('예상')).toBeVisible();
    }
  });

  test('9. CSV 내보내기 (API 수준)', async ({ request }) => {
    const cohorts = await (await request.get('/api/cohorts')).json();
    expect(cohorts.length).toBeGreaterThan(0);
    const id = cohorts[0].id;

    // 요약 CSV
    const summaryRes = await request.get(`/api/cohorts/${id}/export?type=summary`);
    expect(summaryRes.status()).toBe(200);
    const summaryText = await summaryRes.text();
    expect(summaryText).toContain('순위');

    // 상세 CSV
    const detailRes = await request.get(`/api/cohorts/${id}/export?type=detail`);
    expect(detailRes.status()).toBe(200);
    const detailText = await detailRes.text();
    expect(detailText).toContain('총점');
  });

  test('10. 데이터 영속성 확인', async ({ request }) => {
    const cohorts = await (await request.get('/api/cohorts')).json();
    expect(cohorts.length).toBeGreaterThan(0);

    const id = cohorts[0].id;

    const students = await (await request.get(`/api/cohorts/${id}/students`)).json();
    expect(students.students.length).toBe(4);

    const config = await (await request.get(`/api/cohorts/${id}/config`)).json();
    expect(config.name).toBe('테스트 2기');

    // 파일 직접 확인
    const configFile = JSON.parse(await fs.readFile(path.join(DATA_DIR, id, 'config.json'), 'utf8'));
    expect(configFile.name).toBe('테스트 2기');
  });
});
