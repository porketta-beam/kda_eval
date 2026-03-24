# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

**Unit Tests:**
- Runner: Node.js native test runner (no Jest/Vitest)
- No assertion library -- custom `assert()` and `assertApprox()` functions
- Module resolution: Custom ESM loader at `tests/loader.js` to support `@/` path aliases
- Registration: `tests/register-loader.js` hooks the loader via `node:module` `register()`

**E2E Tests:**
- Runner: Playwright `@playwright/test` ^1.58.2
- Config: `playwright.config.js`
- Browser: Chromium only (`projects: [{ name: 'chromium' }]`)
- Serial execution: `workers: 1`
- Base URL: `http://localhost:3000`
- Timeout: 30s test / 15s expect
- Web server auto-start: `node server.js` on port 3000

**Run Commands:**
```bash
npm run test:scoring       # Unit: scoring engine tests
npm run test:team          # Unit: team scoring tests
npm run test:unit          # All unit tests (scoring + team)
npm run test:e2e           # All E2E tests via Playwright
npm run test:e2e:team      # E2E: team input only
npm run test:e2e:nav       # E2E: recursive navigation only
```

## Test File Organization

**Location:**
- Unit tests: `tests/*.test.js` (separate from source)
- E2E tests: `tests/e2e/*.spec.js`
- Test support: `tests/loader.js`, `tests/register-loader.js`

**Naming:**
- Unit: `{feature}.test.js` -- `scoring-engine.test.js`, `team-scoring.test.js`
- E2E: `{feature}.spec.js` -- `team-input.spec.js`, `cohort-creation.spec.js`, `kda-workflow.spec.js`

**Structure:**
```
tests/
  register-loader.js       # ESM loader registration (entry point)
  loader.js                # Custom resolve hook for @/ aliases
  scoring-engine.test.js   # Scoring engine unit tests
  team-scoring.test.js     # Team scoring unit tests
  e2e/
    cell-display.spec.js           # Cell state display (empty/ok/error)
    cohort-creation.spec.js        # Cohort creation + auto-navigation
    composite-creation-flow.spec.js # Composite category creation UI
    composite-formula.spec.js      # Composite formula validation
    empty-state.spec.js            # Empty state onboarding
    kda-workflow.spec.js           # Full workflow (create -> score -> export)
    recursive-nav.spec.js          # Recursive eval navigation
    team-input.spec.js             # Team input mode (Phase 1)
    team-score-input.spec.js       # Team score input (Phase 3-A)
```

## Unit Test Structure

**Custom Test Runner Pattern:**
The project uses a custom minimal test runner (no framework). Each test file is self-contained:

```javascript
import { SCORING_METHOD, INPUT_FIELD_TYPE, INPUT_SCOPE } from '@/lib/schema.js';
import { calculateCategory } from '@/lib/scoring-engine/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertApprox(actual, expected, message, tolerance = 0.01) {
  assert(Math.abs(actual - expected) < tolerance,
    `${message} (expected ${expected}, got ${actual})`);
}

// Test sections with console.log headers
console.log('\n[1] 출석률 차감법');
// ... test code ...
assertApprox(attResults.s1.calculated, 20, '출석률 91.7% → 20');

// Final summary
console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

**Key patterns:**
- Tests are numbered sections with `console.log('\n[N] Description')`
- Inline test data -- no external fixtures
- `assertApprox()` for floating point with configurable tolerance (default 0.01, team tests use 0.05)
- Exit code 1 on failure for CI compatibility
- Korean variable names for test fixtures: `팀평가`, `학생모드`, `이차프로젝트`

**Running unit tests:**
```bash
node --import ./tests/register-loader.js tests/scoring-engine.test.js
node --import ./tests/register-loader.js tests/team-scoring.test.js
```

## E2E Test Structure

**Suite Organization:**
```javascript
import { test, expect } from '@playwright/test';

let cohortId;
let categoryId;

test.beforeAll(async ({ request }) => {
  // Create test data via API
  const res = await request.post('/api/cohorts', {
    data: { name: '테스트기수' },
  });
  cohortId = (await res.json()).id;

  // Add students, categories, etc. via API
  await request.post(`/api/cohorts/${cohortId}/students`, {
    data: { name: '테스트학생' },
  });
});

