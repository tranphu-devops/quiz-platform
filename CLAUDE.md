# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run everything locally
```bash
cp .env.example .env   # fill in JWT_SECRET and POSTGRES_PASSWORD
docker compose up --build
```
Access at http://localhost (via Nginx on port 80).

With `docker-compose.override.yml` applied automatically, services are also exposed on the host:
- nginx: 80, frontend: 4000, gotrue: 9999, user: 4002, exam: 4003, submission: 4004, postgres: 5432
- Backend `src/` directories are volume-mounted for hot reload (`node --watch`).

### Individual service dev (outside Docker)
```bash
cd apps/<service-name>
npm run dev    # node --watch src/index.js
npm start      # node src/index.js
```

### Frontend dev
```bash
cd apps/frontend
npm run dev      # vite dev (port 5173)
npm run build    # vite build → build/
npm start        # node build (production)
```

### Workspace (pnpm)
The repo uses a pnpm workspace (`pnpm-workspace.yaml`). Top-level `package.json` declares `"workspaces": ["apps/*"]`.

## Architecture

### Overview
Microservices monorepo. All services share a single PostgreSQL 16 instance but use **separate schemas** (`quiz_auth`, `quiz_users`, `quiz_exams`, `quiz_submissions`). Nginx is the single ingress.

```
Browser → Nginx :80
  /auth/            → gotrue:9999          (GoTrue SSO engine)
  /api/users/       → user-service:3002
  /api/exams/       → exam-service:3003    (Nginx blocks /api/exams/exams/internal/)
  /api/submissions/ → submission-service:3004
  /                 → frontend:3000
```

Internal service-to-service calls use Docker network names directly (e.g., `http://exam-service:3003`), never going through Nginx.

### Auth flow — GoTrue + local JWT verification
**GoTrue** (`supabase/gotrue:v2.151.0`) handles all auth: signup, login, Google OAuth, JWT issuance.

JWT claims issued by GoTrue:
- `sub` — user UUID (this is `req.user.id` in backend)
- `email` — user email
- `user_metadata.role` — app role: `student` | `teacher` | `admin` (set at signup via `data.role`)
- `role` — always `"authenticated"` (GoTrue internal, NOT our app role)

Each backend service **verifies JWT locally** using `JWT_SECRET` (no GoTrue call needed). `src/middleware/auth.js` decodes the token and sets:
```javascript
req.user = { id: payload.sub, email: payload.email, role: payload.user_metadata?.role ?? 'student' }
req.ability = defineAbilityFor(req.user)   // CASL ability instance
```

### Authorization — CASL
Each service has `src/lib/ability.js` with `defineAbilityFor(user)`. Uses `@casl/ability` with `createMongoAbility`. Role rules:
- `admin` — full access
- `teacher` — CRUD own exams (`created_by === user.id`), read all submissions
- `student` — read published exams, create/read own submissions

In routes, use `req.ability.cannot('action', subject('Type', object))` to gate access.

### Backend services (Fastify + Node.js 24)
All three backend services (`user-service`, `exam-service`, `submission-service`) follow the same structure:
```
src/
  index.js          # Fastify app setup, /health, plugin registration
  db.js             # pg Pool; sets search_path on every new connection
  lib/
    ability.js      # CASL defineAbilityFor(user)
  middleware/
    auth.js         # verifyAuth() — local JWT verify + sets req.user and req.ability
  routes/
    *.js            # Fastify route plugins
```
`db.js` reads `search_path` from the `DATABASE_URL` query param and applies it via a `pool.on('connect')` hook.

Error format: `{ error: string, statusCode: number }`.
Health check: `GET /health` → `{ status: "ok", service: "...", timestamp: "..." }`.

### Frontend (SvelteKit 5 + Node adapter, SSR disabled)
`+layout.js` exports `export const ssr = false` — fully client-rendered SPA. Auth state comes from `@supabase/auth-js` GoTrueClient (auto-persists in localStorage).

Key files:
- `src/lib/auth.js` — GoTrueClient instance; URL defaults to `window.location.origin + '/auth'`
- `src/lib/stores/auth.js` — `session`, `user` (derived), `token` (derived) Svelte stores; syncs via `auth.onAuthStateChange`
- `src/lib/api.js` — `examApi` and `submissionApi` fetch helpers; reads `token` store for Bearer header

Key routes:
```
/                        → redirect to /dashboard or /login
/login                   → signInWithPassword + Google OAuth button
/register                → signUp with role in user_metadata
/auth/callback           → OAuth redirect handler (exchangeCodeForSession)
/dashboard               → role-based home
/exams                   → list (student view / teacher management)
/exams/create            → create exam (teacher/admin)
/exams/[id]              → exam detail / start
/exams/[id]/take         → take exam
/exams/[id]/edit         → edit exam
/exams/[id]/result       → results after submission
```

### Database schemas
`infra/postgres/init.sql` creates all schemas and tables at container startup (idempotent). `quiz_auth` schema is created for GoTrue — GoTrue manages its own table migrations there. Never manually create tables in `quiz_auth`.

### CI/CD
GitHub Actions (`.github/workflows/build-push.yml`) builds multi-platform (amd64 + arm64) Docker images to GHCR on push to `main`. Matrix strategy over 4 services: `user-service`, `exam-service`, `submission-service`, `frontend`.

## Conventions

- **Package manager:** npm inside each service (not pnpm — Dockerfiles use `npm install`). pnpm is only for the workspace tooling.
- **JWT verification:** Always verify locally with `JWT_SECRET`. Extract role from `payload.user_metadata.role`, NOT from `payload.role` (that's GoTrue internal).
- **DB search_path:** Always set via `?search_path=<schema>` in `DATABASE_URL`; `db.js` handles the rest.
- **Roles:** `admin`, `teacher`, `student` — set at GoTrue signup in `user_metadata.role`, embedded in JWT.
- **Exam visibility:** Strip `correct_answer` from question objects when responding to students.
- **Internal endpoints:** `exam-service` exposes `GET /exams/internal/:id` (requires `x-internal-key` header) for `submission-service` to fetch answers. Nginx blocks `/api/exams/exams/internal/*` from external access.
- **CASL subject matching:** Use `import { subject } from '@casl/ability'` and `subject('Type', plainObject)` for condition-based checks.
