# Technology Stack

**Project:** KDA Eval - Recursive Evaluation Tree Extension
**Researched:** 2026-03-24

## Context

This is a brownfield extension to an existing Next.js 16.1.6 + React 19.2.3 + Socket.io 4.8.3 app. The existing stack is locked (JavaScript ESM, file-based JSON, no TypeScript, no database). Research focuses only on **new libraries/patterns** needed for the milestone: Notion-style recursive page trees, tree-based score aggregation, and team score input UI.

## What Already Exists (Do Not Replace)

| Technology | Version | Role |
|------------|---------|------|
| Next.js | 16.1.6 | App Router, catch-all `[[...path]]` routes already in place |
| React | 19.2.3 | UI, Context for cohort data |
| Socket.io | 4.8.3 | Real-time sync |
| Radix UI | 1.4.3 | Headless UI primitives |
| shadcn/ui | 4.0.5 | Component scaffolding (JSX, radix-nova style) |
| expr-eval | 2.0.2 | Safe formula evaluation in composite scoring |
| Tailwind CSS | 4 | Styling |

The existing app already has:
- Catch-all route: `src/app/cohort/[id]/eval/[[...path]]/page.jsx`
- Recursive `EvalNode` component with `findCategoryByPath()` traversal
- Breadcrumb navigation for nested categories
- `sub_categories` field on `EvaluationCategory` typedef
- Recursive `calculateCategory()` in scoring engine with bottom-up aggregation
- `input_scope: 'team'` support in schema and scoring engine
- `CohortDataContext` for state distribution

## Recommended New Stack

### Tree Sidebar Navigation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom tree component | n/a | Sidebar tree for category navigation | HIGH |

**Rationale:** The existing sidebar (`Sidebar.jsx`) shows student totals, not a category tree. A new tree sidebar is needed for Notion-style navigation where users see and interact with the evaluation category hierarchy.

**Why custom, not a library:**
- The evaluation tree is shallow (typically 2-4 levels deep, under 50 nodes total) -- not the thousands-of-nodes scenario where virtualized tree libraries shine.
- The app already uses Radix UI + shadcn/ui for all UI primitives. Adding react-arborist (which depends on react-window for virtualization) or react-complex-tree introduces a styling system conflict and bundle weight for zero benefit at this scale.
- The existing `EvalNode` already does recursive path-based navigation. A sidebar tree just needs to render the same `evaluation_categories` hierarchy as a collapsible list with links -- about 80 lines of recursive React.
- Radix UI's `Collapsible` primitive handles expand/collapse with full accessibility (aria-expanded, keyboard nav) out of the box.

**Implementation pattern:**
```jsx
// Recursive TreeNode using Radix Collapsible
function CategoryTreeNode({ category, cohortId, basePath, currentPath }) {
  const hasChildren = category.sub_categories?.length > 0;
  const nodePath = [...basePath, category.id];
  const isActive = currentPath.join('/') === nodePath.join('/');

  if (!hasChildren) {
    return <Link href={`/cohort/${cohortId}/eval/${nodePath.join('/')}`}>...</Link>;
  }

  return (
    <Collapsible defaultOpen={isAncestorOfCurrent}>
      <CollapsibleTrigger>...</CollapsibleTrigger>
      <CollapsibleContent>
        {category.sub_categories.map(sub => (
          <CategoryTreeNode key={sub.id} category={sub} ... />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

**Libraries evaluated and rejected:**

| Library | Version | Why Not |
|---------|---------|---------|
| react-arborist | 3.4.3 | Overkill: adds react-window virtualization for 50 nodes. Different styling paradigm (CSS classes vs Tailwind). |
| react-complex-tree | 2.6.1 | Same overkill problem. Author recommends migrating to @headless-tree/react. |
| @headless-tree/react | 1.2.1 | Beta quality (still pre-1.0 stable feel). Too much ceremony for a simple hierarchy. |
| @dnd-kit/react | 0.3.2 | Pre-stable (0.x). Only needed if drag-drop reordering is required in tree sidebar, which PROJECT.md scopes as "UI에서 자연스럽게 수행" -- doable with simpler move-up/move-down buttons first. |

### Drag-and-Drop Tree Reordering (Deferred)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @dnd-kit/core | 6.3.1 | Category drag-drop reordering | Only if move-up/move-down buttons prove insufficient | MEDIUM |
| @dnd-kit/sortable | 10.0.0 | Sortable preset for tree items | Pairs with @dnd-kit/core | MEDIUM |

**Rationale:** PROJECT.md lists "평가 구조 자유 변경: 카테고리 추가/삭제/이동/중첩을 UI에서 자연스럽게 수행" as a requirement. This can be phased:
1. **Phase 1:** Add/delete/rename in tree sidebar + move-up/move-down buttons (no new deps)
2. **Phase 2 (if needed):** Drag-and-drop with @dnd-kit for a more polished experience

@dnd-kit/core 6.3.1 is the stable, widely-used version. The newer @dnd-kit/react 0.3.2 is a rewrite still in pre-release. Use the stable packages.

**NOTE:** @dnd-kit/react 0.3.2 is NOT recommended -- it is a pre-stable rewrite. Stick with @dnd-kit/core + @dnd-kit/sortable if/when drag-drop is needed.

### Immutable Tree Updates

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| immer | 11.1.4 | Safe immutable updates to nested tree structures | HIGH |

**Rationale:** The current codebase does manual spread-based immutable updates for category tree mutations (see `handleWeightChange` in `EvalNode.jsx`). As tree manipulation grows (add/remove/reorder categories at arbitrary depth, move categories between parents), manual spread chains become fragile and error-prone:

```javascript
// Current: manageable for shallow updates
const subCategories = (category.sub_categories || []).map(s =>
  s.id === colId ? { ...s, weight } : s
);

