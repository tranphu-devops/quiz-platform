# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased] — 2026-06-18 (latest)

### Changed
- **Edit exam page**: Redesign thành wizard 4 bước giống trang create — Thông tin → Import JSON → Câu hỏi → Review & Lưu. Thêm toggle Xuất bản/Nháp nổi bật ở bước 1; step indicator cho phép click để nhảy đến bất kỳ bước nào; question card hiển thị badge "Đã lưu" cho câu hỏi đã có trong DB
- **Publish logic**: Student chỉ thấy collection có `is_published = true` VÀ có ít nhất 1 exam published. Exam draft (`is_published = false`) bị ẩn hoàn toàn
- **Trang `/exams`**: Thêm section "Bộ đề" hiển thị published collections (danh sách exam bên trong, creator name, huy hiệu); thêm stats trên mỗi exam card: số lượt thi, tỷ lệ pass, tên/email người tạo

### Changed (backend)
- `GET /api/exams/exams`: Thêm `creator_name`, `submission_count`, `pass_count` vào response (JOIN với `quiz_users.profiles`, `auth.users`, `quiz_submissions.submissions`)
- `GET /api/exams/collections` (student view): Filter `HAVING COUNT published exams > 0`; chỉ include published exams trong `exams` array; thêm `creator_name`; teacher/admin views cũng nhận `creator_name`

### Changed
- **Landing page** (`landing/index.html`): Cập nhật toàn diện — thêm 3 showcase section (Bộ đề & Huy hiệu, Credit system, JSON Import) với mockup UI minh hoạ; mở rộng features grid lên 9 tính năng; thêm section FAQ 6 câu; cập nhật "Cách hoạt động" 4 bước; nav bar thêm anchor links; Inter font; gradient indigo/violet nhất quán
- **Trang tạo đề thi redesign**: Wizard 4 bước — (1) Thông tin cơ bản → (2) Import JSON → (3) Sửa câu hỏi → (4) Review & Lưu. Step indicator có thể click để quay lại bước trước.

### Added
- Tính năng import câu hỏi từ JSON: drag & drop hoặc click chọn file, parse + validate, preview số câu import được, chọn thay thế hoặc ghép thêm vào câu hỏi hiện có
- File mẫu `/question-template.json` có sẵn để download — bao gồm ví dụ câu single/multiple + hướng dẫn inline


### Added
- **Collections & Badges**: Teacher tạo bộ đề (nhóm nhiều đề thi), chọn huy hiệu từ thư viện 50 preset hoặc tải lên ảnh tùy chỉnh. Student hoàn thành toàn bộ đề thi trong collection → tự động nhận huy hiệu
- 50 badge SVG preset (64×64) trong `static/badges/`, sinh bằng `scripts/generate-badges.js`
- `BadgePicker.svelte` — component chọn badge với 2 tab: thư viện preset và upload ảnh
- `/collections`, `/collections/create`, `/collections/[id]/edit` — quản lý bộ đề (teacher/admin)
- Sidebar & navbar: link "Bộ đề" cho teacher/admin
- Profile page: section huy hiệu đã đạt (student)
- `GET /api/users/badges/:userId` — danh sách huy hiệu của user
- `GET /api/exams/collections/internal/check-badge` — internal endpoint cho submission-service kiểm tra badge
- `infra/postgres/migrate_collections.sql` — migration script
- Admin tab **Bộ đề**: xem toàn bộ collections, số huy hiệu đã trao, toggle xuất bản, xoá

### Changed
- **Exam detail page redesign**: Hero banner với cover image, layout 2 cột (main + sticky sidebar), preview 3 câu hỏi đầu không có đáp án, CTA buttons mobile-first, extensible section structure cho reviews/teacher intro

