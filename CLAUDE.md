# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Changelog

**Mỗi lần chuẩn bị push/commit**, cập nhật `CHANGELOG.md`:
- Thêm mục `## [Unreleased] — YYYY-MM-DD` (hoặc cập nhật mục đang có) với các thay đổi theo nhóm `Added / Changed / Fixed / Removed`
- Viết ngắn gọn, tập trung vào **what & why** từ góc nhìn người dùng/developer, không liệt kê từng file đã sửa
- Khi release, đổi `[Unreleased]` thành số phiên bản theo SemVer

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
docker compose exec postgres psql -U postgres -d quizdb -f /dev/stdin < infra/postgres/migrate_credits.sql
docker compose exec postgres psql -U postgres -d quizdb -f /dev/stdin < infra/postgres/migrate_collections.sql
docker compose exec postgres psql -U postgres -d quizdb -f /dev/stdin < infra/postgres/migrate_security.sql
docker compose exec postgres psql -U postgres -d quizdb -f /dev/stdin < infra/postgres/migrate_scheduled_exam.sql
docker compose exec postgres psql -U postgres -d quizdb -f /dev/stdin < infra/postgres/migrate_submission_progress.sql
docker compose exec postgres psql -U postgres -d quizdb -f /dev/stdin < infra/postgres/migrate_exam_session.sql
```

### Regenerate badge SVGs
```bash
node scripts/generate-badges.js   # outputs to apps/frontend/static/badges/ + src/lib/badge-presets.json
```

### Production deploy (Ubuntu server, run as root)
```bash
sudo bash deploy.sh           # fresh install: clone, configure, build, start
sudo bash deploy.sh --update  # pull latest, rebuild, rolling restart
sudo bash deploy.sh --set-admin  # promote ADMIN_EMAIL to admin role without full redeploy
```

### Tests
There is no test suite in this repo. Verification is done by running the app and exercising the feature manually.

### Workspace (pnpm)
The repo uses a pnpm workspace (`pnpm-workspace.yaml`). Top-level `package.json` declares `"workspaces": ["apps/*"]`. Use npm inside each service for Dockerfiles.

## Environment Variables

Required in `.env` (see `.env.example`):
```
POSTGRES_PASSWORD=
JWT_SECRET=                   # min 32 chars; shared by GoTrue and all backend services
INTERNAL_API_KEY=             # min 32 chars; submission-service → exam-service
SITE_URL=http://localhost      # public URL of the app; used by GoTrue for OAuth redirects
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_ENABLED=true
TAG=latest                    # Docker image tag; used by docker-compose

# Per-service DB connection strings (include schema via search_path)
USER_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_users
EXAM_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_exams
SUBMISSION_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_submissions

# AWS / Lightsail Object Storage (for image uploads)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET=
AWS_REGION=ap-southeast-1
AWS_ENDPOINT=                 # optional; set for non-standard S3-compatible endpoints
AWS_PUBLIC_URL=               # public base URL of the bucket, e.g. https://bucket.s3.region.amazonaws.com

