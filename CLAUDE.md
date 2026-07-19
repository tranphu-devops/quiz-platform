# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Changelog

**Mỗi lần chuẩn bị push/commit**, cập nhật `CHANGELOG.md`:
- Thêm mục `## [Unreleased] — YYYY-MM-DD` (hoặc cập nhật mục đang có) với các thay đổi theo nhóm `Added / Changed / Fixed / Removed`
- Viết ngắn gọn, tập trung vào **what & why** từ góc nhìn người dùng/developer, không liệt kê từng file đã sửa
- Khi release, đổi `[Unreleased]` thành số phiên bản theo SemVer

## Git workflow (bắt buộc)

**Trước khi thay đổi bất kỳ source code nào**, phải làm việc trong một **git worktree riêng**, không sửa trực tiếp trên cây làm việc chính:

1. **Tạo git worktree + nhánh mới từ `main`**: mỗi task = một worktree + một nhánh xuất phát từ `main` (cập nhật `origin/main` mới nhất). Không commit thẳng lên `main`.
2. **Làm toàn bộ thay đổi trong worktree đó** — tách biệt, tránh xung đột khi có nhiều luồng làm việc song song trên cùng repo.
3. **Khi hoàn thành**: `push` nhánh lên `origin` và **mở Pull Request** vào `main` để review; không merge thẳng.

Lý do: cô lập từng luồng công việc (nhiều tiến trình có thể cùng sinh code trên một repo), giữ `main` luôn sạch, và mọi thay đổi đều đi qua PR.

## Commands

### Run everything locally
```bash
cp .env.example .env   # fill in required values (see Environment Variables below)
docker compose up --build
```
Access at http://localhost (via Nginx on port 80).

`docker-compose.override.yml` is applied automatically in dev — it volume-mounts each service's `src/` for hot reload (`node --watch`) and exposes ports directly:
- nginx: 80, frontend: 4000, gotrue: 9999, user: 4002, exam: 4003, submission: 4004, interaction: 4005, generator: 4006, postgres: 5432, redis: 6379

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

### Database migrations (automatic)
Schema is managed by **ordered, idempotent migration files** in `infra/postgres/migrations/` (`NNNN_name.sql`). They are applied automatically by the one-shot **`migrate`** service in `docker-compose.yml` on every `docker compose up` — every app service `depends_on` it with `condition: service_completed_successfully`, so the schema is always current before services start. No manual `psql` step is needed (locally or on deploy).

