<!-- GSD:project-start source:PROJECT.md -->
## Project

**KDA Eval — 평가 시스템 리팩토링**

교육 현장에서 학생 점수를 취합하고 총점을 계산하는 웹 앱. 2-5명의 관리자(강사/조교)가 코호트별로 평가 항목을 구성하고, 학생 점수를 입력하며, 자동 집계된 결과를 확인한다. Next.js 16 + Socket.io 기반 실시간 협업 앱으로, 파일 기반 JSON 저장을 사용한다.

**Core Value:** 평가 구조를 자유롭게 설계하고, 어떤 구조든 정확하게 점수가 집계되어야 한다.

### Constraints

- **Tech stack**: Next.js 16 + React 19 + Socket.io 유지 — 기존 인프라 활용
- **Storage**: 파일 기반 JSON 저장 유지 — DB 도입 안 함
- **Language**: JavaScript (ESM) 유지 — TypeScript 전환 안 함
- **Users**: 2-5명 동시 접속 규모 — 대규모 성능 최적화 불필요
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (ES Modules) - All source code (`.js`, `.jsx`), no TypeScript
- CSS (Tailwind CSS v4) - Styling via `src/app/globals.css`, `src/styles/tokens.css`
## Runtime
- Node.js (no `.nvmrc` or `.node-version` — version not pinned)
- ESM-first: `"type": "module"` in `package.json`
- npm
- Lockfile: `package-lock.json` (present)
## Frameworks
- Next.js 16.1.6 - App Router with custom HTTP server (`server.js`)
- React 19.2.3 - UI rendering
- Socket.io 4.8.3 - Real-time WebSocket communication (server + client)
- Playwright 1.58.2 - E2E browser testing, config at `playwright.config.js`
- Node.js native test runner (`node:test`, `node:assert`) - Unit tests run via custom ESM loader
- Next.js built-in compiler (SWC) - Build and dev bundling
- PostCSS with `@tailwindcss/postcss` v4 plugin - CSS processing (`postcss.config.mjs`)
- ESLint 9 with `eslint-config-next` (core-web-vitals) - Linting (`eslint.config.mjs`)
## Key Dependencies
- `next` 16.1.6 - Full-stack framework (API routes + SSR/RSC)
- `react` / `react-dom` 19.2.3 - UI layer
- `socket.io` / `socket.io-client` 4.8.3 - Real-time updates between clients
- `expr-eval` 2.0.2 - Safe formula evaluation engine (used in composite scoring, replaces `eval()`)
- `async-mutex` 0.5.0 - File-level mutex for optimistic locking (`src/lib/storage/locking.js`)
- `uuid` 13.0.0 - UUID v4 generation for all entity IDs
- `radix-ui` 1.4.3 - Headless UI primitives (dialog, dropdown, select, tooltip, etc.)
- `shadcn` 4.0.5 - Component scaffolding tool (radix-nova style, JSX not TSX)
- `lucide-react` 0.577.0 - Icon library
- `class-variance-authority` 0.7.1 - Variant-based component styling
- `clsx` 2.1.1 + `tailwind-merge` 3.5.0 - Class name utilities (`src/lib/utils.js`)
- `tw-animate-css` 1.4.0 - Tailwind animation presets
- `cross-env` 10.1.0 - Cross-platform env variable setting for production start script
## Configuration
- `.env` files listed in `.gitignore` but not required for core functionality
- Port configured via `process.env.PORT` (default: 3000)
- `NODE_ENV` checked in `server.js` for dev/production mode
- `next.config.mjs` - Minimal (empty config object)
- `jsconfig.json` - Path alias `@/*` maps to `./src/*`
- `components.json` - shadcn/ui configuration (radix-nova style, JSX, not TSX, CSS variables enabled)
- `postcss.config.mjs` - Tailwind CSS v4 PostCSS plugin
- `eslint.config.mjs` - ESLint 9 flat config with Next.js core-web-vitals
- `server.js` - Custom Node.js HTTP server wrapping Next.js + Socket.io
- Dev command: `node --watch server.js` (uses Node.js native watch mode, not `next dev`)
- Production: `cross-env NODE_ENV=production node server.js`
## npm Scripts
## Data Storage
- Data directory: `data/cohorts/{cohort-uuid}/`
- Three files per cohort: `config.json`, `students.json`, `scores.json`
- No database dependency - all data is read/written via `fs/promises`
- File storage module: `src/lib/storage/file-store.js`
- Optimistic locking with mutex: `src/lib/storage/locking.js`
## Unit Test Infrastructure
- `tests/register-loader.js` + `tests/loader.js` - Resolves `@/` path aliases for Node.js test runner
- Tests run directly with `node --import ./tests/register-loader.js`
- Uses `node:test` (`describe`, `it`) and `node:assert` (strict)
## Platform Requirements
- Node.js (ESM support required, likely 18+)
- npm
- No containerization configuration detected
- Single Node.js process (custom server handles both HTTP and WebSocket)
- File system access required for JSON data storage
- Binds to `0.0.0.0:3000` by default
- No Docker, Vercel, or cloud deployment config present (`.vercel` in `.gitignore` only)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Source files use **kebab-case**: `file-store.js`, `socket-client.js`, `boolean-with-deduction.js`, `table-helpers.js`
- React components use **PascalCase**: `EvalNode.jsx`, `DataTable.jsx`, `CategoryCard.jsx`, `ConflictDialog.jsx`, `SocketProvider.jsx`
- UI primitives from shadcn follow **kebab-case**: `button.jsx`, `card.jsx`, `dropdown-menu.jsx`
- Test files use **kebab-case with suffix**: `scoring-engine.test.js`, `team-scoring.test.js`
- E2E test files use **kebab-case with `.spec.js`**: `team-input.spec.js`, `cohort-creation.spec.js`
- **camelCase** throughout: `calculateCategory()`, `buildTableColumns()`, `handleScoreChange()`, `fetchConfig()`
- Factory functions: `createEmptyCohortConfig()`, `createStudent()`, `createTeam()` -- prefix with `create`
- Event handlers: prefix with `handle` -- `handleAddCategory`, `handleDelete`, `handleCategoryClick`
- Async data fetchers: prefix with `fetch` -- `fetchConfig`, `fetchStudents`, `fetchAll`
- **camelCase** for local variables: `cohortId`, `categoryId`, `activeStudents`
- **SCREAMING_SNAKE_CASE** for constants/enums: `SCORING_METHOD`, `INPUT_FIELD_TYPE`, `COLUMN_TYPE`, `INPUT_SCOPE`
- Korean variable names are used in test files only: `팀평가`, `이차프로젝트`, `rawScores_팀` (for readability in domain-specific tests)
- JSDoc `@typedef` for all data structures (no TypeScript) -- see `src/lib/schema.js`
- Type names use **PascalCase**: `CohortConfig`, `EvaluationCategory`, `Student`, `ScoresData`
## Language
- Code comments use Korean: `/** 기수 목록 조회 */`, `// 학생별 총점 계산`
- API error messages use Korean: `'기수 이름을 입력해 주세요'`, `'같은 이름의 기수가 이미 존재합니다'`
- UI labels use Korean: `'기수 관리'`, `'학생 관리'`, `'평가 항목'`
- Variable names and function names use English
## Code Style
- No Prettier configuration -- formatting is not enforced by tooling
- 2-space indentation (observed throughout codebase)
- Single quotes for strings (consistent across all files)
- Semicolons used (consistent)
- Trailing commas used in multi-line structures
- ESLint 9 with `eslint-config-next/core-web-vitals`
- Config at `eslint.config.mjs`
- Minimal custom rules -- relies on Next.js defaults
- Run with: `npm run lint`
## Module System
- All imports use `import/export` syntax, never `require()`
- File extensions **required** in non-aliased imports: `import * as composite from './methods/composite.js'`
- Path alias `@/` maps to `./src/*` (configured in `jsconfig.json`)
## Import Organization
- `@/` -> `./src/` (configured in `jsconfig.json`, used everywhere)
- shadcn aliases configured in `components.json`:
## Error Handling
- Wrap handler body in `try/catch`
- Return `NextResponse.json({ error: err.message }, { status: 500 })` on error
- Check for `ConflictError` by name: `if (err.name === 'ConflictError')` returns 409
- Validate required fields and return 400 with Korean error messages
- Example pattern from `src/app/api/cohorts/route.js`:
- Use `window.alert()` for user-facing errors (via `alert()`)
- Check `res.ok` before processing response
- No centralized error boundary
- Throw plain `Error` with descriptive message: `throw new Error('Student ${studentId} not found')`
- Custom `ConflictError` class for optimistic locking conflicts in `src/lib/storage/locking.js`
## Logging
- WebSocket events: `console.log(\`[WS] Connected: ${socket.id}\`)`
- No structured logging
- No log levels beyond console methods
## Comments
- File-level block comments with purpose and Korean description at top of files:
- Section dividers with `// ─── 제목 ──────` pattern
- JSDoc `/** ... */` on all exported functions with Korean descriptions
- Inline comments for non-obvious logic (Korean)
- Used for type definitions (`@typedef`) in `src/lib/schema.js`
- Used for function documentation on service and scoring engine functions
- JSDoc `@param` and `@returns` on complex functions like `calculateCategory()`
- Component props documented as JSDoc block comments (see `src/components/eval/DataTable.jsx`)
## Function Design
- Service functions are small and focused (5-20 lines typically)
- Component files can be large (300-500 lines) because they include local sub-components
- Scoring methods are single-function modules with one exported `calculate()` function
- Options pattern with defaults: `function createCategory(name, scoringMethod, maxScore, options = {})`
- Nullish coalescing for defaults: `options.is_bonus ?? false`
- Destructuring config: `const { multiplier = 1, exclude_empty = true } = category.config`
- API services return the saved data object
- Score calculations return `{ raw: *, calculated: number }` per student
- Factory functions return the created object
## Module/Component Design
- Named exports for utility functions and constants
- Default exports for React components and hooks
- Barrel file only for scoring engine: `src/lib/scoring-engine/index.js`
- `'use client'` directive on all client components (Next.js App Router)
- Server components are the default (layout, pages without interactivity)
- Context pattern for shared state: `CohortDataContext` + `useCohortData` hook
- Sub-components defined in the same file (e.g., `SortHeader`, `ScoreInput`, `OverrideInput` inside `DataTable.jsx`)
- React Context (`CohortDataContext`) for cohort-scoped data
- Local `useState` for UI state
- No Redux/Zustand -- state flows through context + fetch
## Data Architecture Conventions
- `import { v4 as uuidv4 } from 'uuid'`
- Every write increments version
- Conflict detection via `writeWithLock()` in `src/lib/storage/locking.js`
- `config.json`, `students.json`, `scores.json` per cohort
- Emit `data-changed` with `{ type, cohortId }` after mutations
- Access Socket.io via `global.__io` in API routes
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- File-based JSON storage (no database), one directory per cohort under `data/cohorts/`
- Custom HTTP server (`server.js`) that boots Next.js + Socket.io together
- Optimistic locking with per-file mutexes for concurrent write safety
- Recursive evaluation tree: categories can nest sub-categories, each computed by a pluggable scoring method
- Real-time sync: API routes broadcast changes via `global.__io` WebSocket, clients re-fetch on event
## Layers
- Purpose: Renders the UI, captures user input, orchestrates fetch calls to API routes
- Location: `src/app/` (pages/layouts) and `src/components/`
- Contains: Pages, layout wrappers, evaluation forms, data tables, settings panels
- Depends on: API routes via `fetch()`, WebSocket via `useSocket()` hook
- Used by: End users in the browser
- Purpose: HTTP endpoints that validate requests, delegate to services, emit WebSocket events
- Location: `src/app/api/cohorts/`
- Contains: Route handler files exporting `GET`, `POST`, `PUT`, `DELETE` functions
- Depends on: Service layer (`src/lib/services/`), Scoring engine (`src/lib/scoring-engine/`)
- Used by: Presentation layer via `fetch()`
- Purpose: Business logic for CRUD operations, orchestrates storage reads/writes with locking
- Location: `src/lib/services/`
- Contains: `cohort-service.js`, `config-service.js`, `score-service.js`, `student-service.js`, `export-service.js`
- Depends on: Storage layer (`src/lib/storage/`), Schema (`src/lib/schema.js`)
- Used by: API layer
- Purpose: Pure computation layer that calculates scores from raw inputs based on category configuration
- Location: `src/lib/scoring-engine/`
- Contains: Main orchestrator (`index.js`) and 8 method modules in `methods/`
- Depends on: Schema constants only; stateless and side-effect free
- Used by: API layer (scores and results routes), imported in both server and client contexts
- Purpose: File I/O abstraction and optimistic locking
- Location: `src/lib/storage/`
- Contains: `file-store.js` (JSON read/write/path helpers), `locking.js` (Mutex + version conflict)
- Depends on: Node.js `fs/promises`, `async-mutex`
- Used by: Service layer exclusively
- Purpose: Data structure definitions, constants, factory functions
- Location: `src/lib/schema.js`
- Contains: TypeDefs (JSDoc), scoring method enums, factory functions for cohorts/students/categories
- Depends on: `uuid`
- Used by: All layers
## Data Flow
- Server state: JSON files on disk under `data/cohorts/{cohortId}/` (config.json, students.json, scores.json)
- Client state: `useCohortData` hook (`src/hooks/useCohortData.js`) holds `config`, `students`, `scores`, `results` in React state
- Context: `CohortDataContext` (`src/hooks/CohortDataContext.js`) distributes cohort data to child components via React Context, provided by `CohortLayout` (`src/app/cohort/[id]/layout.jsx`)
- WebSocket: `SocketProvider` (`src/lib/websocket/SocketProvider.jsx`) wraps the app at root layout level
## Key Abstractions
- Purpose: Defines a scoring category that can contain `input_fields` (leaf data) and `sub_categories` (recursive children)
- Examples: `src/lib/schema.js` (typedef), `src/lib/scoring-engine/index.js` (recursive calculation)
- Pattern: Each category has a `scoring_method` that maps to a calculation module. Composite categories use `final_formula` (expr-eval) to combine sub-category scores.
- Purpose: Pluggable calculation strategies, one per scoring method type
- Examples: `src/lib/scoring-engine/methods/weighted-average.js`, `src/lib/scoring-engine/methods/composite.js`
- Pattern: Each method module exports a `calculate(category, rawScores, students, teams)` function. The main engine dispatches via `METHOD_MAP[category.scoring_method]`.
- Purpose: Single component handling both read-only computed columns and editable input columns
- Examples: `src/components/eval/DataTable.jsx`
- Pattern: Columns array with `type: 'input' | 'computed'` determines rendering. Supports keyboard navigation, clipboard paste (Excel-compatible), sorting, override columns.
- Purpose: Prevents concurrent write conflicts on shared JSON files
- Examples: `src/lib/storage/locking.js`
- Pattern: Every data file has a `version` field. `writeWithLock()` acquires a per-file `Mutex`, checks `expectedVersion === current.version`, increments version on write. On conflict, throws `ConflictError` which API routes return as HTTP 409. Client shows `ConflictDialog` (`src/components/common/ConflictDialog.jsx`).
## Entry Points
- Location: `server.js`
- Triggers: `npm run dev` (via `node --watch server.js`) or `npm start`
- Responsibilities: Creates HTTP server, initializes Next.js, initializes Socket.io, sets `global.__io`, handles WebSocket connections and cohort room management
- Location: `src/app/layout.js`
- Triggers: Every page render (Next.js root layout)
- Responsibilities: Wraps app with `SocketProvider`, `TooltipProvider`, renders `Navbar` and `<main>` slot
- Location: `src/app/page.js`
- Triggers: Navigation to `/`
- Responsibilities: Lists cohorts, create/clone/delete cohort dialogs
- Location: `src/app/cohort/[id]/layout.jsx`
- Triggers: Navigation to `/cohort/{id}/*`
- Responsibilities: Initializes `useCohortData` hook, provides `CohortDataContext`, renders tab navigation and `Sidebar`
- Location: `src/app/cohort/[id]/eval/[[...path]]/page.jsx`
- Triggers: Navigation to `/cohort/{id}/eval/*` (recursive URL path)
- Responsibilities: Delegates to `EvalNode` component with `cohortId` and `path` array, enabling recursive drill-down into nested categories
## Error Handling
- API routes wrap all logic in try/catch, return `{ error: message }` with appropriate HTTP status codes
- `ConflictError` (version mismatch) returns HTTP 409 with `{ error: 'Conflict', current: currentData }`
- Client-side: `ConflictDialog` component offers "Keep mine" (re-fetch + retry) or "Use server version" (discard local)
- Scoring engine errors (e.g., invalid formula in composite) are caught per-student and stored as `{ error: message }` in results
- No global error boundary; errors surface via `alert()` or inline error indicators (`_err_` prefix in cell data)
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
