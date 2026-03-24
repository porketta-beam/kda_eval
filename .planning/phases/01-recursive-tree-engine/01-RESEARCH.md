# Phase 01: Recursive Tree Engine - Research

**Researched:** 2026-03-24
**Domain:** Recursive evaluation tree scoring engine, category nesting, override mechanism
**Confidence:** HIGH

## Summary

Phase 1 transforms the scoring engine from a system where only COMPOSITE categories can have children into one where **any category can have sub-categories**, with automatic score aggregation. The existing codebase already has most infrastructure in place: recursive `calculateCategory()`, the augmented category pattern, flat score storage by category ID, and recursive URL routing. The primary work is (1) removing the COMPOSITE-only restriction in UI and service layer, (2) consolidating 8 scoring methods down to 3 active ones (average, sum, user_input), (3) adding per-column weight support to the DataTable UI, and (4) ensuring the override mechanism works at any tree depth.

The scoring engine (`src/lib/scoring-engine/index.js`) already handles the full recursive calculation with the augmented category pattern (lines 116-143). The `buildAugmentedCategory()` function merges sub-category results as virtual input fields, allowing any scoring method to work as a parent. This means the engine changes are minimal -- primarily renaming/consolidating methods and ensuring weight propagation works correctly.

**Primary recommendation:** Focus on the service/schema/UI layers to unlock recursive nesting for all methods. The scoring engine core requires only method consolidation, not architectural change. Use immer for safe nested tree mutations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 부모 노드는 자신의 스코어링 메서드(평균/합산)에 따라 하위 항목을 자동 집계한다. 기존 augmented category 패턴을 활용.
- **D-02:** 각 하위 항목 칼럼에 가중치 행이 추가된다. 가중치 기본값은 1. 가중치를 입력하면 자연스럽게 가중평균/가중합산이 된다.
- **D-03:** 스코어링 메서드 이름은 "평균"과 "합산"으로 통일. 별도의 "가중평균"/"가중합산" 메서드 없음 -- 가중치가 UI 설정으로 분리.
- **D-04:** 어떤 노드에서든 직접 점수를 입력하면 하위 집계값을 덮어쓴다 (override).
- **D-05:** override를 지우면 자동 집계로 복귀한다 (null로 설정 시 calculated 값 사용).
- **D-06:** override된 셀은 시각적으로 구분하지 않는다 -- 별도 표시 불필요.
- **D-07:** leaf/parent 구분 없음. 하위 항목이 있든 없든 어떤 노드에서든 직접 입력 가능.
- **D-08:** 하위 항목 삭제 시마다 남은 항목으로 즉시 재계산. 전부 삭제되면 빈 노드로 전환.
- **D-09:** 빈 노드에 하위 항목을 추가해도 특별한 전환 과정 없음 -- 자연스럽게 공존.
- **D-10:** v1 스코어링 메서드는 3가지: 평균, 합산, 사용자입력.
- **D-11:** 등수차등배분은 v1에서 "등수 표시" 기능으로 대체. 차등 배분은 사용자가 직접 입력.
- **D-12:** 개인/팀 점수 테이블 모두에서 해당 카테고리 점수 기준으로 등수가 항상 표시된다.
- **D-13:** 기존 deprecated 메서드(formula, boolean, boolean_with_deduction, rank_differential, composite 등)는 엔진에서 하위 호환 유지하되, UI에서 새 카테고리 생성 시 선택 불가.

### Claude's Discretion
- 가중치 행의 정확한 UI 위치와 스타일링
- override 저장 메커니즘 (기존 overrides 필드 활용 vs raw_scores에 통합)
- 등수 계산의 동점 처리 방식
- 빈 노드의 점수 표시 방식 (0 vs 빈칸)

