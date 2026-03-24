# Architecture Patterns

**Domain:** Notion-style recursive evaluation tree with score aggregation
**Researched:** 2026-03-24
**Confidence:** HIGH (based on thorough codebase analysis; architecture extends existing patterns)

## Current Architecture (Baseline)

The existing system is a layered Next.js 16 monolith:

```
Browser (React Client Components)
  |
  | fetch() + WebSocket
  v
API Routes (Next.js App Router)
  |
  v
Service Layer (business logic + locking)
  |
  v
File Store (JSON on disk: data/cohorts/{id}/)
```

**Key existing recursive infrastructure:**
- `EvaluationCategory.sub_categories[]` already supports nesting in the schema
- `EvalNode` component already resolves a `path[]` array via `findCategoryByPath()`
- Catch-all route `[[...path]]` already maps URL segments to tree depth
- Scoring engine already recurses through `sub_categories` via `calculateCategory()`
- `config-service.js` already has `findCategoryRecursive()` and `removeCategoryRecursive()`

**What is missing for full Notion-style behavior:**
1. Sub-categories can only be added to `COMPOSITE` method categories (via `CompositeManager`)
2. No "add child" action from within a category page for non-composite categories
3. No ability for any category to become a parent by simply adding children
4. No drag-and-drop or tree reordering at arbitrary depths
5. No explicit "leaf node direct input" mode where entering a score at a parent makes it a leaf

## Recommended Architecture

### Design Principle: Any Node Can Be Parent or Leaf

The core architectural change is removing the constraint that only `COMPOSITE` categories can have children. Instead, **any category becomes a parent when children are added, and becomes a leaf when all children are removed or when the user directly enters a score**.

This aligns with the Notion mental model: every page can have sub-pages; the presence of sub-pages is what makes it a "parent."

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **EvalNode** (existing, extended) | Renders a single tree node as a full page; shows children as navigable links + computed scores, or shows input fields if leaf | CohortDataContext, API Routes, Router |
| **TreeNav** (new) | Sidebar/breadcrumb tree navigator showing the full eval tree with expand/collapse; provides "add child" / "delete" / "reorder" actions at any depth | CohortDataContext, Router |
| **NodeActions** (new) | Inline action bar on each node page: "Add sub-item", "Delete this item", "Move up/down", "Change to leaf/parent" | API Routes via config-service |
| **InlineSettings** (existing, extended) | Category configuration (scoring method, max_score, etc.) | Parent EvalNode via onSave callback |
| **FieldManager** (existing, unified) | Merge current LeafManager + CompositeManager into one: manages both input_fields AND sub_categories on any node | Parent EvalNode via onSave callback |
| **Scoring Engine** (existing, extended) | Recursive score calculation; handle new "auto-leaf" detection | Called by API routes, pure computation |
| **Config Service** (existing, extended) | Tree mutation operations: add child at path, move node, reparent node | Called by API routes |

### Data Flow

#### Tree Navigation Flow (New)

```
1. User lands on /cohort/{id}/eval
   -> EvalNode renders root: shows top-level categories as clickable computed columns
   -> TreeNav sidebar shows full tree outline

2. User clicks a category (e.g., "1st Project")
   -> Router navigates to /cohort/{id}/eval/{catId}
   -> EvalNode renders that node:
      - If node has sub_categories: show them as computed columns (clickable)
      - If node has input_fields only: show DataTable with editable inputs
      - If node has BOTH: show both (input columns + computed sub-category columns)

3. User clicks "Add sub-item" on a leaf node
   -> API: PUT /api/cohorts/{id}/config/categories/{catId}
      with new sub_categories entry appended
   -> Node transitions from leaf -> parent
   -> Existing input_fields become sibling-level items OR remain as direct inputs
      (user's choice via UI)

4. User enters score directly on a parent node (leaf-override)
   -> Saves to overrides[categoryId][studentId]
   -> Parent shows this override instead of computed aggregation
   -> Visual indicator shows "manual override active"
```

#### Score Aggregation Flow (Extended)

```
calculateCategory(node, allRawScores, students, teams):
  1. If node has sub_categories:
     a. Recursively calculate each sub_category
     b. Merge sub-results as virtual input_fields (existing "augmented" pattern)
     c. Apply node's own scoring_method to combined fields
     d. Return { calculated, sub_scores }
  2. If node is leaf (no sub_categories):
     a. Get raw_scores[node.id] for each student
     b. Apply scoring_method directly
     c. Return { raw, calculated }
  3. Override check (at API level, NOT in engine):
     a. If overrides[node.id][studentId] exists, use that instead
```

