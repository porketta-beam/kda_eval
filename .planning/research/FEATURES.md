# Feature Landscape

**Domain:** Recursive evaluation/grading system with Notion-style page navigation, tree-based score aggregation, and team scoring
**Researched:** 2026-03-24
**Overall Confidence:** HIGH (based on codebase analysis + domain research across LMS platforms + UX pattern research)

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

### Tree Structure & Navigation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Recursive category nesting (unlimited practical depth)** | Core promise of the app. Canvas/Blackboard limit to 1-2 levels; this app's value is deeper nesting. Warn at depth > 4 but do not hard-block. | Med | Schema already supports `sub_categories[]` recursively. Scoring engine handles recursive `calculateCategory()`. Main work is ensuring UI works cleanly at depth 3-4. |
| **Each node opens as independent page** | Notion's core metaphor. Click into a category to get a full-page editing experience with its own context (input fields, sub-categories, scores). | Med | Catch-all route `[[...path]]` exists. EvalNode renders differently for root vs non-root. Needs polish, not a rewrite. |
| **Breadcrumb navigation** | Standard for hierarchical content. Users must know where they are in the tree and navigate up. Every LMS, Notion, and file manager uses breadcrumbs. | Low | Already implemented in EvalNode.jsx for depth >= 2. Depth-1 has a back button. Minor UX refinement only (e.g., consistent arrow separators, truncation for deep paths). |
| **Tree sidebar showing category hierarchy** | Users need to see the full structure at a glance and navigate by clicking, like Notion's sidebar. Without this, nested categories exist but are invisible -- you can only discover them by drilling page-by-page. | Med | Not yet implemented. Recursive component needed using Radix Collapsible or similar. Should show expand/collapse state, category names, and serve as primary navigation. |
| **Add sub-category from within any page** | If users can only add top-level categories from the dashboard, the recursive promise is broken. Must add children from any node's page. | Med | Dashboard has add-category dialog (CohortDashboard). Not available in EvalNode pages. Need to replicate or adapt the add dialog for non-root pages. |
| **Delete category at any depth (with confirmation)** | CRUD completeness. Must handle score data orphaning gracefully (preserve scores in JSON, just remove the category from config). | Low | Exists for top-level in CohortDashboard. Needs to work at any depth via the API `DELETE /config/categories/[categoryId]`. |
| **Reorder categories at same level** | Users must control display order. Up/down arrows are sufficient for MVP. | Low | Implemented for top-level via `handleReorder`. Needs to work at sub-category level too (same logic, different API path). |
| **Leaf node = direct score input** | Only leaf nodes (no children) accept direct score entry. If a node has children, it auto-aggregates. This is the fundamental tree-scoring contract. | Low | Already working. Empty `sub_categories` -> shows input fields. Non-empty -> shows computed columns. No code changes needed. |
| **Parent node auto-aggregation** | Parents auto-calculate from children using configured scoring method. Weighted average, sum, composite -- all propagate upward recursively. | Low | Fully implemented in `calculateCategory()` with the augmented-category pattern (sub-categories become virtual input_fields). |

### Score Input & Display

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Per-student score entry in leaf nodes** | Core function. Instructors enter individual student scores in a spreadsheet-like table. | Low | DataTable + ScoreInput fully implemented with keyboard nav (arrow keys, Enter) and multi-cell Excel paste. |
| **Computed score display in parent nodes** | Parent nodes show read-only calculated scores per student. Clicking a computed cell navigates to that child page. | Low | Working via `COLUMN_TYPE.COMPUTED` columns in DataTable with clickable navigation. |
| **Score override (manual adjustment)** | Every major LMS (Moodle, Canvas, Blackboard) supports overriding calculated scores. Instructors need manual adjustment regardless of formula results. Must visually indicate override state (Moodle uses orange highlight, our app uses amber). | Low | Already implemented. `overrides` in scores.json, amber highlight in DataTable, dedicated override input column. |
| **Real-time WebSocket sync** | Multiple admins (2-5) work simultaneously. Changes by one must appear for others without page refresh. | Low | Implemented via Socket.io. |
| **Optimistic locking / conflict resolution** | When two admins edit the same data, detect and resolve conflicts. | Low | Version-based locking + ConflictDialog already working. |
| **Excel clipboard paste** | Bulk data entry from Excel/Google Sheets. This is a productivity-critical feature for instructors who prepare scores offline. | Low | Implemented in DataTable with multi-cell paste, parsing tabs and newlines correctly. |