### Deferred Ideas (OUT OF SCOPE)
- 트리 사이드바 (v2 -- NAV-01)
- 드래그앤드롭 카테고리 이동/재정렬 (v2 -- NAV-02, NAV-03)
- 기존 데이터 마이그레이션 스크립트 -- 기존 코호트가 deprecated 메서드 사용 시 필요할 수 있음
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TREE-01 | 임의 깊이로 하위 카테고리를 생성할 수 있다 (재귀 중첩) | Existing `sub_categories[]` schema + `findCategoryRecursive()` in config-service. Remove COMPOSITE-only restriction in FieldManager. Unify LeafManager + CompositeManager. |
| TREE-05 | 부모 노드는 하위 항목의 점수를 자동으로 집계한다 | Existing `buildAugmentedCategory()` + `buildAugmentedScores()` in scoring engine already handles this for ANY method. No engine changes needed for basic aggregation. |
| TREE-06 | 어떤 노드에서든 소계를 직접 입력하면 하위 항목의 집계값을 덮어쓴다 (override) | Existing `overrides` field in scores.json + `bulkUpdateScores()` override support + `handleOverrideChange` in EvalNode. Extend `calculateTotals()` to apply overrides recursively, not just at root. |
| TREE-07 | 하위 항목이 있는 노드에서도 직접 입력이 가능하다 (leaf 제한 없음) | D-07 decision. The augmented category pattern already merges input_fields + sub_categories. Override column exists in DataTable for non-composite methods. |
| CONF-01 | 코호트별로 독립적인 평가 트리 구조를 가질 수 있다 | Already achieved: each cohort has its own `config.json` with independent `evaluation_categories[]`. No changes needed. |
</phase_requirements>

## Standard Stack

### Core (Existing -- No Changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | App Router, API routes, catch-all routing | Already in use, locked constraint |
| react | 19.2.3 | UI rendering, Context, hooks | Already in use, locked constraint |
| socket.io | 4.8.3 | Real-time WebSocket sync | Already in use, locked constraint |
| expr-eval | 2.0.2 | Safe formula evaluation (composite method backward compat) | Already in use for composite scoring |
| async-mutex | 0.5.0 | File-level mutex for optimistic locking | Already in use in storage layer |
| uuid | 13.0.0 | UUID v4 generation for category IDs | Already in use throughout |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| immer | 11.1.4 | Immutable tree mutations with `produce()` | All nested config tree mutations (add/remove/reorder sub-categories at any depth) |

**Installation:**
```bash
npm install immer@^11.1.4
```

**Version verification:** immer 11.1.4 confirmed current on npm registry (2026-03-24). Zero dependencies, 6KB gzipped, works with plain JS objects.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| immer | Manual spread operators | Error-prone for 3+ level deep tree mutations. immer is safer. |
| immer | immutable-js | Heavy API surface, does not work with plain JS objects, violates project conventions. |

## Architecture Patterns

### Recommended Project Structure (Changes Only)
```
src/
  lib/
    schema.js                    # MODIFIED: Add V1_SCORING_METHOD, DEPRECATED_SCORING_METHOD
    scoring-engine/
      index.js                   # MODIFIED: Recursive override support in calculateTotals
      methods/
        average.js               # NEW: Renamed from weighted-average.js (or alias)
        sum.js                   # NEW: Renamed from sum-divide.js (or alias)
        user-input.js            # UNCHANGED
        weighted-average.js      # KEPT: backward compat
        sum-divide.js            # KEPT: backward compat
        rank-differential.js     # KEPT: backward compat (deprecated)
        formula.js               # KEPT: backward compat (deprecated)
        boolean.js               # KEPT: backward compat (deprecated)
        boolean-with-deduction.js # KEPT: backward compat (deprecated)
        composite.js             # KEPT: backward compat (deprecated)
    services/
      config-service.js          # MODIFIED: addSubCategory(), reorderSubCategories()
    table-helpers.js             # MODIFIED: Rank column generation for all methods
  components/
    eval/
      EvalNode.jsx               # MODIFIED: Weight row, rank display, unified field management
      FieldManager.jsx           # MODIFIED: Unified (no LeafManager/CompositeManager split)
      InlineSettings.jsx         # MODIFIED: Only show v1 methods for new categories
  hooks/
    useCohortData.js             # MINOR: No structural change needed
```

### Pattern 1: Augmented Category (Already Exists -- Core Mechanism)
**What:** When a non-composite category has `sub_categories`, the scoring engine creates virtual input fields from sub-results, merges with real `input_fields`, then calculates using the node's own scoring method.
**When to use:** Any parent node that aggregates children.
**Why it works:** Allows ANY scoring method to work as a parent, not just COMPOSITE. This is the key enabler for D-01.

