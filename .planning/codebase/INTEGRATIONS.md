# External Integrations

**Analysis Date:** 2026-03-24

## Overview

KDA Eval is a self-contained application with minimal external integrations. It uses no external databases, no third-party APIs, no authentication providers, and no cloud services. All data is stored locally on the filesystem. The only "integration" is the internal WebSocket layer for real-time client synchronization.

## APIs & External Services

**None detected.** The application does not call any external APIs, SaaS services, or third-party endpoints. All API routes are internal (Next.js App Router API routes consumed by the frontend).

## Internal API Routes

All routes are under `src/app/api/` using Next.js App Router conventions:

**Cohort Management:**
- `GET/POST /api/cohorts` - List and create cohorts (`src/app/api/cohorts/route.js`)
- `GET/DELETE /api/cohorts/[id]` - Get and delete a cohort (`src/app/api/cohorts/[id]/route.js`)
- `POST /api/cohorts/[id]/clone` - Clone a cohort (`src/app/api/cohorts/[id]/clone/route.js`)

**Configuration:**
- `GET/PUT /api/cohorts/[id]/config` - Get and update cohort config (`src/app/api/cohorts/[id]/config/route.js`)
- `GET/POST /api/cohorts/[id]/config/categories` - List and add categories (`src/app/api/cohorts/[id]/config/categories/route.js`)
- `PUT/DELETE /api/cohorts/[id]/config/categories/[categoryId]` - Update and delete category (`src/app/api/cohorts/[id]/config/categories/[categoryId]/route.js`)

**Students:**
- `GET/POST /api/cohorts/[id]/students` - List and add students (`src/app/api/cohorts/[id]/students/route.js`)
- `PUT/DELETE /api/cohorts/[id]/students/[studentId]` - Update and delete student (`src/app/api/cohorts/[id]/students/[studentId]/route.js`)

**Scores & Results:**
- `GET /api/cohorts/[id]/scores` - Get scores (with optional `?calculated=true`) (`src/app/api/cohorts/[id]/scores/route.js`)
- `PUT /api/cohorts/[id]/scores/[categoryId]` - Bulk update scores for a category (`src/app/api/cohorts/[id]/scores/[categoryId]/route.js`)
- `GET /api/cohorts/[id]/results` - Get totals and rankings (with optional `?mode=projected`) (`src/app/api/cohorts/[id]/results/route.js`)

**Export:**
- `GET /api/cohorts/[id]/export` - CSV export (with `?type=summary|detail`) (`src/app/api/cohorts/[id]/export/route.js`)

## Data Storage

**Databases:**
- None. No SQL or NoSQL database is used.

**File Storage:**
- Local filesystem JSON files
- Base path: `data/cohorts/{cohort-uuid}/`
- Files per cohort:
  - `config.json` - Evaluation structure, categories, teams, settings
  - `students.json` - Student roster with version tracking
  - `scores.json` - Raw score inputs and overrides with version tracking
- Storage abstraction: `src/lib/storage/file-store.js`
- Concurrency control: `src/lib/storage/locking.js` (Mutex + optimistic versioning)

**Caching:**
- None. All reads go directly to filesystem.

## WebSocket (Real-Time Sync)

**Implementation:**
- Server: Socket.io server instantiated in `server.js`, attached to the HTTP server
- Client: Socket.io client via `src/lib/websocket/socket-client.js`
- Provider: React context provider `src/lib/websocket/SocketProvider.jsx`
- Data hook: `src/hooks/useCohortData.js` listens for `data-changed` events and re-fetches

**Socket.io Events:**

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `join-cohort` | Client -> Server | `cohortId` | Join a room for cohort-scoped updates |
| `leave-cohort` | Client -> Server | `cohortId` | Leave the cohort room |
| `data-changed` | Server -> Client | `{ type, cohortId, categoryId? }` | Notify clients of data mutations |

**Broadcasting pattern:**
- API routes access Socket.io via `global.__io` (set in `server.js`)
- After a write operation, the API route emits `data-changed` to the cohort room
- Example from `src/app/api/cohorts/[id]/scores/[categoryId]/route.js`:
  ```js
  global.__io?.to(`cohort:${id}`).emit('data-changed', {
    type: 'scores',
    cohortId: id,
    categoryId,
  });
  ```
- Client-side `useCohortData` hook re-fetches the relevant data type on receiving the event

**Rooms:**
- Pattern: `cohort:{cohortId}`
- Each cohort page joins its room on mount, leaves on unmount

## Authentication & Identity

**Auth Provider:**
- None. No authentication or authorization is implemented.
- All API endpoints are publicly accessible.
- No user sessions, tokens, or access control.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Datadog, or similar service.

**Logs:**
- `console.log` only, in `server.js` for WebSocket connection/disconnection events
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- No deployment configuration detected
- `.vercel` directory in `.gitignore` suggests Vercel was considered but no `vercel.json` exists
- Custom server (`server.js`) is incompatible with Vercel serverless deployment

**CI Pipeline:**
- No CI/CD configuration detected (no `.github/workflows/`, no `Jenkinsfile`, no `gitlab-ci.yml`)

## Environment Configuration

**Required env vars:**
- `PORT` (optional, defaults to 3000)
- `NODE_ENV` (set to `production` for production mode)

**No secrets required.** The application has no API keys, database credentials, or third-party service tokens.

## Font Resources

**Google Fonts (via `next/font/google`):**
- Geist (sans-serif) - `src/app/layout.js`
- Geist Mono (monospace) - `src/app/layout.js`
- Loaded at build time via Next.js font optimization (no runtime external requests)

## Formula Evaluation

**expr-eval library:**
- Used in `src/lib/scoring-engine/methods/composite.js`
- Provides safe mathematical expression evaluation (replacement for `eval()`)
- Supports user-defined formulas for composite scoring categories
- Handles Korean variable names by mapping to safe ASCII identifiers (`_cat0`, `_cat1`, etc.)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integration audit: 2026-03-24*
