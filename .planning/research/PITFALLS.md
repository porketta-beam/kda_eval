# Domain Pitfalls

**Domain:** Recursive tree-based evaluation system refactoring (Notion-style pages + scoring engine simplification)
**Researched:** 2026-03-24
**Codebase:** KDA Eval (Next.js 16 + file-based JSON + Socket.io)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or fundamental architecture breakage.

### Pitfall 1: Flat Scores Storage vs. Nested Config Tree Desynchronization

**What goes wrong:** The config tree (`config.json`) stores categories in a recursive `sub_categories[]` hierarchy, but scores (`scores.json`) use a flat `{ [category_id]: { [student_id]: { [field_id]: value } } }` structure keyed only by category ID. When the tree structure is refactored (nodes moved, reparented, or split), the flat scores data has no concept of hierarchy -- there is nothing in `scores.json` that knows which node is a parent of which. Category IDs in scores can become orphaned or misaligned with the new tree position.

**Why it happens:** The current architecture at `src/lib/scoring-engine/index.js` uses `calculateCategory()` which walks the config tree recursively and pulls scores from the flat map by category ID. This works as long as category IDs never change during tree restructuring. But the moment you allow tree operations like "convert a leaf to a parent" (which requires changing `scoring_method` and potentially splitting `input_fields` into child nodes), the old flat scores keyed by the original category ID become ambiguous -- do they belong to the old leaf version or the new parent version?

**Consequences:**
- Silent score loss: moving a node changes its role but scores stay keyed to old ID with old semantics
- Phantom scores: deleted subtrees leave behind `raw_scores[deleted_category_id]` entries that waste space and could confuse debugging
- Wrong totals: if a category ID gets reused or a structural change breaks the `buildAugmentedScores()` path in the scoring engine

**Prevention:**
1. Treat category IDs as immutable and permanent -- never reuse a deleted category's UUID
2. When converting a leaf to a parent (the "leaf node direct input" feature from requirements), create NEW child category IDs and migrate scores explicitly rather than repurposing the parent ID
3. Add a `scores-cleanup` utility that diffs `config.json` category IDs against `scores.json` keys and reports orphans
4. In the scoring engine, add a guard: if `allRawScores[category.id]` exists but that category is now a pure aggregation parent (no `input_fields`), log a warning rather than silently including stale data

**Detection:**
- After any tree restructure, compare `Object.keys(scores.raw_scores)` against all category IDs reachable from `config.evaluation_categories` recursive walk
- Unit test: create a tree, add scores, restructure tree, verify totals remain correct

**Phase relevance:** Must be solved in the earliest phase that touches tree restructuring. This is foundational -- every subsequent feature (team scoring, method simplification) depends on config-to-scores integrity.

---

### Pitfall 2: The "Leaf Becomes Parent" Transition Breaks Scoring Method Semantics

**What goes wrong:** The requirements say "leaf node direct input -- entering a score directly on a subtotal makes it a leaf node." This implies the inverse: a leaf can also become a parent by adding sub-categories beneath it. When this happens, the `scoring_method` semantics change fundamentally. A `weighted_average` leaf with `input_fields` becomes a parent that aggregates children. The current code at `src/lib/scoring-engine/index.js:116-143` handles this via the "augmented category" path -- it merges `input_fields` and `sub_categories` into one flat set. But this creates a confusing hybrid: a node that has both direct input fields AND computed sub-category results mixed together.

**Why it happens:** The current `buildAugmentedCategory()` function (line 26-39) treats sub-categories as virtual `input_fields`, appending them to the real input fields. This is clever but fragile -- it means a parent node with `scoring_method: weighted_average` computes a weighted average across BOTH user-typed inputs and recursively-calculated sub-results. Whether that is intended behavior depends entirely on the user's mental model, which varies.

