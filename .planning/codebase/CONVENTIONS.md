# Coding Conventions

**Analysis Date:** 2026-03-24

## Naming Patterns

**Files:**
- Source files use **kebab-case**: `file-store.js`, `socket-client.js`, `boolean-with-deduction.js`, `table-helpers.js`
- React components use **PascalCase**: `EvalNode.jsx`, `DataTable.jsx`, `CategoryCard.jsx`, `ConflictDialog.jsx`, `SocketProvider.jsx`
- UI primitives from shadcn follow **kebab-case**: `button.jsx`, `card.jsx`, `dropdown-menu.jsx`
- Test files use **kebab-case with suffix**: `scoring-engine.test.js`, `team-scoring.test.js`
- E2E test files use **kebab-case with `.spec.js`**: `team-input.spec.js`, `cohort-creation.spec.js`

**Functions:**
- **camelCase** throughout: `calculateCategory()`, `buildTableColumns()`, `handleScoreChange()`, `fetchConfig()`
- Factory functions: `createEmptyCohortConfig()`, `createStudent()`, `createTeam()` -- prefix with `create`
- Event handlers: prefix with `handle` -- `handleAddCategory`, `handleDelete`, `handleCategoryClick`
- Async data fetchers: prefix with `fetch` -- `fetchConfig`, `fetchStudents`, `fetchAll`

**Variables:**
- **camelCase** for local variables: `cohortId`, `categoryId`, `activeStudents`
- **SCREAMING_SNAKE_CASE** for constants/enums: `SCORING_METHOD`, `INPUT_FIELD_TYPE`, `COLUMN_TYPE`, `INPUT_SCOPE`
- Korean variable names are used in test files only: `팀평가`, `이차프로젝트`, `rawScores_팀` (for readability in domain-specific tests)

**Types:**
- JSDoc `@typedef` for all data structures (no TypeScript) -- see `src/lib/schema.js`
- Type names use **PascalCase**: `CohortConfig`, `EvaluationCategory`, `Student`, `ScoresData`

## Language

**Primary language:** JavaScript (ES modules, no TypeScript)

**UI text and comments:** Korean (한글) -- this is a Korean-language education evaluation system
- Code comments use Korean: `/** 기수 목록 조회 */`, `// 학생별 총점 계산`
- API error messages use Korean: `'기수 이름을 입력해 주세요'`, `'같은 이름의 기수가 이미 존재합니다'`
- UI labels use Korean: `'기수 관리'`, `'학생 관리'`, `'평가 항목'`
- Variable names and function names use English

## Code Style

**Formatting:**
- No Prettier configuration -- formatting is not enforced by tooling
- 2-space indentation (observed throughout codebase)
- Single quotes for strings (consistent across all files)
- Semicolons used (consistent)
- Trailing commas used in multi-line structures

**Linting:**
- ESLint 9 with `eslint-config-next/core-web-vitals`
- Config at `eslint.config.mjs`
- Minimal custom rules -- relies on Next.js defaults
- Run with: `npm run lint`

## Module System

**Type:** ES Modules (`"type": "module"` in `package.json`)
- All imports use `import/export` syntax, never `require()`
- File extensions **required** in non-aliased imports: `import * as composite from './methods/composite.js'`
- Path alias `@/` maps to `./src/*` (configured in `jsconfig.json`)

## Import Organization

**Order (observed):**
1. Node.js builtins: `import fs from 'fs/promises'`, `import path from 'path'`
2. Framework imports: `import { NextResponse } from 'next/server'`, `import { useState } from 'react'`
3. Third-party libraries: `import { Parser } from 'expr-eval'`, `import { v4 as uuidv4 } from 'uuid'`
4. Internal aliases: `import { readJSON } from '@/lib/storage/file-store'`
5. Relative imports: `import * as weightedAverage from './methods/weighted-average.js'`

**Path Aliases:**
- `@/` -> `./src/` (configured in `jsconfig.json`, used everywhere)
- shadcn aliases configured in `components.json`:
  - `@/components` -> components
  - `@/components/ui` -> UI primitives
  - `@/lib` -> library code
  - `@/hooks` -> React hooks

