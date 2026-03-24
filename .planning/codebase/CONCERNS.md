# Codebase Concerns

**Analysis Date:** 2026-03-24

## Overview

The KDA evaluation system is a Next.js application with file-based JSON storage, a custom server for WebSocket support, and a scoring engine with 8 calculation methods. The codebase is functional but carries significant concerns around security, data integrity, scalability, and test coverage. The file-based storage approach and reliance on `global.__io` are the most impactful architectural risks.

## Tech Debt

**Duplicated team-mapping logic across API routes:**
- Issue: The student-to-team mapping logic (iterating `config.teams[].members` to build `studentTeamMap`) is copy-pasted identically in two separate route files.
- Files: `src/app/api/cohorts/[id]/scores/route.js` (lines 21-29), `src/app/api/cohorts/[id]/results/route.js` (lines 23-31)
- Impact: Any change to team membership resolution must be updated in both places. Divergence risk is high.
- Fix approach: Extract a shared helper function `buildStudentTeamMap(config)` into `src/lib/services/student-service.js` or a new `src/lib/utils/team-helpers.js`.

**Custom test runner instead of standard framework:**
- Issue: Tests use a hand-rolled `assert()` / `assertApprox()` test harness with manual `passed`/`failed` counters and `process.exit()`. No test framework (Jest, Vitest, node:test) is used for unit tests.
- Files: `tests/scoring-engine.test.js`, `tests/team-scoring.test.js`
- Impact: No test filtering, no watch mode, no coverage reporting, no snapshot support. Custom loader (`tests/register-loader.js`, `tests/loader.js`) adds maintenance burden. CI integration is fragile.
- Fix approach: Migrate to Vitest (compatible with the ES module setup). Replace custom assertions with `expect()`. Remove custom loader in favor of Vitest's alias resolution.

**Optimistic locking not applied to all config writes:**
- Issue: `handleReorder` in `src/app/cohort/[id]/page.jsx` (line 158) and `handleAggSettingChange` (line 184) send full config via PUT without passing `expectedVersion` in the request body. The `updateConfig` service function receives `expectedVersion` from the route, but the route at `src/app/api/cohorts/[id]/config/route.js` destructures `{ config, expectedVersion }` -- so missing `expectedVersion` means `undefined` is passed to `writeWithLock`, which compares `current.version !== undefined`, always true for existing files, causing consistent ConflictErrors or bypassing locking.
- Files: `src/app/cohort/[id]/page.jsx` (lines 158-169, 184-193), `src/app/api/cohorts/[id]/config/route.js` (line 20), `src/lib/storage/locking.js` (line 31)
- Impact: Concurrent config edits can silently overwrite each other, or fail unpredictably depending on whether `expectedVersion` is `undefined` vs a stale number.
- Fix approach: Always pass `expectedVersion: config.version` in the client-side PUT body. Consider a `useVersionRef` pattern similar to what `EvalNode` uses for scores.

**`alert()` and `confirm()` for user feedback:**
- Issue: Browser-native `alert()` and `confirm()` are used for error messages and deletion confirmations across multiple pages.
- Files: `src/app/page.js` (lines 68, 80, 85), `src/app/cohort/[id]/page.jsx` (line 142), `src/app/cohort/[id]/students/page.jsx` (lines 87, 113, 129), `src/components/eval/FieldManager.jsx` (lines 65, 199)
- Impact: Blocks the main thread, breaks the UX with unstyled OS dialogs, cannot be tested in unit tests, and is not accessible.
- Fix approach: Replace with a reusable confirmation dialog component (the project already has `ConflictDialog` as a pattern). Use toast notifications for errors.

**Stale `FieldManager` and `InlineSettings` local state:**
- Issue: Both `FieldManager` and `InlineSettings` initialize local state from props (`useState(category.input_fields || [])`) but do not re-sync when the parent's `category` prop changes. If another user (via WebSocket) updates the config, these components show stale data until the user closes and reopens the collapsible.
- Files: `src/components/eval/FieldManager.jsx` (line 50, line 182), `src/components/eval/InlineSettings.jsx` (line 29)
- Impact: Silent data loss when a user saves stale state, overwriting a newer server version.
- Fix approach: Add a `useEffect` that resets local state when `category` prop changes (keyed on `category.id` + a version/hash), or use a `key={category.version}` approach on the component.

## Security Considerations

**WebSocket CORS set to wildcard:**
- Risk: `cors: { origin: '*' }` on the Socket.io server allows any origin to connect and emit events, including `join-cohort` to subscribe to any cohort's real-time updates.
- Files: `server.js` (line 23)
- Current mitigation: None. No authentication or authorization on WebSocket connections.
- Recommendations: Restrict CORS origin to the application domain. Add authentication middleware to WebSocket connections. Validate `cohortId` on `join-cohort` events.

**No authentication or authorization on any API route:**
- Risk: All API endpoints (CRUD for cohorts, students, scores, config) are completely open. Anyone with network access can read, modify, or delete all evaluation data.
- Files: All files in `src/app/api/cohorts/`
- Current mitigation: None. The app assumes a trusted network.
- Recommendations: If this remains an internal tool, add at minimum basic auth or an API key middleware. For multi-tenant use, implement proper auth (NextAuth, session-based).

