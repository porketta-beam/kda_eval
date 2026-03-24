# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
kda_eval/
├── server.js                    # Custom Node.js server (Next.js + Socket.io)
├── package.json                 # Dependencies and scripts
├── next.config.mjs              # Next.js config (minimal)
├── jsconfig.json                # Path alias: @/* -> ./src/*
├── eslint.config.mjs            # ESLint config
├── postcss.config.mjs           # PostCSS (Tailwind)
├── components.json              # shadcn/ui config
├── playwright.config.js         # Playwright E2E config
├── data/                        # Runtime data (JSON files, not committed to git)
│   └── cohorts/                 # One subdirectory per cohort (UUID-named)
│       └── {cohortId}/
│           ├── config.json      # Cohort settings, teams, evaluation categories
│           ├── students.json    # Student list with metadata
│           └── scores.json      # Raw scores and overrides
├── src/
│   ├── app/                     # Next.js App Router (pages + API routes)
│   │   ├── layout.js            # Root layout (SocketProvider, Navbar)
│   │   ├── page.js              # Home page (cohort list)
│   │   ├── globals.css          # Global styles (Tailwind base)
│   │   ├── favicon.ico
│   │   ├── api/                 # API route handlers
│   │   │   └── cohorts/         # REST endpoints for cohort management
│   │   │       ├── route.js                         # GET list, POST create
│   │   │       └── [id]/
│   │   │           ├── route.js                     # GET detail, DELETE
│   │   │           ├── clone/route.js               # POST clone
│   │   │           ├── config/
│   │   │           │   ├── route.js                 # GET/PUT config
│   │   │           │   └── categories/
│   │   │           │       ├── route.js             # POST add category
│   │   │           │       └── [categoryId]/route.js # PUT/DELETE category
│   │   │           ├── students/
│   │   │           │   ├── route.js                 # GET/POST students
│   │   │           │   └── [studentId]/route.js     # PUT/DELETE student
│   │   │           ├── scores/
│   │   │           │   ├── route.js                 # GET scores
│   │   │           │   └── [categoryId]/route.js    # PUT bulk scores
│   │   │           ├── results/route.js             # GET results/totals
│   │   │           └── export/route.js              # GET CSV export
│   │   └── cohort/
│   │       └── [id]/
│   │           ├── layout.jsx                       # Cohort layout (context, tabs, sidebar)
│   │           ├── page.jsx                         # Dashboard (summary table + category management)
│   │           ├── students/page.jsx                # Student management page
│   │           └── eval/
│   │               └── [[...path]]/page.jsx         # Recursive eval page (catch-all)
│   ├── components/
│   │   ├── common/
│   │   │   └── ConflictDialog.jsx          # Version conflict resolution dialog
│   │   ├── eval/
│   │   │   ├── CategoryCard.jsx            # Category list item with progress
│   │   │   ├── DataTable.jsx               # Unified data table (input + computed)
│   │   │   ├── EvalNode.jsx                # Main evaluation view (recursive)
│   │   │   ├── FieldManager.jsx            # Input field / sub-category CRUD
│   │   │   └── InlineSettings.jsx          # Category settings panel
│   │   ├── layout/
│   │   │   ├── Navbar.jsx                  # Top nav with cohort selector + export
│   │   │   ├── Sidebar.jsx                 # Right sidebar with totals + ranking
│   │   │   └── SlidePanel.jsx              # Sheet-based detail view (legacy, still present)
│   │   └── ui/                             # shadcn/ui primitives (auto-generated)
│   │       ├── badge.jsx
│   │       ├── breadcrumb.jsx
│   │       ├── button.jsx
│   │       ├── card.jsx
│   │       ├── checkbox.jsx
│   │       ├── collapsible.jsx
│   │       ├── dialog.jsx
│   │       ├── dropdown-menu.jsx
│   │       ├── input.jsx
│   │       ├── label.jsx
│   │       ├── select.jsx
│   │       ├── separator.jsx
│   │       ├── sheet.jsx
│   │       ├── switch.jsx
│   │       ├── table.jsx
│   │       └── tooltip.jsx
│   ├── hooks/
│   │   ├── CohortDataContext.js            # React context definition
│   │   └── useCohortData.js               # Data fetching + WebSocket hook
│   ├── lib/
│   │   ├── schema.js                       # Data types, constants, factory functions
│   │   ├── utils.js                        # Tailwind merge utility (cn)
│   │   ├── table-helpers.js                # Column/cell data builders for DataTable
│   │   ├── scoring-engine/
│   │   │   ├── index.js                    # Main engine (calculateCategory, calculateTotals)
│   │   │   └── methods/
│   │   │       ├── boolean.js              # Boolean scoring
│   │   │       ├── boolean-with-deduction.js # Boolean with deduction rules
│   │   │       ├── composite.js            # Composite (recursive + formula)
│   │   │       ├── formula.js              # Formula-based (attendance deduction)
│   │   │       ├── rank-differential.js    # Rank-based differential scoring
│   │   │       ├── sum-divide.js           # Sum and divide
│   │   │       ├── user-input.js           # Direct user input
│   │   │       └── weighted-average.js     # Weighted average
│   │   ├── services/
│   │   │   ├── cohort-service.js           # Cohort CRUD + clone
│   │   │   ├── config-service.js           # Category CRUD + reorder
│   │   │   ├── export-service.js           # CSV export (summary + detail)
│   │   │   ├── score-service.js            # Score read/write/bulk update
│   │   │   └── student-service.js          # Student CRUD + dropout toggle
│   │   ├── storage/
│   │   │   ├── file-store.js               # JSON file I/O + path helpers
│   │   │   └── locking.js                  # Mutex + optimistic locking
│   │   └── websocket/
│   │       ├── SocketProvider.jsx           # React context provider for Socket.io
│   │       └── socket-client.js            # Singleton socket.io-client instance
│   └── styles/
│       └── tokens.css                      # Design tokens (colors, shadows)
├── tests/
│   ├── scoring-engine.test.js              # Unit tests for scoring engine
│   ├── team-scoring.test.js                # Unit tests for team scoring
│   ├── loader.js                           # Custom ESM loader for @ alias
│   ├── register-loader.js                  # Loader registration
│   └── e2e/
│       ├── cell-display.spec.js            # E2E: cell display behavior
│       ├── cohort-creation.spec.js         # E2E: cohort creation flow
│       ├── composite-creation-flow.spec.js # E2E: composite category creation
│       ├── composite-formula.spec.js       # E2E: composite formula evaluation
│       ├── empty-state.spec.js             # E2E: empty state handling
│       ├── kda-workflow.spec.js            # E2E: full workflow
│       ├── recursive-nav.spec.js           # E2E: recursive navigation
│       ├── team-input.spec.js              # E2E: team input mode
│       └── team-score-input.spec.js        # E2E: team score input
├── claudedocs/                             # Project documentation and analysis
├── .planning/                              # GSD planning artifacts
└── public/                                 # Static assets
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components (`.js`/`.jsx`), route handlers, layouts
- Key files: `layout.js` (root), `page.js` (home), `cohort/[id]/layout.jsx` (cohort context provider)

