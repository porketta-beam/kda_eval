# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- JavaScript (ES Modules) - All source code (`.js`, `.jsx`), no TypeScript

**Secondary:**
- CSS (Tailwind CSS v4) - Styling via `src/app/globals.css`, `src/styles/tokens.css`

## Runtime

**Environment:**
- Node.js (no `.nvmrc` or `.node-version` — version not pinned)
- ESM-first: `"type": "module"` in `package.json`

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.6 - App Router with custom HTTP server (`server.js`)
- React 19.2.3 - UI rendering
- Socket.io 4.8.3 - Real-time WebSocket communication (server + client)

**Testing:**
- Playwright 1.58.2 - E2E browser testing, config at `playwright.config.js`
- Node.js native test runner (`node:test`, `node:assert`) - Unit tests run via custom ESM loader

**Build/Dev:**
- Next.js built-in compiler (SWC) - Build and dev bundling
- PostCSS with `@tailwindcss/postcss` v4 plugin - CSS processing (`postcss.config.mjs`)
- ESLint 9 with `eslint-config-next` (core-web-vitals) - Linting (`eslint.config.mjs`)

## Key Dependencies

**Critical:**
- `next` 16.1.6 - Full-stack framework (API routes + SSR/RSC)
- `react` / `react-dom` 19.2.3 - UI layer
- `socket.io` / `socket.io-client` 4.8.3 - Real-time updates between clients
- `expr-eval` 2.0.2 - Safe formula evaluation engine (used in composite scoring, replaces `eval()`)
- `async-mutex` 0.5.0 - File-level mutex for optimistic locking (`src/lib/storage/locking.js`)
- `uuid` 13.0.0 - UUID v4 generation for all entity IDs

**UI:**
- `radix-ui` 1.4.3 - Headless UI primitives (dialog, dropdown, select, tooltip, etc.)
- `shadcn` 4.0.5 - Component scaffolding tool (radix-nova style, JSX not TSX)
- `lucide-react` 0.577.0 - Icon library
- `class-variance-authority` 0.7.1 - Variant-based component styling
- `clsx` 2.1.1 + `tailwind-merge` 3.5.0 - Class name utilities (`src/lib/utils.js`)
- `tw-animate-css` 1.4.0 - Tailwind animation presets

**Infrastructure:**
- `cross-env` 10.1.0 - Cross-platform env variable setting for production start script

## Configuration

**Environment:**
- `.env` files listed in `.gitignore` but not required for core functionality
- Port configured via `process.env.PORT` (default: 3000)
- `NODE_ENV` checked in `server.js` for dev/production mode

**Build:**
- `next.config.mjs` - Minimal (empty config object)
- `jsconfig.json` - Path alias `@/*` maps to `./src/*`
- `components.json` - shadcn/ui configuration (radix-nova style, JSX, not TSX, CSS variables enabled)
- `postcss.config.mjs` - Tailwind CSS v4 PostCSS plugin
- `eslint.config.mjs` - ESLint 9 flat config with Next.js core-web-vitals

**Custom Server:**
- `server.js` - Custom Node.js HTTP server wrapping Next.js + Socket.io
- Dev command: `node --watch server.js` (uses Node.js native watch mode, not `next dev`)
- Production: `cross-env NODE_ENV=production node server.js`

## npm Scripts

```bash
npm run dev          # Development with --watch (custom server)
npm run dev:next     # Next.js dev server only (no WebSocket)
npm run build        # next build
npm run start        # Production server
npm run lint         # ESLint
npm run test:unit    # Unit tests (scoring-engine + team-scoring)
npm run test:e2e     # All Playwright E2E tests
npm run test:scoring # Scoring engine unit tests only
npm run test:team    # Team scoring unit tests only
```

## Data Storage

**Approach:** File-based JSON storage on local filesystem
- Data directory: `data/cohorts/{cohort-uuid}/`
- Three files per cohort: `config.json`, `students.json`, `scores.json`
- No database dependency - all data is read/written via `fs/promises`
- File storage module: `src/lib/storage/file-store.js`
- Optimistic locking with mutex: `src/lib/storage/locking.js`

## Unit Test Infrastructure

**Custom ESM Loader:**
- `tests/register-loader.js` + `tests/loader.js` - Resolves `@/` path aliases for Node.js test runner
- Tests run directly with `node --import ./tests/register-loader.js`
- Uses `node:test` (`describe`, `it`) and `node:assert` (strict)

## Platform Requirements

**Development:**
- Node.js (ESM support required, likely 18+)
- npm
- No containerization configuration detected

**Production:**
- Single Node.js process (custom server handles both HTTP and WebSocket)
- File system access required for JSON data storage
- Binds to `0.0.0.0:3000` by default
- No Docker, Vercel, or cloud deployment config present (`.vercel` in `.gitignore` only)

---

*Stack analysis: 2026-03-24*