**Consequences:**
- User confusion: "I added a sub-category but my scores changed because the weighted average now includes a new virtual field"
- Formula breakage: composite categories use `expr-eval` formulas referencing `_cat0`, `_cat1` etc. (line 24-29 in composite.js). Adding/removing sub-categories shifts indices, breaking existing formulas silently
- Inconsistent semantics: a `weighted_average` parent with 3 input fields + 2 sub-categories averages across 5 items, which may not match user intent

**Prevention:**
1. Enforce a clean separation: a node is EITHER a leaf (has `input_fields`, no `sub_categories`) OR a parent (has `sub_categories`, no `input_fields`). The "leaf becomes parent" transition should move existing `input_fields` into a new child category automatically
2. For the requirements' "direct input on a subtotal" feature, create a special `user_input` child node rather than storing scores directly on the parent
3. If hybrid nodes must exist, make the aggregation strategy explicit in the UI -- show the user exactly what is being averaged together
4. For composite formulas, use category IDs in formulas rather than positional `_catN` variables. The current `_cat0`, `_cat1` approach (composite.js:24-29) is fragile against reordering or insertion

**Detection:**
- Audit: find categories where `input_fields.length > 0 && sub_categories.length > 0` -- these are hybrid nodes that need special attention
- Test: add a sub-category to a leaf, verify parent score calculation still makes sense

**Phase relevance:** Must be designed before implementing the Notion-style recursive tree. The leaf/parent transition model is the single most important architectural decision.

---

### Pitfall 3: Scoring Method Reduction (8 to 4) With Existing Data Migration

**What goes wrong:** The project requires reducing from 8 scoring methods to 4 (weighted_sum, weighted_average, rank_differential, user_input). Existing cohort configurations reference the deprecated methods (`sum_divide`, `formula`, `boolean`, `boolean_with_deduction`, `composite`). If migration is handled poorly, old cohorts break silently -- the scoring engine's `METHOD_MAP` no longer has an entry, throwing "Unknown scoring method" errors at `src/lib/scoring-engine/index.js:96`.

**Why it happens:** Removing methods from `SCORING_METHOD` enum and `METHOD_MAP` is straightforward in code, but file-based JSON storage means old `config.json` files on disk still reference the old method strings. There is no schema migration system -- the app reads raw JSON directly.

**Consequences:**
- Existing cohorts crash on load if they use deprecated methods
- Score recalculation fails silently for affected categories
- If migration is incomplete, some cohorts work and others do not, creating hard-to-debug inconsistency

**Prevention:**
1. Create a migration mapping: `sum_divide` -> `weighted_average` (with `multiplier` = `1/divisor`), `boolean` -> `user_input`, `boolean_with_deduction` -> `user_input`, `formula` -> evaluate case-by-case
2. Add a compatibility layer in the scoring engine: if `METHOD_MAP[method]` is undefined, check a `LEGACY_MAP` for a migration path and auto-convert
3. Implement a one-time migration script that walks all `data/cohorts/*/config.json` files and rewrites deprecated methods
4. Keep `composite` as an internal mechanism -- it is the only way to express parent-with-formula aggregation. Even if removed from the UI, it should remain functional in the engine
5. Version the config schema: add a `schema_version` field to `config.json` so the loader can detect and migrate old formats

**Detection:**
- Before removing any method from `METHOD_MAP`, grep all `data/cohorts/*/config.json` for usage counts
- Add a startup check that loads all configs and validates all `scoring_method` values are in `METHOD_MAP`

**Phase relevance:** Should be its own dedicated phase or substep, AFTER the tree refactoring is stable. Doing method reduction simultaneously with tree restructuring creates too many moving variables.

---

### Pitfall 4: Recursive Rendering Performance Cascade in React

