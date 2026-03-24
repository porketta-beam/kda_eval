---
phase: 1
slug: recursive-tree-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js native test runner (`node:test`, `node:assert`) for unit tests; Playwright 1.58.2 for E2E |
| **Config file** | `playwright.config.js` for E2E; custom loader `tests/register-loader.js` for unit tests |
| **Quick run command** | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` |
| **Full suite command** | `npm run test:unit && npx playwright test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test:unit && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | TREE-01 | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | TREE-05 | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | TREE-06 | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 0 | TREE-07 | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 0 | CONF-01 | unit | `node --import ./tests/register-loader.js tests/scoring-engine.test.js` | ✅ partial | ⬜ pending |
| 01-01-06 | 01 | 0 | D-10 | unit | `node --import ./tests/register-loader.js tests/scoring-engine.test.js` | ✅ partial | ⬜ pending |
| 01-01-07 | 01 | 0 | D-12 | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | ❌ W0 | ⬜ pending |
| 01-01-08 | 01 | 0 | D-13 | unit | `node --import ./tests/register-loader.js tests/scoring-engine.test.js` | ✅ exists | ⬜ pending |
| 01-02-01 | 02 | final | Integration | e2e | `npx playwright test tests/e2e/recursive-tree.spec.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/recursive-tree.test.js` — Unit tests for TREE-01, TREE-05, TREE-06, TREE-07, D-12 (recursive nesting, auto-aggregation, override at depth, hybrid nodes, category-level rank)
- [ ] `tests/e2e/recursive-tree.spec.js` — E2E test for full nested category creation + scoring flow

*Existing infrastructure covers D-10, D-13, CONF-01 (partial).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Weight row appears below column header | D-02 | Visual layout verification | 1. Create parent category with 2 sub-categories 2. Verify weight input row appears below each sub-category column header 3. Enter weight value and verify calculation updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
