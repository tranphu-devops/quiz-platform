# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run everything locally
```bash
cp .env.example .env   # fill in required values (see Environment Variables below)
docker compose up --build
```
Access at http://localhost (via Nginx on port 80).

`docker-compose.override.yml` is applied automatically in dev — it volume-mounts each service's `src/` for hot reload (`node --watch`) and exposes ports directly:
- nginx: 80, frontend: 4000, gotrue: 9999, user: 4002, exam: 4003, submission: 4004, postgres: 5432

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

### Migrate an existing running database
```bash
docker compose exec postgres psql -U postgres -d quizdb -f /dev/stdin < infra/postgres/migrate_image_upload.sql
```

### Workspace (pnpm)
The repo uses a pnpm workspace (`pnpm-workspace.yaml`). Top-level `package.json` declares `"workspaces": ["apps/*"]`. Use npm inside each service for Dockerfiles.

## Environment Variables

Required in `.env` (see `.env.example`):
```
POSTGRES_PASSWORD=
JWT_SECRET=                   # min 32 chars; shared by GoTrue and all backend services
INTERNAL_API_KEY=             # min 32 chars; submission-service → exam-service
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_ENABLED=true

# AWS / Lightsail Object Storage (for image uploads)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET=
AWS_REGION=ap-southeast-1
AWS_ENDPOINT=                 # optional; set for non-standard S3-compatible endpoints
AWS_PUBLIC_URL=               # public base URL of the bucket, e.g. https://bucket.s3.region.amazonaws.com
```

## Architecture

### Overview
Microservices monorepo. All services share a single PostgreSQL 16 instance with **separate schemas per service**. Nginx is the single ingress.

```
Browser → Nginx :80
  /auth/            → gotrue:9999           (GoTrue SSO engine)
  /api/users/       → user-service:3002
  /api/exams/       → exam-service:3003     (Nginx blocks /api/exams/exams/internal/)
  /api/submissions/ → submission-service:3004
  /                 → frontend:3000
```

Internal service-to-service calls use Docker network hostnames directly (e.g., `http://exam-service:3003`), never going through Nginx.

### Auth flow — GoTrue + local JWT verification
**GoTrue** (`supabase/gotrue:v2.151.0`) handles signup, login, Google OAuth, and JWT issuance.

JWT claims:
- `sub` → `req.user.id` (user UUID)
- `email` → `req.user.email`
- `user_metadata.role` → `req.user.role` (`student` | `teacher` | `admin`)
- `role` → always `"authenticated"` — **this is GoTrue-internal, NOT our app role**

Each backend verifies JWT locally via `JWT_SECRET` in `src/middleware/auth.js`, which sets `req.user` and `req.ability`.

### Authorization — CASL
Each service has `src/lib/ability.js` with `defineAbilityFor(user)` using `@casl/ability` / `createMongoAbility`.

Role rules:
- `admin` — full access
- `teacher` — CRUD own exams (`created_by === user.id`), read all submissions
- `student` — read published exams, create/read own submissions

In routes: `req.ability.cannot('action', subject('Type', plainObject))`. Always import `subject` from `@casl/ability` for condition-based checks.

### Backend services (Fastify + Node.js 24)
All three services share the same layout:
```
src/
  index.js           # Fastify setup, /health, plugin registration
  db.js              # pg Pool; auto-sets search_path from DATABASE_URL query param
  lib/ability.js     # CASL rules
  middleware/auth.js # verifyAuth() hook
  routes/*.js        # Fastify plugins
```

- Error format: `{ error: string, statusCode: number }`
- Health: `GET /health` → `{ status: "ok", service: "...", timestamp: "..." }`
- `db.js` applies `search_path` via `pool.on('connect')`, read from `?search_path=` in `DATABASE_URL`

### Image upload — user-service only
All image uploads (avatar, exam cover, question image) go through a **single endpoint in user-service**:

```
POST /api/users/upload   (multipart/form-data)
  fields: file, type (avatar|exam-cover|question), old_url (optional)
```

- `src/lib/s3.js` — `uploadToS3()` and `deleteFromS3()`. Lightsail Object Storage is S3-compatible; set `AWS_ENDPOINT` + `forcePathStyle: true` for non-standard endpoints.
- When `old_url` is provided, the old S3 object is deleted before uploading the new one. The S3 key is extracted by finding `uploads/` in the URL.
- Validation settings (max size MB, allowed MIME types) are stored in `quiz_users.admin_settings` and read at upload time — not hardcoded.
- Nginx `client_max_body_size` is set to `10m`.

