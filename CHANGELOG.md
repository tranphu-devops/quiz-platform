# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased] — 2026-06-20 (updated 2)

### Added
- **Auto-save tiến trình làm bài**: Mỗi lần học sinh bấm "Câu sau →", đáp án hiện tại được lưu lên backend (`PUT /submissions/:id/progress`) — đảm bảo không mất dữ liệu nếu thoát giữa chừng hoặc mất mạng.
- **Auto-grade khi hết giờ (grader-service)**: Service mới chạy độc lập, cron 15 phút/lần, quét tất cả submission `in_progress` đã qua `expires_at`, tự động chấm điểm và ghi kết quả (status `timed_out`) — kể cả khi học sinh không bấm nộp bài.
- **Submission có trạng thái (`status`)**: Schema submissions bổ sung `status` (`in_progress` | `completed` | `timed_out`), `started_at`, `expires_at`. Credit chỉ bị trừ 1 lần duy nhất; nếu còn `in_progress` hợp lệ, bấm vào lại sẽ resume mà không trừ thêm.
- **Resume bài thi**: Khi học sinh quay lại sau khi thoát, frontend kiểm tra trạng thái submission trên server — nếu vẫn `in_progress` thì tiếp tục từ câu đã làm; nếu đã được chấm thì chuyển thẳng sang trang kết quả.
- **Mã hoá API response (production)**: Backend mã hoá toàn bộ response bằng AES-256-GCM; frontend giải mã trong suốt. Dùng ECDH P-256 key exchange — shared key không bao giờ truyền trên wire, bảo vệ khỏi Nginx/proxy inspection. Chỉ kích hoạt khi `NODE_ENV=production` + `API_ENCRYPTION_KEY` được set. Dev mode không ảnh hưởng.
- **Resume bài thi sau khi đóng tab / đổi thiết bị**: Khi student vào lại trang làm bài, frontend kiểm tra server (`GET /submissions/active?exam_id=`) để tìm session `in_progress` còn thời hạn — kể cả khi localStorage đã bị xoá hoặc đang dùng thiết bị khác. Đáp án đã lưu trên server được restore, đồng hồ đếm ngược tiếp tục từ thời gian còn lại (server-authoritative). Không trừ credit lần 2.
- **Dashboard student — bài thi đang làm dở**: Section mới hiển thị tất cả submission `in_progress` còn thời hạn kèm bộ đếm ngược và nút "Tiếp tục". Stat card "Đang thi dở" hiển thị số lượng.
- **Chống gian lận: 1 tài khoản = 1 thiết bị làm bài**: Mỗi submission `in_progress` được gắn `exam_session_id` (UUID) và `session_last_active`. Khi một thiết bị đang làm bài, mọi thiết bị khác cố truy cập cùng bài thi đều bị chặn với thông báo rõ ràng. Session được xem là "stale" sau 5 phút không heartbeat — cho phép re-login hợp lệ sau sự cố. Frontend gửi heartbeat mỗi 30 giây qua `PUT /progress`; nếu bị đẩy ra sẽ hiện overlay thông báo và ngừng đếm giờ.

---

## [1.0.0] — 2026-06-19

### Added
- **Xuất bản theo lịch (Scheduled Publish)**: Người tạo đề có thể chọn 1 trong 3 chế độ khi tạo/chỉnh sửa đề thi — *Lưu nháp*, *Xuất bản ngay*, hoặc *Theo lịch*. Khi chọn "Theo lịch", nhập datetime trong tương lai; đề thi hiển thị cho học sinh nhưng bị khoá với bộ đếm ngược trực tiếp (cập nhật mỗi giây). Khi đến giờ, nút bắt đầu tự động kích hoạt. Server chặn `POST /submissions/start` với HTTP 423 nếu exam chưa đến giờ mở.
- Migration `infra/postgres/migrate_scheduled_exam.sql` — thêm cột `scheduled_at TIMESTAMPTZ` vào `quiz_exams.exams`.

### Fixed
- **Auto-create profile on first login**: Layout tự động gọi `PUT /api/users/:id` khi phát hiện profile chưa tồn tại (GET trả 404). Profile mới được tạo với `role = 'student'` và credits = `default_credits` (mặc định 20). Metadata từ Google OAuth (full_name, avatar_url) được điền tự động nếu có.
- **Profile upsert hardcode `role = 'student'`** cho INSERT mới; ON CONFLICT chỉ cập nhật `full_name` và `avatar_url`, không bao giờ ghi đè role hiện tại trong bảng profiles
- **Admin change role**: `PATCH /admin/users/:id/role` nay cập nhật cả bảng `profiles.role` (trước chỉ cập nhật `auth.users.raw_user_meta_data`)

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
