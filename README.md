# Quiz Platform

Ứng dụng tạo & thi trắc nghiệm trực tuyến, kiến trúc microservices. Một PostgreSQL dùng chung (mỗi service một schema riêng), Nginx là ingress duy nhất, auth qua GoTrue (SSO + Google OAuth).

## Services

| Service | Port (Docker) | Dev Port | Mô tả |
|---|---|---|---|
| GoTrue (SSO) | 9999 | 9999 | Đăng ký / đăng nhập / Google OAuth / JWT |
| user-service | 3002 | 4002 | Profile, upload ảnh (S3), credit, admin settings |
| exam-service | 3003 | 4003 | Đề thi, câu hỏi, bộ đề (collections) |
| submission-service | 3004 | 4004 | Nộp bài, chấm điểm, phiên thi 1-thiết-bị |
| interaction-service | 3005 | 4005 | Bình luận / thích / báo lỗi |
| grader-service | — | — | Worker cron (15 phút/lần) tự chấm bài hết giờ — không có HTTP |
| migrate | — | — | Job one-shot chạy migration rồi thoát; các service chờ nó xong mới khởi động |
| frontend | 3000 | 4000 | SvelteKit 5 SPA (SSR tắt) |
| nginx | 80 | 80 | Reverse proxy / ingress |

## Quick Start

**Prerequisites:** Docker, Docker Compose

```bash
cp .env.example .env
# Điền tối thiểu: POSTGRES_PASSWORD, JWT_SECRET (≥32 ký tự),
# INTERNAL_API_KEY (≥32 ký tự), SITE_URL, và các *_DATABASE_URL.

docker compose up --build
```

Truy cập: http://localhost

Schema DB được áp **tự động** bởi service `migrate` mỗi lần `up` (không cần chạy `psql` thủ công). Xem chi tiết ở [CLAUDE.md](CLAUDE.md#database-migrations-automatic).

## Dev (hot reload)

`docker-compose.override.yml` tự áp dụng khi chạy `docker compose up`. Nó:
- Mount `src/` của mỗi service → hot reload qua `node --watch`
- Expose thêm port trên host (4000–4005, 9999, 5432)

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
curl http://localhost/api/interactions/health
```

## Tính năng chính

- **Soạn đề**: wizard 4 bước, import câu hỏi từ JSON, ảnh bìa & ảnh câu hỏi, câu đơn/nhiều đáp án đúng, giải thích markdown.
- **Bộ đề & Huy hiệu**: gom nhiều đề thành lộ trình; hoàn thành toàn bộ → tự động trao huy hiệu trên profile.
- **Hệ thống Credit**: mỗi đề có credit cost; trừ credit khi bắt đầu thi; admin cấu hình mức credit.
- **Phiên thi an toàn**: mỗi bài chỉ trên một thiết bị (session UUID); auto-save tiến trình; resume khi login lại; auto-grade khi hết giờ (grader-service); xuất bản theo lịch với đếm ngược.
- **Tương tác**: bình luận, thích (❤️ chỉ student), báo lỗi đề (sau khi hoàn thành bài) + hộp thư xử lý cho teacher/admin.
- **Khám phá đề**: trang `/exams` lọc theo tag, sắp xếp (mới nhất / phổ biến), hiển thị số lượt thích & bình luận trên mỗi thẻ.
- **Hồ sơ công khai** (`/users/[id]`): xem thông tin người tạo đề + danh sách đề đã công bố.

## Tech Stack

- **Frontend**: SvelteKit 5 + Node adapter + @supabase/auth-js (SSR tắt, SPA)
- **Backend**: Node.js 24 + Fastify + CASL (authorization)
- **Auth**: GoTrue (supabase/gotrue:v2.151.0) — JWT HS256, Google OAuth optional
- **Database**: PostgreSQL 16 (multi-schema; migration đánh số tự động)
- **Storage**: Lightsail / S3-compatible object storage (upload ảnh)
- **Container**: Docker Compose + Nginx
- **Registry**: GitHub Container Registry (GHCR)
- **CI/CD**: GitHub Actions — matrix build (user / exam / submission / interaction / grader / frontend), auto-deploy lên server sau khi build thành công

## Roles

| Role | Quyền |
|---|---|
| `student` | Xem đề đã publish, làm bài, xem submission của mình, thích & báo lỗi đề |
| `teacher` | CRUD đề của mình, xem tất cả submissions, xử lý báo lỗi đề của mình |
| `admin` | Full access |
| `banned` | Bị chặn ngay ở middleware (kiểm tra live trong DB) |

Role đặt tại đăng ký trong `user_metadata.role` và embed vào JWT. Chi tiết kiến trúc & quy ước xem [CLAUDE.md](CLAUDE.md); design system xem [DESIGN.md](DESIGN.md).