test.afterAll(async ({ request }) => {
  // Cleanup: delete test cohort
  if (cohortId) {
    await request.delete(`/api/cohorts/${cohortId}`);
  }
});

test.describe.serial('Feature Name', () => {
  test('1. First scenario', async ({ page }) => {
    await page.goto(`/cohort/${cohortId}/eval`);
    await page.waitForLoadState('networkidle');
    // ... assertions
  });

  test('2. Second scenario', async ({ page, request }) => {
    // Can mix page interactions and API calls
  });
});
```

**Key patterns:**
- `test.describe.serial()` for ordered test execution (tests depend on prior state)
- `test.beforeAll()` sets up data via REST API calls (not UI interactions)
- `test.afterAll()` cleans up test data via `DELETE` API
- Test names numbered: `'1. Description'`, `'2. Description'`
- API data setup uses `request` fixture, UI testing uses `page` fixture
- `waitForLoadState('networkidle')` used before assertions

## Mocking

**No mocking framework.** The codebase has no mocking infrastructure.

**Approach:**
- Unit tests call real scoring engine functions with inline test data
- E2E tests use a real server instance with real filesystem storage
- Test data is created and torn down via API calls

**What is NOT mocked:**
- File system (unit tests run against real scoring engine logic, no I/O)
- API endpoints (E2E tests hit real server)
- WebSocket connections (not tested directly)

## Fixtures and Factories

**Unit Test Data (inline):**
```javascript
// Students are defined inline per test
const students = [
  { id: 's1', name: '학생A', team_id: 'team-1', is_dropout: false },
  { id: 's2', name: '학생B', team_id: 'team-1', is_dropout: false },
];

// Scores are plain objects matching the schema
const rawScores = {
  category_id: {
    's1': { field1: 8, field2: 6 },
    's2': { field1: 9, field2: 9 },
  },
};

// Categories define the scoring method and config
const category = {
  id: 'cat1',
  name: '수업참여도',
  scoring_method: SCORING_METHOD.WEIGHTED_AVERAGE,
  config: { multiplier: 2, exclude_empty: true },
  input_fields: [
    { id: 'f1', name: '과목1', type: INPUT_FIELD_TYPE.NUMBER, per: INPUT_SCOPE.STUDENT },
  ],
};
```

**E2E Test Data (created via API):**
```javascript
// Cohort
const res = await request.post('/api/cohorts', { data: { name: '테스트' } });
cohortId = (await res.json()).id;

// Students
const sRes = await request.post(`/api/cohorts/${cohortId}/students`, {
  data: { name: '테스트학생' },
});
studentId = (await sRes.json()).student?.id;