**No input validation on API routes:**
- Risk: API routes accept arbitrary JSON and pass it directly to service functions. The `updateCategory` endpoint at `src/app/api/cohorts/[id]/config/categories/[categoryId]/route.js` applies `Object.assign(found, updates)` with no schema validation, allowing injection of arbitrary properties or overwriting critical fields like `id`.
- Files: `src/app/api/cohorts/[id]/config/categories/[categoryId]/route.js` (line 9), `src/app/api/cohorts/[id]/students/[studentId]/route.js` (line 8), `src/lib/services/config-service.js` (line 47)
- Current mitigation: The `updateCategory` function does re-set `id: categoryId` after `Object.assign`, but other fields (e.g., `scoring_method` set to an invalid value) are not validated.
- Recommendations: Add Zod or similar schema validation at the API route level. Define allowed fields per endpoint.

**`global.__io` pattern for Socket.io access:**
- Risk: Storing the Socket.io instance on `global` is a hack required because Next.js App Router doesn't natively support WebSocket. This creates implicit coupling, makes testing difficult, and could break with Next.js upgrades or serverless deployments.
- Files: `server.js` (line 27), all API routes that use `global.__io?.to(...).emit(...)` (10+ occurrences across `src/app/api/`)
- Current mitigation: Optional chaining (`global.__io?.`) prevents crashes when running without the custom server.
- Recommendations: Abstract WebSocket emission behind a service layer (`src/lib/websocket/emitter.js`) to decouple route handlers from the global state.

**Path traversal risk in cohort IDs:**
- Risk: Cohort IDs are UUIDs (auto-generated), but the file-store functions like `getCohortDir(cohortId)` directly join user-provided IDs into filesystem paths. If a manually crafted request provides `../../etc` as a cohort ID, it could escape the data directory.
- Files: `src/lib/storage/file-store.js` (lines 57-71)
- Current mitigation: The clone and create endpoints auto-generate UUIDs (`v4()`), but the GET/DELETE/PUT endpoints use the `id` directly from the URL params.
- Recommendations: Add path validation in `getCohortDir()` to ensure the resolved path stays within `DATA_DIR`. Use `path.resolve()` and check it starts with the expected prefix.

## Performance Bottlenecks

**Full recalculation on every score save:**
- Problem: Every individual cell edit triggers a PUT to `/scores/[categoryId]`, followed by `refreshCalculation()` which fetches `/scores?calculated=true`. The scores GET endpoint calls `calculateAllCategories()` which recalculates every category for every student, even when only one cell changed.
- Files: `src/components/eval/EvalNode.jsx` (lines 58-69), `src/app/api/cohorts/[id]/scores/route.js` (lines 16-33), `src/lib/scoring-engine/index.js` (`calculateAllCategories`)
- Cause: No caching or incremental calculation. The scoring engine always recomputes from scratch.
- Improvement path: For leaf categories, only recalculate the affected category. Cache results and invalidate selectively. Consider debouncing rapid cell edits on the client.

**File I/O on every request (no caching):**
- Problem: Every API request reads JSON from disk via `fs.readFile`. For concurrent users editing the same cohort, this means repeated disk reads of the same files (config.json, students.json, scores.json).
- Files: `src/lib/storage/file-store.js` (`readJSON`), all service files
- Cause: No in-memory cache. The file-store is a thin wrapper around `fs`.
- Improvement path: Add an in-memory LRU cache with TTL, invalidated on writes. The mutex in `locking.js` already serializes writes, so cache invalidation can be done there.

**O(n * m) rendering for large cohorts:**
- Problem: `DataTable` renders every student row with every column. With 30+ students and 10+ columns, this creates hundreds of input elements. Each re-render (e.g., after sorting) rebuilds all cells.
- Files: `src/components/eval/DataTable.jsx` (496 lines, the largest component)
- Cause: No virtualization, no memoization of individual rows.
- Improvement path: Add `React.memo` on row components. For very large cohorts (50+ students), consider virtual scrolling (e.g., `@tanstack/virtual`).

## Fragile Areas

**Composite formula evaluation with Korean variable names:**
- Files: `src/lib/scoring-engine/methods/composite.js` (lines 22-41)
- Why fragile: The composite method must transform Korean sub-category names into safe ASCII variable names (`_cat0`, `_cat1`) before passing to `expr-eval`. The name-to-variable mapping uses regex replacement on the formula string, which can produce incorrect results if sub-category names are substrings of each other (e.g., "팀" and "팀평가").
- Safe modification: Always use `_catN` notation in formulas. The UI hints in `InlineSettings.jsx` already show this mapping.
- Test coverage: Basic composite test exists (`tests/scoring-engine.test.js` test 8), but no edge cases for name collision or special characters in formulas.

