# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Changelog

Trước khi commit/push, cập nhật `CHANGELOG.md` (mục `## [Unreleased] — YYYY-MM-DD`, nhóm `Added/Changed/Fixed/Removed`, ngắn gọn theo góc nhìn user/dev — không liệt kê từng file). Đổi `[Unreleased]` → version SemVer khi release.

> Enforced tự động bởi hook `PreToolUse`/`Bash` — chặn `git commit` nếu `CHANGELOG.md` chưa được stage (`.claude/settings.json`).

> Trước khi Claude sửa `CHANGELOG.md` lần đầu trong session (file đang sạch, chưa có edit dở), hook `PreToolUse`/`Edit|Write` tự `git fetch origin main` + `git checkout origin/main -- CHANGELOG.md` để lấy bản mới nhất trước khi ghi đè — mục Unreleased mỗi worktree đều append nên hay conflict khi mở PR, hook này giảm bớt. Nếu file đã có thay đổi chưa commit trong session thì bỏ qua bước sync (`.claude/settings.json`).

## Git workflow (bắt buộc)

Mỗi task = một **git worktree riêng** + một branch mới từ `main` (`origin/main` mới nhất) — không sửa source code trực tiếp trên main worktree, không commit thẳng lên `main`. Xong việc: push branch + mở PR vào `main` (không merge thẳng).

Lý do: cô lập từng luồng việc (nhiều tiến trình có thể cùng sinh code trên một repo), giữ `main` sạch, mọi thay đổi đi qua review.

> Enforced tự động bởi hook `PreToolUse`/`Edit|Write` — chặn sửa file khi đang ở main worktree, trừ doc/config (`CLAUDE.md`, `CHANGELOG.md`, `README.md`, `DESIGN.md`, `.claude/*`) (`.claude/settings.json`).

## Commands

### Run everything locally
```bash
cp .env.example .env   # fill in required values (see Environment Variables below)
docker compose up --build
```
Access at http://localhost (via Nginx on port 80).

`docker-compose.override.yml` applies automatically in dev — volume-mounts each service's `src/` for hot reload (`node --watch`) and exposes ports directly: nginx 80, frontend 4000, gotrue 9999, user 4002, exam 4003, submission 4004, interaction 4005, generator 4006, postgres 5432, redis 6379.

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
Schema managed by **ordered, idempotent migration files** in `infra/postgres/migrations/` (`NNNN_name.sql`), applied automatically by the one-shot **`migrate`** service in `docker-compose.yml` — every app service `depends_on` it with `condition: service_completed_successfully`. No manual `psql` step needed.

