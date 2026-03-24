# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Layered Monolith with Next.js App Router

This is a full-stack Next.js 16 application using the App Router pattern. A custom Node.js server wraps Next.js to add Socket.io WebSocket support for real-time multi-user collaboration. All data is persisted to the local filesystem as JSON files -- there is no database.

**Key Characteristics:**
- File-based JSON storage (no database), one directory per cohort under `data/cohorts/`
- Custom HTTP server (`server.js`) that boots Next.js + Socket.io together
- Optimistic locking with per-file mutexes for concurrent write safety
- Recursive evaluation tree: categories can nest sub-categories, each computed by a pluggable scoring method
- Real-time sync: API routes broadcast changes via `global.__io` WebSocket, clients re-fetch on event

## Layers

**Presentation Layer (React Client Components):**
- Purpose: Renders the UI, captures user input, orchestrates fetch calls to API routes
- Location: `src/app/` (pages/layouts) and `src/components/`
- Contains: Pages, layout wrappers, evaluation forms, data tables, settings panels
- Depends on: API routes via `fetch()`, WebSocket via `useSocket()` hook
- Used by: End users in the browser

**API Layer (Next.js App Router Route Handlers):**
- Purpose: HTTP endpoints that validate requests, delegate to services, emit WebSocket events
- Location: `src/app/api/cohorts/`
- Contains: Route handler files exporting `GET`, `POST`, `PUT`, `DELETE` functions
- Depends on: Service layer (`src/lib/services/`), Scoring engine (`src/lib/scoring-engine/`)
- Used by: Presentation layer via `fetch()`

**Service Layer:**
- Purpose: Business logic for CRUD operations, orchestrates storage reads/writes with locking
- Location: `src/lib/services/`
- Contains: `cohort-service.js`, `config-service.js`, `score-service.js`, `student-service.js`, `export-service.js`
- Depends on: Storage layer (`src/lib/storage/`), Schema (`src/lib/schema.js`)
- Used by: API layer

**Scoring Engine:**
- Purpose: Pure computation layer that calculates scores from raw inputs based on category configuration
- Location: `src/lib/scoring-engine/`
- Contains: Main orchestrator (`index.js`) and 8 method modules in `methods/`
- Depends on: Schema constants only; stateless and side-effect free
- Used by: API layer (scores and results routes), imported in both server and client contexts

**Storage Layer:**
- Purpose: File I/O abstraction and optimistic locking
- Location: `src/lib/storage/`
- Contains: `file-store.js` (JSON read/write/path helpers), `locking.js` (Mutex + version conflict)
- Depends on: Node.js `fs/promises`, `async-mutex`
- Used by: Service layer exclusively

**Schema Layer:**
- Purpose: Data structure definitions, constants, factory functions
- Location: `src/lib/schema.js`
- Contains: TypeDefs (JSDoc), scoring method enums, factory functions for cohorts/students/categories
- Depends on: `uuid`
- Used by: All layers

## Data Flow

**Score Entry Flow:**

1. User types a value in `DataTable` -> `ScoreInput` component (`src/components/eval/DataTable.jsx`)
2. `onBlur` fires, `EvalNode` calls `handleScoreChange()` (`src/components/eval/EvalNode.jsx`)
3. `saveToScores()` sends `PUT /api/cohorts/{id}/scores/{categoryId}` with `{ scores, expectedVersion }`
4. API route handler (`src/app/api/cohorts/[id]/scores/[categoryId]/route.js`) calls `bulkUpdateScores()` in `score-service.js`
5. `score-service.js` calls `writeWithLock()` which acquires a per-file mutex, checks version, writes JSON
6. API route emits `data-changed` event via `global.__io.to('cohort:{id}')`
7. All connected clients receive the event via `useCohortData` hook, which re-fetches scores and results

**Results Calculation Flow:**

1. Client requests `GET /api/cohorts/{id}/results`
2. API route (`src/app/api/cohorts/[id]/results/route.js`) loads config, students, and scores in parallel
3. Calls `calculateTotals()` from scoring engine (`src/lib/scoring-engine/index.js`)
4. `calculateTotals()` iterates all categories, calling `calculateCategory()` for each
5. `calculateCategory()` dispatches to the appropriate method module (e.g., `weighted-average.js`)
6. For composite categories, recursively calculates sub-categories first, then evaluates `final_formula` via `expr-eval`
7. Totals are summed across categories with bonus cap, then ranks are assigned
8. Response includes `{ config, students, scores, results: { categoryResults, totals } }`

**State Management:**
- Server state: JSON files on disk under `data/cohorts/{cohortId}/` (config.json, students.json, scores.json)
- Client state: `useCohortData` hook (`src/hooks/useCohortData.js`) holds `config`, `students`, `scores`, `results` in React state
- Context: `CohortDataContext` (`src/hooks/CohortDataContext.js`) distributes cohort data to child components via React Context, provided by `CohortLayout` (`src/app/cohort/[id]/layout.jsx`)
- WebSocket: `SocketProvider` (`src/lib/websocket/SocketProvider.jsx`) wraps the app at root layout level