### Team Scoring

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Team definition and student assignment** | Teams must be defined per cohort with students assigned. Schema has `teams[]` and `student.team_id`. | Med | Schema exists (`createTeam`, `Team` typedef, `student.team_id`). Need UI for creating/editing teams and assigning students. May need a dedicated "Team Management" section or integration into the student management page. |
| **Team-level score input** | When `input_scope: 'team'`, the table shows team rows instead of student rows. Score entered for the team propagates to all members identically. | Med | Scoring engine has `calculateTeamCategory()`. DataTable supports `rows` prop for team mode. EvalNode shows "team" badge. Main gap is team management UI and ensuring the full workflow is smooth (create teams -> assign students -> enter team scores). |
| **Team score propagation to students** | Every team member receives the same calculated value for a team-scoped category. No per-student differentiation within a team (anti-feature). | Low | Fully implemented in `calculateTeamCategory()`. Maps team results to students via `student.team_id`. |

### Scoring Methods (Consolidation)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Weighted average** | Standard aggregation: SUM(value * weight) / SUM(weight) * multiplier. | Low | `weighted-average.js` -- keep as-is. |
| **Weighted sum (sum/divide)** | Simple sum with optional divisor. | Low | `sum-divide.js` -- keep as-is. |
| **Rank differential** | Score by ranking with configurable top score, interval, floor. | Low | `rank-differential.js` -- keep as-is. |
| **User input (manual/direct)** | Leaf node accepts raw score. No formula. | Low | `user-input.js` -- keep as-is. |
| **Composite (formula-based aggregation)** | Combine sub-category scores with custom expression. This is the "glue" method for tree aggregation at intermediate nodes. | Low | `composite.js` using expr-eval -- keep as essential 5th method. |
| **Method selector shows only 4+1 methods** | Reduce InlineSettings method dropdown from 8 to 5 choices. Remove formula, boolean, boolean_with_deduction from UI. | Med | Need to check if any existing cohorts use deprecated methods. Migration path: keep engine code for backward compat, hide from UI selector. |

### Results & Export

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Total score calculation with ranking** | Auto-sum top-level categories into final score, rank students. Bonus cap support. | Low | `calculateTotals()` fully implemented. |
| **Results export (spreadsheet)** | Export final scores. | Low | `export-service.js` exists. |
| **Projected scores (average fill-in)** | Estimate final scores by filling empty slots with class average. | Low | `calculateProjectedScores()` implemented. |

## Differentiators

Features that set this product apart from Canvas/Blackboard/Moodle gradebooks. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Drag-and-drop tree reordering** | Notion-like feel. Move categories within a level by dragging. Far superior to up/down arrows. | High | Not implemented. dnd-kit-sortable-tree is the best React option. Defer to post-MVP -- arrows work fine. |
| **Drag-and-drop reparenting** | Move a sub-category from one parent to another via drag. Notion sidebar experience. | High | Not implemented. Very complex: must prevent circular refs, update URL paths, handle score data migration. Defer to post-MVP. |
| **Collapse/expand tree with memory** | Sidebar tree state persists across navigation. Users don't lose context. | Low | Store collapse state in localStorage per cohort. Implement alongside tree sidebar. |
| **Score completion indicators on tree nodes** | See which categories have scores entered vs empty at every level, not just top-level. Quick visual of grading progress. | Low | CategoryCard already shows progress bar for top-level. Extend to tree sidebar nodes. |
| **Category weight visualization** | Show how much each category contributes to total (percentage badges). | Low | Calculated from weight/max_score data. Display in tree sidebar or breadcrumb. |
| **Inline sub-category creation** | Add a sub-category without leaving context -- type name, press Enter, like Notion's quick-add. No modal needed. | Med | Currently requires dialog. An inline text input row at the bottom of sub-category list would be much faster. |
| **Bulk team assignment** | Assign multiple students to teams at once via multi-select or paste. | Low | Currently requires individual `team_id` assignment. A team management UI with drag-to-assign or batch select would be valuable. |
| **Conditional formatting / score warnings** | Highlight scores outside expected ranges (score > max_score, negative values, statistical outliers). | Low | Simple validation highlighting catches data entry errors early. |
| **Tree path deep links (shareable URLs)** | URL-based deep linking to any node. Admin can share `/cohort/2기/eval/cat1/cat2` with a colleague. | Low | Already works via catch-all routing. Just needs explicit "copy link" button or URL display. |
| **Tree-wide category search/filter** | Find specific categories in large trees. Client-side filter on category names. | Med | Only useful for large evaluation trees. Low priority. |

