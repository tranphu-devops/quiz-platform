# Quiz Platform

MVP ứng dụng tạo bài thi trắc nghiệm với kiến trúc microservices.

## Services

| Service | Port (Docker) | Dev Port | Mô tả |
|---|---|---|---|
| GoTrue (SSO) | 9999 | 9999 | Đăng ký / đăng nhập / JWT |
| user-service | 3002 | 4002 | User profile |
| exam-service | 3003 | 4003 | Tạo đề, quản lý câu hỏi |
| submission-service | 3004 | 4004 | Nộp bài, chấm điểm |
| frontend | 3000 | 4000 | SvelteKit SPA |
| nginx | 80 | 80 | Reverse proxy |

## Quick Start

**Prerequisites:** Docker, Docker Compose

```bash
cp .env.example .env
# Điền JWT_SECRET và POSTGRES_PASSWORD vào .env

docker compose up --build
```

Truy cập: http://localhost

## Dev (hot reload)

`docker-compose.override.yml` tự động áp dụng khi chạy `docker compose up`. Nó:
- Mount `src/` của mỗi service → hot reload qua `node --watch`
- Expose thêm port trên host (4000-4004, 9999, 5432)

## Test nhanh bằng curl

```bash
# Đăng ký
curl -s -X POST http://localhost/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"123456","data":{"role":"teacher"}}' | jq

# Đăng nhập → lấy token
TOKEN=$(curl -s -X POST http://localhost/auth/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"123456"}' | jq -r '.access_token')

# Tạo đề thi
curl -s -X POST http://localhost/api/exams/exams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Exam","time_limit":30}' | jq

# Health checks
curl http://localhost/auth/health
curl http://localhost/api/exams/health
curl http://localhost/api/users/health
curl http://localhost/api/submissions/health
```

## Tech Stack

- **Frontend**: SvelteKit 5 + Node adapter + @supabase/auth-js
- **Backend**: Node.js 24 + Fastify + CASL
- **Auth**: GoTrue (supabase/gotrue:v2.151.0) — JWT HS256, Google OAuth optional
- **Database**: PostgreSQL 16 (multi-schema)
- **Container**: Docker Compose + Nginx
- **Registry**: GitHub Container Registry (GHCR)
- **CI/CD**: GitHub Actions (matrix build: user/exam/submission/frontend)

## Roles

| Role | Quyền |
|---|---|
| `student` | Xem đề đã publish, làm bài, xem submission của mình |
| `teacher` | CRUD đề của mình, xem tất cả submissions |
| `admin` | Full access |

Role được đặt tại đăng ký trong `user_metadata.role` và embed vào JWT.