### Frontend (SvelteKit 5 + Node adapter, SSR disabled)
Fully client-rendered SPA (`export const ssr = false` in `+layout.js`). Auth persists in localStorage via GoTrueClient.

Key files:
- `src/lib/auth.js` — GoTrueClient, URL = `window.location.origin + '/auth'`
- `src/lib/stores/auth.js` — `session`, `user`, `token` Svelte stores via `onAuthStateChange`
- `src/lib/api.js` — `examApi`, `submissionApi`, `userApi`, `uploadApi`; all read `token` store for Bearer header

`uploadApi.upload(file, type, oldUrl?)` sends `multipart/form-data` with no `Content-Type` header (let browser set the boundary).

Components in `src/lib/components/`:
- `ImageUpload.svelte` — drag-and-drop upload with preview; `bind:value` for the URL; accepts `type` prop (`avatar|exam-cover|question`); automatically passes the current URL as `old_url` to delete the old file on replace.
- `MarkdownEditor.svelte` — markdown editor for question explanations

Routes:
```
/                        → redirect to /dashboard or /login
/login                   → Google OAuth + email/password
/register                → signup with role in user_metadata
/auth/callback           → OAuth redirect handler
/dashboard               → role-based home
/profile                 → edit avatar + full_name
/exams                   → Udemy-style grid; cover image or gradient placeholder
/exams/create            → create exam with cover image + per-question images
/exams/[id]              → exam detail / start
/exams/[id]/take         → take exam; shows question image if present
/exams/[id]/edit         → edit exam
/exams/[id]/result       → submission results
/admin                   → tabs: Users (role management) · Upload settings (max size, MIME types)
```

### Database schemas
`infra/postgres/init.sql` is idempotent (`IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS`). It runs once at container creation. For running databases use `infra/postgres/migrate_image_upload.sql`.

Never manually create tables in `quiz_auth` — GoTrue manages that schema.

Schema summary:
- `quiz_users.profiles` — `id, full_name, avatar_url, role, updated_at`
- `quiz_users.admin_settings` — `key, value` (upload validation config)
- `quiz_exams.exams` — includes `cover_image_url`, `tags TEXT[]`, `show_explanation`, `allow_retake`
- `quiz_exams.questions` — includes `image_url`, `question_type` (`single`|`multiple`), `correct_answer` (comma-separated keys for multiple)
- `quiz_submissions.submissions` — `answers JSONB`, `results_detail JSONB`, `percentage FLOAT`

Seed files in `infra/postgres/`: `seed.sql` (sample data), `seed_aws_saa.sql` (AWS SAA exam with 45 questions).

### CI/CD
GitHub Actions (`.github/workflows/build-push.yml`) builds multi-platform (amd64 + arm64) Docker images to GHCR on push to `main`. Matrix over 4 services: `user-service`, `exam-service`, `submission-service`, `frontend`.

## Conventions

- **Package manager:** npm per service (Dockerfiles use `npm install`). pnpm only for workspace tooling.
- **JWT role:** Always read from `payload.user_metadata.role`. `payload.role` is GoTrue-internal (`"authenticated"`).
- **DB search_path:** Set via `?search_path=<schema>` in `DATABASE_URL`; never hardcode it.
- **Exam answers visibility:** Strip `correct_answer` and `explanation` from questions returned to students. For `multiple` type, return `correct_count` instead.
- **Internal exam endpoint:** `GET /exams/internal/:id` requires `x-internal-key` header; used only by submission-service for grading. Nginx blocks this path from external clients.
- **Multiple-choice answers:** Stored as sorted comma-separated option keys, e.g. `"A,C"`. Always sort before storing.
- **Image URL construction:** Built as `${AWS_PUBLIC_URL}/${key}` where key is `uploads/{type}/{timestamp}-{uuid}.{ext}`. Extract key for deletion by slicing from `uploads/` in the URL.
- **Admin settings:** Read from DB at runtime, not from env. Add new configurable thresholds to `quiz_users.admin_settings` rather than hardcoding.