**`src/app/api/cohorts/`:**
- Purpose: RESTful API endpoints for all server-side operations
- Contains: Route handler files with `GET`/`POST`/`PUT`/`DELETE` exports
- Key files: Each `route.js` file represents one endpoint

**`src/components/eval/`:**
- Purpose: Core evaluation UI components
- Contains: The main data table, evaluation node, category management, settings panels
- Key files: `EvalNode.jsx` (main recursive view), `DataTable.jsx` (unified table component)

**`src/components/layout/`:**
- Purpose: App-level layout components
- Contains: Navbar, Sidebar, SlidePanel
- Key files: `Navbar.jsx` (global nav), `Sidebar.jsx` (ranking sidebar)

**`src/components/ui/`:**
- Purpose: shadcn/ui primitives (auto-generated, do not edit manually)
- Contains: Reusable UI components (Button, Dialog, Input, Select, Table, etc.)
- Key files: All files are auto-generated by `npx shadcn add`

**`src/lib/scoring-engine/`:**
- Purpose: Pure computation engine for all scoring methods
- Contains: Main orchestrator and 8 pluggable method modules
- Key files: `index.js` (entry point with `calculateCategory`, `calculateTotals`, `calculateProjectedScores`)

**`src/lib/services/`:**
- Purpose: Business logic layer between API routes and storage
- Contains: Service modules for each domain entity
- Key files: `score-service.js` (most frequently called), `config-service.js` (category management)

**`src/lib/storage/`:**
- Purpose: File-system persistence and concurrency control
- Contains: JSON read/write helpers, path builders, mutex locking
- Key files: `file-store.js` (all file operations), `locking.js` (optimistic locking)

**`src/hooks/`:**
- Purpose: React hooks for data management
- Contains: Cohort data fetching hook and context definition
- Key files: `useCohortData.js` (main data hook), `CohortDataContext.js` (context)

**`data/cohorts/`:**
- Purpose: Runtime data storage (one directory per cohort)
- Contains: JSON files (config.json, students.json, scores.json)
- Generated: Yes (at runtime)
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**
- `server.js`: Custom Node.js server (Next.js + Socket.io)
- `src/app/layout.js`: React root layout
- `src/app/page.js`: Home page (cohort list)

