# Project Research Summary

**Project:** KDA Eval — Recursive Evaluation Tree Extension
**Domain:** Notion-style recursive grading tree with bottom-up score aggregation and team scoring
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

KDA Eval is a brownfield extension to an existing Next.js 16 + React 19 + Socket.io grading tool used by 2-5 admin users. The milestone extends the system from a shallow, flat category structure into a full Notion-style recursive evaluation tree, where any node can become a parent by adding children, every node opens as an independent page via a catch-all URL route, and a tree sidebar gives users instant visibility into the full category hierarchy. The core finding: the infrastructure already exists. The catch-all route, recursive scoring engine, flat scores storage, `sub_categories` schema support, and breadcrumb navigation are all in place. The work is principally about unlocking those capabilities in the UI and removing artificial constraints (only `COMPOSITE` nodes can currently have children).

The recommended approach builds in four sequential phases. First, remove the COMPOSITE-only restriction and generalize config-service tree mutation operations so any category can have children. Second, build the `TreeNav` sidebar and `NodeActions` component to expose this in the UI. Third, consolidate scoring methods from 8 down to 4+1 with a backward-compatible migration. Fourth, complete team management UI and the team score input workflow. Only one new library is needed: `immer` for safe immutable updates to deeply nested tree structures. All other requirements are met by existing primitives already in the stack.

The three key risks are: (1) data integrity during tree restructuring — flat scores can desync from the config tree if category IDs are mishandled during the leaf-to-parent transition; (2) the leaf-to-parent transition model — a node holding both `input_fields` and `sub_categories` creates ambiguous aggregation semantics that confuse users and break composite formulas; (3) scoring method migration — removing deprecated methods from `METHOD_MAP` while old `config.json` files still reference them will silently break existing cohorts. All three are preventable with deliberate design decisions made before writing code.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16.1.6, React 19.2.3, Radix UI 1.4.3, shadcn/ui 4.0.5, Tailwind CSS 4, Socket.io 4.8.3, expr-eval 2.0.2) handles all requirements without additions. The only new dependency is `immer@^11.1.4`. All evaluated tree component libraries were rejected as overkill for a 2-50 node tree that already has custom recursive navigation. No state management library, caching layer, or additional UI framework is needed.

**Core technologies:**
- `immer@^11.1.4`: safe immutable nested tree mutations — the only required new dependency (6KB gzipped, zero deps)
- Radix UI `Collapsible`: expand/collapse for the new `TreeNav` sidebar — already in project, zero additional cost
- `@dnd-kit/core@^6.3.1` + `@dnd-kit/sortable@^10.0.0`: drag-drop reordering — conditional, install only if up/down arrow buttons prove insufficient (defer)

**Hard constraints (do not change):**
- JavaScript ESM only — no TypeScript migration
- File-based JSON storage — no database
- 2-5 admin users only — no auth, no RBAC, no mobile layout

**Rejected libraries:**
- react-arborist, react-complex-tree, @headless-tree/react — all overkill for <50 node trees; styling conflicts with Radix/Tailwind
- redux, zustand, jotai — React Context + `useCohortData` hook is sufficient for 2-5 users
- react-query, SWR — direct `fetch()` + Socket.io push handles cache invalidation cleanly at this scale

### Expected Features

**Must have (table stakes):**
- Tree sidebar showing full category hierarchy with expand/collapse — without it, nested categories are invisible; users must drill page-by-page to discover structure
- Sub-category CRUD (add/delete/reorder) from any node page, not just root dashboard
- Each node opens as independent page via existing `[[...path]]` catch-all route — needs polish, not a rewrite
- Breadcrumb navigation at arbitrary depth — minor UX refinement only
- Scoring method consolidation: reduce UI from 8 to 4+1, keeping engine code for backward compat
- Team management UI: create teams, assign students (engine already supports team scoring, UI is missing)
- Team score input workflow: smooth path from team management to team-scoped category to score entry

**Should have (differentiators):**
- Score completion indicators on tree sidebar nodes (filled/empty state per category)
- Collapse/expand tree state persisted to `localStorage` per cohort
- Category weight percentage badges in sidebar or breadcrumb
- Inline sub-category creation (type name, press Enter — no dialog)
- Bulk team assignment UI (multi-select or paste)