**Score data orphaning on category/student deletion:**
- Files: `src/lib/services/config-service.js` (line 53, comment: "scores 데이터는 보존"), `src/lib/services/student-service.js` (`deleteStudent`)
- Why fragile: When a category or student is deleted, their score data remains in `scores.json` as orphaned entries. Over time, this bloats the scores file. More critically, if a new category is created with the same UUID (extremely unlikely but possible), it could inherit stale scores.
- Safe modification: Add a cleanup pass after deletion to remove orphaned keys from `raw_scores` and `overrides`.
- Test coverage: None. No tests verify cleanup behavior.

**`handleReorder` sends full config without version lock:**
- Files: `src/app/cohort/[id]/page.jsx` (lines 149-170)
- Why fragile: The reorder function spreads the current `config` state and sends the entire object. If the config was fetched 5 minutes ago and another user modified it since, this overwrites their changes entirely. Unlike score saves which use `versionRef`, config operations in the dashboard page have no version tracking.
- Safe modification: Always include `expectedVersion: config.version` and handle 409 responses gracefully.
- Test coverage: None. No E2E tests for concurrent config editing.

## Scaling Limits

**File-based JSON storage:**
- Current capacity: Works well for 1-5 cohorts with up to ~50 students each. JSON files remain under 100KB.
- Limit: With many concurrent editors, the mutex in `locking.js` serializes all writes to a single file, creating a bottleneck. In-memory mutex maps are not shared across Node.js workers or serverless instances, so multi-instance deployments will have data corruption.
- Scaling path: Migrate to SQLite (via better-sqlite3 or Prisma) for local deployments, or PostgreSQL for multi-instance. The service layer abstraction makes this migration relatively clean.

**In-memory mutex per-process only:**
- Current capacity: Correct for a single-process Node.js server.
- Limit: `const fileMutexes = new Map()` in `src/lib/storage/locking.js` exists only in the current process memory. If Next.js spawns multiple workers, or if deployed to serverless, different instances will have separate mutex maps, allowing concurrent writes to the same file.
- Scaling path: Use filesystem-level locking (`proper-lockfile` package) or migrate to a database with transactional writes.

## Test Coverage Gaps

**No unit tests for service layer:**
- What's not tested: `src/lib/services/cohort-service.js`, `src/lib/services/config-service.js`, `src/lib/services/student-service.js`, `src/lib/services/score-service.js`, `src/lib/services/export-service.js`
- Files: All files in `src/lib/services/`
- Risk: CRUD operations, version conflict handling, and data integrity logic are untested. Regressions in these files would go unnoticed until manual testing.
- Priority: High

**No unit tests for file-store or locking:**
- What's not tested: `readJSON`, `writeJSON`, `writeWithLock`, `ConflictError` throwing behavior
- Files: `src/lib/storage/file-store.js`, `src/lib/storage/locking.js`
- Risk: The optimistic locking mechanism is core to multi-user safety. A bug here causes data loss. No tests verify that concurrent writes properly raise `ConflictError`.
- Priority: High

**No API route tests:**
- What's not tested: Request validation, error responses, conflict handling, WebSocket emission
- Files: All 12 route files in `src/app/api/cohorts/`
- Risk: API behavior changes (e.g., incorrect status codes, missing error handling) are only caught by E2E tests, which are slow and brittle.
- Priority: Medium

**No component unit tests:**
- What's not tested: `DataTable`, `EvalNode`, `FieldManager`, `InlineSettings`, `CategoryCard`, `Sidebar`, `SlidePanel`
- Files: All files in `src/components/`
- Risk: UI regressions in the scoring table, navigation, and settings panels. The `DataTable` component (496 lines) handles sorting, clipboard paste, keyboard navigation, and override editing -- all untested at the component level.
- Priority: Medium

**E2E tests exist but lack error-path coverage:**
- What's not tested: Conflict resolution flow, concurrent editing scenarios, invalid input handling, export functionality, scoring engine edge cases through the UI
- Files: `tests/e2e/` (8 spec files cover happy paths only)
- Risk: Error handling regressions in the full stack go undetected.
- Priority: Low

## Dependencies at Risk

**`expr-eval` library for formula parsing:**
- Risk: Last published in 2020. No active maintenance. If a parsing bug is found or a new operator is needed, there is no upstream fix path.
- Impact: The composite scoring method (`src/lib/scoring-engine/methods/composite.js`) depends entirely on this library for user-defined formula evaluation.
- Migration plan: Consider `mathjs` (actively maintained, larger but more feature-complete) or `math-expression-evaluator` as alternatives. The formula syntax is simple enough that migration would be straightforward.

## Missing Critical Features

**No data backup or export of raw data:**
- Problem: The only export is CSV summary/detail reports. There is no way to export or back up the raw JSON data files (config, students, scores) from the UI.
- Blocks: Disaster recovery. If the `data/` directory is deleted, all evaluation data is lost permanently.

**No undo/redo for score edits:**
- Problem: Individual cell edits are immediately persisted. There is no edit history or undo capability.
- Blocks: Users cannot recover from accidental bulk pastes or incorrect data entry without manually re-entering values.

---

*Concerns audit: 2026-03-24*