# Optional
API_ENCRYPTION_KEY=          # EC private key for response encryption (production only); generate with scripts/generate-api-key.js
GHCR_ORG=tranphu-devops      # GHCR org prefix for docker-compose image names
# Frontend Vite overrides (defaults point to /api/* via Nginx; override for direct service access)
PUBLIC_EXAM_URL=
PUBLIC_SUBMISSION_URL=
PUBLIC_USER_URL=
```

## Architecture

### Overview
Microservices monorepo. All services share a single PostgreSQL 16 instance with **separate schemas per service**. Nginx is the single ingress.

```
Browser → Nginx :80
  /auth/            → gotrue:9999           (GoTrue SSO engine)
  /api/users/       → user-service:3002
  /api/exams/       → exam-service:3003     (Nginx blocks /api/exams/exams/internal/ and /api/exams/collections/internal/ — these map to the exam-service's /exams/internal/ and /collections/internal/ paths after proxy stripping)
  /api/submissions/ → submission-service:3004
  /                 → frontend:3000
```

Nginx has two `server` blocks: one for `phutx.top` / `www.phutx.top` (production domain, serves a landing page at `/`) and one `default_server` for all other hosts (used locally). The routing above applies to both.

Internal service-to-service calls use Docker network hostnames directly (e.g., `http://exam-service:3003`), never going through Nginx.

> **Note:** `apps/auth-service/` is a legacy prototype (email/password auth before GoTrue was adopted). It is **not** wired into `docker-compose.yml` or Nginx and should be ignored.

### Auth flow — GoTrue + local JWT verification
**GoTrue** (`supabase/gotrue:v2.151.0`) handles signup, login, Google OAuth, and JWT issuance.

JWT claims:
- `sub` → `req.user.id` (user UUID)
- `email` → `req.user.email`
- `user_metadata.role` → `req.user.role` (`student` | `teacher` | `admin`)
- `role` → always `"authenticated"` — **this is GoTrue-internal, NOT our app role**

Each backend verifies JWT locally via `JWT_SECRET` in `src/middleware/auth.js`, which sets `req.user` and `req.ability`. After JWT verification, the middleware does a **live DB query** to check if the user's role is `banned` — this ensures bans take effect immediately without waiting for token expiry.

### Authorization — CASL
Each service has `src/lib/ability.js` with `defineAbilityFor(user)` using `@casl/ability` / `createMongoAbility`.

Role rules:
- `admin` — full access
- `teacher` — CRUD own exams (`created_by === user.id`), read all submissions
- `student` — read published exams, create/read own submissions
- `banned` — blocked at auth middleware (live DB check); CASL grants no permissions

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
- `src/lib/api.js` — `examApi`, `submissionApi`, `userApi`, `collectionApi`, `badgeApi`, `uploadApi`; all read `token` store for Bearer header

`uploadApi.upload(file, type, oldUrl?)` sends `multipart/form-data` with no `Content-Type` header (let browser set the boundary).

Components in `src/lib/components/`:
- `ImageUpload.svelte` — drag-and-drop upload with preview; `bind:value` for the URL; accepts `type` prop (`avatar|exam-cover|question`); automatically passes the current URL as `old_url` to delete the old file on replace.
- `MarkdownEditor.svelte` — markdown editor for question explanations
- `BadgePicker.svelte` — grid of 50 preset badge SVGs + custom upload tab; `bind:value` for badge URL. Preset metadata from `src/lib/badge-presets.json`.

Preset badges: 50 SVG files in `apps/frontend/static/badges/badge-01.svg…badge-50.svg`. Regenerate with `node scripts/generate-badges.js`.

Routes:
```
/                        → redirect to /dashboard or /login
/login                   → Google OAuth + email/password
/register                → signup with role in user_metadata
/auth/callback           → PKCE OAuth handler (GoTrue redirects here after Google login)
/auth-callback           → implicit-flow fallback handler
/dashboard               → role-based home
/profile                 → edit avatar + full_name; student shows earned badges
/exams                   → Udemy-style grid; cover image or gradient placeholder
/exams/create            → create exam with cover image + per-question images
/exams/[id]              → exam detail / start
/exams/[id]/take         → take exam; shows question image if present
/exams/[id]/edit         → edit exam
/exams/[id]/result       → submission results
/collections             → teacher: list own collections; admin: all
/collections/create      → create collection (teacher)
/collections/[id]/edit   → edit collection (teacher)
/admin                   → tabs: Users (role management) · Upload settings (max size, MIME types)
```

### Collections & Badges

**Collections** group multiple exams under a shared goal. When a student passes **all** exams in a published collection, they earn a badge (stored in `quiz_submissions.student_badges`, awarded automatically at submission time).

- `GET /api/exams/collections` — list (role-filtered); teacher sees own, student sees published
- `POST /api/exams/collections` — create (teacher/admin)
- `PUT /api/exams/collections/:id` — update incl. `exam_ids` array (replaces membership atomically)
- `GET /api/exams/collections/internal/check-badge?exam_id=` — internal; used by submission-service. Nginx blocks from external.
- `GET /api/users/badges/:userId` — list student's earned badges (with collection title + badge_image_url)

Badge check is **fire-and-forget** (non-blocking): submission returns immediately, badge award happens async in the background.

### Database schemas
`infra/postgres/init.sql` is idempotent (`IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS`). It runs once at container creation. For running databases use `infra/postgres/migrate_image_upload.sql`.

Never manually create tables in `quiz_auth` — GoTrue manages that schema.

Schema summary:
- `quiz_users.profiles` — `id, full_name, avatar_url, role, credits, updated_at`
- `quiz_users.admin_settings` — `key, value` (upload validation + credit config)
- `quiz_exams.exams` — includes `cover_image_url`, `tags TEXT[]`, `show_explanation`, `allow_retake`, `credit_cost`, `cooldown_minutes` (int, minutes between retakes), `max_attempts` (int nullable, null = unlimited), `scheduled_at` (timestamptz nullable, when null or in the past the exam is open; when in the future the exam is visible but locked), `passing_score` (float nullable, percentage threshold for "pass"; used by badge-award logic)
- `quiz_exams.questions` — includes `image_url`, `question_type` (`single`|`multiple`), `correct_answer` (comma-separated keys for multiple)
- `quiz_exams.collections` — `id, title, description, created_by, badge_image_url, is_published`
- `quiz_exams.collection_exams` — `(collection_id, exam_id, position)` many-to-many
- `quiz_submissions.submissions` — `answers JSONB`, `results_detail JSONB`, `percentage FLOAT`, `status VARCHAR(20)` (`in_progress`|`completed`|`timed_out`, DEFAULT `completed`), `started_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`, `exam_session_id UUID` (UUID assigned per active browser tab to enforce single-device rule), `session_last_active TIMESTAMPTZ` (updated on every progress heartbeat; used to detect stale sessions)
- `quiz_submissions.student_badges` — `(user_id, collection_id)` unique; `earned_at`

Seed files in `infra/postgres/`: `seed.sql` (sample data), `seed_aws_saa.sql` (AWS SAA exam with 45 questions).

### API response encryption
Active only when `NODE_ENV=production` AND `API_ENCRYPTION_KEY` is set. Transparent in dev.

**Flow:** Frontend generates an ephemeral ECDH P-256 key pair (Web Crypto API, private key non-extractable) on session init. Sends base64 public key in `X-Client-Pubkey` header with every request. Backend derives the same AES-256 key via `ECDH(backend_private, client_public) → HKDF(sha256, info='quiz-api-v1')`. Encrypts response with AES-256-GCM → `{ iv, data }`. Frontend decrypts transparently in `apiFetch()`.

- `scripts/generate-api-key.js` — generate key pair; only `API_ENCRYPTION_KEY` (private) goes to backend env — no frontend build var needed
- `GET /api/users/public/crypto-key` — unauthenticated endpoint that serves the derived EC public key at runtime; frontend fetches this once on init (plain fetch, no encryption header → plain response)
- `src/lib/encryptResponse.js` in each backend service — `onSend` Fastify hook; skips if header absent (health checks, internal calls unaffected)
- `apps/frontend/src/lib/crypto.js` — fetches public key at runtime, ECDH session init, `decryptIfNeeded()`
- `apps/frontend/src/lib/api.js` — all calls go through `apiFetch()` which adds the header and auto-decrypts

### Grader service (`apps/grader-service`)
Standalone Node.js worker — no HTTP server, no Fastify. Runs `node-cron` every 15 minutes.

On each tick it queries `quiz_submissions.submissions WHERE status = 'in_progress' AND expires_at < NOW()`, fetches exam questions via `EXAM_SERVICE_URL/exams/internal/:id` (internal key), grades each submission using the same logic as submission-service, then `UPDATE ... SET status = 'timed_out'` (the `WHERE status = 'in_progress'` acts as an optimistic lock against races with the user submit endpoint). Also runs once at startup to catch submissions that expired while the service was down.

Environment: `DATABASE_URL` (same as `SUBMISSION_DATABASE_URL`), `EXAM_SERVICE_URL`, `INTERNAL_API_KEY`.

### Landing page
`landing/` contains a static HTML landing page served by Nginx for the production domain (`phutx.top` / `www.phutx.top`). The `default_server` block (used locally) skips it and goes straight to the frontend SPA.

### CI/CD
Three GitHub Actions workflows:
- `build-push.yml` — triggered on push to `main`; builds multi-platform (amd64 + arm64) Docker images to GHCR. Matrix: `auth-service` (legacy, built but not deployed), `user-service`, `exam-service`, `submission-service`, `grader-service`, `frontend`.
- `deploy.yml` — triggered after `build-push.yml` succeeds; SSHs into the production server and runs `deploy.sh --update`.
- `cleanup-images.yml` — runs weekly (Sunday 00:00 ICT); deletes GHCR image versions beyond the 5 most recent, keeping all semver-tagged releases.

`GHCR_ORG` env var (default `tranphu-devops`) controls the GHCR org prefix used in `docker-compose.yml` image names.

## Conventions

- **Package manager:** npm per service (Dockerfiles use `npm install`). pnpm only for workspace tooling.
- **JWT role:** Always read from `payload.user_metadata.role`. `payload.role` is GoTrue-internal (`"authenticated"`).
- **DB search_path:** Set via `?search_path=<schema>` in `DATABASE_URL`; never hardcode it.
- **Exam answers visibility:** Strip `correct_answer` and `explanation` from questions returned to students. For `multiple` type, return `correct_count` instead.
- **Internal exam endpoint:** `GET /exams/internal/:id` requires `x-internal-key` header; used only by submission-service for grading. Nginx blocks this path from external clients.
- **Multiple-choice answers:** Stored as sorted comma-separated option keys, e.g. `"A,C"`. Always sort before storing.
- **Image URL construction:** Built as `${AWS_PUBLIC_URL}/${key}` where key is `uploads/{type}/{timestamp}-{uuid}.{ext}`. Extract key for deletion by slicing from `uploads/` in the URL.
- **Admin settings:** Read from DB at runtime, not from env. Add new configurable thresholds to `quiz_users.admin_settings` rather than hardcoding.
- **Credit system:** `profiles.credits` tracks balance. Deducted by `POST /api/submissions/start` (calls user-service internal API). Credit cost per exam stored in `exams.credit_cost` (default from `admin_settings.default_exam_cost`). Admin configures `default_credits`, `teacher_upgrade_cost`, `default_exam_cost` in the Credits tab.
- **Internal credit endpoint:** `POST /internal/credits/deduct` on user-service — atomic UPDATE with `credits >= amount` check; returns 402 if insufficient. Called only by submission-service with `x-internal-key`.
- **Public settings:** `GET /api/users/public/settings` — exposes `teacher_upgrade_cost`, `default_credits`, `default_exam_cost` without auth.
- **Teacher upgrade:** `POST /api/users/upgrade-to-teacher` — deducts credits, updates `auth.users.raw_user_meta_data` directly. User must log out and back in for new role to take effect.
- **Session credit flag:** Take page stores `credit_deducted: true` in localStorage session to avoid double-charging on page refresh.
- **Single-device exam session:** `POST /submissions/start` generates a UUID `session_id` and stores it as `exam_session_id`. Each `PUT /submissions/:id/progress` (heartbeat + answer save) and `POST /submissions/:id/submit` must pass this UUID in the `X-Session-Id` header. If the header doesn't match the stored `exam_session_id`, the server returns HTTP 409 — preventing a second tab or device from taking over the session. If `session_last_active` is stale (>300 s / 5 min — `SESSION_STALE_SECS` constant), the new session may claim the submission. `GET /submissions/active?exam_id=` returns any existing `in_progress` submission for the user+exam pair.
- **Scheduled publish:** `exams.scheduled_at` — if set to a future datetime and `is_published = true`, the exam is visible to students but locked. The frontend shows a live countdown (1 s interval via `setInterval`). Server blocks `POST /submissions/start` with HTTP 423 if `scheduled_at > NOW()`. Create/edit forms have a 3-way publish mode selector: draft / now / scheduled. `PUT /exams/:id` uses a `(has_scheduled_at, scheduled_at_val)` param pair so `null` can clear the field.

## Design System

Xem chi tiết đầy đủ tại `DESIGN.md`. Tóm tắt nhanh:

- **Brand gradient**: `linear-gradient(135deg, #5625d1, #6d29d3)` — monochromatic deep purple, dùng thống nhất trên cả landing page và quiz app (Udemy-inspired)
- **CSS tokens** (quiz app — `+layout.svelte` `:root`):
  - `--primary: #5625d1` · `--accent: #6d29d3` · `--primary-light: #ede6ff`
  - Light: `--bg: #f8f7ff` · `--surface: #ffffff` · `--text: #2b2a3f` · `--border: #d0d2e1`
  - Dark (`[data-theme="dark"]`): `--bg: #202331` · `--surface: #2d2b42` · `--text: #f1f5f9` · `--border: #3d4055`
- **Typography**: Inter (body/UI), JetBrains Mono (code). Google Fonts import.
- **Border radius**: `--radius-card: 16px` · `--radius-btn: 10px` · inputs 8px
- **Shadows**: `0 4px 20px rgba(86,37,209,0.08)` default · `0 12px 36px rgba(86,37,209,0.18)` hover
- **Dark mode**: toggle via `localStorage('quiz-theme')`, applied as `document.documentElement.dataset.theme`
- Dùng CSS custom properties (`var(--primary)`, không hard-code hex)
- Mobile-first, breakpoint 768px
- Không dùng Bootstrap/jQuery, vanilla CSS