# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased] — 2026-07-19

### Added
- **Tạo đề thi bằng AI từ tài liệu upload (`generator-service` mới)**: teacher/admin có thể vào `/exams/generate`, tải lên một tài liệu (PDF, DOCX, hoặc text), chọn số câu hỏi/ngôn ngữ/độ khó, hệ thống gọi Claude API để soạn sẵn một bộ câu hỏi trắc nghiệm và tự động tạo đề thi (ở trạng thái draft), rồi điều hướng sang trang edit sẵn có để hoàn thiện (điểm đạt, thời gian, publish...). Giúp tiết kiệm thời gian cho teacher đã có sẵn tài liệu ôn tập, thay vì soạn từng câu thủ công.
- **LLM key**: teacher có thể tự lưu LLM API key riêng (mã hoá AES-256-GCM tại nghỉ, có thể giải mã để gọi provider) hoặc dùng key nền tảng do admin cấu hình — dùng key nền tảng sẽ trừ credit của teacher theo mức admin đặt (tái dùng cơ chế credit sẵn có). Admin bật/tắt và cấu hình mức trừ, giới hạn kích thước file, số câu hỏi tối đa tại tab "Tạo đề bằng AI" mới trong `/admin`.
- Import đề thi vào exam-service qua đúng route Teacher API hiện có (`POST /exams`, `POST /exams/:id/questions`), forward nguyên JWT của teacher — không cần thay đổi gì ở exam-service, `created_by`/CASL xử lý y hệt như teacher tự gọi API.
- DOCX được extract text bằng `mammoth` trước khi gửi cho LLM (Claude không parse trực tiếp `.docx`, chỉ nhận PDF/text làm document block native); PDF gửi thẳng dạng base64.

---

## [Unreleased] — 2026-07-08

### Added
- **Redis read-through cache cho exam-service, user-service, interaction-service**: thêm service `redis` (docker-compose) làm lớp cache chung phía sau `exam-service`, `user-service`, `interaction-service`, giúp tăng tốc các trang tải nặng (`/exams`, `/exams/[id]`, `/collections`, hồ sơ công khai, tương tác thích/bình luận). Cache chỉ áp dụng cho dữ liệu đọc nhiều/an toàn chia sẻ (danh sách đề công khai, chi tiết đề đã publish, profile công khai, settings công khai, số lượt thích/bình luận) — không bao giờ cache dữ liệu riêng theo người dùng (như trạng thái "đã thích") hay dữ liệu cần kiểm tra quyền mỗi request (đề chưa publish). Ghi (create/update/delete) sẽ chủ động xoá cache liên quan ngay lập tức, cộng thêm TTL 60s làm lớp bảo hiểm. Cache "fail-open": nếu Redis lỗi/không kết nối được, request tự động rơi về đọc thẳng DB, không bao giờ làm sập request.

---

## [Unreleased] — 2026-07-06

### Added
- **Hỗ trợ đa ngôn ngữ Việt/Anh/Nhật (i18n)**: quiz app và landing page giờ hỗ trợ chuyển đổi giữa Tiếng Việt, English và 日本語. Quiz app dùng store `$lib/i18n` (locale lưu ở `localStorage('quiz-lang')`, mặc định theo ngôn ngữ trình duyệt) với nút chuyển ngôn ngữ (bấm để chuyển vòng qua 3 ngôn ngữ) trong sidebar và trên các trang chưa đăng nhập; toàn bộ text UI, thông báo lỗi, và định dạng ngày/giờ theo locale đã được chuyển sang key dịch. Landing page dùng cơ chế client-side JS thuần (không cần build) với `data-i18n` attributes và nút chuyển ngôn ngữ trên nav.