## Anti-Features

Features to explicitly NOT build. These add unwanted complexity, contradict core value, or are out of scope per PROJECT.md.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Block-based content editor (Notion blocks)** | This is an evaluation app, not a document editor. Categories are data containers with scoring configs, not rich-text pages. Importing Notion's block model would be massive scope creep. | Categories remain config objects: name, scoring method, input_fields, sub_categories. |
| **Additional scoring methods beyond 4+1** | PROJECT.md explicitly scopes to 4 core methods. Composite stays as the 5th for formula aggregation. The 3 deprecated methods (formula, boolean, boolean_with_deduction) add UI complexity without proportional value. | Keep engine code for backward compat. Hide deprecated methods from UI selector. Migrate cohorts if needed. |
| **Student-facing features** | Admin-only tool (PROJECT.md: Out of Scope). No student login, score viewing, or self-assessment. | Export and distribute if students need scores. |
| **Authentication / RBAC** | 2-5 admins on internal network. Auth adds friction without security benefit. | No auth. Add as separate milestone if ever needed. |
| **Database migration** | File-based JSON is a hard constraint. SQL would help concurrency but contradicts simplicity goal. | Keep file-based. Optimistic locking handles 2-5 user concurrency. |
| **Mobile-responsive design** | Admin tool on desktop only. Mobile layout would compromise data-dense table UI. Multi-column score tables do not work on small screens. | Desktop-first. No responsive breakpoints for tables. |
| **Per-student weighting within teams** | Some LMS tools allow individual contribution factors (FeedbackFruits, CATME). This is a different product. | All team members get identical score. Use a separate individual category for differentiation. |
| **Peer evaluation / student self-assessment** | Completely different product surface (Peerceptiv, CATME, FeedbackFruits). | Out of scope. Instructor-driven scoring only. |
| **Real-time CRDT collaborative editing** | Optimistic locking works for 2-5 users. CRDT adds enormous complexity for zero benefit at this scale. | Keep optimistic locking + conflict dialog. |
| **Internationalization (i18n)** | Korean-only app per PROJECT.md. i18n infrastructure adds complexity for zero users. | Korean only. All labels hardcoded in Korean. |
| **Undo/redo for score changes** | Proper undo/redo across multi-user real-time is extremely complex. File-based storage makes versioning harder. | Use score override for corrections. Implement audit log (differentiator) later if history is needed. |
| **Hard depth limit on nesting** | The schema and engine handle arbitrary depth correctly. Blocking at depth 3-4 would feel arbitrary. | Soft warning at depth > 4 ("deeply nested trees may be hard to manage"). No hard block. |

## Feature Dependencies

```
Tree Sidebar Navigation
  --> Category CRUD in Sidebar (requires tree to be visible)
    --> Collapse/expand with memory (enhances sidebar usability)
    --> Score completion indicators on tree nodes (requires tree + score data)
    --> Drag-drop reordering (requires tree items; defer)

Scoring Method Simplification (8 -> 4+1)
  --> Cleaner InlineSettings UI (fewer options in dropdown)
  --> Leaf-node direct input clarity (user_input vs deprecated boolean etc.)

Sub-category CRUD at Any Depth
  --> Full Notion-style recursive experience
  --> Category templates / presets (save structures; defer)

Team Management UI (create teams, assign students)
  --> Team Score Input (input_scope: 'team' in DataTable)
    --> Team Score Propagation (already in engine)

Bottom-up Aggregation (already exists)
  --> Score Completion Indicators (needs aggregation results)
  --> Projected Scores (needs aggregation results)
```