- Runner: `infra/postgres/run-migrations.sh` (POSIX sh + psql). Tracks applied files in `public.schema_migrations`; each file runs in a single transaction; already-applied files are skipped.
- **To add a schema change:** drop a new `infra/postgres/migrations/NNNN_name.sql` file (next number). Write it idempotently (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`) so re-runs on partially-migrated DBs are safe. Then `docker compose up -d` (dev) or `deploy.sh --update` (prod) applies it.
- Force a run / inspect state against a running DB:
  ```bash
  docker compose run --rm migrate
  docker compose exec postgres psql -U postgres -d quizdb -c "SELECT * FROM public.schema_migrations;"
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
INTERNAL_API_KEY=             # min 32 chars; submission-service → exam-service, and grader-service → exam-service (via EXAM_SERVICE_URL)
SITE_URL=http://localhost      # public URL of the app; used by GoTrue for OAuth redirects
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_ENABLED=true
TAG=latest                    # Docker image tag; used by docker-compose

# Per-service DB connection strings (include schema via search_path)
USER_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_users
EXAM_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_exams
SUBMISSION_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_submissions
INTERACTION_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_interactions
GENERATOR_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_generator

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
SENTRY_AUTH_TOKEN=           # Build-time secret for Sentry source map upload; passed via BuildKit secret, never in image
GENERATOR_KEY_ENCRYPTION_KEY= # 32 bytes hex; encrypts teacher-supplied ("bring your own") LLM API keys at rest (AES-256-GCM). Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ANTHROPIC_API_KEY=            # Optional platform-wide Claude API key, used only when a teacher opts into the platform key (deducts credits)
# Frontend Vite overrides (defaults point to /api/* via Nginx; override for direct service access)
PUBLIC_EXAM_URL=
PUBLIC_SUBMISSION_URL=
PUBLIC_USER_URL=
PUBLIC_INTERACTION_URL=
PUBLIC_GENERATOR_URL=
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
  /api/interactions/ → interaction-service:3005  (comments / likes / reports)
  /api/generator/   → generator-service:3006  (AI exam generation from an uploaded document)
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

### Teacher API — API key auth (exam-service only)
Long-lived credentials for programmatic exam management, so teachers can automate the exam lifecycle without a browser session (JWT expires after 1h; Google-OAuth teachers have no password for a machine grant). Keys work regardless of signup method.

- **Storage:** `quiz_users.api_keys` (`id, user_id, name, key_prefix, key_hash, last_used_at, created_at, revoked_at`). Only the **SHA-256 hash** is stored; plaintext (`qz_live_<48 hex>`) is returned **once** at creation. `key_prefix` = first 14 chars, shown in listings for identification.
- **Key management (user-service, JWT-protected, teacher/admin only):** `apps/user-service/src/routes/api-keys.js` — `POST /api-keys` (create, returns plaintext once), `GET /api-keys` (list metadata), `DELETE /api-keys/:id` (soft-revoke via `revoked_at`). Via Nginx: `/api/users/api-keys`.
- **Consuming the key (exam-service):** `apps/exam-service/src/middleware/auth.js` `verifyAuth` accepts header `X-API-Key` when there's no `Authorization: Bearer`. It resolves the key cross-schema (join `quiz_users.api_keys` → `profiles` → `auth.users`), rejects missing/revoked (`401`) and `banned` (`403`), sets `req.user`/`req.ability` from the **profile role** (source of truth, same as ban-check), and stamps `last_used_at` fire-and-forget. Authorization then flows through the existing CASL rules (teacher CRUD own `Exam`). **Only exam-service** accepts API keys; other services stay JWT-only.
- **Frontend:** `apiKeyApi` in `api.js`; "API Access" card on `/profile` (teacher/admin); static docs at `/api-docs` (linked from the sidebar for teacher/admin). Question images are passed as `image_url` (no file upload over the API in v1).

### Authorization — CASL
Each service has `src/lib/ability.js` with `defineAbilityFor(user)` using `@casl/ability` / `createMongoAbility`.

Role rules:
- `admin` — full access
- `teacher` — CRUD own exams (`created_by === user.id`), read all submissions
- `student` — read published exams, create/read own submissions
- `banned` — blocked at auth middleware (live DB check); CASL grants no permissions

In routes: `req.ability.cannot('action', subject('Type', plainObject))`. Always import `subject` from `@casl/ability` for condition-based checks.

### Backend services (Fastify + Node.js 24)
There are five HTTP backends (user, exam, submission, interaction, generator) — plus `grader-service` (a non-HTTP cron worker, see below). All five HTTP services share the same layout:
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

### Redis cache (exam-service, user-service, interaction-service)
A shared `redis` service (docker-compose, `redis://redis:6379`, no persistence — `save ""` + `appendonly no`, pure cache) sits in front of the three read-heaviest services to speed up page loads. `src/lib/cache.js` (identical in each of the three services) exports `getOrSet(key, ttlSeconds, fetchFn)` and `invalidate(...keys)`, backed by `ioredis`. It is **best-effort**: any Redis error/timeout falls back to calling `fetchFn` directly (or is a no-op for `invalidate`), so a down/misconfigured cache never breaks a request — `submission-service` and `grader-service` intentionally have no cache (submission state changes too fast to benefit, and correctness there is critical).

Strategy: active invalidation on every write that affects a cached key, plus a 60s TTL as a backstop for any invalidation path that was missed. Only **safe-to-share** data is cached — anything that varies per caller (a user's own "liked" state, ability-gated draft content) is always computed fresh:
- **exam-service**: `GET /exams` (keyed by role/creator_id — student/public list, per-creator list, per-teacher own list, admin list) and `GET /collections` (same role-keyed split). `GET /exams/:id` and `GET /collections/:id` always run the CASL ability check fresh on every request (never skip it for a cache hit) and only cache the response body when the exam/collection is **published** — the row is then identical for every authorized viewer, so there's no risk of leaking a draft or another owner's content through the cache. Writes call `invalidate()` with the exact set of list/detail keys the change could affect.
- **user-service**: `GET /public/profile/:userId`, `GET /public/settings` (both invalidated on the corresponding profile/admin-settings write) and `GET /badges/:userId` (TTL-only — badges are awarded by submission-service, which has no invalidation hook into this cache).
- **interaction-service**: `GET /exams/:examId/summary` caches only `like_count`/`comment_count` (global, invalidated on like-toggle/comment create-delete); the caller-specific `liked` flag is always queried fresh and merged in after the cache read, so it's never shared across users.

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
- `src/lib/api.js` — `examApi`, `submissionApi`, `userApi`, `collectionApi`, `badgeApi`, `uploadApi`, `commentApi`, `likeApi`, `reportApi`, `generatorApi`; all read `token` store for Bearer header

`uploadApi.upload(file, type, oldUrl?)` sends `multipart/form-data` with no `Content-Type` header (let browser set the boundary).

Components in `src/lib/components/`:
- `ImageUpload.svelte` — drag-and-drop upload with preview; `bind:value` for the URL; accepts `type` prop (`avatar|exam-cover|question`); automatically passes the current URL as `old_url` to delete the old file on replace.
- `DocumentUpload.svelte` — drag-and-drop picker for the AI exam generator (`/exams/generate`); `bind:file` holds the raw `File` (no auto-upload, no image preview — the parent page sends it together with generation params).
- `MarkdownEditor.svelte` — markdown editor for question explanations
- `RichTextEditor.svelte` — WYSIWYG editor (bold/italic/underline/lists/links toolbar) for exam `description`; `bind:value` for the HTML string. Pair with `sanitizeHtml.js` before storing.
- `BadgePicker.svelte` — grid of 50 preset badge SVGs + custom upload tab; `bind:value` for badge URL. Preset metadata from `src/lib/badge-presets.json`.

`src/lib/components/ui/` — shared design-system primitives used across all pages: `Button.svelte`, `Card.svelte`, `Input.svelte`, `PageHeader.svelte` (unifies page title/breadcrumb/actions header), `Sidebar.svelte` (permanent left nav, collapsible, replaces the old top navbar — collapse state persisted to localStorage).

Preset badges: 50 SVG files in `apps/frontend/static/badges/badge-01.svg…badge-50.svg`. Regenerate with `node scripts/generate-badges.js`.

Routes:
```
/                        → redirect to /dashboard or /login
/login                   → Google OAuth + email/password
/register                → signup with role in user_metadata
/auth/callback           → PKCE OAuth handler (GoTrue redirects here after Google login)
/auth-callback           → implicit-flow fallback handler
/dashboard               → role-based home
/profile                 → edit own profile: avatar + full_name + extended personal fields (bio, birth_year, gender, interests, social links); student shows earned badges
/users/[id]              → public profile page (read-only) for any user — shows bio/social links + exams they've created (published only, unless viewer is the creator/admin)
/exams                   → Udemy-style grid; cover image or gradient placeholder
/exams/create            → create exam with cover image + per-question images
/exams/generate          → AI exam generator: upload a document (PDF/DOCX/text), draft exam auto-created
/exams/[id]              → exam detail / start
/exams/[id]/take         → take exam; shows question image if present
/exams/[id]/edit         → edit exam
/exams/[id]/result       → submission results
/collections             → teacher: list own collections; admin: all
/collections/create      → create collection (teacher)
/collections/[id]/edit   → edit collection (teacher)
/admin                   → tabs: Users (role management) · Upload settings (max size, MIME types) · Credits · AI Generation (platform key, cost, limits)
```

### Public user profile
- `GET /api/users/public/profile/:userId` — unauthenticated; returns public profile fields (`full_name, avatar_url, role, bio, birth_year, gender, interests` + social URLs) for any user, used by `/users/[id]`.
- `GET /api/exams/exams?creator_id=<id>` — lists exams by a given creator; anonymous/other-role viewers get published exams only, the creator (or admin) also sees their own drafts.
- Extended personal fields live on `quiz_users.profiles`: `bio, birth_year, gender, interests, facebook_url, zalo, tiktok_url, youtube_url, instagram_url, linkedin_url, website_url` (see `infra/postgres/migrations/0009_user_profile.sql`).

### Collections & Badges

**Collections** group multiple exams under a shared goal. When a student passes **all** exams in a published collection, they earn a badge (stored in `quiz_submissions.student_badges`, awarded automatically at submission time).

- `GET /api/exams/collections` — list (role-filtered); teacher sees own, student sees published
- `POST /api/exams/collections` — create (teacher/admin)
- `PUT /api/exams/collections/:id` — update incl. `exam_ids` array (replaces membership atomically)
- `GET /api/exams/collections/internal/check-badge?exam_id=` — internal; used by submission-service. Nginx blocks from external.
- `GET /api/users/badges/:userId` — list student's earned badges (with collection title + badge_image_url)

Badge check is **fire-and-forget** (non-blocking): submission returns immediately, badge award happens async in the background.

### Interactions — comment / like / report (`apps/interaction-service`, port 3005)
A separate microservice (schema `quiz_interactions`) for social/feedback features. Same Fastify layout as the other backends. Reads **cross-schema** in the shared DB for simple checks (join author name from `quiz_users.profiles`, verify a completed submission in `quiz_submissions.submissions`, look up `quiz_exams.exams.created_by`) rather than internal HTTP calls — following the same precedent as the auth middleware's ban check.

- `auth.js` exports both `verifyAuth` (strict) and `optionalAuth` (lenient — sets `req.user` if a valid token is present, else continues anonymously). Public reads use `optionalAuth` so they can report the caller's like state.
- **Comments** — any authenticated user may create; author + admin may edit/delete (teacher does **not** moderate comments on their own exams). Listing is **paginated 10/page**.
  - `GET /exams/:examId/comments?page=` (public) · `POST /exams/:examId/comments` · `PATCH|DELETE /comments/:id`
- **Likes** — **students only** may like; count is public. `POST /exams/:examId/like` toggles.
- **Summary** — `GET /exams/:examId/summary` → `{ like_count, comment_count, liked }` for the exam detail hero.
- **Reports** — only a user with a **completed** submission (`status IN ('completed','timed_out')`) for the exam may file one; `category` ∈ `question_wrong|answer_wrong|image_issue|other` + `description`. `exam_owner_id` is denormalized from `exams.created_by` at creation for fast inbox filtering.
  - `POST /exams/:examId/reports` · `GET /reports/mine` (reporter's own history) · `GET /reports/inbox` (teacher: own exams / admin: all) · `GET /reports/inbox/count` (open-count badge) · `PATCH /reports/:id` (owner/admin responds → `status='resolved'`)
- Frontend: `commentApi`, `likeApi`, `reportApi` in `api.js`. Like heart + comments live on `/exams/[id]`; the report modal on `/exams/[id]/result`; report history ("my reports") and the teacher/admin inbox+response live on `/profile`.

### AI exam generator (`apps/generator-service`, port 3006)
Teacher/admin uploads a document (PDF, DOCX, or plain text) on `/exams/generate`; the service calls the Claude API to draft a full multiple-choice exam, then imports it into exam-service as a **draft** (unpublished) exam via exam-service's own Teacher API routes (`POST /exams`, `POST /exams/:id/questions`) — **not** an internal/privileged path. exam-service itself is unmodified: `generateRoutes` forwards the caller's own `Authorization: Bearer <JWT>` header on those requests, so `created_by`/CASL behave exactly as if the teacher had called the Teacher API directly. JWT-only auth (`middleware/auth.js` has no `X-API-Key` path, unlike exam-service/user-service — this feature is UI-driven, not part of the Teacher API surface).

- **Document handling** — PDF and plain text are sent to Claude as native `document`/`text` content blocks (base64 for PDF). **DOCX is not a Claude-native document type** — `lib/docParse.js` extracts its text with `mammoth` first and sends that as a `text` block. Max upload size is `admin_settings.ai_generation_max_file_size_mb` (default 20MB); Nginx's `/api/generator/` location raises `client_max_body_size` to `20m` and `proxy_read_timeout`/`proxy_send_timeout` to `180s` (generation + sequential question import is slower than a typical API call).
- **LLM call** (`lib/llm.js`) — `@anthropic-ai/sdk`, `output_config.format: json_schema` forces a structured `{ title, description, tags, questions[] }` result (schema mirrors the Teacher API's question shape: `content, options[{key,text}], correct_answer[] , question_type, explanation, points`). Default model `claude-sonnet-5`; `ALLOWED_MODELS`/`PLATFORM_MODELS` in `lib/llm.js` gate which models each key source may use. The result is re-validated locally (unique option keys, `correct_answer` ⊆ option keys, `multiple` needs ≥2 correct, `order_index` assigned sequentially 0..n-1) before import — exam-service defaults `order_index` to `0` for every question if the caller omits it, so this must always be sent explicitly.
- **`credit_cost` gotcha on import** — exam-service's `POST /exams` inserts `credit_cost` as literally given rather than falling back to its own column default when omitted (an explicit `NULL` still violates the `NOT NULL` constraint). `importExam()` therefore always resolves and sends a concrete `credit_cost` itself (from `admin_settings.default_exam_cost`) rather than relying on exam-service to apply a fallback — this is a real, pre-existing exam-service quirk, not something to "fix" by touching exam-service.
- **LLM key sourcing** — two modes, chosen per-request (`params.key_source`):
  - `own` — teacher's own Claude API key, saved via `POST /generate/keys` and encrypted at rest with **AES-256-GCM** (`lib/keyCrypto.js`, key from `GENERATOR_KEY_ENCRYPTION_KEY` — 32 bytes hex). This is a **reversible** encryption, unlike `quiz_users.api_keys`' one-way SHA-256 hash and unlike the ECDH *response* encryption below — the plaintext must be recoverable to actually call the provider. Plaintext is returned once at save time only; `GET /generate/keys` returns metadata + `key_prefix` only.
  - `platform` — uses the server's own `ANTHROPIC_API_KEY` env var, gated by `admin_settings.ai_generation_enabled`, and **deducts credits before calling the LLM** (`POST {USER_SERVICE_URL}/internal/credits/deduct`, same internal endpoint submission-service uses) — insufficient credit (402) short-circuits before any LLM spend. A failure *after* the deduction (LLM error, import error) does not refund the credit — an accepted v1 tradeoff.
- **Job history** — every attempt (success or failure) is recorded in `quiz_generator.generation_jobs` (`status`, `key_source`, `model`, `credits_charged`, `exam_id`, `error_message`). `GET /generate/jobs` / `GET /generate/jobs/:id`.
- **Admin settings** (`quiz_users.admin_settings`, same table/pattern as upload/credit config): `ai_generation_enabled`, `ai_generation_credit_cost`, `ai_generation_max_file_size_mb`, `ai_generation_max_questions`. Configured on the "Tạo đề bằng AI" tab in `/admin`. `GET /api/users/public/settings` also exposes `ai_generation_enabled`/`ai_generation_credit_cost` (no auth) so the generate page can decide whether to offer the platform-key option without an admin call.
- Frontend: `generatorApi` in `api.js`; `DocumentUpload.svelte` (plain file-picker/drag-drop, distinct from `ImageUpload.svelte` — no auto-upload-on-select, no image preview); page at `/exams/generate` (sidebar entry "Tạo đề thi bằng AI", teacher/admin only). On success the page redirects to `/exams/[id]/edit` so the teacher reviews/edits the generated questions and sets passing score, time limit, publish, etc. through the existing edit flow.

### Exam notes (frontend-only, not persisted)
On `/exams/[id]/take` there is a **single scratch note for the whole exam session** (one `note` string in per-tab Svelte `$state`), shared across all questions and unchanged when navigating between them. It lives in a floating widget (`.note-widget`) anchored bottom-right, **hidden by default**, toggled by a FAB (the FAB shows a dot when the note is non-empty). The note is **intentionally not sent to any server** — lost on refresh (F5); a helper line states this. There is no notes table or endpoint.

### Database schemas
Schema is defined by the ordered migration files in `infra/postgres/migrations/` (see **Database migrations** above), all idempotent (`IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS`) and applied automatically by the `migrate` service. `0001_init.sql` is the base; later files (`0002_image_upload` … `0013_generator`) add columns/tables incrementally.

Never manually create tables in `auth` / `quiz_auth` — GoTrue manages that schema (the `auth` schema is created by `0001_init.sql` so it exists before GoTrue starts).

Schema summary:
- `quiz_users.profiles` — `id, full_name, avatar_url, role, credits, updated_at`, plus extended personal fields: `bio, birth_year, gender, interests, facebook_url, zalo, tiktok_url, youtube_url, instagram_url, linkedin_url, website_url`
- `quiz_users.admin_settings` — `key, value` (upload validation + credit config + AI generation config: `ai_generation_enabled`, `ai_generation_credit_cost`, `ai_generation_max_file_size_mb`, `ai_generation_max_questions`)
- `quiz_exams.exams` — includes `cover_image_url`, `tags TEXT[]`, `show_explanation`, `allow_retake`, `credit_cost`, `cooldown_minutes` (int, minutes between retakes), `max_attempts` (int nullable, null = unlimited), `scheduled_at` (timestamptz nullable, when null or in the past the exam is open; when in the future the exam is visible but locked), `passing_score` (float nullable, percentage threshold for "pass"; used by badge-award logic), `deleted_at TIMESTAMPTZ` (soft-delete; NULL = active)
- `quiz_exams.questions` — includes `image_url`, `question_type` (`single`|`multiple`), `correct_answer` (comma-separated keys for multiple), `deleted_at TIMESTAMPTZ` (soft-delete; cascaded from exam delete)
- `quiz_exams.collections` — `id, title, description, created_by, badge_image_url, is_published`, `deleted_at TIMESTAMPTZ` (soft-delete)
- `quiz_exams.collection_exams` — `(collection_id, exam_id, position)` many-to-many
- `quiz_submissions.submissions` — `answers JSONB`, `results_detail JSONB`, `percentage FLOAT`, `status VARCHAR(20)` (`in_progress`|`completed`|`timed_out`, DEFAULT `completed`), `started_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`, `exam_session_id UUID` (UUID assigned per active browser tab to enforce single-device rule), `session_last_active TIMESTAMPTZ` (updated on every progress heartbeat; used to detect stale sessions)
- `quiz_submissions.student_badges` — `(user_id, collection_id)` unique; `earned_at`
- `quiz_interactions.comments` — `id, exam_id, user_id, content, created_at, updated_at`
- `quiz_interactions.likes` — `(exam_id, user_id)` PK; `created_at`
- `quiz_interactions.reports` — `id, exam_id, exam_owner_id, reporter_id, category, description, status` (`open`|`resolved`), `response, responded_by, responded_at, created_at`
- `quiz_generator.llm_keys` — teacher-supplied ("bring your own") LLM API keys: `id, user_id, provider, encrypted_key` (AES-256-GCM, reversible), `key_prefix, created_at, last_used_at, revoked_at`
- `quiz_generator.generation_jobs` — one row per AI exam generation attempt: `id, user_id, status` (`processing`|`completed`|`failed`), `key_source` (`own`|`platform`), `model, source_filename, source_file_type, question_count, exam_id, credits_charged, error_message, created_at, completed_at`

Seed files in `infra/postgres/`: `seed.sql` (sample data), `seed_aws_saa.sql` (AWS SAA exam with 45 questions), `seed_exam_01.sql`.

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

### Rich-text exam description
Exam `description` field is rich HTML (not plain text). In the create/edit forms, `RichTextEditor.svelte` provides a lightweight WYSIWYG editor (toolbar: bold, italic, underline, lists, links). On save, the HTML is sanitized server-side via an allowlist before storing. On the exam detail page, it renders formatted HTML. `apps/frontend/src/lib/sanitizeHtml.js` defines the allowlist used in both sanitization and rendering. `htmlToText()` in the same file strips tags to plain text (used for collection tag aggregation and search snippets).

The exam detail page (`/exams/[id]`) shows a **1-random-question preview** (`ORDER BY RANDOM() LIMIT 1`) to give students a taste without revealing the full question set.

Collection tags are **derived** (not stored): the backend computes the union of all member exams' `tags` arrays in the query, so collection tag filters on `/exams` and `/collections` always reflect current exam state.

Custom SvelteKit error pages (`+error.svelte`) handle 404 and 5xx responses with brand-consistent styling.

### Analytics & error monitoring
- **Zoho PageSense** and **Umami** tracking scripts are embedded in `apps/frontend/src/app.html` (quiz app) and `landing/index.html`. Both are load-time embeds — no npm packages; update the script src URLs directly in those files.
- **Sentry** (`@sentry/sveltekit`) is configured in `apps/frontend/src/hooks.client.js` and `hooks.server.js`. It is **enabled only when `import.meta.env.PROD` is true** (i.e., skipped during `vite dev`). Source maps are uploaded at Docker build time when `SENTRY_AUTH_TOKEN` is passed as a BuildKit secret (`--secret id=SENTRY_AUTH_TOKEN`); the token is never baked into any image layer. If the secret is absent, `sentrySvelteKit()` in `vite.config.js` silently skips the upload.
- To rotate the Sentry DSN or org/project slugs, update `hooks.client.js`, `hooks.server.js`, and `vite.config.js` together.

### Landing page
`landing/` contains a static HTML landing page served by Nginx for the production domain (`phutx.top` / `www.phutx.top`). The `default_server` block (used locally) skips it and goes straight to the frontend SPA.

### CI/CD
Three GitHub Actions workflows:
- `build-push.yml` — triggered on push to `main`; builds multi-platform (amd64 + arm64) Docker images to GHCR. Matrix: `auth-service` (legacy, built but not deployed), `user-service`, `exam-service`, `submission-service`, `interaction-service`, `generator-service`, `grader-service`, `frontend`.
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
- **Interactions gating:** Comments — any authenticated user. Likes — **students only** (server rejects others with 403). Reports — only after a completed submission (server verifies via cross-schema query, 403 otherwise). Comment moderation is **author + admin only** (teachers can't moderate comments on their own exams). Report responses are **owner + admin** and flip `status` to `resolved`.
- **Exam notes are not persisted:** the take-page note textareas are in-memory only (Svelte `$state`), never sent to a server; don't add a notes table/endpoint — losing them on refresh is intended behavior.
- **Soft-delete pattern (exams / questions / collections):** DELETE endpoints set `deleted_at = NOW()` instead of hard-deleting. All SELECT queries must include `AND deleted_at IS NULL` (or `AND e.deleted_at IS NULL` for aliased tables). Deleting an exam cascades the same timestamp to all its questions. `deleted_at` rows are never returned to the frontend; no restore UI exists yet — recovery is done directly in DB if needed.
- **`POST /exams` requires an explicit `credit_cost`:** the column is `NOT NULL DEFAULT 10`, but the route inserts whatever value is given (including a literal `null`) rather than falling back to the column default — an omitted/`null` `credit_cost` always 500s. Any programmatic caller that doesn't set `credit_cost` itself (see `apps/generator-service`) must resolve `admin_settings.default_exam_cost` and send a concrete number.

## Design System

Xem chi tiết đầy đủ tại `DESIGN.md`. Tóm tắt nhanh:

- **Brand gradient**: `linear-gradient(135deg, #5625d1, #6d29d3)` — monochromatic deep purple, dùng thống nhất trên cả landing page và quiz app (Udemy-inspired). Landing page (light-only) always uses these exact values.
- **CSS tokens** (quiz app — `+layout.svelte` `:root`):
  - Light (default): `--primary: #5625d1` · `--accent: #6d29d3` · `--primary-light: #ede6ff`
  - `--bg: #f8f7ff` · `--surface: #ffffff` · `--text: #2b2a3f` · `--border: #d0d2e1`
  - Dark (`[data-theme="dark"]`): `--bg: #202331` · `--surface: #2d2b42` · `--text: #f1f5f9` · `--border: #3d4055`
  - Dark brand override: `--primary: #c084fc` · `--primary-dark: #a855f7` · `--accent: #e879f9` · `--primary-light: rgba(192,132,252,0.18)` — the light-mode purple (`#5625d1`) only has ~1.9:1 contrast against dark surfaces, so dark mode uses lighter purple/fuchsia tones (~6:1) instead of reusing the light-mode brand hex.
- **Typography**: Inter (body/UI), JetBrains Mono (code). Google Fonts import.
- **Border radius**: `--radius-card: 16px` · `--radius-btn: 10px` · inputs 8px
- **Shadows**: `0 4px 20px rgba(86,37,209,0.08)` default · `0 12px 36px rgba(86,37,209,0.18)` hover
- **Dark mode**: toggle via `localStorage('quiz-theme')`, applied as `document.documentElement.dataset.theme`
- Dùng CSS custom properties (`var(--primary)`, không hard-code hex)
- Mobile-first, breakpoint 768px
- Không dùng Bootstrap/jQuery, vanilla CSS