### Fixed
- Landing page hiển thị literal `<br/>` trong tiêu đề CTA cuối trang do thiếu cờ `data-i18n-html` — đã sửa để render đúng thẻ xuống dòng.
- **Tỷ lệ hiển thị ảnh bìa đề thi đổi từ 16:9 sang 4:3**: ảnh bìa AI sinh vuông (1:1) bị crop quá chặt khi ép vào khung 16:9, làm mất nhiều nội dung ảnh. Đổi `aspect-ratio` ở card `/exams`, card đề thi trên trang hồ sơ công khai `/users/[id]`, và khung preview khi tạo/sửa đề thi sang 4:3 để hiển thị cân đối hơn với ảnh nguồn vuông.
- **Hero ảnh bìa ở `/exams/[id]` giảm độ đậm còn 25% opacity**: khối hero là hình chữ nhật rộng có chữ đè lên, chiều cao co giãn theo nội dung nên rất khó chọn khung crop đẹp cho ảnh vuông — thay vì cố crop, ảnh giờ chỉ làm nền mờ nhẹ phía sau chữ.

---

## [Unreleased] — 2026-07-05

### Added
- **Upload ảnh qua Teacher API (X-API-Key)**: endpoint `POST /api/users/upload` giờ chấp nhận cả `X-API-Key` lẫn JWT — teacher có thể upload ảnh bìa/câu hỏi bằng API key thay vì phải đăng nhập trình duyệt. Trả về S3 URL dùng trực tiếp cho `cover_image_url` / `image_url`.
- **`make-cover-ai.mjs` hỗ trợ upload trực tiếp lên S3**: thêm flag `--upload <url> --api-key <key>` — script sinh ảnh AI rồi tự upload, in ra S3 URL thay vì base64 data URI, tránh lưu dữ liệu nặng vào DB.
- **Tài liệu API cập nhật**: thêm endpoint `POST /api/users/upload` vào trang `/api-docs` kèm curl example.

### Fixed
- Upload file `.jpg` bị reject do MIME type `image/jpg` (không chuẩn) — giờ được normalize thành `image/jpeg` trước khi kiểm tra.

---

## [Unreleased] — 2026-07-04

### Fixed
- **Docker build frontend nhanh hơn**: copy `package-lock.json` cùng với `package.json` trước khi install để Docker cache layer `npm install` đúng cách; đổi `npm install` sang `npm ci` (nhanh hơn, dùng thẳng lock file, không write lại); production image chỉ install runtime deps (`--omit=dev`) thay vì copy toàn bộ `node_modules` kể cả devDependencies.

---

## [Unreleased] — 2026-07-04

### Added
- **Quản lý tài khoản người dùng (Admin)**: admin có thể tạo tài khoản teacher/student mới trực tiếp từ trang `/admin` (tab Người dùng → nút "Tạo tài khoản") — nhập email, mật khẩu, họ tên, vai trò; mật khẩu được hash bcrypt trước khi lưu vào DB, tài khoản xác nhận ngay mà không cần email confirmation. Admin cũng có thể chỉnh sửa toàn bộ thông tin hồ sơ của bất kỳ người dùng nào (avatar, họ tên, bio, năm sinh, giới tính, sở thích, liên kết mạng xã hội, vai trò, credits) qua trang `/admin/users/:id/edit` — có link "Sửa" trong từng hàng của bảng người dùng.

---

## [Unreleased] — 2026-07-03