**Defer to next milestone:**
- Drag-and-drop tree reordering — high complexity; up/down arrows work for MVP
- Drag-and-drop reparenting — very high complexity; "Move to..." dialog covers the need
- Score change history / audit log — requires storage schema changes
- Category templates / presets — cohort cloning covers 80% of the need
- Tree-wide category search/filter — only useful for very large trees (>100 categories)

**Anti-features (explicitly do not build):**
- Block-based content editor (Notion blocks) — categories are data containers, not rich-text pages
- Student-facing features — admin-only tool per PROJECT.md
- Per-student weighting within teams — all team members get identical score by design
- Real-time CRDT — optimistic locking handles 2-5 user concurrency

### Architecture Approach

The architecture is a layered Next.js monolith with no structural changes needed. The key change is behavioral: any category becomes a parent when children are added, and becomes a leaf when all children are removed. This unlocks full Notion-style tree behavior using infrastructure that already exists. The `TreeNav` component (new) provides the sidebar tree outline. The `NodeActions` component (new) provides add/delete/reorder from each node page. The `FieldManager` should merge `LeafManager` and `CompositeManager` into a unified component. All tree structure lives in `config.json` (single atomic file). Scores remain flat in `scores.json` keyed by category ID — this decoupling is what enables reparenting without score data migration.

**Major components:**
1. `TreeNav` (new) — sidebar with recursive category tree, expand/collapse, click-to-navigate, inline CRUD actions
2. `NodeActions` (new) — action bar on each eval page: add child, delete, move up/down
3. `EvalNode` (extended) — remove COMPOSITE-only restriction; render leaf or parent based on `sub_categories.length`
4. `FieldManager` (unified) — merge LeafManager + CompositeManager; manage both `input_fields` and `sub_categories` on any node
5. Config Service (extended) — new `POST /children` endpoint; generalize `reorderCategories` to arbitrary depth
6. Scoring Engine (unchanged) — existing `calculateCategory()` and augmented-category pattern already handle arbitrary depth

**New API routes required:**
- `POST /api/cohorts/[id]/config/categories/[categoryId]/children` — add child to any category
- `PUT /api/cohorts/[id]/config/categories/[categoryId]/order` — reorder siblings at any depth
- `PUT /api/cohorts/[id]/config/categories/[categoryId]/parent` — reparent node

**Patterns to maintain:**
- Flat score storage keyed by category ID — decouples scores from tree position; reparenting needs no score migration
- Single config.json per cohort with mutex atomic writes — no per-node files
- Server-side score aggregation only — no client-side parent score calculation

### Critical Pitfalls

1. **Flat scores desync on tree restructuring** — When the config tree is restructured, `scores.json` entries keyed by old category IDs become orphaned or ambiguous. Prevention: treat category IDs as immutable UUIDs never to be reused; add a `scores-cleanup` utility that diffs config IDs against score keys after any structural change; when converting a leaf to a parent, create new child category IDs and migrate scores explicitly.

2. **Leaf-to-parent transition breaks scoring semantics** — A node with both `input_fields` and `sub_categories` creates a hybrid where the scoring method averages across both user-typed inputs and computed sub-results. This confuses users and the `_catN` positional variables in composite formulas shift silently when sub-categories are inserted. Prevention: enforce clean separation — a node is EITHER a leaf OR a parent. When a user adds a child to a leaf, auto-migrate existing `input_fields` to a new sibling child node.

3. **Scoring method migration breaks existing cohorts** — Removing deprecated methods from `METHOD_MAP` while old `config.json` files still reference them causes crashes at `scoring-engine/index.js:96`. Prevention: add a `LEGACY_MAP` compatibility layer; write a migration script that walks all `data/cohorts/*/config.json` files; test all cohorts before removing any method from the UI.

4. **React context re-render cascade** — Every WebSocket `data-changed` event causes `CohortDataContext` to re-fetch all scores and re-render all consumers. At 3+ tree levels with multiple tabs open, this causes visible UI jank. Prevention: scope WebSocket events to include `categoryId`; split `ScoresContext` from `ConfigContext`; use `useMemo` to isolate per-category score slices in `EvalNode`.

5. **Composite formula positional variable binding** — `composite.js` maps sub-categories to `_cat0`, `_cat1`, etc. by array index. Reordering sub-categories silently breaks formulas. Prevention: replace positional binding with stable identifiers (stable UUID suffix or category name via `safeVarMap`); add formula validation that alerts when referenced variables no longer exist after a reorder.