**What goes wrong:** The `EvalNode` component (`src/components/eval/EvalNode.jsx`) renders differently at each tree depth but is a single component handling root, parent, and leaf behaviors. When the tree becomes deeply nested (3+ levels), every score change triggers a WebSocket `data-changed` event -> `useCohortData` re-fetches ALL scores -> React Context update -> every mounted `EvalNode` re-renders, even those viewing unrelated branches. With Notion-style independent pages this could mean multiple open tabs/views each re-fetching and re-rendering.

**Why it happens:** The `CohortDataContext` (`src/hooks/CohortDataContext.js`) provides a single monolithic state object containing `config`, `students`, `scores`, `results`. Any score change updates `scores`, which is a single large object containing ALL categories. React cannot know that only `scores.raw_scores[categoryX]` changed -- it sees the entire `scores` object change and re-renders all consumers.

**Consequences:**
- UI jank when editing scores in a deeply nested tree because the entire context re-renders
- Waterfall re-fetches: `fetchScores` -> new scores -> re-render -> new results (separate fetch in sidebar)
- In Notion-style pages, opening sub-category as an independent page means each page has its own `EvalNode` subscribing to the same context -- multiplied re-renders

**Prevention:**
1. Scope WebSocket events: instead of generic `data-changed { type: 'scores' }`, emit `data-changed { type: 'scores', categoryId: 'xxx' }`. The client then only re-fetches if the changed category is an ancestor/descendant of the currently viewed node
2. Split the monolithic context: separate `ScoresContext` from `ConfigContext`. Score changes should not trigger config consumers to re-render
3. Use `useMemo` aggressively in `EvalNode` to derive only the slice of scores relevant to the current `categoryId`, so downstream `DataTable` only re-renders when its own data changes
4. For Notion-style independent pages, consider per-page data fetching rather than global context -- each page fetches only the sub-tree scores it needs

**Detection:**
- React DevTools Profiler: check re-render counts when editing a single cell in a nested category
- Add `console.count('EvalNode render')` during development to see cascade magnitude

**Phase relevance:** Address in the Notion-style page architecture phase. This is not a problem in the current shallow tree (mostly 1-2 levels) but becomes critical at 3+ levels.

---

### Pitfall 5: Optimistic Locking Granularity Breaks at Scale With Deep Trees

**What goes wrong:** The current locking system (`src/lib/storage/locking.js`) uses a single `version` per file. `scores.json` contains ALL scores for ALL categories in one file. Two users editing different categories in different parts of the tree will conflict (HTTP 409) because both modify the same file and the version increments. With deeper trees and more categories, conflict frequency increases quadratically.

**Why it happens:** The file-based storage design puts all scores in one `scores.json` per cohort. The `writeWithLock()` function checks `expectedVersion === current.version` on the entire file. There is no per-category versioning.

**Consequences:**
- Frequent false conflicts: User A edits "attendance" while User B edits "project score" -- conflict even though they touched different categories
- ConflictDialog fatigue: users learn to just click "Use server version" without thinking, potentially losing their own edits
- With Notion-style independent pages, this is worse: users are visually on separate pages but compete for the same lock

**Prevention:**
1. Split scores storage: instead of one `scores.json`, use `scores/{category_id}.json` per leaf category. Each file has its own version and mutex. This is the ideal solution and aligns with the Notion-style "each page is independent" mental model
2. If splitting storage is too disruptive, implement per-category versioning within `scores.json`: `{ version: N, category_versions: { [catId]: M }, raw_scores: ... }`. The API checks only the relevant `category_versions[catId]`
3. At minimum, make the conflict dialog show WHICH category conflicted so users can make informed decisions
4. Consider optimistic updates on the client: apply the change locally immediately, then reconcile on conflict. The current approach (wait for server response, then re-fetch) adds latency

**Detection:**
- Monitor 409 response frequency in development with 2+ concurrent users editing different categories
- Count unique category IDs per `scores.json` write -- if different users consistently touch different categories, splitting is justified

**Phase relevance:** Should be addressed when implementing the Notion-style independent pages. The split storage design should be part of the page architecture, not retrofitted later.