### Added
- **API cho giáo viên (API key + CRUD đề thi)**: giáo viên có thể quản lý đề thi bằng chương trình mà không cần đăng nhập trình duyệt. Tạo/thu hồi **API key** ở `/profile → API Access` (key hiện plaintext đúng **một lần**, lưu dạng băm SHA-256, thu hồi có hiệu lực ngay). Gọi các endpoint exam/question CRUD sẵn có bằng header `X-API-Key` — hoạt động bất kể đăng ký bằng Google hay email, không bị giới hạn 1 giờ như JWT. Phân quyền tái dùng CASL: key chỉ thao tác trên đề của chính chủ (admin toàn quyền). Trang hướng dẫn tại `/api-docs` (điều hướng hiện link cho teacher/admin). Chỉ `exam-service` chấp nhận API key; các service khác vẫn chỉ nhận JWT.
- **Lọc & sắp xếp đề thi ở trang danh sách (`/exams`)**: thêm thanh chip lọc theo **tag** (bấm tag để lọc, "Tất cả" để bỏ lọc; tag xếp theo tần suất xuất hiện) và dropdown **sắp xếp** — "Mới nhất" (mặc định) hoặc "Phổ biến nhất" (ưu tiên theo lượt thích + bình luận + lượt thi). Lọc/sắp xếp chạy phía client trên dữ liệu đã tải.
- **Hiển thị lượt thích/bình luận trên thẻ đề thi**: mỗi thẻ ở `/exams` giờ hiện số ❤️ và 💬 (khi > 0) để người dùng cảm nhận mức độ tương tác trước khi chọn đề. Số liệu lấy từ `quiz_interactions` qua subquery cross-schema trong endpoint `GET /exams` (một truy vấn, không N+1).
- **Rich text cho mô tả đề thi**: form tạo/sửa đề dùng editor WYSIWYG (đậm/nghiêng/gạch chân/gạch ngang/danh sách/liên kết) cho phần "Mô tả ngắn". Mô tả hiển thị có định dạng trên trang chi tiết đề (cho cả học viên lẫn giáo viên). HTML được làm sạch (allowlist) khi lưu và khi render; các nơi hiển thị dạng thẻ (danh sách đề, hồ sơ công khai) tự rút gọn về text thuần.
- **Trang lỗi 404 & 5xx**: thêm `+error.svelte` với thiết kế theo brand — phân biệt "không tìm thấy trang" (404) và "máy chủ gặp sự cố" (5xx), kèm nút về trang chủ / thử lại / quay lại.
- **Tag của bộ đề**: thẻ bộ đề ở `/collections` hiển thị tập hợp tag (unique) của các đề thi thành viên — tự suy ra qua truy vấn, không cần nhập tay.
- **Analytics (PageSense + Umami)**: nhúng script theo dõi Zoho PageSense và Umami vào toàn bộ website — quiz app (SvelteKit `app.html`) và landing page (`landing/index.html`).
- **Giám sát lỗi Sentry (quiz app)**: tích hợp `@sentry/sveltekit` qua `hooks.client.js`/`hooks.server.js`; chỉ bật ở production build (`import.meta.env.PROD`), bỏ qua khi `vite dev`. Vite plugin `sentrySvelteKit()` upload source maps khi có `SENTRY_AUTH_TOKEN` lúc build (không có thì tự bỏ qua, build vẫn chạy). Trong CI, token được truyền vào Docker build của frontend qua **BuildKit secret** (`--mount=type=secret`, không bake vào image layer).

### Changed
- **Xóa logic (soft delete) cho đề thi, câu hỏi, bộ đề** (migration `0012_soft_delete.sql`): thay vì xóa vật lý, các thao tác xóa trên UI giờ chỉ đánh dấu `deleted_at`; dữ liệu vẫn còn trong DB để tra cứu/khôi phục. Đề thi bị xóa đồng thời soft-delete toàn bộ câu hỏi của nó. Migration `0011_soft_delete.sql` thêm cột và partial index cho các bảng liên quan.
- **Trang chi tiết đề chỉ xem trước 1 câu hỏi ngẫu nhiên** (trước đây hiển thị 3 câu đầu) — chọn ngẫu nhiên phía server mỗi lần mở.
- **Input ngày giờ (`datetime-local`/`date`/`time`) đẹp & nhất quán hơn**: bo góc, viền, focus ring theo brand; picker tự đổi sang giao diện tối trong dark mode (`color-scheme`).
- **Cập nhật tài liệu & landing page theo trạng thái mới nhất**: `README.md` bổ sung `interaction-service`, `grader-service`, `migrate` (job one-shot), dev port 4005, health check interactions và nhóm tính năng credit/collections/tương tác/khám phá. Landing page (`landing/index.html`) thêm card tính năng cho bình luận–thích–báo lỗi, khám phá đề theo tag, ghi chú khi làm bài và hồ sơ công khai; gỡ nhãn "Mới" khỏi các tính năng đã ra mắt từ trước.

