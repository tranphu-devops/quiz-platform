# Quiz Platform — Claude Code Context

## Mục tiêu dự án

Xây dựng **MVP ứng dụng tạo bài thi trắc nghiệm** với kiến trúc microservices, chạy bằng Docker Compose, images đẩy lên GHCR.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit (Node adapter) |
| Backend | Node.js + Fastify hoặc Express |
| Database | PostgreSQL 16 (1 instance, multi-schema) |
| Container Registry | ghcr.io |
| Orchestration (local) | Docker Compose |
| Reverse Proxy | Nginx hoặc Traefik |
| CI/CD | GitHub Actions |

---

## Monorepo Structure

```
quiz-platform/
├── apps/
│   ├── auth-service/          # JWT login/register
│   ├── user-service/          # User profile, roles
│   ├── exam-service/          # Tạo đề, quản lý câu hỏi
│   ├── submission-service/    # Nộp bài, chấm điểm
│   └── frontend/              # SvelteKit app
├── infra/
│   ├── nginx/
│   │   └── nginx.conf
│   └── postgres/
│       └── init.sql
├── .github/
│   └── workflows/
│       └── build-push.yml     # Build & push all images to GHCR
├── docker-compose.yml
├── docker-compose.override.yml  # local dev overrides
├── .env.example
└── README.md
```

---

## Services chi tiết

### 1. auth-service (port 3001)

**Trách nhiệm:** Đăng ký, đăng nhập, cấp JWT, verify token

**Endpoints:**
```
POST /auth/register     → { email, password, role }
POST /auth/login        → { email, password } → { token, user }
POST /auth/verify       → { token } → { userId, role }  # internal only
GET  /auth/health
```