- Runner: `infra/postgres/run-migrations.sh` (POSIX sh + psql). Tracks applied files in `public.schema_migrations`; each file runs in a transaction; already-applied files skipped.
- **To add a schema change:** new `infra/postgres/migrations/NNNN_name.sql` (next number), written idempotently (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`). Then `docker compose up -d` (dev) or `deploy.sh --update` (prod).
- Force a run / inspect state:
  ```bash
  docker compose run --rm migrate
  docker compose exec postgres psql -U postgres -d quizdb -c "SELECT * FROM public.schema_migrations;"
  ```

### Other commands
```bash
node scripts/generate-badges.js   # regen badge SVGs → apps/frontend/static/badges/ + src/lib/badge-presets.json
node --env-file=.env scripts/mint-test-jwt.js [--email hs.minh@quiz.test]   # dev-only: mint a JWT for a seeded user, bypassing GoTrue/login
sudo bash deploy.sh                  # prod: fresh install (Ubuntu server, run as root)
sudo bash deploy.sh --update         # prod: pull latest, rebuild, rolling restart
sudo bash deploy.sh --set-admin      # prod: promote ADMIN_EMAIL to admin role without full redeploy
```
`mint-test-jwt.js` requires the local stack running (`docker compose up`); signs with the local `JWT_SECRET` for a user seeded in `infra/postgres/seed.sql`. Paste the printed `localStorage.setItem('quiz_session', ...)` snippet into the browser console for UI testing, or use the token as a Bearer header for API testing. Dev/local only — never run against a production `JWT_SECRET`/database.

**Tests:** none in this repo — verify by running the app and exercising the feature manually.

**Workspace:** pnpm workspace (`pnpm-workspace.yaml`); top-level `package.json` declares `"workspaces": ["apps/*"]`. Use npm inside each service for Dockerfiles.

## Environment Variables

Required in `.env` (see `.env.example`):
```
POSTGRES_PASSWORD=
JWT_SECRET=                   # min 32 chars; shared by GoTrue and all backend services
INTERNAL_API_KEY=             # min 32 chars; submission-service/grader-service → exam-service
SITE_URL=http://localhost      # public URL; used by GoTrue for OAuth redirects
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
NOTIFICATION_DATABASE_URL=postgres://postgres:<pw>@postgres:5432/quizdb?search_path=quiz_notifications

# AWS / Lightsail Object Storage (image uploads)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET=
AWS_REGION=ap-southeast-1
AWS_ENDPOINT=                 # optional; non-standard S3-compatible endpoints
AWS_PUBLIC_URL=               # public base URL of the bucket

# Optional
API_ENCRYPTION_KEY=          # EC private key for response encryption (prod only); scripts/generate-api-key.js
GHCR_ORG=tranphu-devops      # GHCR org prefix for docker-compose image names
SENTRY_AUTH_TOKEN=           # build-time secret for source map upload, via BuildKit secret only
GENERATOR_KEY_ENCRYPTION_KEY= # 32B hex; encrypts teacher "bring your own" LLM API keys at rest (AES-256-GCM)
OPENROUTER_API_KEY=           # platform-wide fallback OpenRouter key
RESEND_API_KEY=
NOTIFICATION_EMAIL_FROM=
PUSHOVER_APP_TOKEN=
TELEGRAM_BOT_TOKEN=
CONTACT_EMAIL_TO=             # inbox for public "Contact us" form; falls back to NOTIFICATION_EMAIL_FROM
BRAND_SITE_URL=               # marketing site for email footers (default https://novaquiz.net)
NOTIFICATION_TIMEZONE=        # timestamps in notification emails (default Asia/Ho_Chi_Minh)
DOCKER_PROXY_HOST=docker-socket-proxy   # Admin System Overview; safe defaults in docker-compose.yml
DOCKER_PROXY_PORT=2375
COMPOSE_PROJECT_NAME=quiz-platform
# Frontend Vite overrides (default: /api/* via Nginx)
PUBLIC_EXAM_URL=
PUBLIC_SUBMISSION_URL=
PUBLIC_USER_URL=
PUBLIC_INTERACTION_URL=
PUBLIC_GENERATOR_URL=
PUBLIC_NOTIFICATION_URL=
```

## Architecture

### Overview
Microservices monorepo. Single PostgreSQL 16 instance, **separate schema per service**. Nginx is the single ingress.

```
Browser → Nginx :80
  /auth/               → gotrue:9999            (GoTrue SSO)
  /api/users/          → user-service:3002
  /api/exams/          → exam-service:3003       (Nginx blocks /api/exams/{exams,collections}/internal/)
  /api/submissions/    → submission-service:3004
  /api/interactions/   → interaction-service:3005 (comments/likes/reports)
  /api/generator/      → generator-service:3006  (AI exam generation)
  /api/notifications/  → notification-service:3007 (Nginx blocks /api/notifications/internal/)
  /                    → frontend:3000
```

Nginx has two `server` blocks: `novaquiz.net`/`www.novaquiz.net` (landing page at `/`) and a `default_server` for everything else (local dev, and prod `app.novaquiz.net`). Internal service-to-service calls use Docker network hostnames directly, never through Nginx.

> `apps/auth-service/` is a legacy prototype, not wired into compose/Nginx — ignore it.

### Auth flow — GoTrue + local JWT verification
**GoTrue** (`supabase/gotrue:v2.151.0`) handles signup, login, Google OAuth, JWT issuance. Claims: `sub`→`req.user.id`, `email`→`req.user.email`, `user_metadata.role`→`req.user.role` (`student|teacher|admin`), `role` is always `"authenticated"` (GoTrue-internal, **not** our app role). **No passwords for end users** — login is Google OAuth or passwordless email magic link (`signInWithOtp`, `apps/frontend/src/routes/login/+page.svelte`), both provisioning the same `auth.users`/`profiles` rows keyed by email/`sub`. GoTrue's SMTP relays through Resend (`docker-compose.yml`, reusing `RESEND_API_KEY`), `GOTRUE_MAILER_OTP_EXP: 600` (magic links expire in 10 min). Locked-out recovery: admin changes the user's email via `PATCH /admin/users/:id/email` (`/admin/users/:id/edit`) — no self-service password reset.

**Three GoTrue gotchas, each of which fails silently — all three were shipped as bugs before being caught:**
1. **The `/auth` prefix belongs in `GOTRUE_MAILER_URLPATHS_*`, never in `API_EXTERNAL_URL`.** Emailed links are built as `externalURL.ResolveReference(urlPath)` (`internal/mailer/template.go`); the URL paths are absolute (`/verify`), so per RFC 3986 the base URL's path is **discarded**. `API_EXTERNAL_URL=<site>/auth` therefore silently produces `<site>/verify` — a 404 against the SPA. Hence `GOTRUE_MAILER_URLPATHS_{INVITE,CONFIRMATION,RECOVERY,EMAIL_CHANGE}: /auth/verify` (magic link uses the **RECOVERY** path).
2. **`/auth/*` is GoTrue, not the SPA.** Nginx proxies the whole prefix, so `/auth/callback` reaches GoTrue's OAuth callback (HTTP 400 `bad_oauth_callback`), never SvelteKit. Every app-side redirect target must be **`/auth-callback`** (hyphen).
3. **A broken mail template degrades to plain text without any error.** `GOTRUE_MAILER_TEMPLATES_*` accepts **http(s) only** (`file://` does not work) and is re-fetched on every send; on failure `supabase/mailme` just logs `Error loading template from …` and uses its built-in plain default — which is how the unstyled "Magic Link / Alternatively, enter the code: 123456" mail gets out. The branded template is `infra/nginx/mail-templates/magic-link.html` (styled like `notification-service`'s `emailLayout.js`; GoTrue is a separate Go binary so it can't import that JS module — the shared header, including the logo URL, has to be kept in sync by hand).
   It is served by its **own `mail-templates` container**, not by `nginx`. That is deliberate: `nginx` is recreated and restarted on every `deploy.sh --update` (the script ends with `docker compose restart nginx`), and a magic link requested inside that window silently arrives unstyled. `mail-templates` has no upstreams and no config that changes between deploys, so `docker compose up -d` leaves it running. The failure is not sticky — mailme re-fetches on the next send, so a single bad send does not poison the process. If magic-link mail arrives unstyled, check: `docker compose logs gotrue | grep "Error loading template"` and `docker compose exec gotrue wget -qO- http://mail-templates/magic-link.html`.

Each backend verifies JWT locally via `JWT_SECRET` in `src/middleware/auth.js`, setting `req.user`/`req.ability`, then does a **live DB query** to check `banned` role — bans take effect immediately, no waiting for token expiry.

### Teacher API — API key auth (exam-service only)
Long-lived credentials so teachers can automate exam management without a browser session.

- Storage: `quiz_users.api_keys` (`id, user_id, name, key_prefix, key_hash, last_used_at, created_at, revoked_at`) — only SHA-256 hash stored; plaintext (`qz_live_<48 hex>`) returned once at creation.
- Management (user-service, JWT, teacher/admin): `POST/GET/DELETE /api-keys` (`apps/user-service/src/routes/api-keys.js`). Via Nginx: `/api/users/api-keys`.
- Consumption (exam-service `middleware/auth.js`): `X-API-Key` header accepted when no `Authorization: Bearer`; resolves key cross-schema, rejects missing/revoked (401) and banned (403), sets `req.user`/`req.ability` from profile role. **Only exam-service** accepts API keys.
- Frontend: `apiKeyApi`; "API Access" card on `/profile`; docs at `/api-docs`. Question images passed as `image_url` (no file upload over API in v1).

### Authorization — CASL
Each service: `src/lib/ability.js`, `defineAbilityFor(user)` via `@casl/ability`/`createMongoAbility`.
- `admin` — full access · `teacher` — CRUD own exams (`created_by === user.id`), read all submissions · `student` — read published exams, own submissions · `banned` — blocked at auth middleware, no CASL permissions.
- In routes: `req.ability.cannot('action', subject('Type', obj))` — always import `subject` from `@casl/ability`.

### Backend services (Fastify + Node.js 24)
Six HTTP backends (user, exam, submission, interaction, generator, notification) + `grader-service` (non-HTTP cron worker). Shared layout:
```
src/
  index.js           # Fastify setup, /health, plugin registration
  db.js              # pg Pool; auto-sets search_path from DATABASE_URL query param
  lib/ability.js     # CASL rules
  middleware/auth.js # verifyAuth() hook
  routes/*.js        # Fastify plugins
```
- Error format: `{ error: string, statusCode: number }`
- Health: `GET /health` → `{ status: "ok", service, timestamp, db: { ok }, pool: { totalCount, idleCount, waitingCount } }` (consumed by admin System Overview)
- `db.js` applies `search_path` via `pool.on('connect')`, read from `?search_path=` in `DATABASE_URL`

### Redis cache (exam, user, interaction services)
Shared `redis` (docker-compose, no persistence, pure cache) in front of the three read-heaviest services. `src/lib/cache.js` (duplicated per service) exports `getOrSet(key, ttlSeconds, fetchFn)` / `invalidate(...keys)` via `ioredis`, **best-effort** (any Redis error falls back to `fetchFn` directly). `submission-service`/`grader-service` intentionally have no cache.

Active invalidation on every affecting write + 60s TTL backstop. Only safe-to-share data cached (never per-caller state):
- **exam-service**: `GET /exams`/`GET /collections` (role/creator-keyed); `GET /exams/:id`/`GET /collections/:id` always run CASL fresh, cache body only when **published**.
- **user-service**: `GET /public/profile/:userId`, `GET /public/settings` (invalidated on write); `GET /badges/:userId` (TTL-only, no invalidation hook).
- **interaction-service**: `GET /exams/:examId/summary` caches only `like_count`/`comment_count`; per-caller `liked` flag always queried fresh.

### Image upload — user-service only
Single endpoint for all uploads (avatar, exam cover, question image):
```
POST /api/users/upload   (multipart/form-data)
  fields: file, type (avatar|exam-cover|question), old_url (optional)
```
- `src/lib/s3.js` — `uploadToS3()`/`deleteFromS3()`. Lightsail Object Storage is S3-compatible (`AWS_ENDPOINT` + `forcePathStyle: true` for non-standard endpoints).
- `old_url` provided → old S3 object deleted first; key extracted by finding `uploads/` in the URL.
- Validation (max size, MIME types) read from `quiz_users.admin_settings` at upload time, not hardcoded. Nginx `client_max_body_size: 10m`.

### Frontend (SvelteKit 5 + Node adapter, SSR disabled)
Fully client-rendered SPA (`export const ssr = false`). Auth persists in localStorage via GoTrueClient.

Key files:
- `src/lib/auth.js` — GoTrueClient, URL = `window.location.origin + '/auth'`
- `src/lib/stores/auth.js` — `session`, `user`, `token` Svelte stores via `onAuthStateChange`
- `src/lib/api.js` — `examApi`, `submissionApi`, `userApi`, `collectionApi`, `badgeApi`, `uploadApi`, `commentApi`, `likeApi`, `reportApi`, `generatorApi`; all read `token` store for Bearer header

`uploadApi.upload(file, type, oldUrl?)` sends `multipart/form-data` with no `Content-Type` header (browser sets boundary).

Components (`src/lib/components/`):
- `ImageUpload.svelte` — drag-drop upload+preview; `bind:value`; `type` prop (`avatar|exam-cover|question`); auto-passes current URL as `old_url` on replace.
- `DocumentUpload.svelte` — picker for AI generator; `bind:file` holds raw `File`, no auto-upload/preview.
- `MarkdownEditor.svelte` — question explanations.
- `RichTextEditor.svelte` — WYSIWYG (bold/italic/underline/lists/links) for exam `description`; pair with `sanitizeHtml.js`.
- `BadgePicker.svelte` — 50 preset badge SVGs + custom upload; metadata from `src/lib/badge-presets.json`.
- `src/lib/components/ui/` — design-system primitives: `Button`, `Card`, `Input`, `PageHeader`, `Sidebar` (collapsible, collapse state in localStorage).

Preset badges: `apps/frontend/static/badges/badge-01..50.svg`, regenerate via `node scripts/generate-badges.js`.

Routes:
```
/                        → redirect to /dashboard or /login
/login /register         → Google OAuth + email/password; register sets role in user_metadata
/auth-callback           → the ONLY app-side auth callback (implicit flow, `#access_token=`); used by both Google OAuth and magic link. Note `/auth/*` is NOT the SPA — nginx proxies it to GoTrue
/dashboard               → role-based home
/profile                 → own profile edit + notification preferences; student shows earned badges
/users/[id]              → public profile (read-only) — bio/social + published exams
/exams                   → Udemy-style grid
/exams/create            → create exam (cover + per-question images)
/exams/generate          → AI exam generator (upload doc → draft exam)
/exams/generate/jobs     → past generation attempts + error detail
/exams/generate/keys     → own/platform LLM key management
/exams/[id]              → exam detail/start · /take → take exam · /edit → edit · /result → results
/collections, /collections/create, /collections/[id]/edit
/admin                   → tabs: Users · Upload settings · Credits · AI Generation · Notifications · System
```

### Public user profile
- `GET /api/users/public/profile/:userId` — unauthenticated; public fields for `/users/[id]`.
- `GET /api/exams/exams?creator_id=<id>` — exams by creator; anon/other-role gets published only, creator/admin also sees drafts.
- Extended fields on `quiz_users.profiles`: `bio, birth_year, gender, interests, facebook_url, zalo, tiktok_url, youtube_url, instagram_url, linkedin_url, website_url`.

### Collections & Badges
**Collections** group exams under a shared goal; passing **all** exams in a published collection earns a badge (`quiz_submissions.student_badges`, awarded automatically, **fire-and-forget** at submission time — non-blocking).
- `GET/POST /api/exams/collections`, `PUT /api/exams/collections/:id` (incl. `exam_ids` array, atomic replace)
- `GET /api/exams/collections/internal/check-badge?exam_id=` — internal, used by submission-service, Nginx-blocked externally
- `GET /api/users/badges/:userId` — student's earned badges

### Interactions — comment/like/report (`interaction-service`, port 3005)
Schema `quiz_interactions`. Reads cross-schema (join `quiz_users.profiles`, `quiz_submissions.submissions`, `quiz_exams.exams`) rather than internal HTTP, same precedent as auth ban-check. `auth.js` exports `verifyAuth` (strict) and `optionalAuth` (lenient, public reads report caller's like state).
- **Comments** — any authenticated user creates; author+admin edit/delete (teachers don't moderate own-exam comments); paginated 10/page. `GET/POST /exams/:examId/comments`, `PATCH|DELETE /comments/:id`.
- **Likes** — students only; `POST /exams/:examId/like` toggles.
- **Summary** — `GET /exams/:examId/summary` → `{ like_count, comment_count, liked }`.
- **Reports** — only after a completed submission; `category` ∈ `question_wrong|answer_wrong|image_issue|other`; `exam_owner_id` denormalized for inbox filtering. `POST /exams/:examId/reports`, `GET /reports/mine`, `GET /reports/inbox` (teacher: own / admin: all), `GET /reports/inbox/count`, `PATCH /reports/:id` (owner/admin → `resolved`).
- Frontend: `commentApi`/`likeApi`/`reportApi`; like+comments on `/exams/[id]`; report modal on `/exams/[id]/result`; history/inbox on `/profile`.

### AI exam generator (`generator-service`, port 3006)
Teacher/admin uploads a document on `/exams/generate`; service calls an LLM **via OpenRouter** to draft a full MC exam, then imports as a **draft** exam via exam-service's own Teacher API (`POST /exams`, `POST /exams/:id/questions`), forwarding the caller's own JWT so `created_by`/CASL behave as if the teacher called it directly. JWT-only (no `X-API-Key` path — UI-driven, not part of Teacher API surface).

- **Why OpenRouter, not Anthropic directly**: direct `api.anthropic.com` calls from AWS Lightsail were blocked by Cloudflare (`403 forbidden`, reproduced via bare curl, survived an IP rotation) — an IP/ASN-reputation block outside our control. OpenRouter (OpenAI-compatible) sidesteps it since only OpenRouter's infra talks to Anthropic.
- **Model availability > price**: prod host is in **Hong Kong**, where `google/*` and `openai/*` 403 with region restrictions (OpenRouter does not launder this — separate from the Cloudflare block above). Verified working: `deepseek/*`, `mistralai/*`, `moonshotai/*`. Verified broken: `qwen/qwen3.5-flash-02-23` (400s on strict `json_schema`), `z-ai/glm-4.7-flash` (200 with schema-violating JSON). Re-run `scripts/test-openrouter-models.sh` **from the production server** before changing the default — region-dependent.
- **Document handling**: PDF/text sent as OpenAI-compatible `file`/`text` blocks. DOCX has no native file type — `lib/docParse.js` extracts text via `mammoth`; <30 chars fails up front (`reason: 'empty_document'`).
- **PDF engine** (`admin_settings.ai_generation_pdf_engine`, default `cloudflare-ai`, allowlist `PDF_ENGINES` in `lib/llm.js`): `native` needs a model with `file` input_modality or the model silently answers "empty document" inside valid JSON; `cloudflare-ai` (free, parses to text, loses layout) works with any model; `mistral-ocr` (paid/page) is the only one reading scanned PDFs. Because failure arrives as a *successful* LLM response, `generateExam()` treats "zero questions" and "all-questions-no-options" as the same `reason: 'empty_exam'`, storing the model's own `title`/`description` plus `pdf_engine`/`file_type`/`file_size_bytes` in `generation_jobs.error_detail`. Max upload `admin_settings.ai_generation_max_file_size_mb` (default 20MB); Nginx `/api/generator/` raises `client_max_body_size` to `20m`, timeouts to `180s`.
- **LLM call** (`lib/llm.js`) — plain `fetch`, `response_format: json_schema strict:true` forces `{ title, description, tags, questions[] }` (mirrors Teacher API question shape). Default model `deepseek/deepseek-v4-flash` (`DEFAULT_MODEL`, overridden by `admin_settings.ai_generation_default_model`). Re-validated locally (unique option keys, `correct_answer ⊆` options, `multiple` needs ≥2 correct, `order_index` sequential 0..n-1 — exam-service defaults `order_index` to `0` if omitted, so always send explicitly).
- **`credit_cost` gotcha**: `importExam()` always resolves a concrete value from `admin_settings.default_exam_cost` itself (see Conventions).
- **Model choice by key source**: `platform`-key generations always use the admin default (ignore client `model`); `own`-key generations accept any OpenRouter slug (loosely validated: non-empty, contains `/`, <100 chars).
- **LLM key sourcing** — `quiz_generator.llm_keys`, distinguished by `scope` (`'user'`|`'platform'`): `own` = teacher's key (`POST /generate/keys`), AES-256-GCM reversible encryption (`lib/keyCrypto.js`, key = `GENERATOR_KEY_ENCRYPTION_KEY`), plaintext shown once, generation uses most-recently-created key. `platform` = admin-managed (`POST/GET/DELETE /generate/platform-key`, manual `role !== 'admin'` check), new key revokes previous; falls back to `OPENROUTER_API_KEY` env if no DB row. Gated by `admin_settings.ai_generation_enabled`; **deducts credits before calling the LLM** (402 short-circuits before spend); failure after deduction does not refund (accepted v1 tradeoff).
- **Job history** — `quiz_generator.generation_jobs` (status/key_source/model/credits_charged/exam_id/error_message/error_detail). `error_detail` (JSONB) carries `source` (`openrouter|exam-service|validation|generator-service`) + source-specific fields, attached via `.detail` on thrown Errors. Frontend `/exams/generate/jobs` shows a raw `<pre>` dump per failed job (shapes vary too much for bespoke UI).
- **Admin settings**: `ai_generation_enabled/credit_cost/max_file_size_mb/max_questions/default_model/pdf_engine` on the "Tạo đề bằng AI" `/admin` tab. `GET /api/users/public/settings` exposes enabled/credit_cost/default_model unauthenticated.
- Frontend: `generatorApi`; page redirects to `/exams/[id]/edit` on success for review/publish.

### Notification service (`notification-service`, port 3007)
Admin alerts + per-user activity notifications via Pushover/Email(Resend)/Telegram. Hybrid: Fastify HTTP API + `node-cron` queue worker, same process.

- **Queue = Postgres** (`quiz_notifications.notification_queue`), not BullMQ/Redis (shared `redis` is a volatile no-persistence cache, unsuitable). Producers enqueue via `POST /internal/notify`; a 10s cron tick claims rows with `SELECT ... FOR UPDATE SKIP LOCKED`, dispatches outside the claiming transaction, marks `sent` or backs off (`30s * 2^attempts`, capped at 5 attempts → `status='dead'`).
- **Event taxonomy**: `event_type` = `<domain>.<event>.<audience>` (e.g. `submission.completed.owner|teacher|admin`) — independently-toggleable per audience. Catalog in `quiz_notifications.event_types` (seeded `0016_notifications.sql`).
- **Fan-out at enqueue time**: `POST /internal/notify` (`{ event, recipients, payload }`) resolves subscriptions once and inserts one fully-resolved row per (recipient, channel) — worker never re-joins subscriptions.
- **Producer hooks**: each producer (`user`, `submission`, `grader`, `interaction`, `generator`-service) has its own copy-pasted `src/lib/notify.js`, fire-and-forget `notify(event, {recipients, payload})`, no-op if `NOTIFICATION_SERVICE_URL` unset, never throws into caller. Payloads carry everything the email needs to render (producer owns business data).
- **Channel adapters** (`lib/channels/{pushover,email,telegram}.js`) — plain `fetch`, no SDK. Platform credentials are env vars (deploy-time secrets). Each recipient's own target (Pushover key/Telegram chat-id/email override) in `quiz_notifications.user_channel_targets`.
- **Rendering** — `lib/events.js` maps `event_type` → content object, rendered by `renderEmail()` (branded HTML shell, `lib/emailLayout.js` — inline-styled, every value HTML-escaped; the header logo `BRAND.logoUrl` is the only remote asset, decorative `alt=""` since clients block images by default) and `renderMessage()` (plain, first ~4 facts for Pushover/Telegram). Untemplated events still render via `fallbackContent()`, never a raw JSON dump. Needs `SITE_URL` (in-app links), optional `BRAND_SITE_URL` (marketing site), `NOTIFICATION_TIMEZONE`. Third-party emails shown to a recipient are masked via `maskEmail()` except in `.admin` templates.
- **Self-service preferences** (`routes/preferences.js`): `GET/PUT /preferences` — own `audience='user'` subscriptions + channel targets, on `/profile`.
- **Admin** (`routes/admin.js`, manual role check): `GET/PUT /admin/subscriptions` (per-admin `audience='admin'` opt-ins), `GET /admin/queue` (log viewer), `POST /admin/queue/:id/retry`. "Notifications" tab on `/admin`.
- Internal enqueue endpoint Nginx-blocked externally.

### Exam notes (frontend-only, not persisted)
`/exams/[id]/take` has a **single scratch note for the whole session** (Svelte `$state`, shared across questions), in a hidden-by-default floating widget toggled by a FAB. **Never sent to a server** — lost on refresh; no notes table/endpoint exists or should be added.

### Database schemas
Defined by ordered migrations in `infra/postgres/migrations/` (idempotent, auto-applied by `migrate` service). `0001_init.sql` is base. Never manually create tables in `auth`/`quiz_auth` — GoTrue manages that schema.

Summary:
- `quiz_users.profiles` — `id, full_name, avatar_url, role, credits, updated_at` + `bio, birth_year, gender, interests, facebook_url, zalo, tiktok_url, youtube_url, instagram_url, linkedin_url, website_url`
- `quiz_users.admin_settings` — `key, value` (upload/credit/AI-generation config)
- `quiz_exams.exams` — `cover_image_url, tags TEXT[], show_explanation, allow_retake, credit_cost, cooldown_minutes, max_attempts (null=unlimited), scheduled_at, passing_score, deleted_at` (soft-delete)
- `quiz_exams.questions` — `image_url, question_type (single|multiple), correct_answer (comma-sep keys), deleted_at`
- `quiz_exams.collections` — `id, title, description, created_by, badge_image_url, is_published, deleted_at`
- `quiz_exams.collection_exams` — `(collection_id, exam_id, position)`
- `quiz_submissions.submissions` — `answers JSONB, results_detail JSONB, percentage FLOAT, status (in_progress|completed|timed_out), started_at, expires_at, exam_session_id UUID, session_last_active`
- `quiz_submissions.student_badges` — `(user_id, collection_id)` unique, `earned_at`
- `quiz_interactions.comments` — `id, exam_id, user_id, content, created_at, updated_at`
- `quiz_interactions.likes` — `(exam_id, user_id)` PK, `created_at`
- `quiz_interactions.reports` — `id, exam_id, exam_owner_id, reporter_id, category, description, status, response, responded_by, responded_at, created_at`
- `quiz_generator.llm_keys` — `id, user_id, provider, encrypted_key (AES-256-GCM), key_prefix, created_at, last_used_at, revoked_at, scope (user|platform)`
- `quiz_generator.generation_jobs` — `id, user_id, status, key_source, model, source_filename, source_file_type, question_count, exam_id, credits_charged, error_message, error_detail, created_at, completed_at`
- `quiz_notifications.event_types` — `key (PK), audience (admin|user), label_vi/en/ja, description_vi, applicable_roles TEXT[]`
- `quiz_notifications.user_channel_targets` — `user_id (PK), email_override, pushover_user_key, telegram_chat_id, updated_at`
- `quiz_notifications.notification_subscriptions` — `(user_id, event_type, channel)` unique, `enabled`
- `quiz_notifications.notification_queue` — `event_type, channel, recipient_user_id, payload JSONB, status, attempts, max_attempts, last_error, available_at, created_at, sent_at`

Seed files in `infra/postgres/`: `seed.sql`, `seed_aws_saa.sql`, `seed_exam_01.sql`.

### API response encryption
Active only when `NODE_ENV=production` AND `API_ENCRYPTION_KEY` set (transparent in dev). Frontend generates ephemeral ECDH P-256 key pair (Web Crypto, non-extractable), sends base64 public key in `X-Client-Pubkey`. Backend derives AES-256 key via `ECDH → HKDF(sha256, info='quiz-api-v1')`, encrypts response as `{ iv, data }` (AES-256-GCM).

- `scripts/generate-api-key.js` generates the pair; only the private key goes to backend env.
- `GET /api/users/public/crypto-key` — unauthenticated, serves derived public key at runtime.
- `src/lib/encryptResponse.js` per backend — `onSend` hook, skips if header absent.
- Frontend: `src/lib/crypto.js` (session init, `decryptIfNeeded()`), `src/lib/api.js`'s `apiFetch()` wraps all calls.

### Grader service (`apps/grader-service`)
Standalone Node worker, no HTTP server. `node-cron` every 15 min (+ once at startup): queries `quiz_submissions.submissions WHERE status='in_progress' AND expires_at < NOW()`, fetches questions via `EXAM_SERVICE_URL/exams/internal/:id` (internal key), grades, then `UPDATE ... SET status='timed_out'` (the `WHERE status='in_progress'` is an optimistic lock against the user-submit race). Env: `DATABASE_URL` (=`SUBMISSION_DATABASE_URL`), `EXAM_SERVICE_URL`, `INTERNAL_API_KEY`.

### Admin System Overview (`user-service` `/admin/system/*`, read-only)
"System" tab on `/admin` — service health/logs/DB stats without SSH, gated by manual `role !== 'admin'` check.

- **`docker-socket-proxy`** (`tecnativa/docker-socket-proxy`, `CONTAINERS:1, LOGS:1, POST:0`) is the only thing touching the real Docker socket (mounted read-only); exec/restart/create endpoints are default-denied. No published port/Nginx route. This is what makes it safe even for a fully compromised `user-service` — read-only, not just "no button in the UI."
- `lib/docker.js` — `dockerode` via the proxy, looks up containers by Compose label (`com.docker.compose.service=<name>` + `project=${COMPOSE_PROJECT_NAME}`), not name strings.
- `lib/systemHealth.js` — calls each HTTP service's own `/health` over the Docker network.
- `routes/admin-system.js`: `GET /admin/system/services` (container state + `/health` per service, `grader-service` is container-only), `GET /admin/system/logs?service=&tail=` (service must be one of 7 known names, tail max 2000, demuxed + best-effort JSON-parsed), `GET /admin/system/database` (Postgres-instance-wide stats: `pg_stat_activity`, `pg_database_size`, per-schema sizes, recent migrations).
- `/health` on all 6 HTTP services also pings `pool.query('SELECT 1')` and reports pool stats — `status` stays `'ok'` even on DB-ping failure (distinct signal from "process not responding").
- Frontend: `systemApi`; `SystemServicesPanel` (polls ~25s), `SystemDatabasePanel`/`SystemLogsPanel` (manual refresh only).

### Rich-text exam description
Exam `description` is rich HTML. `RichTextEditor.svelte` (bold/italic/underline/lists/links) on create/edit; sanitized server-side via allowlist before storing (`apps/frontend/src/lib/sanitizeHtml.js`, also has `htmlToText()` for tag-stripping used in collection tag aggregation/search snippets); rendered as formatted HTML on detail page.

`/exams/[id]` shows a 1-random-question preview (`ORDER BY RANDOM() LIMIT 1`). Collection tags are **derived** (union of member exams' `tags`, computed in-query, never stored). Custom `+error.svelte` pages handle 404/5xx.

### Analytics & error monitoring
- **Zoho PageSense** + **Umami** — load-time script embeds in `apps/frontend/src/app.html` and `landing/index.html`; no npm packages.
- **Sentry** (`@sentry/sveltekit`) in `hooks.client.js`/`hooks.server.js`, enabled only when `import.meta.env.PROD`. Source maps uploaded at Docker build time via BuildKit secret `SENTRY_AUTH_TOKEN` (never baked into image layers; upload silently skipped if absent).
- Rotating Sentry DSN/org/project: update `hooks.client.js`, `hooks.server.js`, `vite.config.js` together.

### Landing page
`landing/` — static HTML for `novaquiz.net`/`www.novaquiz.net`: `index.html` (`/`), `brand.html` (`/brand`), `contact.html` (`/contact`). Each self-contained (inline style/script, no build step), matched by exact Nginx `location` blocks — a new landing page needs both the `.html` and its `location`. `landing/brand-assets/` served via `/brand-assets/`. The `default_server` block (local + `app.novaquiz.net`) skips all this, goes straight to the SPA.

Contact form posts JSON to `POST /api/notifications/contact` (`apps/notification-service/src/routes/contact.js`) — the one unauthenticated public route in that service, bypasses the subscription/queue system, sends directly via the Resend adapter to `CONTACT_EMAIL_TO`. Rate-limited 5/min (route-level, tighter than the service's global 300/min).

### CI/CD
- `build-push.yml` — on push to `main`; multi-platform (amd64+arm64) images to GHCR. Matrix: `auth-service` (legacy, built not deployed), `user/exam/submission/interaction/generator/notification/grader-service`, `frontend`.
- `deploy.yml` — after `build-push.yml` succeeds; SSHs into prod, runs `deploy.sh --update`.
- `cleanup-images.yml` — weekly (Sun 00:00 ICT); deletes GHCR versions beyond 5 most recent, keeps semver releases.

`GHCR_ORG` env var (default `tranphu-devops`) controls image name prefix.

## Conventions

- **Package manager:** npm per service (Dockerfiles use `npm install`). pnpm only for workspace tooling.
- **JWT role:** always `payload.user_metadata.role`. `payload.role` is GoTrue-internal (`"authenticated"`).
- **DB search_path:** via `?search_path=<schema>` in `DATABASE_URL`; never hardcode.
- **Exam answers visibility:** strip `correct_answer`/`explanation` from student-facing questions. `multiple` type returns `correct_count` instead.
- **Internal exam endpoint:** `GET /exams/internal/:id` requires `x-internal-key`, used only by submission-service, Nginx-blocked externally.
- **Multiple-choice answers:** sorted comma-separated option keys, e.g. `"A,C"` — always sort before storing.
- **Image URL construction:** `${AWS_PUBLIC_URL}/${key}`, key = `uploads/{type}/{timestamp}-{uuid}.{ext}`; extract key for deletion by slicing from `uploads/`.
- **Admin settings:** read from DB at runtime, never env. New configurable thresholds go in `quiz_users.admin_settings`.
- **Credit system:** `profiles.credits`; deducted by `POST /api/submissions/start` (user-service internal API). `exams.credit_cost` defaults from `admin_settings.default_exam_cost`. Admin configures `default_credits`, `teacher_upgrade_cost`, `default_exam_cost` in Credits tab.
- **Internal credit endpoint:** `POST /internal/credits/deduct` (user-service) — atomic `credits >= amount` UPDATE, 402 if insufficient, called only by submission-service with `x-internal-key`.
- **Public settings:** `GET /api/users/public/settings` — `teacher_upgrade_cost`, `default_credits`, `default_exam_cost`, no auth.
- **Teacher upgrade:** `POST /api/users/upgrade-to-teacher` — deducts credits, updates `auth.users.raw_user_meta_data` directly; user must log out/in for new role to apply.
- **Session credit flag:** take-page stores `credit_deducted: true` in localStorage to avoid double-charging on refresh.
- **Single-device exam session:** `POST /submissions/start` issues a UUID `exam_session_id`; every `PUT /submissions/:id/progress` and `POST /submissions/:id/submit` must pass it in `X-Session-Id` — mismatch → 409 (blocks a second tab/device). Stale session (>300s, `SESSION_STALE_SECS`) may be claimed by a new one. `GET /submissions/active?exam_id=` returns any existing `in_progress` submission.
- **Scheduled publish:** `exams.scheduled_at` future + `is_published=true` → visible but locked (live countdown, `POST /submissions/start` blocked with 423). Create/edit forms: draft/now/scheduled selector. `PUT /exams/:id` uses `(has_scheduled_at, scheduled_at_val)` pair so `null` can clear it.
- **Interactions gating:** comments — any authenticated user; likes — students only (403 otherwise); reports — only after a completed submission. Comment moderation: author+admin only. Report responses: owner+admin, flip to `resolved`.
- **Exam notes are not persisted:** take-page note is in-memory `$state` only — don't add a notes table/endpoint.
- **Soft-delete (exams/questions/collections):** DELETE sets `deleted_at=NOW()`; all SELECTs must filter `AND deleted_at IS NULL`. Deleting an exam cascades to its questions. No restore UI — recovery is manual DB.
- **`POST /exams` requires explicit `credit_cost`:** column is `NOT NULL DEFAULT 10` but the route inserts whatever's given (including `null`) — omitted/`null` always 500s. Programmatic callers (e.g. generator-service) must resolve `admin_settings.default_exam_cost` themselves.

## Design System

Xem chi tiết đầy đủ tại `DESIGN.md`. Tóm tắt nhanh:

- **Brand gradient**: `linear-gradient(135deg, #5625d1, #6d29d3)` — monochromatic deep purple, dùng thống nhất trên landing page và quiz app.
- **CSS tokens** (quiz app — `+layout.svelte` `:root`):
  - Light (default): `--primary: #5625d1` · `--accent: #6d29d3` · `--primary-light: #ede6ff` · `--bg: #f8f7ff` · `--surface: #ffffff` · `--text: #2b2a3f` · `--border: #d0d2e1`
  - Dark (`[data-theme="dark"]`): `--bg: #202331` · `--surface: #2d2b42` · `--text: #f1f5f9` · `--border: #3d4055`; brand override `--primary: #c084fc` · `--primary-dark: #a855f7` · `--accent: #e879f9` · `--primary-light: rgba(192,132,252,0.18)` (light-mode hex has ~1.9:1 contrast on dark surfaces, so dark mode uses lighter tones ~6:1).
- **Typography**: Inter (body/UI), JetBrains Mono (code), Google Fonts.
- **Border radius**: `--radius-card: 16px` · `--radius-btn: 10px` · inputs 8px.
- **Shadows**: `0 4px 20px rgba(86,37,209,0.08)` default · `0 12px 36px rgba(86,37,209,0.18)` hover.
- **Dark mode**: toggle via `localStorage('quiz-theme')` → `document.documentElement.dataset.theme`.
- Dùng CSS custom properties, không hard-code hex. Mobile-first, breakpoint 768px. Không dùng Bootstrap/jQuery, vanilla CSS.