---

## Moderate Pitfalls

Mistakes that cause significant rework or user confusion but do not corrupt data.

### Pitfall 6: URL Path Encoding for Deeply Nested Tree Navigation

**What goes wrong:** The current catch-all route `src/app/cohort/[id]/eval/[[...path]]/page.jsx` encodes the tree path as URL segments: `/cohort/abc/eval/cat1/cat2/cat3`. As the tree deepens, URLs become long and fragile. If a category ID contains special characters (UUIDs with hyphens are fine, but future non-ASCII category IDs could break), URL encoding fails. More importantly, the `findCategoryByPath()` function (EvalNode.jsx:16-23) performs a linear search at each level -- O(n*d) where n is siblings and d is depth.

**Prevention:**
1. Keep using UUIDs for category IDs (already the case via `uuid` package) -- they are URL-safe
2. Consider a flat lookup map `{ [categoryId]: category }` built once from the tree, rather than path-based traversal. This also enables O(1) navigation to any node
3. Set a maximum nesting depth (e.g., 5 levels) in the UI with a clear warning. There is no reasonable evaluation scenario requiring more than 5 levels
4. Store the full flattened category map in a `useMemo` at the `CohortLayout` level for O(1) access

**Detection:** Test with 4+ level nesting during development. Watch for URL truncation in browsers (some have ~2000 char URL limits).

**Phase relevance:** Tree architecture phase. Build the flat lookup map as part of the Notion-style navigation implementation.

---

### Pitfall 7: Sub-Category Ordering in Composite Formulas Uses Positional Variables

**What goes wrong:** The composite scoring method (`src/lib/scoring-engine/methods/composite.js:24-29`) maps sub-categories to `_cat0`, `_cat1`, `_cat2` etc. based on array position. If sub-categories are reordered (moved up/down in the FieldManager), the formula variables shift: what was `_cat0` (e.g., "Attendance") becomes `_cat1`, breaking the formula. The user has no idea why their formula stopped working.

**Prevention:**
1. Replace positional variables with stable identifiers. Options: use category name (already partially done with `safeVarMap`, but Korean names are mangled), or use a short human-readable slug the user assigns, or use a stable abbreviation like `sub_<last-4-chars-of-uuid>`
2. If keeping positional variables, freeze sub-category order when a formula references them -- warn the user before reorder that it will break the formula
3. Add formula validation: when sub-categories change, parse the formula and check all referenced variables still exist. Show an inline error if not (the UI already has a formula-missing warning at EvalNode.jsx:337-340, extend it)
4. Best approach: let users reference sub-categories by name in formulas and handle the mapping internally. The existing `safeVarMap` already translates names to `_catN` -- reverse the approach: keep names as the user-facing API and map to internal variables

**Detection:** Reorder sub-categories in a composite node that has a formula. Verify the formula result does not change unexpectedly.

**Phase relevance:** Scoring method simplification phase. If composite is retained internally (it should be), fix the variable binding before adding more sub-category manipulation features.

---

### Pitfall 8: Team Score Input Without Team-Aware Tree Propagation

**What goes wrong:** The `input_scope: 'team'` feature (`calculateTeamCategory` in scoring-engine/index.js:60-83) currently distributes team scores to individual students. But in a recursive tree, a parent node might aggregate a mix of `input_scope: 'student'` and `input_scope: 'team'` children. The augmented scores path (`buildAugmentedScores`, line 44-55) assumes student-keyed scores. If a child has `input_scope: 'team'`, its `calculated` results are already student-keyed (after distribution), so this works. But if someone sets `input_scope: 'team'` on a PARENT node that has children, the team-mode path runs before the recursion, skipping sub-category calculation entirely (line 103-105: team check is before the sub_categories check).