### Fixed
- **Rò credit khi làm bài (student không bị trừ credit)**: gỡ endpoint legacy `POST /submissions` chấm-điểm-một-phát — nó bỏ qua toàn bộ cổng kiểm soát (trừ credit, `max_attempts`, cooldown, lịch mở đề). Frontend vẫn dùng nó làm fallback khi không có `submissionId`, nên mọi lượt làm bài không đi qua `POST /submissions/start` đều được nộp miễn phí. Nay mọi lượt chấm điểm bắt buộc qua luồng `start` → `submit`. Ngoài ra, trang làm bài không còn tin cờ `credit_deducted` trong localStorage để bỏ qua bước trừ credit; học viên luôn được định tuyến qua `/start` (vốn idempotent — tự resume phiên `in_progress` đang chạy mà không trừ lại).

## [Unreleased] — 2026-07-02

### Added
- **Tương tác đề thi (service mới `interaction-service`)**: tách riêng phần comment / like / report ra một microservice mới (schema `quiz_interactions`).
  - **Bình luận**: mọi người dùng đã đăng nhập có thể bình luận trên trang chi tiết đề thi; hiển thị tối đa 10 bình luận mỗi trang (có phân trang). Tác giả sửa/xoá bình luận của mình, admin xoá bất kỳ.
  - **Thích (❤️)**: chỉ học viên (student) mới thích được đề thi; số lượt thích hiển thị cho tất cả mọi người.
  - **Báo lỗi đề thi**: người đã hoàn thành bài thi có thể báo lỗi (chọn loại: câu hỏi sai / đáp án sai / hình ảnh lỗi / khác + mô tả). Giáo viên/admin xem và phản hồi trong trang cá nhân (kèm badge số báo lỗi chưa xử lý); người báo lỗi theo dõi được trạng thái xử lý ("Báo lỗi của tôi") ngay trong trang cá nhân.
- **Ghi chú nháp khi làm bài**: một ô ghi chú **dùng chung cho cả bài thi**, giữ nguyên nội dung khi chuyển câu tới/lui. Đóng gói trong widget nổi (góc dưới phải), **mặc định ẩn**, bấm nút mới hiện để tránh rối. Ghi chú chỉ nằm trong bộ nhớ tạm — **không được lưu** và sẽ mất khi tải lại trang (F5); có dòng nhắc rõ điều này.
- **Hệ thống migration tự động (code-based)**: schema DB giờ được quản lý bằng các file migration đánh số thứ tự trong `infra/postgres/migrations/` (`NNNN_name.sql`), chạy **tự động** qua service `migrate` (one-shot) mỗi lần `docker compose up` — mọi service `depends_on` migrate hoàn tất mới khởi động. Không còn phải chạy `psql` migrate thủ công (cả local lẫn khi deploy). Trạng thái theo dõi ở bảng `public.schema_migrations`; mỗi file chạy trong 1 transaction, đã chạy thì bỏ qua.

### Changed
- **Gộp schema về một nguồn**: `init.sql` + toàn bộ `migrate_*.sql` được chuyển thành `infra/postgres/migrations/0001_init.sql … 0010_interactions.sql`. Trước đây `init.sql` thiếu nhiều cột/bảng (credits, collections, badges, session...) nên fresh install thực chất phải chạy tay các migrate file — nay một lệnh `up` là đủ schema đầy đủ.
- **`deploy.sh`**: bỏ bước hỏi chạy migrate thủ công ở Phase 10 (migration tự chạy qua service `migrate`).

## [Unreleased] — 2026-07-01

### Changed
- **Dark mode contrast**: Màu brand `--primary`/`--accent` giờ có override riêng cho dark mode (`#c084fc`/`#e879f9` thay vì tái sử dụng `#5625d1` của light mode) — chữ/link/icon nhấn mạnh trên nền tối giờ đạt ~6:1 contrast thay vì ~1.9:1. Light mode không đổi.
- **Sidebar to hơn**: Rộng từ 200px lên 232px; logo icon 22px → 32px, chữ "QuizPlatform" 0.875rem → 1.15rem.
- **Avatar trang profile to hơn**: 120px → 168px, bo góc vuông (`border-radius: 24px`) thay vì hình tròn.