## Key Abstractions

**EvaluationCategory (Recursive Tree Node):**
- Purpose: Defines a scoring category that can contain `input_fields` (leaf data) and `sub_categories` (recursive children)
- Examples: `src/lib/schema.js` (typedef), `src/lib/scoring-engine/index.js` (recursive calculation)
- Pattern: Each category has a `scoring_method` that maps to a calculation module. Composite categories use `final_formula` (expr-eval) to combine sub-category scores.

**Scoring Method (Strategy Pattern):**
- Purpose: Pluggable calculation strategies, one per scoring method type
- Examples: `src/lib/scoring-engine/methods/weighted-average.js`, `src/lib/scoring-engine/methods/composite.js`
- Pattern: Each method module exports a `calculate(category, rawScores, students, teams)` function. The main engine dispatches via `METHOD_MAP[category.scoring_method]`.

**DataTable (Unified Input/Display Table):**
- Purpose: Single component handling both read-only computed columns and editable input columns
- Examples: `src/components/eval/DataTable.jsx`
- Pattern: Columns array with `type: 'input' | 'computed'` determines rendering. Supports keyboard navigation, clipboard paste (Excel-compatible), sorting, override columns.

**Optimistic Locking:**
- Purpose: Prevents concurrent write conflicts on shared JSON files
- Examples: `src/lib/storage/locking.js`
- Pattern: Every data file has a `version` field. `writeWithLock()` acquires a per-file `Mutex`, checks `expectedVersion === current.version`, increments version on write. On conflict, throws `ConflictError` which API routes return as HTTP 409. Client shows `ConflictDialog` (`src/components/common/ConflictDialog.jsx`).

## Entry Points

**Custom Server (`server.js`):**
- Location: `server.js`
- Triggers: `npm run dev` (via `node --watch server.js`) or `npm start`
- Responsibilities: Creates HTTP server, initializes Next.js, initializes Socket.io, sets `global.__io`, handles WebSocket connections and cohort room management

**Root Layout (`src/app/layout.js`):**
- Location: `src/app/layout.js`
- Triggers: Every page render (Next.js root layout)
- Responsibilities: Wraps app with `SocketProvider`, `TooltipProvider`, renders `Navbar` and `<main>` slot

**Home Page (`src/app/page.js`):**
- Location: `src/app/page.js`
- Triggers: Navigation to `/`
- Responsibilities: Lists cohorts, create/clone/delete cohort dialogs

**Cohort Layout (`src/app/cohort/[id]/layout.jsx`):**
- Location: `src/app/cohort/[id]/layout.jsx`
- Triggers: Navigation to `/cohort/{id}/*`
- Responsibilities: Initializes `useCohortData` hook, provides `CohortDataContext`, renders tab navigation and `Sidebar`

**Eval Catch-All Page (`src/app/cohort/[id]/eval/[[...path]]/page.jsx`):**
- Location: `src/app/cohort/[id]/eval/[[...path]]/page.jsx`
- Triggers: Navigation to `/cohort/{id}/eval/*` (recursive URL path)
- Responsibilities: Delegates to `EvalNode` component with `cohortId` and `path` array, enabling recursive drill-down into nested categories

## Error Handling

**Strategy:** Optimistic with conflict resolution dialog

**Patterns:**
- API routes wrap all logic in try/catch, return `{ error: message }` with appropriate HTTP status codes
- `ConflictError` (version mismatch) returns HTTP 409 with `{ error: 'Conflict', current: currentData }`
- Client-side: `ConflictDialog` component offers "Keep mine" (re-fetch + retry) or "Use server version" (discard local)
- Scoring engine errors (e.g., invalid formula in composite) are caught per-student and stored as `{ error: message }` in results
- No global error boundary; errors surface via `alert()` or inline error indicators (`_err_` prefix in cell data)

## Cross-Cutting Concerns

**Logging:** `console.log` only, primarily in `server.js` for WebSocket connect/disconnect events. No structured logging framework.

**Validation:** Minimal -- API routes check for required fields (`name`, `scoring_method`), cohort name uniqueness. No schema validation library (e.g., Zod). Input ranges (`min`/`max`) are enforced only via HTML `<input>` attributes on the client.

**Authentication:** None. The application has no auth layer. All endpoints are publicly accessible on the network.

**Real-time Sync:** WebSocket via Socket.io. `server.js` manages rooms per cohort (`cohort:{id}`). API routes emit `data-changed` events after successful writes. Client `useCohortData` hook listens and re-fetches the affected data type.

**Internationalization:** Korean-only. All UI labels, error messages, and export headers are hardcoded in Korean.

---

*Architecture analysis: 2026-03-24*