**Prevention:**
1. Enforce `input_scope: 'team'` only on leaf nodes -- disallow it on nodes with `sub_categories`
2. If team scope must apply to branches, separate the concerns: calculate sub-categories first (always student-scoped), then apply team-to-student distribution as a final step
3. Add validation in `config-service.js` `updateCategory()`: if a category has `sub_categories.length > 0`, reject `input_scope: 'team'`

**Detection:** Create a parent node with `input_scope: 'team'` and sub-categories. Observe that sub-category scores are not calculated at all.

**Phase relevance:** Team scoring phase. Must define the constraint before building team scoring UI.

---

### Pitfall 9: Config File Size Growth With Deep Recursive Trees

**What goes wrong:** The entire evaluation tree is stored inline in `config.json` as nested `sub_categories[]` arrays. A 4-level tree with 5 categories at each level = 5^4 = 625 category objects, each with `input_fields`, `config`, metadata. At ~200 bytes per minimal category, that is 125KB of JSON just for the tree structure. With `JSON.stringify(data, null, 2)` pretty-printing (file-store.js:26), this doubles. Every config write rewrites the entire file.

**Prevention:**
1. For this app's scale (2-5 admins, likely <50 total categories), this is unlikely to be a real problem. But set a reasonable limit: warn if tree exceeds 100 categories total
2. If splitting config becomes necessary, consider a separate `categories.json` that stores the tree, while `config.json` keeps only cohort metadata
3. More pragmatically: do not pretty-print in production (`JSON.stringify(data)` instead of `JSON.stringify(data, null, 2)`) to halve file sizes

**Detection:** Monitor `config.json` file size. If it exceeds 100KB, investigate.

**Phase relevance:** Low priority. Only relevant if the tree grows unexpectedly large. Monitor rather than preemptively optimize.

---

### Pitfall 10: WebSocket Event Flooding During Bulk Tree Operations

**What goes wrong:** Tree restructuring operations (adding multiple sub-categories, reordering, bulk import) each trigger individual API calls, each emitting a `data-changed` WebSocket event. All connected clients re-fetch after each event. Adding 5 sub-categories = 5 API calls = 5 `data-changed` events = 5 full re-fetches on every other client.

**Prevention:**
1. Batch tree operations: create an API endpoint that accepts multiple category operations in a single request (e.g., `POST /api/cohorts/{id}/config/categories/batch`)
2. Debounce WebSocket event handling on the client: in `useCohortData.js`, debounce the `handleDataChanged` callback by 300ms so rapid-fire events coalesce into one re-fetch
3. Add an event sequence number so clients can detect they are behind by multiple events and do a single catch-up fetch

**Detection:** Open browser DevTools Network tab while adding multiple sub-categories. Count the fetch requests on a second connected client.

**Phase relevance:** Tree manipulation phase. Implement debouncing early; batch API can come later.

---

## Minor Pitfalls

Annoyances that waste time but do not cause structural damage.

### Pitfall 11: Breadcrumb Navigation Edge Cases at Deep Nesting

**What goes wrong:** The breadcrumb in `EvalNode.jsx` (line 142-154) only shows when `path.length >= 2`. At depth 1, a back button is shown instead (line 312-323). The inconsistency becomes confusing at depth 3+: the user sees "root > grandparent > parent > current" but clicking "root" navigates to `/eval` while clicking "grandparent" navigates to `/eval/grandparent_id`. If the grandparent node is deleted while the user views a descendant, navigation breaks silently.

**Prevention:**
1. Always show breadcrumb for any non-root depth (including depth 1)
2. Guard `findCategoryByPath`: if it returns `null` for any path segment, redirect to the eval root rather than showing a blank screen
3. Add a loading/error state for "category not found" when the tree has been modified by another user

**Detection:** Navigate to depth 3, then have another user delete the depth-2 ancestor. Observe behavior.

**Phase relevance:** Notion-style pages phase. Polish during navigation UX implementation.

---

### Pitfall 12: `FieldManager` Local State Diverges From Server State