## [Unreleased] — 2026-06-30

### Added
- **Trang hồ sơ công khai** (`/users/[id]`): sinh viên có thể xem profile của người tạo đề thi — avatar, tên, email, giới thiệu, thông tin cá nhân và danh sách đề thi đã công bố.
- **Thông tin cá nhân mở rộng**: người dùng có thể cập nhật giới thiệu bản thân, năm sinh, giới tính, sở thích, và links đến Facebook, Zalo, TikTok, YouTube, Instagram, LinkedIn, Website từ trang `/profile`.
- **Creator link trên exam cards**: tên người tạo đề thi trên trang `/exams` là link dẫn đến trang profile công khai của họ.
- **DB migration** (`migrate_user_profile.sql`): thêm các cột mới vào `quiz_users.profiles`.

### Added
- **Logo & favicon**: Logo SVG (`/static/logo.svg`) với icon document+checkmark gradient tím; favicon SVG thay thế favicon.ico; `theme-color` đổi thành `#5625d1`.
- **Sidebar collapse**: Nút thu/mở sidebar (toggle) ở góc brand — khi thu gọn còn 56px, chỉ hiện icon; state lưu vào `localStorage('quiz-sidebar-collapsed')`.

### Changed
- **Page headers thống nhất**: Tất cả trang dùng component `PageHeader` (ix-style, dark text, không gradient) — bao gồm `/exams`, `/collections`, collections create/edit. Button "Tạo" chuyển sang style `ix-btn--primary` (đen).
- **Sidebar brand**: Dùng logo icon SVG kèm text thay vì plain text.

### Fixed
- **Dashboard status column**: Cột "Trạng thái" render raw HTML string thay vì Svelte conditional — đã sửa thành `{#if}` block.

---

## [Unreleased] — 2026-06-30 (sidebar + imgix)

### Added
- **imgix-style UI toàn bộ app**: Áp dụng design system imgix (nền `#FBFBF8`, sidebar trái cố định 200px, typography sạch, border mảnh) cho tất cả trang có auth.
- **Global sidebar**: Sidebar điều hướng cố định bên trái trên mọi trang authenticated — thay thế hoàn toàn top navbar. Bao gồm nav sections theo role, theme toggle, user info row + logout.
- **5 base UI components** tái sử dụng (`src/lib/components/ui/`): `Sidebar`, `PageHeader`, `Card`, `Button`, `Input`.
- **Design tokens `--ix-*`**: 14 CSS variables trong `:root` + dark mode overrides; `--mobile-bar-h: 56px` cho sticky elements.

### Changed
- **Top navbar đã bị xoá**: Không còn thanh nav nằm ngang ở trên cùng. Điều hướng toàn bộ qua sidebar trái.
- **Full-width layout**: `<main>` không còn `max-width: 1100px`, nội dung giờ chiếm toàn bộ vùng còn lại sau sidebar.
- **Admin page**: Sidebar điều hướng tabs đã chuyển thành horizontal tab nav (Người dùng / Bộ đề / Cài đặt upload / Credits) trong content area.
- **Profile page**: Loại bỏ sidebar nội bộ; nội dung cards hiển thị trực tiếp trong global layout.
- **Login page**: Đã bỏ negative margin trick và `calc(100vh - 60px)` do không còn top navbar.
- **Take exam page**: `.top-bar` sticky sửa từ `top: 60px` → `top: 0` (desktop) / `top: var(--mobile-bar-h)` (mobile).
- **CLAUDE.md**: Sửa session stale threshold từ `>30 s` → `>300 s / 5 min` (khớp với `SESSION_STALE_SECS = 300` trong code).

---

## [Unreleased] — 2026-06-27