### Added
- **Credit system**: Người dùng mới nhận 20 credit (admin configurable)
- `profiles.credits` column — theo dõi số dư credit của từng user
- `exams.credit_cost` column — số credit cần để làm bài (default 10, teacher tự set)
- `POST /api/submissions/start` — deduct credit khi bắt đầu bài thi (atomic, 402 nếu không đủ)
- `POST /api/users/internal/credits/deduct` — internal endpoint cho submission-service gọi
- `PATCH /api/users/admin/users/:id/credits` — admin sửa credit của user bất kỳ
- `POST /api/users/upgrade-to-teacher` — student dùng credit mua gói Teacher
- `GET /api/users/public/settings` — lấy credit settings không cần auth (teacher_upgrade_cost, default_credits, default_exam_cost)
- Admin tab **Credits**: cấu hình `default_credits`, `teacher_upgrade_cost`, `default_exam_cost`
- Admin tab **Người dùng**: cột Credits với inline edit
- Exam create/edit: field `credit_cost`
- Profile page: hiện số dư credit + section nâng cấp lên Teacher
- Take page: tự động deduct credit khi load, hiện badge credit còn lại, màn hình lỗi nếu không đủ
- Exam detail: hiện credit cost, balance, disable nút Start nếu không đủ credit
- `infra/postgres/migrate_credits.sql` — migration script

### Changed
- `GET /api/users/:id` và `GET /api/users/admin/users` — thêm trường `credits` vào response
- Profile upsert: user mới nhận `default_credits` từ admin_settings; update không ghi đè credits
- `docker-compose.yml` + `docker-compose.override.yml`: thêm `USER_SERVICE_URL` cho submission-service

---

## [0.5.0] — 2026-06-17

### Added
- Thay thế exec-based health check bằng docker inspect (Phase 9 fix)
- Sidebar user section hiển thị avatar và full name đúng
- Redesign UI: indigo/violet theme, mobile sidebar responsive
- Production deploy script (`deploy.sh`) cho Ubuntu 24.04

---

## [0.4.0] — 2026-06-17

### Added
- Image upload: S3/Lightsail Object Storage cho avatar, exam cover, question image
- `POST /api/users/upload` — single upload endpoint với validation từ admin_settings
- `ImageUpload.svelte` component drag-and-drop với preview
- Admin tab Upload Settings: cấu hình max size và allowed MIME types
- Udemy-style exam list với cover image / gradient placeholder
- Landing page riêng cho domain `phutx.top`

---

## [0.3.0] — 2026-06-17

### Added
- AWS SAA exam seed data (3 exams, 45 questions) — `infra/postgres/seed_aws_saa.sql`
- Admin user management: xem danh sách user, đổi role
- Tags, explanation (markdown), multiple-choice question support
- Exam modes: thi chính thức (pass 1 lần) vs thi thực hành (làm lại nhiều lần)
- Pass-gated content review sau khi nộp bài
- Attempt history table trên exam detail page
- Submit confirmation modal khi còn câu chưa trả lời
- LocalStorage session persistence trong take page (kèm timer bù thời gian)
- Role dashboards: student / teacher / admin redirect về trang phù hợp

### Fixed
- Google OAuth callback loop: dùng `/auth-callback` thay `/auth/callback` làm `redirectTo`
- Input styles, student exam preview, take-page state persistence
- Schema-qualified table names trong seed files

---

## [0.2.0] — 2026-06-16

### Added
- Thay thế auth-service bằng GoTrue SSO (`supabase/gotrue:v2.151.0`)
- CASL authorization (`@casl/ability`) trên cả 3 backend services
- Google OAuth (configurable qua `GOOGLE_OAUTH_ENABLED`)
- Multi-platform Docker images (amd64 + arm64) qua GitHub Actions
- Nginx proxy paths làm default API URLs trong frontend

### Changed
- Chuyển toàn bộ Dockerfile từ pnpm sang npm

---

## [0.1.0] — 2026-06-16

### Added
- Initial MVP: microservices monorepo (user-service, exam-service, submission-service, frontend)
- SvelteKit 5 frontend (SSR disabled, client-only SPA)
- Fastify backend services với PostgreSQL 16 (multi-schema)
- Nginx ingress với routing đến từng service
- Exam CRUD, question management, auto-grading khi submit
- pnpm workspace, Docker Compose dev environment với hot reload