```javascript
// Already in src/lib/scoring-engine/index.js:116-143
// No changes needed to this core logic
if (subCategories.length > 0) {
  const subResults = {};
  for (const sub of subCategories) {
    subResults[sub.id] = calculateCategory(sub, allRawScores, students, teams);
  }
  const augmentedCategory = buildAugmentedCategory(category, subCategories);
  const augmentedScores = buildAugmentedScores(categoryScores, subResults, subCategories, activeStudents);
  return method.calculate(augmentedCategory, augmentedScores, activeStudents, teams);
}
```

### Pattern 2: Override at Any Depth (Extension Needed)
**What:** Override values stored in `scores.json.overrides[categoryId][studentId]` override the calculated score at any tree depth.
**When to use:** D-04/D-05 -- user directly enters score on a parent node.
**Current limitation:** `calculateTotals()` only applies overrides at the **root level** (for top-level categories). For recursive trees, overrides must be applied at the level where the override exists AND propagate correctly to parent calculations.

```javascript
// CURRENT: calculateTotals() applies overrides only at root level (line 185-186)
const overrideVal = overrides[category.id]?.[student.id];
const score = (overrideVal != null) ? overrideVal : (result?.calculated ?? 0);

// NEEDED: Override-aware recursive calculation
// Option A (recommended): Apply overrides during tree walk in calculateCategory()
// When calculating a parent, check if any child has an override; if so, use override instead of calculated
// Option B: Post-process -- calculate full tree, then walk again applying overrides bottom-up
```

**Recommendation for Claude's Discretion (override storage):** Keep the existing `overrides` field in `scores.json`. It already works for per-category-per-student override storage. The key change is making `calculateCategory()` or `calculateTotals()` aware of overrides at all depths, not just root level. Specifically:
1. Pass `overrides` into `calculateCategory()` as a new parameter
2. After computing each node's result, check `overrides[category.id][studentId]`
3. If override exists, use it instead of the calculated value
4. This override then propagates upward correctly because parent nodes see the overridden value via `buildAugmentedScores()`

### Pattern 3: Flat Score Storage with Tree Config (Already Exists)
**What:** Tree structure in `config.json`, scores flat in `scores.json` keyed by `category.id`.
**When to use:** Always. No structural changes needed.
**Why:** Category IDs are immutable UUIDs. Rearranging the tree does not require score data migration.

### Pattern 4: Method Consolidation with Backward Compatibility
**What:** Three v1 methods (average, sum, user_input) are the only ones selectable in UI. All 8 existing methods remain functional in the engine.
**When to use:** D-10/D-13.
**Implementation:**

```javascript
// In schema.js -- add a new enum for v1 methods
export const V1_SCORING_METHOD = {
  AVERAGE: 'weighted_average',  // Same engine key, new UI label "평균"
  SUM: 'sum_divide',            // Same engine key, new UI label "합산"
  USER_INPUT: 'user_input',     // Same engine key, new UI label "사용자입력"
};

// In InlineSettings.jsx and FieldManager.jsx -- use V1_SCORING_METHOD for dropdowns
// SCORING_METHOD kept for backward compat, METHOD_MAP unchanged
```

**Key insight:** The "평균" method IS `weighted_average` (with weight defaults to 1, multiplier configurable). The "합산" method IS `sum_divide` (with divisor defaulting to 1). No new engine methods needed -- just restrict the UI selector and rename labels.

### Pattern 5: Per-Column Weight in DataTable
**What:** Each column (input_field or sub_category) has a `weight` property (default 1). The DataTable renders a weight row where admins can edit weights.
**When to use:** D-02. Non-root views with multiple columns.
**Current state:** Weight row (`showWeightRow`) already exists in EvalNode.jsx (line 245). `handleWeightChange` updates both `input_fields[].weight` and `sub_categories[].weight` (line 121-126). The scoring engine already reads `field.weight ?? 1` in weighted-average.js and sum-divide.js.