**Configuration:**
- `package.json`: Dependencies and npm scripts
- `jsconfig.json`: Path alias (`@/*` -> `./src/*`)
- `next.config.mjs`: Next.js configuration
- `components.json`: shadcn/ui component config
- `playwright.config.js`: E2E test configuration
- `src/styles/tokens.css`: Design tokens (CSS custom properties)

**Core Logic:**
- `src/lib/schema.js`: All data types, enums, and factory functions
- `src/lib/scoring-engine/index.js`: Main scoring computation
- `src/lib/storage/file-store.js`: All file I/O operations
- `src/lib/storage/locking.js`: Optimistic locking implementation
- `src/lib/table-helpers.js`: DataTable column/cell data builders

**Core Components:**
- `src/components/eval/EvalNode.jsx`: Main evaluation page component (recursive)
- `src/components/eval/DataTable.jsx`: Unified data table (input + display)
- `src/app/cohort/[id]/layout.jsx`: Cohort-level data provider
- `src/app/cohort/[id]/page.jsx`: Cohort dashboard

**Testing:**
- `tests/scoring-engine.test.js`: Scoring engine unit tests
- `tests/team-scoring.test.js`: Team scoring unit tests
- `tests/e2e/*.spec.js`: Playwright E2E tests

## Naming Conventions

**Files:**
- Pages/layouts: `page.js`, `page.jsx`, `layout.js`, `layout.jsx` (Next.js convention)
- API routes: `route.js` (Next.js convention)
- Components: `PascalCase.jsx` (e.g., `DataTable.jsx`, `EvalNode.jsx`)
- Libs/services: `kebab-case.js` (e.g., `file-store.js`, `score-service.js`)
- Scoring methods: `kebab-case.js` matching the scoring method name (e.g., `weighted-average.js`)
- Hooks: `camelCase.js` with `use` prefix (e.g., `useCohortData.js`)

**Directories:**
- `kebab-case` for all directories (e.g., `scoring-engine`, `file-store`)
- Next.js dynamic segments: `[param]` or `[[...param]]` for catch-all

## Where to Add New Code

**New Scoring Method:**
- Create: `src/lib/scoring-engine/methods/{method-name}.js` -- export a `calculate(category, rawScores, students, teams)` function
- Register: Add to `METHOD_MAP` in `src/lib/scoring-engine/index.js`
- Add enum: Add to `SCORING_METHOD` and `METHOD_LABELS` in `src/lib/schema.js`
- Add settings UI: Add a case to `MethodConfig` in `src/components/eval/InlineSettings.jsx`
- Tests: Add test cases to `tests/scoring-engine.test.js`

**New API Endpoint:**
- Create: `src/app/api/cohorts/[id]/{resource}/route.js`
- Export: Named functions for HTTP methods (`GET`, `POST`, `PUT`, `DELETE`)
- Pattern: Use service layer for logic, emit WebSocket events via `global.__io`

**New Page:**
- Create: `src/app/{route}/page.jsx` (or `page.js`)
- Access cohort data: Use `useCohortDataContext()` hook (must be within `CohortLayout`)

**New Component:**
- Domain component: `src/components/{domain}/{ComponentName}.jsx`
- UI primitive: Run `npx shadcn add {component}` (auto-generates to `src/components/ui/`)
- Shared/common: `src/components/common/{ComponentName}.jsx`

**New Service:**
- Create: `src/lib/services/{entity}-service.js`
- Import storage: Use `src/lib/storage/file-store.js` for I/O, `locking.js` for writes
- Import schema: Use factory functions from `src/lib/schema.js`

**New Hook:**
- Create: `src/hooks/{hookName}.js`
- Convention: Export default function with `use` prefix

**New Data File per Cohort:**
- Add path helper: Add `get{Resource}Path()` to `src/lib/storage/file-store.js`
- Add factory: Add `createEmpty{Resource}Data()` to `src/lib/schema.js`
- Initialize: Add to `createCohort()` in `src/lib/services/cohort-service.js`

## Special Directories

**`data/`:**
- Purpose: Runtime JSON data storage
- Generated: Yes (created at runtime by the application)
- Committed: No (excluded via `.gitignore`)

**`.next/`:**
- Purpose: Next.js build output and dev cache
- Generated: Yes (by Next.js)
- Committed: No

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No

**`test-results/`:**
- Purpose: Playwright test output artifacts
- Generated: Yes (by Playwright)
- Committed: No

**`.planning/`:**
- Purpose: GSD planning documents
- Generated: Yes (by GSD mapping/planning)
- Committed: Varies

**`claudedocs/`:**
- Purpose: Project analysis documents and implementation plans
- Generated: Manually created
- Committed: Yes

**`.phase_state/`:**
- Purpose: Phase execution state tracking
- Generated: Yes (by GSD execution)
- Committed: Varies

---

*Structure analysis: 2026-03-24*