This flow is **already implemented** in the scoring engine. The `calculateCategory()` function handles both leaf and parent cases via the `subCategories.length > 0` branch. No changes needed to the core calculation logic.

#### Tree Mutation Flow (New Operations Needed)

```
Add child to any node:
  1. Client: POST /api/cohorts/{id}/config/categories/{parentId}/children
  2. Service: findCategoryRecursive(parentId) -> push to sub_categories[]
  3. If parent was leaf with scoring_method != COMPOSITE:
     - Auto-set scoring_method to COMPOSITE (or keep and use augmented path)
     - Decision: KEEP existing method. The augmented path already handles
       mixing input_fields + sub_categories for ANY scoring method.
  4. Emit WebSocket data-changed

Move node (reorder within siblings):
  1. Client: PUT /api/cohorts/{id}/config/categories/{catId}/order
  2. Service: find parent's sub_categories[], reorder
  3. Emit WebSocket data-changed

Delete node (already exists):
  - removeCategoryRecursive already handles arbitrary depth

Reparent node (drag between parents):
  1. Client: PUT /api/cohorts/{id}/config/categories/{catId}/parent
     body: { newParentId, insertIndex }
  2. Service: remove from old parent, insert into new parent's sub_categories[]
  3. Emit WebSocket data-changed
```

### Data Model Changes

**No schema changes required.** The existing `EvaluationCategory` typedef already supports:
- `sub_categories: EvaluationCategory[]` - recursive nesting
- `input_fields: InputField[]` - leaf data
- `scoring_method` - calculation strategy
- `weight` - for parent aggregation

The only gap is that the UI artificially restricts sub-category management to `COMPOSITE` method. Removing this UI constraint is sufficient.

**File storage: no structural changes.** All tree data lives in `config.json` as nested `evaluation_categories`. Scores remain flat in `scores.json` keyed by `category.id` regardless of tree depth. This flat score storage is actually ideal for recursive trees -- it avoids deeply nested score data.

### Scoring Method Simplification

The project requires reducing from 8 methods to 4 core methods:

| Keep | Current | New Role |
|------|---------|----------|
| `weighted_average` | `weighted_average` | Parent aggregation + leaf calculation (multiply, average) |
| `weighted_average` | Absorbs `sum_divide` | Same pattern: sum then divide. Use multiplier=1, post-divide via formula or config |
| `rank_differential` | `rank_differential` | Rank-based differential scoring |
| `user_input` | `user_input` | Direct manual entry (leaf-only) |
| `composite` | `composite` | Formula-based combination of sub-categories |

Methods to deprecate: `sum_divide` (merge into weighted_average), `formula` (merge into composite), `boolean` (convert to user_input with 0/1), `boolean_with_deduction` (convert to formula in composite).

**Migration strategy:** Add a `deprecated: true` flag to old methods. Keep calculation code but hide from UI. Existing configs continue to work.

## Patterns to Follow

### Pattern 1: Recursive Catch-All Routing (Already Exists)

**What:** Use Next.js `[[...path]]` catch-all route to map URL depth to tree depth.
**When:** Always -- this IS the Notion-style navigation model.
**Why it works:** URL `/cohort/abc/eval/cat1/cat2/cat3` maps to path `['cat1', 'cat2', 'cat3']`, which `findCategoryByPath()` resolves to the exact node.

```
src/app/cohort/[id]/eval/[[...path]]/page.jsx  <-- existing, no change needed
```

### Pattern 2: Flat Score Storage with Tree Config

**What:** Tree structure lives in `config.json` (nested categories). Scores live in `scores.json` as flat `{ [categoryId]: { [studentId]: { [fieldId]: value } } }`.
**When:** Always -- this separation is critical.
**Why:** Avoids O(n*depth) nested writes. Any category's scores can be read/written in O(1) by ID, regardless of tree depth. Tree restructuring (move, reparent) does not require score data migration.

### Pattern 3: Augmented Category Calculation (Already Exists)

**What:** When a non-composite category has sub_categories, the scoring engine creates "virtual input fields" from sub-results, merges with real input_fields, then calculates using the node's own scoring method.
**When:** Any parent node that is not `COMPOSITE` method.
**Why:** Allows ANY scoring method to work as a parent, not just COMPOSITE. This is the key enabler for "any node can be parent."