```javascript
// Already in EvalNode.jsx:245
const showWeightRow = !isRoot && tableColumns.length > 0 && !isComposite;

// Already in EvalNode.jsx:121-126
const handleWeightChange = useCallback((colId, weight) => {
  const inputFields = (category.input_fields || []).map(f => f.id === colId ? { ...f, weight } : f);
  const subCategories = (category.sub_categories || []).map(s => s.id === colId ? { ...s, weight } : s);
  handleSettingsSave({ ...category, input_fields: inputFields, sub_categories: subCategories });
}, [category, handleSettingsSave]);
```

**Change needed:** Currently `showWeightRow` is false for COMPOSITE. Per D-02, it should show for ALL parent nodes regardless of method. Modify condition to: `const showWeightRow = !isRoot && tableColumns.length > 0;`

### Pattern 6: Rank Display at Every Category Level
**What:** D-12 requires rank displayed at every category level (both individual and team tables).
**When to use:** All non-root category views.
**Current state:** Rank column only appears for `RANK_DIFFERENTIAL` method (table-helpers.js:59-64). Need to add rank column for ALL methods.

```javascript
// CURRENT in table-helpers.js:buildResultColumns
if (category.scoring_method === SCORING_METHOD.RANK_DIFFERENTIAL) {
  cols.push({ id: 'rank', label: '순위', getValue: ... });
}

// NEEDED: Always add rank column
// Calculate rank from calculated scores (same tie-handling as calculateTotals)
cols.push({
  id: 'rank',
  label: '순위',
  getValue: (sid) => categoryRanks[sid] ?? null,
});
```

### Anti-Patterns to Avoid
- **Separate file per category for config:** Breaks atomicity of tree mutations. Keep single `config.json` per cohort.
- **Client-side score aggregation:** Server calculates all scores. Client receives pre-computed results. Never compute scores in React components.
- **Storing tree path in score data:** Scores stay flat by category ID. Never couple scores to tree structure.
- **Hybrid leaf/parent special-casing:** Per D-07/D-09, there is NO special transition. A node can have both `input_fields` and `sub_categories` simultaneously. The augmented category pattern handles this naturally.
- **Creating new scoring method modules for "average" and "sum":** The existing `weighted-average.js` and `sum-divide.js` ARE the implementations. Only rename labels, do not create duplicate calculation code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Nested immutable tree updates | Manual spread chains for 3+ levels | `immer.produce()` | Deeply nested spreads are error-prone and unreadable |
| Score aggregation algorithm | Custom parent-child calculation | Existing `buildAugmentedCategory()` + `buildAugmentedScores()` | Already handles arbitrary nesting, tested |
| Rank calculation | Custom ranking logic per component | Centralize rank computation in scoring engine | Tie-handling must be consistent everywhere |
| Category tree traversal | Ad-hoc recursive search per use case | `findCategoryRecursive()` from config-service | Already exists, handles arbitrary depth |
| UUID generation | Custom ID generation | `uuid.v4()` | Already used throughout, collision-safe |

**Key insight:** The existing scoring engine IS the recursive tree engine. Phase 1's work is mostly about unlocking what already exists (removing artificial COMPOSITE-only restrictions) and consolidating the method set, not building new computation logic.

## Common Pitfalls

### Pitfall 1: Override Not Propagating Through Recursive Calculation
**What goes wrong:** User overrides a score at depth-2, but the parent at depth-1 still uses the calculated (non-overridden) value because `calculateCategory()` does not receive overrides.
**Why it happens:** Currently, overrides are only applied in `calculateTotals()` at root level (line 185-186). The recursive `calculateCategory()` has no knowledge of overrides.
**How to avoid:** Pass `overrides` object into `calculateCategory()`. After computing each node (whether leaf or parent via augmented path), check `overrides[category.id][studentId]`. If present, substitute the override value into the result. This way, when a parent node calls `buildAugmentedScores()` for its children, it sees overridden values.
**Warning signs:** Overriding a child category's score does not change the parent's total.

### Pitfall 2: FieldManager Split Creates Inconsistent Behavior
**What goes wrong:** Currently, `FieldManager` renders `LeafManager` for non-composite and `CompositeManager` for composite. When ALL categories can have children, this split is wrong. A `weighted_average` category with sub_categories needs both input field management AND sub-category management.
**Why it happens:** The split assumes only COMPOSITE categories have children.
**How to avoid:** Unify `FieldManager` into a single component that shows BOTH input field management and sub-category management sections. The component always renders both sections; either can be empty.
**Warning signs:** Cannot add sub-categories to a non-composite category. Cannot add input fields to a category that already has sub-categories.

