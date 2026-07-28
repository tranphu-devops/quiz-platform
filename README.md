# NovaQuiz

*[Tiếng Việt](README.vi.md) · [日本語](README.ja.md)*

An online quiz platform (create, publish, and take exams) built as a microservices monorepo. One shared PostgreSQL instance (a dedicated schema per service), a single Nginx ingress, and GoTrue for auth (email/password + Google OAuth).

## Services

| Service | Docker port | Dev port | Description |
|---|---|---|---|
| GoTrue (SSO) | 9999 | 9999 | Signup / login / Google OAuth / JWT issuance |
| user-service | 3002 | 4002 | Profiles, image uploads (S3), credits, admin settings, Teacher API keys |
| exam-service | 3003 | 4003 | Exams, questions, collections |
| submission-service | 3004 | 4004 | Submissions, grading, single-device exam sessions |
| interaction-service | 3005 | 4005 | Comments / likes / error reports |
| generator-service | 3006 | 4006 | AI-generated exams from uploaded documents (PDF/DOCX/text) |
| notification-service | 3007 | 4007 | Admin alerts + per-user activity notifications (Email/Pushover/Telegram) |
| grader-service | — | — | Cron worker (every 15 min) auto-grading expired submissions — no HTTP server |
| migrate | — | — | One-shot job that applies DB migrations then exits; every service waits on it |
| frontend | 3000 | 4000 | SvelteKit 5 SPA (SSR disabled) |
| nginx | 80 | 80 | Reverse proxy / single ingress |

> `apps/auth-service/` is a legacy prototype, not wired into Compose/Nginx — ignore it.

## Quick Start

**Prerequisites:** Docker, Docker Compose

```bash
cp .env.example .env
# Fill in at minimum: POSTGRES_PASSWORD, JWT_SECRET (>=32 chars),
# INTERNAL_API_KEY (>=32 chars), SITE_URL, and the *_DATABASE_URL vars.

docker compose up --build
```

Visit: http://localhost

The DB schema is applied **automatically** by the `migrate` service on every `up` (no manual `psql` step). See [CLAUDE.md](CLAUDE.md#database-migrations-automatic) for details.

## Dev (hot reload)

`docker-compose.override.yml` is applied automatically by `docker compose up`. It:
- Mounts each service's `src/` for hot reload via `node --watch`
- Exposes extra ports on the host (4000–4007, 9999, 5432, 6379)

## Quick test with curl

```bash
# Sign up
curl -s -X POST http://localhost/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"123456","data":{"role":"teacher"}}' | jq

# Log in -> get a token
TOKEN=$(curl -s -X POST http://localhost/auth/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"123456"}' | jq -r '.access_token')

# Create an exam
curl -s -X POST http://localhost/api/exams/exams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Exam","time_limit":30,"credit_cost":0}' | jq

# Health checks
curl http://localhost/auth/health
curl http://localhost/api/exams/health
curl http://localhost/api/users/health
curl http://localhost/api/submissions/health
curl http://localhost/api/interactions/health
curl http://localhost/api/generator/health
curl http://localhost/api/notifications/health
```

## Key features

- **Exam builder**: 4-step wizard, JSON question import, cover & per-question images, single/multiple-correct-answer questions, markdown explanations.
- **AI-generated exams**: teachers upload a document (PDF/DOCX/text) at `/exams/generate` — an LLM (via OpenRouter) drafts a full multiple-choice exam as a draft for review. Uses the teacher's own LLM key or an admin-configured platform key (deducts credits).
- **Collections & badges**: group exams into a learning path; completing every exam in a published collection automatically awards a badge on the student's profile.
- **Credit system**: each exam has a credit cost, deducted when a student starts it; admin configures the defaults. Referral program: invite a friend, both sides earn credits once the referee upgrades to teacher or completes a paid action.
- **Secure exam sessions**: one device per attempt (session UUID); progress auto-saves; resumes on re-login; auto-graded when time runs out (grader-service); scheduled publishing with a live countdown.
- **Interactions**: comments, likes (students only), error reports (after finishing an attempt) with a resolution inbox for teachers/admins.
- **Discover exams**: `/exams` filterable by tag, sortable (newest / most popular), with like/comment counts on every card.
- **Public profiles** (`/users/[id]`): a creator's bio, social links, and published exams.
- **Multi-channel notifications**: per-user activity alerts (submission graded, comment reply, report resolved, etc.) and admin/system alerts, delivered over Email (Resend), Pushover, or Telegram — each user opts in per event type on `/profile`.
- **Teacher API**: long-lived API keys (`/profile`) let teachers manage exams programmatically without a browser session — see `/api-docs`.
- **Admin System Overview**: read-only service health, logs, and DB stats on `/admin`, no SSH required.

## Tech stack

- **Frontend**: SvelteKit 5 + Node adapter + `@supabase/auth-js` (SSR disabled, SPA)
- **Backend**: Node.js 24 + Fastify + CASL (authorization)
- **Auth**: GoTrue (`supabase/gotrue:v2.151.0`) — JWT HS256, optional Google OAuth
- **Database**: PostgreSQL 16 (multi-schema; numbered, idempotent migrations)
- **Cache**: Redis (best-effort read-through cache for exam/user/interaction services)
- **Storage**: Lightsail / S3-compatible object storage (image uploads)
- **Containers**: Docker Compose + Nginx
- **Registry**: GitHub Container Registry (GHCR)
- **CI/CD**: GitHub Actions — matrix build (user / exam / submission / interaction / generator / notification / grader / frontend), auto-deploy to the server on a successful build

## Roles

| Role | Permissions |
|---|---|
| `student` | View published exams, take exams, view own submissions, like & report exams |
| `teacher` | CRUD own exams, view all submissions, resolve reports on own exams |
| `admin` | Full access |
| `banned` | Blocked at the auth middleware (checked live against the DB) |

The role is set at signup in `user_metadata.role` and embedded in the JWT. See [CLAUDE.md](CLAUDE.md) for architecture/conventions, and [DESIGN.md](DESIGN.md) for the design system.