```javascript
// From scoring-engine/index.js -- already handles this:
if (subCategories.length > 0) {
  const subResults = {};
  for (const sub of subCategories) {
    subResults[sub.id] = calculateCategory(sub, allRawScores, students, teams);
  }
  const augmentedCategory = buildAugmentedCategory(category, subCategories);
  const augmentedScores = buildAugmentedScores(categoryScores, subResults, ...);
  return method.calculate(augmentedCategory, augmentedScores, ...);
}
```

### Pattern 4: Single Context for Cohort Data (Already Exists)

**What:** `CohortDataContext` provides config, students, scores, results to all descendant components. Re-fetches on WebSocket `data-changed` events.
**When:** All components within `/cohort/{id}/*`.
**Why:** Avoids prop-drilling through recursive components. Any depth of EvalNode can access the full cohort data.

**Limitation to address:** The current context fetches ALL scores and ALL results for the entire cohort at once. For deeply nested trees with many categories, this could become a performance concern. However, with 2-5 concurrent users and modest data sizes, this is acceptable. Do NOT prematurely optimize.

### Pattern 5: Tree Operations via Config Mutations

**What:** All tree structure changes (add, delete, move, reparent) are config mutations. Save the entire config.json with optimistic locking.
**When:** Any structural change to the evaluation tree.
**Why:** Config is a single file with a version counter. Atomic writes with mutex ensure consistency. No need for per-node files or relational references.

**Trade-off:** Entire config.json is rewritten on every structural change. For trees with 50+ categories, this is still <100KB -- well within acceptable range.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate File Per Category

**What:** Storing each category's config in its own file (e.g., `data/cohorts/{id}/categories/{catId}.json`).
**Why bad:** Breaks atomicity of tree mutations. Moving a node between parents requires writing 3 files (old parent, new parent, node itself) without a transaction. The single-file config.json with mutex is simpler and safer.
**Instead:** Keep all category config in `config.json`. The file is small (<100KB even for complex trees).

### Anti-Pattern 2: Storing Tree Path in Score Data

**What:** Including the category's path or parent reference in `scores.json`.
**Why bad:** Scores become coupled to tree structure. Reparenting a node would require migrating all its score entries. The current flat `{ categoryId: scores }` structure is already decoupled.
**Instead:** Keep scores flat by category ID. Resolve tree relationships from config at calculation time.

### Anti-Pattern 3: Client-Side Score Aggregation

**What:** Computing parent scores from child scores in the browser.
**Why bad:** Duplication of business logic. Race conditions with stale data. Different clients might compute different results.
**Instead:** Server calculates all scores via scoring engine. Client receives pre-computed results. This is the existing pattern -- maintain it.

### Anti-Pattern 4: Deep Component Nesting for Tree Rendering

**What:** Rendering the tree by nesting React components N levels deep (recursive component rendering in a single page).
**Why bad:** Performance degrades with depth. State management becomes complex. Each level needs its own fetch.
**Instead:** Use the existing flat approach: EvalNode renders ONE level at a time. Navigation between levels is via URL routing, not component nesting. This IS the Notion model -- each page is one level.

### Anti-Pattern 5: Premature Drag-and-Drop

**What:** Implementing full drag-and-drop tree reordering in the first phase.
**Why bad:** High complexity (cross-level drag, drop targets, visual feedback). Libraries like `dnd-kit` or `react-beautiful-dnd` add significant bundle size and complexity.
**Instead:** Start with simple up/down arrows for reordering within siblings (already exists at root level). Add "Move to..." dialog for reparenting. Drag-and-drop can come later as polish.

## Component Architecture Diagram