### Pitfall 3: Method Rename Breaking Existing Data
**What goes wrong:** If we change `scoring_method` strings in existing configs (e.g., `weighted_average` to `average`), existing cohorts break.
**Why it happens:** File-based JSON storage has no migration system.
**How to avoid:** Do NOT change the internal method strings. Keep `weighted_average` and `sum_divide` as the actual enum values. Only change the **UI labels** to "평균" and "합산". The `V1_SCORING_METHOD` enum maps new UI labels to existing engine keys.
**Warning signs:** Existing cohorts throw "Unknown scoring method" errors after update.

### Pitfall 4: Composite Formula Variable Binding With Reordering
**What goes wrong:** Composite formulas use positional `_cat0`, `_cat1` etc. If sub-categories are reordered, formula variables shift.
**Why it happens:** `composite.js:22-29` maps sub-categories by array index.
**How to avoid:** This is a known issue but is OUT OF SCOPE for Phase 1 (composite is deprecated for new creation). Leave composite as-is for backward compatibility. Users cannot create new composite categories.
**Warning signs:** After reordering sub-categories in a composite node, formula results change unexpectedly.

### Pitfall 5: Weight Row Not Showing After Category Gets Children
**What goes wrong:** The weight row display condition (`showWeightRow`) currently excludes composite categories. If changed to include all categories, existing composite categories with formulas might show a confusing weight row.
**Why it happens:** Composite categories use formulas, not weighted aggregation. Showing a weight row is misleading.
**How to avoid:** Show weight row for all v1 methods (average, sum, user_input). For deprecated methods (including composite), keep current behavior. Use: `const showWeightRow = !isRoot && tableColumns.length > 0 && !isDeprecatedMethod(category.scoring_method);`
**Warning signs:** Composite categories show weight controls that have no effect on formula evaluation.

### Pitfall 6: `addCategory` Only Adds to Root Level
**What goes wrong:** `config-service.js:addCategory()` (line 19-38) pushes new categories to `config.evaluation_categories` (root level only). There is no function to add a sub-category to an arbitrary parent.
**Why it happens:** Original design only needed root-level category addition. Sub-categories were managed client-side in CompositeManager.
**How to avoid:** Add `addSubCategory(cohortId, parentCategoryId, childData)` to config-service. Use `findCategoryRecursive()` to locate parent, then push to its `sub_categories[]`.
**Warning signs:** API has no endpoint to add children to non-root categories.

### Pitfall 7: `reorderCategories` Only Works at Root Level
**What goes wrong:** `config-service.js:reorderCategories()` (line 65-77) searches only `config.evaluation_categories` for matching IDs. Sub-category reordering fails silently.
**Why it happens:** Same root-level-only design.
**How to avoid:** Generalize to accept an optional `parentCategoryId`. If provided, find parent via `findCategoryRecursive()` and reorder its `sub_categories[]`.
**Warning signs:** Moving sub-categories up/down does not persist.

## Code Examples

### Example 1: Adding Sub-Category to Any Parent (config-service extension)
```javascript
// Source: New function for config-service.js
import { produce } from 'immer';

/** 하위 카테고리 추가 */
export async function addSubCategory(cohortId, parentCategoryId, childData) {
  const config = await getConfig(cohortId);
  if (!config) throw new Error(`Cohort ${cohortId} not found`);

  const parent = findCategoryRecursive(config.evaluation_categories, parentCategoryId);
  if (!parent) throw new Error(`Category ${parentCategoryId} not found`);

  if (!parent.sub_categories) parent.sub_categories = [];
  const maxOrder = parent.sub_categories.reduce((m, c) => Math.max(m, c.order), 0);

  const child = createCategory(childData.name, childData.scoring_method, childData.max_score || 0, {
    ...childData,
    order: maxOrder + 1,
  });
  parent.sub_categories.push(child);

  const saved = await writeWithLock(getConfigPath(cohortId), config, config.version);
  return { category: child, config: saved };
}
```