// Future: deeply nested tree mutations become nightmarish without immer
// Immer makes this safe and readable:
import { produce } from 'immer';
const updated = produce(config, draft => {
  const node = findNodeById(draft.evaluation_categories, targetId);
  node.sub_categories.push(newCategory);
  node.sub_categories.sort((a, b) => a.order - b.order);
});
```

Immer is 6KB gzipped, zero dependencies, works perfectly with React state. This is the one library addition with the highest ROI for this milestone.

### Score Aggregation (No New Libraries)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Existing scoring engine | n/a | Bottom-up recursive score aggregation | Already implemented | HIGH |

**Rationale:** The existing `calculateCategory()` in `src/lib/scoring-engine/index.js` already performs recursive bottom-up aggregation:
1. For categories with `sub_categories`, it recursively calculates each child first
2. Creates "augmented" categories that merge sub-category results as virtual input fields
3. Applies the parent's scoring method to the combined result

This pattern handles arbitrary depth. The scoring method simplification (8 -> 4 methods) is a refactoring task, not a technology decision.

### Team Score Input (No New Libraries)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Existing DataTable + schema | n/a | Team-mode score entry | Schema and engine already support `input_scope: 'team'` | HIGH |

**Rationale:** The existing codebase already handles team input:
- `INPUT_SCOPE.TEAM` enum in schema
- `calculateTeamCategory()` in scoring engine that computes per-team then distributes to students
- `EvalNode` renders team-mode with `tableRows` from `config.teams`
- The milestone's team input work is UI refinement and workflow, not new technology

## Complete New Dependencies

### Required (Install Now)

```bash
npm install immer@^11.1.4
```

That's it. One library. Everything else is already in the stack or can be built with existing primitives.

### Conditional (Install Later If Needed)

```bash
# Only if drag-drop reordering proves necessary
npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2
```

## Patterns Over Libraries

This milestone's technical challenge is **patterns**, not **packages**:

| Challenge | Pattern | Library? |
|-----------|---------|----------|
| Tree sidebar navigation | Recursive React component + Radix Collapsible | No (existing) |
| Category CRUD at arbitrary depth | Immer `produce()` for immutable tree mutation | immer |
| Bottom-up score aggregation | Post-order tree traversal (already implemented) | No (existing) |
| Notion-style page-per-node | Catch-all route + path array (already implemented) | No (existing) |
| Breadcrumb from path | Path array mapping (already implemented) | No (existing) |
| Category reordering | Move-up/move-down buttons initially, @dnd-kit later | Deferred |
| Team score input UI | DataTable in team mode (partially implemented) | No (existing) |
| Real-time tree sync | Socket.io `data-changed` event (already implemented) | No (existing) |

## Anti-Recommendations

**DO NOT use:**

| Library | Why Not |
|---------|---------|
| redux / @reduxjs/toolkit | The app uses React Context + fetch. Adding Redux for tree state is massive overkill for 2-5 concurrent users. |
| zustand / jotai | Same argument. React Context + `useCohortData` hook is sufficient. The cohort data is fetched from server, not derived locally. |
| react-query / SWR | The app uses direct `fetch()` + Socket.io push for cache invalidation. Adding a caching layer adds complexity with no benefit for 2-5 users. |
| react-sortable-tree | Unmaintained since 2020. Does not support React 19. |
| immutable-js | Heavy API surface. Immer is simpler and works with plain JS objects. |
| TypeScript | PROJECT.md constraint: "JavaScript (ESM) 유지 -- TypeScript 전환 안 함" |
| Any database | PROJECT.md constraint: "파일 기반 JSON 저장 유지 -- DB 도입 안 함" |

## Sources

- [Next.js Dynamic Routes docs](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) -- catch-all segment patterns
- [Notion data model blog post](https://www.notion.com/blog/data-model-behind-notion) -- block-based recursive architecture reference
- [immer npm](https://www.npmjs.com/package/immer) -- v11.1.4 confirmed current
- [react-arborist npm](https://www.npmjs.com/package/react-arborist) -- v3.4.3 with React 19 support, evaluated and rejected
- [react-complex-tree npm](https://www.npmjs.com/package/react-complex-tree) -- v2.6.1, author recommends migration to headless-tree
- [@headless-tree/react npm](https://www.npmjs.com/package/@headless-tree/react) -- v1.2.1 beta
- [@dnd-kit/react npm](https://www.npmjs.com/package/@dnd-kit/react) -- v0.3.2 pre-stable
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) -- v6.3.1 stable
- [State Management in 2026 comparison](https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge) -- evaluated and rejected for this use case
- [Tree traversal patterns in JavaScript](https://jrsinclair.com/articles/2019/functional-js-traversing-trees-with-recursive-reduce/) -- recursive reduce pattern reference