// Categories
const catRes = await request.post(`/api/cohorts/${cohortId}/config/categories`, {
  data: { name: '출석률', scoring_method: 'weighted_average', max_score: 10, is_bonus: false },
});
```

**Fixture Location:**
- No external fixture files -- all test data is inline
- Shared fixtures within a test file are declared as module-level `let` variables

## Coverage

**Requirements:** No coverage enforcement. No coverage tooling configured.

**Gaps:**
- No coverage reporting tool (no c8, istanbul, nyc)
- Coverage is not tracked or required

## Test Types

**Unit Tests (2 files, ~500 lines total):**
- Scope: Scoring engine calculation logic only
- Files: `tests/scoring-engine.test.js`, `tests/team-scoring.test.js`
- Tests all 8 scoring methods: weighted_average, sum_divide, rank_differential, formula, boolean, boolean_with_deduction, user_input, composite
- Tests team input mode: team score sharing, teamless students, composite with mixed scopes
- Tests regression: student mode unchanged after team features added

**E2E Tests (8 files, ~900 lines total):**
- Scope: Full user workflows through browser
- `kda-workflow.spec.js`: Complete lifecycle (create cohort -> add students -> add categories -> input scores -> reorder -> delete -> export CSV -> data persistence)
- `team-input.spec.js`: Team input mode (team rows, score persistence, calculated sharing)
- `team-score-input.spec.js`: Team score input with real team structure (3 teams, 8 students)
- `recursive-nav.spec.js`: EvalNode recursive navigation (catch-all URL, breadcrumbs, depth traversal)
- `cohort-creation.spec.js`: Cohort creation with auto-redirect
- `composite-formula.spec.js`: Composite formula validation and error UI
- `composite-creation-flow.spec.js`: Composite category creation dialog
- `cell-display.spec.js`: Cell state display (empty/ok/error data attributes)
- `empty-state.spec.js`: Empty state onboarding guidance

**Integration Tests:** Not present as a separate category. E2E tests serve as integration tests.

## Common Patterns

**Async Testing (E2E -- waiting for API responses):**
```javascript
// Wait for specific API response after user action
const [response] = await Promise.all([
  page.waitForResponse(r => r.url().includes('/scores/') && r.request().method() === 'PUT'),
  inputs.first().blur(),
]);
expect(response.status()).toBe(200);
```

**Verifying API State (E2E -- mixed page + API):**
```javascript
// Use Playwright request fixture for direct API verification
const scores = await (await request.get(`/api/cohorts/${cohortId}/scores`)).json();
const catScores = scores.raw_scores?.[categoryId] || {};
expect(Object.keys(catScores).length).toBeGreaterThanOrEqual(2);
```

**Direct File Verification (E2E):**
```javascript
// Some E2E tests verify filesystem directly
import fs from 'fs/promises';
const configFile = JSON.parse(
  await fs.readFile(path.join(DATA_DIR, id, 'config.json'), 'utf8')
);
expect(configFile.name).toBe('테스트 2기');
```

**Browser Dialog Handling (E2E):**
```javascript
// Handle window.alert/confirm dialogs
page.on('dialog', dialog => dialog.accept());

// Or wait for specific dialog
const dialogPromise = page.waitForEvent('dialog');
// ... trigger action ...
const dialog = await dialogPromise;
expect(dialog.message()).toContain('이미 존재');
await dialog.accept();
```

**Approximate Comparison (Unit):**
```javascript
// Custom assertApprox for floating point
function assertApprox(actual, expected, message, tolerance = 0.01) {
  assert(Math.abs(actual - expected) < tolerance,
    `${message} (expected ${expected}, got ${actual})`);
}
assertApprox(result.calculated, 17.6, '학생C: 팀68 + 동료20 → 17.6');
```

**Test Data Cleanup (E2E -- manual file cleanup):**
```javascript
// Some tests clean up by scanning data directory
const dirs = await fs.readdir(DATA_DIR);
for (const dir of dirs) {
  const cfg = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, dir, 'config.json'), 'utf8')
  );
  if (cfg.name === '테스트기수이름') {
    await fs.rm(path.join(DATA_DIR, dir), { recursive: true, force: true });
  }
}
```

## Adding New Tests

**New Unit Test for Scoring Method:**
1. Create inline category config with the scoring method
2. Create student array and raw scores object
3. Call `calculateCategory()` from `@/lib/scoring-engine/index.js`
4. Assert results with `assertApprox()` or `assert()`
5. Run with: `node --import ./tests/register-loader.js tests/your-test.test.js`

**New E2E Test:**
1. Create file in `tests/e2e/` with `.spec.js` extension
2. Use `test.beforeAll()` to set up data via API
3. Use `test.afterAll()` to clean up (delete cohort)
4. Use `test.describe.serial()` for ordered scenarios
5. Use `page.waitForLoadState('networkidle')` after navigation
6. Run with: `npx playwright test tests/e2e/your-test.spec.js`

## Configuration Details

**Playwright Config (`playwright.config.js`):**
```javascript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 15000 },
  workers: 1,                          // Serial execution
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'node server.js',
    port: 3000,
    reuseExistingServer: true,          // Reuse if already running
  },
});
```

**Custom ESM Loader (`tests/loader.js`):**
```javascript
// Resolves @/ imports to src/ for unit tests running outside Next.js
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let resolved = pathResolve(ROOT, 'src', specifier.slice(2));
    if (!resolved.match(/\.\w+$/) && existsSync(resolved + '.js')) {
      resolved += '.js';
    }
    return nextResolve(pathToFileURL(resolved).href, context);
  }
  return nextResolve(specifier, context);
}
```

---

*Testing analysis: 2026-03-24*