## Implications for Roadmap

The dependency order is firm. Phase 1 (config layer unlock) is a prerequisite for everything else. Phases 2 and 3 can be partially parallelized but Phase 3 must complete before Phase 4 to avoid building team UI on a method set that is about to change.

### Phase 1: Unlock Recursive Tree (Config Layer)
**Rationale:** All other phases depend on the ability to add children to any category. This is a constraint removal in existing code — low risk, high leverage.
**Delivers:** Any category can have children; config service handles add/delete/reorder at arbitrary depth; immer integrated for safe tree mutations; node lifecycle model defined (leaf vs parent separation rule).
**Addresses:** Sub-category CRUD at any depth (table stakes from FEATURES.md)
**Avoids:** Pitfall 2 (leaf/parent transition) — design the node lifecycle model here before any UI is built on top of it
**Research flag:** Standard patterns. Existing `findCategoryRecursive` and `removeCategoryRecursive` provide the template. No research phase needed.

### Phase 2: Tree Navigation UI
**Rationale:** Once any node can have children, users need to see and navigate the full tree. Without the `TreeNav` sidebar, nested categories remain invisible.
**Delivers:** `TreeNav` sidebar with expand/collapse and click navigation; `NodeActions` for add/delete/reorder from any node page; breadcrumb working at arbitrary depth; collapse state persisted to localStorage.
**Implements:** `TreeNav` and `NodeActions` architecture components
**Avoids:** Pitfall 4 (render cascade) — scope data fetching per page, use `categoryId` in WebSocket events; Pitfall 6 (URL path traversal) — build flat category lookup `useMemo` for O(1) node access
**Research flag:** Standard patterns. Radix `Collapsible` + recursive React is well-documented. No research phase needed.

### Phase 3: Scoring Method Consolidation
**Rationale:** Reduce UI complexity from 8 methods to 4+1 before team scoring UI is built on top. Method migration must be tested against all existing cohort configs before any method is removed from the selector.
**Delivers:** Method dropdown shows 4+1 options only; deprecated methods hidden from UI but still calculated for backward compat; migration script tested against all existing cohorts; composite formula variable binding fixed.
**Avoids:** Pitfall 3 (migration breaks cohorts); Pitfall 7 (composite positional variables) — fix stable variable binding in composite.js in this phase
**Research flag:** No research phase needed. Pre-migration cohort data audit (grep all `config.json` files for deprecated method usage) is the key prerequisite step.

### Phase 4: Team Scoring Completion
**Rationale:** Engine and schema already support team scoring; what is missing is the management UI and end-to-end workflow. Requires Phase 3 to be complete so team categories use the simplified method set.
**Delivers:** Team management UI (create teams, assign students); team-scoped score entry workflow; team score propagation verified end-to-end.
**Addresses:** "Team management UI" and "Team score input UI completion" from FEATURES.md critical path
**Avoids:** Pitfall 8 (team scope on parent nodes) — enforce `input_scope: 'team'` only on leaf nodes in config-service validation before building the UI
**Research flag:** Standard patterns. Engine already implements team scoring. UI follows existing DataTable and dialog patterns. No research phase needed.

### Phase 5: Polish and Differentiators
**Rationale:** Low-risk improvements that require all prior phases to be stable.
**Delivers:** Score completion indicators on tree sidebar; conditional score warnings; `useEffect` reset fix for stale `FieldManager` and `InlineSettings` local state; WebSocket event debouncing; scores-cleanup utility.
**Avoids:** Pitfall 5 (false locking conflicts, measured at this point); Pitfall 10 (WebSocket event flooding); Pitfall 12 (stale local state)
**Research flag:** All standard patterns. No research phase needed.

### Phase Ordering Rationale

- Phase 1 must come first: it is the only phase with no upstream dependencies and it removes the constraint that blocks all subsequent work.
- Phase 2 depends on Phase 1: you cannot navigate a tree that does not allow arbitrary nesting.
- Phase 3 can overlap with Phase 2 in a team setting but is safer run sequentially after Phase 1 is stable. Method migration has independent risk that should not compound with UI development.
- Phase 4 after Phase 3 is non-negotiable: team categories need clean method semantics.
- Phase 5 is polish that requires the complete system to be operational first.

