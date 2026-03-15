/**
 * Phase 3-C: 기수 생성 후 자동 이동 E2E 테스트
 *
 * 검증 항목:
 *   1. 기수 생성 성공 → 자동으로 해당 기수 대시보드 URL로 이동
 *   2. 기수 생성 오류(중복 이름) → 홈 유지, 이동 없음
 */

import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'cohorts');

test.describe('기수 생성 후 자동 이동', () => {

  test('1. 기수 생성 성공 → /cohort/[id] 로 자동 이동', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('기수 관리')).toBeVisible();

    await page.getByRole('button', { name: '새 기수 만들기' }).click();
    await page.locator('input#new-name').fill('자동이동테스트기수');
    await page.getByRole('button', { name: '생성' }).click();

    // 홈(/)이 아닌 /cohort/[id] 로 이동했어야 함
    await page.waitForURL(/\/cohort\/[0-9a-f-]{36}/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/cohort\/[0-9a-f-]{36}/);

    // 기수 이름이 페이지 어딘가에 표시됨
    await expect(page.getByText('자동이동테스트기수').first()).toBeVisible();

    // 정리
    const dirs = await fs.readdir(DATA_DIR);
    for (const dir of dirs) {
      const cfg = JSON.parse(
        await fs.readFile(path.join(DATA_DIR, dir, 'config.json'), 'utf8')
      );
      if (cfg.name === '자동이동테스트기수') {
        await fs.rm(path.join(DATA_DIR, dir), { recursive: true, force: true });
      }
    }
  });

  test('2. 중복 이름 생성 시도 → 홈 유지, URL 변경 없음', async ({ page, request }) => {
    // 기존 기수 먼저 생성
    await request.post('/api/cohorts', { data: { name: '중복이름테스트' } });

    await page.goto('/');
    const dialogPromise = page.waitForEvent('dialog');

    await page.getByRole('button', { name: '새 기수 만들기' }).click();
    await page.locator('input#new-name').fill('중복이름테스트');
    await page.getByRole('button', { name: '생성' }).click();

    // 오류 다이얼로그 또는 인라인 오류 표시
    try {
      const dialog = await Promise.race([
        dialogPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('no dialog')), 2000)),
      ]);
      expect(dialog.message()).toContain('이미 존재');
      await dialog.accept();
    } catch {
      // 인라인 오류 메시지로 처리됐을 수도 있음
      const errorMsg = page.locator('[role="alert"], .error, [data-error]');
      await expect(errorMsg.first()).toBeVisible({ timeout: 2000 });
    }

    // URL은 홈(/)
    await expect(page).toHaveURL('/');

    // 정리
    const dirs = await fs.readdir(DATA_DIR);
    for (const dir of dirs) {
      try {
        const cfg = JSON.parse(
          await fs.readFile(path.join(DATA_DIR, dir, 'config.json'), 'utf8')
        );
        if (cfg.name === '중복이름테스트') {
          await fs.rm(path.join(DATA_DIR, dir), { recursive: true, force: true });
        }
      } catch { /* skip */ }
    }
  });

});
