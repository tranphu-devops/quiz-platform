# Quiz Platform

MVP ứng dụng tạo bài thi trắc nghiệm với kiến trúc microservices.

## Services

| Service | Port | Mô tả |
|---|---|---|
| auth-service | 3001 | JWT login/register |
| user-service | 3002 | User profile |
| exam-service | 3003 | Tạo đề, quản lý câu hỏi |
| submission-service | 3004 | Nộp bài, chấm điểm |
| frontend | 3000 | SvelteKit app |

## Quick Start

```bash
cp .env.example .env
# Chỉnh sửa .env với các giá trị thực

docker compose up --build
```

Truy cập: http://localhost

## Dev (với hot reload)

```bash
docker compose up --build
# Services có volume mount cho src/
```

## Tech Stack

- **Frontend**: SvelteKit 2 + Node adapter
- **Backend**: Node.js 24 + Fastify
- **Database**: PostgreSQL 16 (multi-schema)
- **Container**: Docker Compose + Nginx
- **Registry**: GitHub Container Registry (GHCR)
- **CI/CD**: GitHub Actions