**What goes wrong:** Both `InlineSettings` (line 29: `useState({ ...category })`) and `FieldManager.LeafManager` (line 51: `useState(category.input_fields || [])`) copy props into local state on mount. If another user modifies the category via WebSocket, the context updates but these components keep stale local state until the user manually refreshes or closes/reopens the collapsible.

**Prevention:**
1. Use a `useEffect` to reset local state when the `category` prop changes (compare by `category.id` + a version/hash)
2. Alternatively, use the `key` prop pattern: `<InlineSettings key={category.id + category.version} category={category} />` to force remount on external changes
3. Show a "settings changed by another user" indicator if local state diverges from props

**Detection:** Open settings panel, have another user change the same category's settings. Observe that the first user's panel is stale.

**Phase relevance:** Existing bug, but becomes more visible with collaborative tree editing. Fix during the tree manipulation phase.

---

### Pitfall 13: `reorderCategories` Only Works at Root Level

**What goes wrong:** The `config-service.js` `reorderCategories()` function (line 65-77) only searches `config.evaluation_categories` (root level). It cannot reorder sub-categories within a parent because it only looks one level deep. The Notion-style tree will need drag-and-drop reordering at every level.

**Prevention:**
1. Generalize `reorderCategories` to accept an optional `parentCategoryId` parameter
2. If `parentCategoryId` is provided, find that parent recursively, then reorder its `sub_categories`
3. Even better: the existing `updateCategory()` with `findCategoryRecursive()` can handle reordering by updating the `order` field on sub-categories, so expose that through a cleaner API

**Detection:** Try to reorder sub-categories via API. It will not work correctly.

**Phase relevance:** Tree manipulation phase. Required for drag-and-drop sub-category management.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Notion-style recursive tree | Pitfall 1 (scores desync), Pitfall 2 (leaf/parent transition) | Design the node lifecycle model FIRST. Define clearly: what happens to scores when a node changes type? |
| Notion-style page navigation | Pitfall 4 (render cascade), Pitfall 6 (URL encoding) | Scope data fetching per page. Build flat category lookup map. |
| Tree manipulation (add/move/delete) | Pitfall 5 (locking granularity), Pitfall 10 (event flooding), Pitfall 13 (reorder depth) | Consider splitting scores storage. Implement event debouncing. Generalize reorder API. |
| Scoring method simplification | Pitfall 3 (migration), Pitfall 7 (formula variables) | Migration script first, test all existing cohorts. Fix composite variable binding. |
| Team scoring | Pitfall 8 (team + tree interaction) | Enforce team scope only on leaf nodes. Validate in config service. |
| Collaborative editing (existing + enhanced) | Pitfall 5 (false conflicts), Pitfall 12 (stale local state) | Per-category locking. Reset local state on prop change. |

## Sources

- [Notion's data model: block-based architecture](https://www.notion.com/blog/data-model-behind-notion) -- Notion's own description of their recursive block architecture and the challenges of recursive data loading
- [Recursive React tree component implementation](https://guild-dev-website.pages.dev/blog/recursive-react-tree-component-implementation-made-easy) -- Practical patterns for recursive React components
- [React.memo documentation](https://react.dev/reference/react/memo) -- Official React docs on preventing unnecessary re-renders in recursive component trees
- [React re-renders guide](https://www.developerway.com/posts/react-re-renders-guide) -- Comprehensive guide on understanding and preventing re-render cascades
- [Nested set model (Wikipedia)](https://en.wikipedia.org/wiki/Nested_set_model) -- Hierarchical data storage patterns and their maintenance overhead
- Codebase analysis: `src/lib/scoring-engine/index.js`, `src/lib/scoring-engine/methods/composite.js`, `src/components/eval/EvalNode.jsx`, `src/lib/services/config-service.js`, `src/lib/services/score-service.js`, `src/lib/storage/file-store.js`, `src/hooks/useCohortData.js`