### Research Flags

Phases with standard patterns (no research phase needed):
- **Phase 1:** Config service tree mutations follow existing `findCategoryRecursive` patterns. Immer documentation is authoritative and stable.
- **Phase 2:** Radix `Collapsible` + recursive React is extremely well-documented. `[[...path]]` catch-all routing already implemented.
- **Phase 3:** Method migration is a known pattern. The only prerequisite is auditing existing cohort files for deprecated method usage.
- **Phase 4:** Socket.io + DataTable team-mode patterns are established in the codebase.
- **Phase 5:** All localStorage, UX polish, and debouncing patterns are standard.

No phases require a `/gsd:research-phase` invocation. The codebase analysis provided sufficient domain knowledge for all planned work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Codebase is locked. Only one new library (immer) needed. All alternatives evaluated and rejected with clear rationale. Versions verified via npm. |
| Features | HIGH | Requirements well-defined in PROJECT.md. Feature landscape mapped against existing codebase capabilities and compared with Canvas, Blackboard, Moodle, and Notion patterns. |
| Architecture | HIGH | All key patterns exist in codebase already. Changes are constraint removal and extensions, not rewrites. Recommendations based on direct codebase analysis with specific file and line references. |
| Pitfalls | HIGH | 13 pitfalls identified from direct codebase inspection of specific functions and line numbers. Not theoretical — each pitfall references exact code paths where the issue manifests. |

**Overall confidence:** HIGH

### Gaps to Address

- **Leaf-to-parent transition UX**: The technical mechanism is clear (auto-migrate `input_fields` to a new child node when children are added), but the exact UX flow (confirm dialog? automatic? undoable?) needs a product decision before Phase 1 implementation begins.
- **Composite formula variable binding migration**: Fixing `_catN` positional variables to use stable IDs may require migrating existing composite formulas in production cohort configs. Scope is unknown until existing configs are audited in Phase 3.
- **Scores storage split**: Pitfall 5 identifies that single-file `scores.json` causes false locking conflicts. Whether to split into per-category files is an architectural decision to defer until Phase 2 is complete and real conflict frequency can be measured.
- **Existing cohort deprecated method usage**: Before Phase 3, must audit all `data/cohorts/*/config.json` files to count which deprecated scoring methods are actually in use. This determines migration effort.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/schema.js`, `src/lib/scoring-engine/index.js`, `src/lib/scoring-engine/methods/composite.js`, `src/components/eval/EvalNode.jsx`, `src/components/eval/DataTable.jsx`, `src/lib/services/config-service.js`, `src/lib/storage/file-store.js`, `src/hooks/useCohortData.js`
- `.planning/codebase/ARCHITECTURE.md` — existing architecture documentation
- Next.js App Router catch-all routes — verified via existing `[[...path]]` implementation

### Secondary (MEDIUM confidence)
- [Notion data model blog post](https://www.notion.com/blog/data-model-behind-notion) — recursive block architecture reference
- [Canvas Gradebook Essentials](https://www.teachingcollege.fse.manchester.ac.uk/canvas-essentials-gradebook/) — assignment groups and weighted grading comparison
- [Moodle Grade Overrides](https://techsupport.lambdasolutions.net/hc/en-us/articles/21415272092564-What-are-Grade-Overrides-in-the-Moodle-Gradebook) — override vs calculated score patterns
- [Carnegie Mellon Group Work Grading Methods](https://www.cmu.edu/teaching/assessment/assesslearning/groupWorkGradingMethods.html) — team scoring approaches
- [immer npm](https://www.npmjs.com/package/immer) — v11.1.4 confirmed current
- [React re-renders guide](https://www.developerway.com/posts/react-re-renders-guide) — re-render cascade patterns
- [Notion Navigation Redesign UX Case Study](https://davisdesigninteractive.medium.com/notion-navigation-redesign-a-ux-case-study-e547179faf86) — hierarchy navigation challenges

### Tertiary (LOW confidence — future reference only)
- [dnd-kit-sortable-tree](https://github.com/Shaddix/dnd-kit-sortable-tree) — deferred until drag-drop is needed
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) — v6.3.1 stable, conditional install only
- [State Management in 2026](https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge) — evaluated and rejected

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