```
/cohort/{id}/eval/[[...path]]/page.jsx
  |
  +-- EvalNode (one level of the tree)
       |
       +-- Breadcrumb (path-based navigation, existing)
       |
       +-- NodeActions (new: add child, delete, reorder)
       |    |
       |    +-- AddChildDialog (name, scoring_method, max_score)
       |    +-- MoveNodeDialog (select new parent, for reparenting)
       |
       +-- InlineSettings (existing: category config)
       |
       +-- DataTable (existing: renders columns)
       |    |
       |    +-- Input columns (input_fields of this node)
       |    +-- Computed columns (sub_categories, clickable -> navigation)
       |    +-- Result columns (calculated score, rank)
       |
       +-- FieldManager (existing, unified)
            |
            +-- Input field management (add/remove/reorder fields)
            +-- Sub-category management (add/remove/reorder children)

/cohort/{id}/layout.jsx
  |
  +-- CohortDataContext.Provider
  |
  +-- Tab Navigation
  |
  +-- TreeNav sidebar (new, replaces or augments Sidebar)
  |    |
  |    +-- Recursive tree outline of all categories
  |    +-- Expand/collapse per node
  |    +-- Click to navigate
  |    +-- Current node highlighted
  |
  +-- Score Sidebar (existing: total scores per student)
```

## API Route Extensions

Current routes are sufficient for most operations. New routes needed:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/cohorts/[id]/config/categories/[categoryId]/children` | POST | Add child to any category |
| `/api/cohorts/[id]/config/categories/[categoryId]/order` | PUT | Reorder within siblings |
| `/api/cohorts/[id]/config/categories/[categoryId]/parent` | PUT | Reparent (move to different parent) |

Existing routes that already support the new features:
- `PUT /api/cohorts/[id]/config/categories/[categoryId]` -- update any category property
- `DELETE /api/cohorts/[id]/config/categories/[categoryId]` -- delete (recursive removal exists)
- `PUT /api/cohorts/[id]/scores/[categoryId]` -- score entry (works at any depth via flat ID)

## Suggested Build Order

Based on component dependencies:

```
Phase 1: Unlock Recursive Tree (config layer)
  Dependencies: None (extends existing service)
  - Remove COMPOSITE-only restriction on sub_categories
  - Add "add child" API endpoint for any category
  - Unify FieldManager (merge LeafManager + CompositeManager)
  - Result: any category can have children, managed via API

Phase 2: Tree Navigation UI
  Dependencies: Phase 1 (need child categories to navigate)
  - Add NodeActions component (add child, delete, reorder)
  - Add TreeNav sidebar (recursive tree outline)
  - Extend breadcrumb for arbitrary depth
  - Result: full Notion-style page navigation

Phase 3: Scoring Method Simplification
  Dependencies: Phase 1 (new tree structure should work first)
  - Reduce to 4 core methods
  - Deprecate old methods with backward compatibility
  - Update InlineSettings UI to show only core methods
  - Result: cleaner scoring method selection

Phase 4: Team Score Input
  Dependencies: Phase 1 (tree must work), Phase 3 (simplified methods)
  - Team management UI improvements
  - Team-scope score input per category
  - Team score -> student distribution
  - Result: team-level scoring at any tree node

Phase 5: Polish
  Dependencies: All above
  - Drag-and-drop reordering (optional)
  - Tree import/export
  - Bulk operations
```

**Critical dependency:** Phase 1 must come first because it removes the foundational constraint. Phases 2 and 3 can potentially be parallelized. Phase 4 depends on the simplified method set from Phase 3.

## Scalability Considerations

| Concern | At current scale (2-5 users, <50 categories) | At 10x (50 users, 500 categories) | Mitigation |
|---------|-----------------------------------------------|-------------------------------------|------------|
| Config file size | <10KB, trivial | ~500KB, still manageable | Split to per-cohort files (already done) |
| Score calculation time | <50ms | ~500ms, potentially slow | Add caching of intermediate results |
| Tree depth | 3-4 levels, no concern | 10+ levels unlikely but possible | Cap max depth at 6 levels in UI |
| Concurrent tree edits | Rare, optimistic locking handles | More conflicts possible | Already handled by ConflictDialog |
| Full cohort data fetch | <100KB response | ~5MB, slow on mobile | Paginate or lazy-load sub-tree scores |

For the current 2-5 user scale, **none of these are real concerns**. The architecture handles the expected load with significant headroom.

## Sources

- Codebase analysis: `src/lib/schema.js`, `src/lib/scoring-engine/index.js`, `src/components/eval/EvalNode.jsx`, `src/lib/services/config-service.js`
- Existing architecture doc: `.planning/codebase/ARCHITECTURE.md`
- Next.js App Router catch-all routes: Verified via existing `[[...path]]` implementation
- File-based JSON storage patterns: Verified via `src/lib/storage/file-store.js` and `src/lib/storage/locking.js`

---

*Architecture analysis: 2026-03-24*