**Critical path for this milestone:**
```
1. Scoring method consolidation (8 -> 4+1) -- unblocks cleaner UI
2. Tree sidebar navigation -- the "Notion-style" experience
3. Sub-category CRUD at any depth (add/delete/reorder from any page)
4. Team management UI (create teams, assign students)
5. Team score input UI completion
```

## MVP Recommendation

**Prioritize (must ship for this milestone):**

1. **Tree sidebar navigation** -- This IS the "Notion-style" experience. Without a sidebar showing the full category hierarchy, nested categories are invisible. The user must drill page-by-page to discover structure. This is the highest-impact single feature.

2. **Sub-category CRUD at any depth** -- Users must add/delete/reorder children from any EvalNode page, not just the root dashboard. Without this, tree building is impossible beyond level 1.

3. **Scoring method consolidation (8 -> 4+1)** -- Reduce UI confusion before building new features on top. Hide deprecated methods from selector, keep engine code for backward compat.

4. **Team management UI** -- The schema and engine support teams, but no UI exists for creating teams and assigning students. This is required before team scoring can function end-to-end.

5. **Team score input UI completion** -- The engine works; ensure the DataTable team-row mode is polished and the workflow (teams page -> team-scoped category -> enter scores) is discoverable.

**Include if time permits (low-effort, high-value):**

6. **Score completion indicators on tree sidebar** -- Low effort once sidebar exists. Show filled/empty state per node.
7. **Collapse/expand tree with localStorage memory** -- Low effort, significant UX improvement for the sidebar.

**Defer to next milestone:**

- **Drag-drop reordering**: High complexity, up/down buttons suffice.
- **Drag-drop reparenting**: Very high complexity, rare use case.
- **Score change history / audit log**: High complexity, requires storage schema changes.
- **Category templates**: Cohort cloning covers 80% of this need.
- **Tree-wide search**: Only useful for very large trees.
- **Conditional formatting**: Nice to have, not blocking.

## Sources

- **Primary:** Codebase analysis of `src/lib/schema.js`, `src/lib/scoring-engine/index.js`, `src/components/eval/EvalNode.jsx`, `src/components/eval/DataTable.jsx`, `src/app/cohort/[id]/page.jsx`, `src/components/eval/InlineSettings.jsx`, `src/components/layout/Sidebar.jsx`
- [Notion Breadcrumb Navigation](https://noteforms.com/notion-glossary/breadcrumb) -- Breadcrumb UX pattern reference
- [Notion Navigation Redesign UX Case Study](https://davisdesigninteractive.medium.com/notion-navigation-redesign-a-ux-case-study-e547179faf86) -- Hierarchy navigation challenges (progressive indentation clutter, hidden deep pages)
- [Canvas Gradebook Essentials](https://www.teachingcollege.fse.manchester.ac.uk/canvas-essentials-gradebook/) -- Assignment Groups and weighted grading
- [Blackboard Weighted Categories](https://tips.uark.edu/blackboard-learn-ultra-overall-grade-with-weighted-categories-and-items/) -- Category-based weighted grading
- [Moodle Grade Overrides](https://techsupport.lambdasolutions.net/hc/en-us/articles/21415272092564-What-are-Grade-Overrides-in-the-Moodle-Gradebook) -- Override vs calculated score patterns
- [Carnegie Mellon Group Work Grading Methods](https://www.cmu.edu/teaching/assessment/assesslearning/groupWorkGradingMethods.html) -- Team/group scoring approaches
- [FeedbackFruits Group Member Evaluation](https://help.feedbackfruits.com/hc/en-us/articles/23527092093202-Group-Member-Evaluation-Group-Contribution-Grading-Group-Contribution-Factor) -- Group contribution grading features
- [Aggregation Types for Parent-Child Hierarchies (xViz)](https://docs.xviz.com/project-management/parent-level-calculations/aggregation-types) -- Sum, average, weighted average aggregation
- [dnd-kit-sortable-tree](https://github.com/Shaddix/dnd-kit-sortable-tree) -- React tree drag-and-drop library (for future reference)
- [React dnd-kit Tree Implementation](https://dev.to/fupeng_wang/react-dnd-kit-implement-tree-list-drag-and-drop-sortable-225l) -- Nested DnD patterns
- [Gradebook Software Guide 2025](https://www.eleapsoftware.com/glossary/complete-guide-to-gradebook-software-2025/) -- Modern gradebook feature landscape