### Example 2: Override-Aware Recursive Calculation
```javascript
// Source: Extension to scoring-engine/index.js calculateCategory
export function calculateCategory(category, allRawScores, students, teams = [], overrides = {}) {
  // ... existing method lookup and active student filter ...

  const categoryScores = allRawScores[category.id] || {};
  const subCategories = category.sub_categories || [];

  if (subCategories.length > 0) {
    const subResults = {};
    for (const sub of subCategories) {
      subResults[sub.id] = calculateCategory(sub, allRawScores, students, teams, overrides);
    }

    // Apply overrides to sub-results before building augmented scores
    for (const sub of subCategories) {
      for (const student of students) {
        const overrideVal = overrides[sub.id]?.[student.id];
        if (overrideVal != null && subResults[sub.id]?.[student.id]) {
          subResults[sub.id][student.id].calculated = overrideVal;
        }
      }
    }

    const augmentedCategory = buildAugmentedCategory(category, subCategories);
    const augmentedScores = buildAugmentedScores(categoryScores, subResults, subCategories, activeStudents);
    const results = method.calculate(augmentedCategory, augmentedScores, activeStudents, teams);

    // Attach sub_scores and apply own override
    for (const student of activeStudents) {
      if (results[student.id]) {
        results[student.id].sub_scores = {};
        for (const sub of subCategories) {
          results[student.id].sub_scores[sub.id] = subResults[sub.id]?.[student.id] ?? { calculated: 0 };
        }
        // Apply override at this level
        const ownOverride = overrides[category.id]?.[student.id];
        if (ownOverride != null) {
          results[student.id].calculated = ownOverride;
        }
      }
    }
    return results;
  }

  // Leaf calculation unchanged, but apply override afterward
  const results = method.calculate(category, categoryScores, activeStudents, teams);
  for (const student of activeStudents) {
    const ownOverride = overrides[category.id]?.[student.id];
    if (ownOverride != null && results[student.id]) {
      results[student.id].calculated = ownOverride;
    }
  }
  return results;
}
```

### Example 3: Unified FieldManager Structure
```javascript
// Source: Refactored FieldManager.jsx concept
export default function FieldManager({ category, onSave }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger>
        {open ? '▼' : '▶'} 필드 관리
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Section 1: Input fields -- always available */}
        <InputFieldSection
          fields={category.input_fields || []}
          onSave={(fields) => onSave({ ...category, input_fields: fields })}
        />
        {/* Section 2: Sub-categories -- always available */}
        <SubCategorySection
          subs={category.sub_categories || []}
          onSave={(subs) => onSave({ ...category, sub_categories: subs })}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Example 4: V1 Method Labels in InlineSettings
```javascript
// Source: Schema addition
export const V1_SCORING_METHOD = {
  AVERAGE: 'weighted_average',
  SUM: 'sum_divide',
  USER_INPUT: 'user_input',
};

export const V1_METHOD_LABELS = {
  [V1_SCORING_METHOD.AVERAGE]: '평균',
  [V1_SCORING_METHOD.SUM]: '합산',
  [V1_SCORING_METHOD.USER_INPUT]: '사용자입력',
};

// In InlineSettings.jsx -- replace SCORING_METHOD dropdown with V1 methods
<SelectContent>
  {Object.entries(V1_SCORING_METHOD).map(([key, val]) => (
    <SelectItem key={val} value={val}>{V1_METHOD_LABELS[val]}</SelectItem>
  ))}
</SelectContent>
```

### Example 5: Rank Calculation at Category Level
```javascript
// Source: Extension to table-helpers.js or scoring engine
/**
 * 카테고리 내 학생 순위 계산
 * @param {Object} calcResults - { [studentId]: { calculated: number } }
 * @returns {Object<string, number>} - { [studentId]: rank }
 */
export function computeCategoryRanks(calcResults, overrides = {}) {
  const entries = Object.entries(calcResults)
    .map(([sid, r]) => {
      const overrideVal = overrides[sid];
      const score = overrideVal != null ? overrideVal : (r?.calculated ?? 0);
      return [sid, score];
    })
    .sort(([, a], [, b]) => b - a);

  const ranks = {};
  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i][1] !== entries[i - 1][1]) {
      currentRank = i + 1;
    }
    ranks[entries[i][0]] = currentRank;
  }
  return ranks;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| COMPOSITE-only children | Any method can have children | Phase 1 (this phase) | Core architectural unlock |