## Error Handling

**API Routes (Server):**
- Wrap handler body in `try/catch`
- Return `NextResponse.json({ error: err.message }, { status: 500 })` on error
- Check for `ConflictError` by name: `if (err.name === 'ConflictError')` returns 409
- Validate required fields and return 400 with Korean error messages
- Example pattern from `src/app/api/cohorts/route.js`:
```javascript
export async function POST(request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: '기수 이름을 입력해 주세요' }, { status: 400 });
    }
    // ... business logic
    return NextResponse.json(config, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**Client-Side:**
- Use `window.alert()` for user-facing errors (via `alert()`)
- Check `res.ok` before processing response
- No centralized error boundary

**Services Layer:**
- Throw plain `Error` with descriptive message: `throw new Error('Student ${studentId} not found')`
- Custom `ConflictError` class for optimistic locking conflicts in `src/lib/storage/locking.js`

## Logging

**Framework:** `console.log` / `console.error` (no logging library)

**Patterns:**
- WebSocket events: `console.log(\`[WS] Connected: ${socket.id}\`)`
- No structured logging
- No log levels beyond console methods

## Comments

**When to Comment:**
- File-level block comments with purpose and Korean description at top of files:
```javascript
// ============================================================
// KDA 평가 시스템 — 전체 데이터 구조 정의
// 이 파일 하나로 모든 설정·데이터 구조를 파악할 수 있습니다.
// ============================================================
```
- Section dividers with `// ─── 제목 ──────` pattern
- JSDoc `/** ... */` on all exported functions with Korean descriptions
- Inline comments for non-obvious logic (Korean)

**JSDoc:**
- Used for type definitions (`@typedef`) in `src/lib/schema.js`
- Used for function documentation on service and scoring engine functions
- JSDoc `@param` and `@returns` on complex functions like `calculateCategory()`
- Component props documented as JSDoc block comments (see `src/components/eval/DataTable.jsx`)

## Function Design

**Size:**
- Service functions are small and focused (5-20 lines typically)
- Component files can be large (300-500 lines) because they include local sub-components
- Scoring methods are single-function modules with one exported `calculate()` function

**Parameters:**
- Options pattern with defaults: `function createCategory(name, scoringMethod, maxScore, options = {})`
- Nullish coalescing for defaults: `options.is_bonus ?? false`
- Destructuring config: `const { multiplier = 1, exclude_empty = true } = category.config`

**Return Values:**
- API services return the saved data object
- Score calculations return `{ raw: *, calculated: number }` per student
- Factory functions return the created object

## Module/Component Design

**Exports:**
- Named exports for utility functions and constants
- Default exports for React components and hooks
- Barrel file only for scoring engine: `src/lib/scoring-engine/index.js`

**Component Patterns:**
- `'use client'` directive on all client components (Next.js App Router)
- Server components are the default (layout, pages without interactivity)
- Context pattern for shared state: `CohortDataContext` + `useCohortData` hook
- Sub-components defined in the same file (e.g., `SortHeader`, `ScoreInput`, `OverrideInput` inside `DataTable.jsx`)

**State Management:**
- React Context (`CohortDataContext`) for cohort-scoped data
- Local `useState` for UI state
- No Redux/Zustand -- state flows through context + fetch

## Data Architecture Conventions

**IDs:** UUID v4 generated via `uuid` package
- `import { v4 as uuidv4 } from 'uuid'`

**Versioning:** Optimistic locking with `version` field on all data files
- Every write increments version
- Conflict detection via `writeWithLock()` in `src/lib/storage/locking.js`

**Data Format:** JSON stored on filesystem under `data/cohorts/[id]/`
- `config.json`, `students.json`, `scores.json` per cohort

**WebSocket Events:**
- Emit `data-changed` with `{ type, cohortId }` after mutations
- Access Socket.io via `global.__io` in API routes

---

*Convention analysis: 2026-03-24*