**DB Schema (quiz_auth):**
```sql
CREATE SCHEMA IF NOT EXISTS quiz_auth;
CREATE TABLE quiz_auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- admin | teacher | student
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Env vars:**
```
DATABASE_URL=postgres://postgres:password@postgres:5432/quizdb?search_path=quiz_auth
JWT_SECRET=
JWT_EXPIRES_IN=7d
PORT=3001
```

---

### 2. user-service (port 3002)

**Trách nhiệm:** Quản lý profile user, lookup theo userId

**Endpoints:**
```
GET  /users/:id         → user profile
PUT  /users/:id         → update profile
GET  /users/health
```

**DB Schema (quiz_users):**
```sql
CREATE SCHEMA IF NOT EXISTS quiz_users;
CREATE TABLE quiz_users.profiles (
  id UUID PRIMARY KEY,              -- same UUID as auth.users.id
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Env vars:**
```
DATABASE_URL=postgres://postgres:password@postgres:5432/quizdb?search_path=quiz_users
AUTH_SERVICE_URL=http://auth-service:3001
PORT=3002
```

---

### 3. exam-service (port 3003)

**Trách nhiệm:** CRUD đề thi, quản lý bank câu hỏi, lấy đề để thi

**Endpoints:**
```
POST   /exams                    → tạo đề thi (teacher/admin)
GET    /exams                    → list đề thi
GET    /exams/:id                → chi tiết đề (không có đáp án khi student gọi)
PUT    /exams/:id                → cập nhật đề
DELETE /exams/:id                → xoá đề

POST   /exams/:id/questions      → thêm câu hỏi
PUT    /exams/:id/questions/:qid → cập nhật câu hỏi
DELETE /exams/:id/questions/:qid → xoá câu hỏi

GET    /exams/health
```

**DB Schema (quiz_exams):**
```sql
CREATE SCHEMA IF NOT EXISTS quiz_exams;

CREATE TABLE quiz_exams.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  time_limit INT DEFAULT 30,         -- phút
  created_by UUID NOT NULL,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_exams.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES quiz_exams.exams(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  options JSONB NOT NULL,            -- [{ key: "A", text: "..." }, ...]
  correct_answer TEXT NOT NULL,      -- "A" | "B" | "C" | "D"
  points FLOAT DEFAULT 1.0,
  order_index INT DEFAULT 0
);
```

**Env vars:**
```
DATABASE_URL=postgres://postgres:password@postgres:5432/quizdb?search_path=quiz_exams
AUTH_SERVICE_URL=http://auth-service:3001
PORT=3003
```

---

### 4. submission-service (port 3004)

**Trách nhiệm:** Nhận bài nộp, auto-grade MCQ, lưu kết quả

**Endpoints:**
```
POST /submissions              → nộp bài thi → trả về score ngay
GET  /submissions/:id          → chi tiết bài nộp
GET  /submissions?examId=&userId=  → list submissions
GET  /submissions/health
```

**DB Schema (quiz_submissions):**
```sql
CREATE SCHEMA IF NOT EXISTS quiz_submissions;

CREATE TABLE quiz_submissions.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL,            -- { "question_id": "A", ... }
  score FLOAT,
  total_points FLOAT,
  percentage FLOAT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Grading logic:** Gọi exam-service lấy `correct_answer` cho từng câu → so sánh → tính điểm

**Env vars:**
```
DATABASE_URL=postgres://postgres:password@postgres:5432/quizdb?search_path=quiz_submissions
AUTH_SERVICE_URL=http://auth-service:3001
EXAM_SERVICE_URL=http://exam-service:3003
PORT=3004
```

---

### 5. frontend (port 5173 dev / 3000 prod)

**Framework:** SvelteKit với Node adapter

**Pages:**
```
/                    → Landing / redirect
/login               → Đăng nhập
/register            → Đăng ký
/dashboard           → Home sau login (phân nhánh theo role)
/exams               → Danh sách đề thi (student xem, teacher quản lý)
/exams/create        → Tạo đề thi (teacher/admin only)
/exams/:id           → Chi tiết / bắt đầu thi
/exams/:id/take      → Trang làm bài thi
/exams/:id/result    → Kết quả sau nộp
```

**Env vars:**
```
PUBLIC_AUTH_URL=http://localhost:3001
PUBLIC_EXAM_URL=http://localhost:3003
PUBLIC_SUBMISSION_URL=http://localhost:3004
```

---

## Docker Compose

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - auth-service
      - user-service
      - exam-service
      - submission-service
      - frontend

  auth-service:
    image: ghcr.io/${GITHUB_ORG}/auth-service:${TAG:-latest}
    build:
      context: ./apps/auth-service
    environment:
      DATABASE_URL: ${AUTH_DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3001
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  user-service:
    image: ghcr.io/${GITHUB_ORG}/user-service:${TAG:-latest}
    build:
      context: ./apps/user-service
    environment:
      DATABASE_URL: ${USER_DATABASE_URL}
      AUTH_SERVICE_URL: http://auth-service:3001
      PORT: 3002
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  exam-service:
    image: ghcr.io/${GITHUB_ORG}/exam-service:${TAG:-latest}
    build:
      context: ./apps/exam-service
    environment:
      DATABASE_URL: ${EXAM_DATABASE_URL}
      AUTH_SERVICE_URL: http://auth-service:3001
      PORT: 3003
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  submission-service:
    image: ghcr.io/${GITHUB_ORG}/submission-service:${TAG:-latest}
    build:
      context: ./apps/submission-service
    environment:
      DATABASE_URL: ${SUBMISSION_DATABASE_URL}
      AUTH_SERVICE_URL: http://auth-service:3001
      EXAM_SERVICE_URL: http://exam-service:3003
      PORT: 3004
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    image: ghcr.io/${GITHUB_ORG}/frontend:${TAG:-latest}
    build:
      context: ./apps/frontend
    environment:
      PUBLIC_AUTH_URL: http://localhost/api/auth
      PUBLIC_EXAM_URL: http://localhost/api/exams
      PUBLIC_SUBMISSION_URL: http://localhost/api/submissions
      PORT: 3000
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: quizdb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d quizdb"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## Nginx config mẫu

```nginx
# infra/nginx/nginx.conf
events {}
http {
  upstream auth      { server auth-service:3001; }
  upstream users     { server user-service:3002; }
  upstream exams     { server exam-service:3003; }
  upstream submissions { server submission-service:3004; }
  upstream frontend  { server frontend:3000; }

  server {
    listen 80;

    location /api/auth/        { proxy_pass http://auth/; }
    location /api/users/       { proxy_pass http://users/; }
    location /api/exams/       { proxy_pass http://exams/; }
    location /api/submissions/ { proxy_pass http://submissions/; }
    location /                 { proxy_pass http://frontend; }
  }
}
```

---

## GitHub Actions — Build & Push GHCR

```yaml
# .github/workflows/build-push.yml
name: Build & Push to GHCR

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  ORG: ${{ github.repository_owner }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    strategy:
      matrix:
        service:
          - auth-service
          - user-service
          - exam-service
          - submission-service
          - frontend

    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.ORG }}/${{ matrix.service }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./apps/${{ matrix.service }}
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## .env.example

```bash
# GitHub
GITHUB_ORG=your-github-org

# PostgreSQL
POSTGRES_PASSWORD=changeme

# Connection strings (multi-schema, same DB)
AUTH_DATABASE_URL=postgres://postgres:changeme@postgres:5432/quizdb?search_path=quiz_auth
USER_DATABASE_URL=postgres://postgres:changeme@postgres:5432/quizdb?search_path=quiz_users
EXAM_DATABASE_URL=postgres://postgres:changeme@postgres:5432/quizdb?search_path=quiz_exams
SUBMISSION_DATABASE_URL=postgres://postgres:changeme@postgres:5432/quizdb?search_path=quiz_submissions

# Auth
JWT_SECRET=change_this_to_a_random_secret_min_32_chars

# Image tag
TAG=latest
```

---

## Thứ tự thực hiện trong Claude Code

```
1. Tạo GitHub repo (gh repo create quiz-platform --public)
2. Scaffold monorepo: tạo thư mục, package.json gốc
3. Tạo từng service theo thứ tự: auth → user → exam → submission
   - Mỗi service: src/, package.json, Dockerfile, .dockerignore
4. Tạo SvelteKit frontend
5. Tạo infra/: nginx.conf, init.sql
6. Tạo docker-compose.yml + .env.example
7. Tạo .github/workflows/build-push.yml
8. git init + commit + push
9. Kiểm tra GitHub Actions chạy thành công
10. Test local: docker compose up --build
```

---

## Conventions

- **Node.js version:** 24 LTS (Alpine image: `node:24-alpine`)
- **Package manager:** pnpm (dùng `pnpm-lock.yaml`)
- **Code style:** ESLint + Prettier
- **Auth middleware:** Mỗi service tự verify JWT bằng cách gọi `POST /auth/verify` vào auth-service (hoặc verify local bằng JWT_SECRET)
- **Error format:** `{ error: string, statusCode: number }`
- **Health check:** Mỗi service có `GET /health` trả `{ status: "ok", service: "...", timestamp: "..." }`
- **Logging:** `console.json` hoặc `pino` logger

---

## Ghi chú bổ sung

- MVP không cần message queue — grading synchronous trong submission-service
- Chưa cần Redis — session stateless qua JWT
- PostgreSQL dùng chung 1 instance nhưng **tách schema rõ ràng** → dễ tách service sau
- Tất cả internal service-to-service call dùng **Docker network name**, không qua Nginx
- Frontend gọi API qua `/api/*` (qua Nginx) để tránh CORS