### Added
- **`DESIGN.md`**: File định nghĩa design system theo spec của Google Stitch — YAML tokens (colors, typography, rounded, spacing, components) + prose rationale cho cả light/dark mode.

### Changed
- **Udemy-inspired palette (Option C)**: Cập nhật brand color từ indigo-violet (`#6366f1 → #8b5cf6`) sang deep purple (`#5625d1 → #6d29d3`) — lấy cảm hứng từ Udemy, chuyên nghiệp hơn, vẫn giữ rounded corners. Text màu `#2b2a3f` (Udemy body text), muted `#595d72`, border `#d0d2e1`. Dark mode bg đổi từ `#0f172a` sang `#202331` (Udemy dark navy). Gradient simplify: cùng hue purple, không wide-hue sweep.
- **Thống nhất brand color toàn site**: Landing page và quiz app giờ dùng chung brand gradient `#5625d1 → #6d29d3`. Áp dụng cho cả landing CSS vars, dark sections, footer, feature icons.
- **Chuẩn hoá CSS tokens landing page**: Đổi tên `--blue/--indigo/--violet` → `--primary/--accent/--primary-lt`; border radius `14px → 16px`.
- **Cập nhật CLAUDE.md**: Bổ sung CI/CD workflows còn thiếu (`deploy.yml`, `cleanup-images.yml`), landing page, `GHCR_ORG` env var; cập nhật Design System section tham chiếu đến `DESIGN.md`.

---

## [Unreleased] — 2026-06-24

### Changed
- **Nginx hỗ trợ include config ngoài**: Thêm `include /opt/nginx/*.conf;` vào `nginx.conf` và mount `/opt/nginx` từ host vào container — cho phép thêm vhost cho các app khác trên cùng server mà không cần sửa repo.
- **Nginx có thể proxy đến app ngoài Docker**: Thêm `extra_hosts: host.docker.internal:host-gateway` — dùng `http://host.docker.internal:<port>` trong các file conf để proxy đến app chạy trực tiếp trên host.

---

## [Unreleased] — 2026-06-23

### Added
- **CI/CD tự động lên Lightsail**: Workflow `deploy.yml` trigger sau khi `build-push.yml` thành công — SSH vào server và chạy `deploy.sh --update` tự động.
- **Pull images từ GHCR thay vì build trên server**: `deploy.sh --update` giờ chạy `docker compose pull` + `up -d` (không `--build`), tận dụng image đã được CI build sẵn — deploy nhanh hơn, không cần RAM để build.
- **Thêm `grader-service` vào build matrix**: Service này trước đây không được build lên GHCR.

### Changed
- **`deploy.sh --update` không còn hỏi tương tác**: Phase 10 (migrate/seed/admin) bị bỏ qua hoàn toàn khi chạy `--update` — CI/CD không bị block bởi `read -rp` nữa.
- **`docker-compose.yml`**: Image names đổi sang `ghcr.io/${GHCR_ORG:-tranphu-devops}/<service>:${TAG:-latest}` — pull từ GHCR trong update mode, build local vẫn hoạt động với `--build`.
- **`.env.example`**: Bổ sung `GHCR_ORG` và `GHCR_TOKEN` (GitHub PAT với `read:packages` scope để server login vào GHCR).

---

## [Unreleased] — 2026-06-21

### Added
- **Dark / Light theme toggle**: Nút chuyển giao diện (☀️ / 🌙) trong navbar và sidebar mobile. Tuỳ chọn lưu vào localStorage, áp dụng ngay không cần refresh. Anti-FOUC script trong `app.html`. Dark mode CSS variables phủ toàn bộ layout, admin, profile, dashboard, take, result, login — không còn vùng trắng hoặc chữ trắng trên nền trắng.
- **Cập nhật Landing page**: Thiết kế lại toàn diện với hero mockup thực tế, trust bar, bổ sung tính năng mới (resume, anti-fraud, auto-grade, encryption), security showcase section, resume showcase section, FAQ cập nhật. Chỉ còn 1 nút CTA duy nhất "Bắt đầu khám phá". Thêm thông tin tác giả ở footer.

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