| 8 scoring methods | 3 v1 methods + deprecated compat | Phase 1 (this phase) | Simpler UI, same engine |
| Weight per category only | Weight per column (input_field + sub_category) | Phase 1 (this phase) | Unified weight mechanism |
| Override at root level only | Override at any depth | Phase 1 (this phase) | Required for D-04 |
| Rank only for RANK_DIFFERENTIAL | Rank displayed for all methods | Phase 1 (this phase) | D-12 |

**Deprecated/outdated (kept for backward compat):**
- `SCORING_METHOD.COMPOSITE`: Replaced by any-method-as-parent via augmented pattern
- `SCORING_METHOD.RANK_DIFFERENTIAL`: Replaced by "rank display" feature + user_input
- `SCORING_METHOD.FORMULA`: Kept in engine only, not selectable
- `SCORING_METHOD.BOOLEAN`: Kept in engine only, not selectable
- `SCORING_METHOD.BOOLEAN_WITH_DEDUCTION`: Kept in engine only, not selectable

## Open Questions

1. **Override storage: overrides field vs raw_scores integration**
   - What we know: Existing `overrides` field in scores.json works for category-level overrides. The `bulkUpdateScores()` service already supports writing overrides. The override delete (null) mechanism works.
   - What's unclear: Should overrides for non-root categories use the same top-level `overrides` field, or should each depth level have its own override scope?
   - Recommendation: Use the existing flat `overrides[categoryId][studentId]` structure. Category IDs are unique UUIDs regardless of depth. The flat structure works for any depth. No change needed.

2. **Empty node score display: 0 vs blank**
   - What we know: D-09 says empty nodes exist naturally. No input_fields and no sub_categories.
   - What's unclear: What score should be displayed for students in an empty node?
   - Recommendation: Display blank (null/empty cell). A node with no inputs and no children has no meaningful score. Show `null` which renders as empty in DataTable.

3. **Rank tie-handling**
   - What we know: Current `calculateTotals()` uses "dense ranking" where ties get the same rank and the next rank skips. E.g., 1, 1, 3 (not 1, 1, 2).
   - What's unclear: Should category-level rank use the same algorithm?
   - Recommendation: Yes, use the same "standard competition ranking" (1, 1, 3) for consistency. Reuse the same pattern from `calculateTotals()` lines 209-216.

4. **"평균" method config: multiplier behavior**
   - What we know: Current `weighted_average` has `multiplier` and `exclude_empty` config. When renamed to "평균", should multiplier still exist?
   - What's unclear: Is multiplier confusing in the simplified UI?
   - Recommendation: Keep multiplier in config (backward compat). For new categories, default multiplier to 1. The UI can show it as an advanced setting or hide it entirely.

5. **"합산" method config: divisor behavior**
   - What we know: Current `sum_divide` has `divisor` config. When renamed to "합산", divisor=1 means pure sum.
   - What's unclear: Should the divisor UI be hidden by default for new "합산" categories?
   - Recommendation: Default divisor to 1 for new categories. Show divisor in settings only if it is not 1. This makes "합산" behave as a pure sum by default.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js native test runner (`node:test`, `node:assert`) for unit tests; Playwright 1.58.2 for E2E |
