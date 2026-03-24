---
phase: 01-recursive-tree-engine
plan: 02
subsystem: ui
tags: [recursive-tree, rank-column, weight-row, field-manager, method-selector, e2e, subcategory-api]

# Dependency graph
requires:
  - phase: 01-01
    provides: V1_SCORING_METHOD, V1_METHOD_LABELS, isDeprecatedMethod, computeCategoryRanks, addSubCategory
provides:
  - Rank column visible for all scoring methods via computeCategoryRanks
  - Weight row shown for v1 methods only (not deprecated)
  - Unified FieldManager with both input fields and sub-categories sections
  - InlineSettings method selector restricted to 3 v1 methods for new categories
  - Read-only Badge with tooltip for deprecated methods on existing categories
  - POST /api/cohorts/[id]/config/categories/[categoryId]/subcategories endpoint
  - CategoryCard uses V1_METHOD_LABELS for updated method display
  - E2E test covering full recursive tree workflow
affects: [phase-2-plans, tree-navigation-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [unified FieldManager pattern, deprecated method badge pattern, always-visible rank column]

key-files:
  created:
    - src/app/api/cohorts/[id]/config/categories/[categoryId]/subcategories/route.js
    - tests/e2e/recursive-tree.spec.js
  modified:
    - src/lib/table-helpers.js
    - src/components/eval/EvalNode.jsx
    - src/components/eval/FieldManager.jsx
    - src/components/eval/InlineSettings.jsx
    - src/components/eval/CategoryCard.jsx
    - package.json

key-decisions:
  - "Rank column uses computeCategoryRanks for all methods instead of per-method rank property"
  - "FieldManager unified into single component with both sections always visible (per D-07)"
  - "Deprecated methods shown as read-only Badge, not hidden, preserving backward visibility"
  - "Sub-category add/delete uses API calls (not local state) for WebSocket-driven refresh"

patterns-established:
  - "Unified FieldManager: always shows both input fields and sub-categories sections regardless of category type"
  - "Deprecated method display: Badge variant=secondary with tooltip explanation"
  - "Sub-category management via API: POST to subcategories endpoint, DELETE via existing category endpoint"

requirements-completed: [TREE-01, TREE-05, TREE-06, TREE-07, CONF-01]

# Metrics
duration: 9min
completed: 2026-03-24
---

# Phase 01 Plan 02: Recursive Tree UI Layer Summary

**Rank column always visible, weight row for v1 methods, unified FieldManager with sub-category API, method selector restricted to 3 v1 options, and 6 passing E2E tests**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-24T08:02:49Z
- **Completed:** 2026-03-24T08:12:24Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Rank column now appears for ALL scoring methods (not just RANK_DIFFERENTIAL) using computeCategoryRanks
- Weight row shows only for v1 methods (weighted_average, sum_divide, user_input), hidden for deprecated methods
- FieldManager unified: always renders both input fields section and sub-categories section simultaneously
- InlineSettings restricts method selector to 3 v1 options for new categories; shows read-only Badge for deprecated
- Sub-category POST API endpoint created and wired to addSubCategory service with WebSocket refresh
- CategoryCard method labels updated to use V1_METHOD_LABELS (e.g., "평균" instead of "가중평균")
- 6 E2E tests pass covering weight row, rank column, sub-category creation, score aggregation, and method restriction

## Task Commits

Each task was committed atomically:

1. **Task 1: Table helpers rank column and sub-category API endpoint** - `995ea0b` (feat)
2. **Task 2: EvalNode weight row, FieldManager unification, InlineSettings method restriction** - `3ed94e2` (feat)
3. **Task 3: E2E test for recursive tree workflow** - `94e9979` (test)

## Files Created/Modified
- `src/lib/table-helpers.js` - Added computeCategoryRanks import, rank column for all methods
- `src/app/api/cohorts/[id]/config/categories/[categoryId]/subcategories/route.js` - New POST endpoint for sub-category creation
- `src/components/eval/EvalNode.jsx` - showWeightRow uses isDeprecatedMethod, passes cohortId to FieldManager
- `src/components/eval/FieldManager.jsx` - Unified with both input fields and sub-categories sections, API-driven sub-category management
- `src/components/eval/InlineSettings.jsx` - V1 method selector for new categories, deprecated Badge for existing
- `src/components/eval/CategoryCard.jsx` - V1_METHOD_LABELS for updated method display labels
- `tests/e2e/recursive-tree.spec.js` - 6 E2E tests for recursive tree workflow
- `package.json` - Added test:e2e:tree script

## Decisions Made
- Rank column uses `computeCategoryRanks()` for all methods instead of reading `rank` from calcResults (only RANK_DIFFERENTIAL had that property). This ensures consistent competition ranking across all methods.
- FieldManager unified into a single component. Both input fields and sub-categories sections are always rendered, even when one or both are empty. This matches D-07 (node can have BOTH input_fields and sub_categories).
- Sub-category management uses fetch API calls to the server (POST/DELETE) instead of local state manipulation, ensuring WebSocket-driven refresh for all connected clients.
- Deprecated methods are shown as read-only Badge (not hidden) so administrators can see what method an existing category uses, with tooltip explaining it cannot be changed back to deprecated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing immer dependency**
- **Found during:** Task 3 (E2E test execution)
- **Issue:** immer was added to package.json by Plan 01 but never installed via npm install. Next.js turbopack resolved workspace root to main repo which lacked immer in node_modules, causing all API routes to return HTML error pages.
- **Fix:** Ran `npm install immer` in main repo to make it available to turbopack's module resolution
- **Files modified:** node_modules (runtime only, not committed)
- **Verification:** API routes return JSON correctly, all E2E tests pass
- **Committed in:** Not committed (runtime dependency installation)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for E2E test execution. No scope creep.

## Issues Encountered
- Next.js turbopack inferred workspace root as main repo directory, not worktree directory. This caused module resolution to look in main repo's node_modules. Resolved by installing immer in main repo.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired and tested.

## Next Phase Readiness
- Phase 1 complete: recursive tree engine with full UI integration
- Weight row, rank column, unified FieldManager, method restriction all functional
- Sub-category API endpoint ready for Phase 2 tree navigation UI
- E2E test suite validates the complete recursive tree workflow
- Phase 2 (Tree Navigation & Manipulation UI) can proceed

## Self-Check: PASSED

All 8 files verified present. All 3 commit hashes confirmed in git log.

---
*Phase: 01-recursive-tree-engine*
*Completed: 2026-03-24*