| Config file | `playwright.config.js` for E2E; custom loader `tests/register-loader.js` for unit tests |
| Quick run command | `node --import ./tests/register-loader.js tests/scoring-engine.test.js` |
| Full suite command | `npm run test:unit && npx playwright test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREE-01 | 3+ levels deep category nesting in config.json | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | Wave 0 |
| TREE-05 | Parent auto-aggregates children's scores | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | Wave 0 |
| TREE-06 | Override at any depth replaces calculated value | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | Wave 0 |
| TREE-07 | Node with children can also have direct input | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | Wave 0 |
| CONF-01 | Independent cohort trees | unit | Existing `tests/scoring-engine.test.js` already tests per-category calculation | Exists (partial) |
| D-10 | 3 v1 methods calculate correctly | unit | `node --import ./tests/register-loader.js tests/scoring-engine.test.js` | Exists (partial -- tests weighted_average, sum_divide, user_input) |
| D-12 | Rank displayed at every category | unit | `node --import ./tests/register-loader.js tests/recursive-tree.test.js` | Wave 0 |
| D-13 | Deprecated methods still calculate | unit | Existing `tests/scoring-engine.test.js` covers formula, boolean, composite | Exists |
| Integration | Full flow: add nested categories, enter scores, verify totals | e2e | `npx playwright test tests/e2e/recursive-tree.spec.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:unit` (scoring engine + team tests)
- **Per wave merge:** `npm run test:unit && npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/recursive-tree.test.js` -- Unit tests for TREE-01, TREE-05, TREE-06, TREE-07, D-12 (recursive nesting, auto-aggregation, override at depth, hybrid nodes, category-level rank)
- [ ] `tests/e2e/recursive-tree.spec.js` -- E2E test for full nested category creation + scoring flow
- [ ] Existing `tests/scoring-engine.test.js` uses a custom assert framework (not `node:test`). Consider migrating to `node:test` for consistency, or keep as-is for backward compat.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | 24.14.0 | -- |
| npm | Package management | Yes | 11.9.0 | -- |
| Playwright | E2E tests | Yes | 1.58.2 (devDependency) | -- |
| immer | Tree mutations (to install) | Not yet installed | 11.1.4 on npm | Manual spread operators (not recommended) |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:**
- immer: Not yet installed. Install with `npm install immer@^11.1.4`

## Project Constraints (from CLAUDE.md)

- **Language:** JavaScript (ESM) only, no TypeScript
- **Storage:** File-based JSON, no database
- **Stack:** Next.js 16 + React 19 + Socket.io locked
- **Users:** 2-5 concurrent, no large-scale optimization needed
- **Naming:** kebab-case for source files, PascalCase for components, camelCase for functions, SCREAMING_SNAKE_CASE for constants
- **Comments:** Korean for code comments, API errors, UI labels; English for variable/function names
- **Module system:** ESM with `import/export`, file extensions required in non-aliased imports
- **Code style:** 2-space indentation, single quotes, semicolons, trailing commas
- **Error handling:** try/catch in API routes, ConflictError for version conflicts, `alert()` for client errors
- **Testing:** `node:test` for unit tests, Playwright for E2E
- **JSDoc:** `@typedef` for data structures, `@param`/`@returns` on complex functions
- **Factory functions:** Prefix with `create`
- **Event handlers:** Prefix with `handle`

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/scoring-engine/index.js` -- Full recursive calculation with augmented pattern verified
- Codebase analysis: `src/lib/schema.js` -- EvaluationCategory typedef with sub_categories[], weight, input_fields
- Codebase analysis: `src/lib/services/config-service.js` -- findCategoryRecursive, removeCategoryRecursive, addCategory (root-only)
- Codebase analysis: `src/lib/services/score-service.js` -- bulkUpdateScores with override support
- Codebase analysis: `src/components/eval/EvalNode.jsx` -- handleWeightChange, handleOverrideChange, showWeightRow logic
- Codebase analysis: `src/components/eval/FieldManager.jsx` -- LeafManager/CompositeManager split
- Codebase analysis: `src/lib/table-helpers.js` -- buildResultColumns rank-only-for-RANK_DIFFERENTIAL
- Codebase analysis: `src/app/api/cohorts/[id]/scores/[categoryId]/route.js` -- override API
- Codebase analysis: `src/hooks/useCohortData.js` -- data fetching and WebSocket refresh
- npm registry: immer 11.1.4 confirmed current

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- Augmented category pattern analysis, build order recommendation
- `.planning/research/PITFALLS.md` -- 13 pitfalls documented with prevention strategies
- `.planning/research/STACK.md` -- immer recommendation, library evaluations

### Tertiary (LOW confidence)
- None. All findings verified against codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- verified against existing codebase and npm registry
- Architecture: HIGH -- augmented category pattern verified in source code, override mechanism traced through all layers
- Pitfalls: HIGH -- pitfalls identified from actual code analysis (e.g., root-only addCategory, root-only reorder, root-only override in calculateTotals)

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable codebase, no external API changes expected)
