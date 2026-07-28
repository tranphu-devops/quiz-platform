# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased] — 2026-07-28

### Added
- **README song ngữ**: `README.md` viết lại hoàn toàn bằng tiếng Anh (context cập nhật đầy đủ: notification-service, referral, Teacher API, Admin System Overview...), thêm `README.vi.md` và `README.ja.md` là bản dịch, link chéo qua lại giữa 3 file. Các bản dịch chỉ cập nhật khi có yêu cầu, không tự động đồng bộ mỗi lần đổi README.md.
- **Landing page: 3 tính năng mới lên trang chủ** — giới thiệu bạn bè nhận credit (referral), thông báo đa kênh (Email/Pushover/Telegram), và Teacher API — đủ cả 3 ngôn ngữ. Bỏ badge "Mới" khỏi các tính năng đã ra mắt trước đó (bình luận/thích/báo lỗi, khám phá đề theo tag, ghi chú nháp, tạo đề bằng AI).

### Changed
- **`cleanup-images.yml` khớp lại matrix service với `build-push.yml`**: thêm `interaction-service`, `generator-service`, `notification-service`, `grader-service` — trước đây job dọn image GHCR hàng tuần bỏ sót 4 service này, image cũ tích luỹ không giới hạn.
- **Hook `PreToolUse`/`Edit|Write` tự đồng bộ `CHANGELOG.md` với `origin/main` trước lần sửa đầu tiên trong session** (chỉ khi file đang sạch, không có edit dở) — giảm conflict khi nhiều worktree cùng append vào mục Unreleased rồi mở PR (`.claude/settings.json`).

## [Unreleased] — 2026-07-26

### Added
- **Đăng nhập bằng link gửi qua email (magic link)**, thêm bên cạnh nút "Đăng nhập với Google" hiện có trên `/login`: nhập email, nhận link đăng nhập, link hết hạn sau 10 phút. Không cần đặt/nhớ mật khẩu — hệ thống không lưu password cho người dùng cuối. Nếu người dùng dùng cùng một email đã đăng ký qua Google, magic link đăng nhập vào đúng tài khoản cũ (không tạo tài khoản trùng). Email đăng nhập dùng template có thương hiệu NovaQuiz (giống layout email thông báo).
- **Admin đổi được email cho một tài khoản** (`/admin/users/[id]/edit`) — dùng khi người dùng mất quyền truy cập cả email lẫn tài khoản Google đã đăng ký, không còn cách nào tự đăng nhập lại. Email mới có hiệu lực đăng nhập (qua magic link) ngay lập tức.
- **`scripts/mint-test-jwt.js`** (dev-only): tạo nhanh một JWT/session hợp lệ cho một tài khoản đã seed sẵn, dùng để test API hoặc test giao diện (dán vào console trình duyệt) mà không cần đăng nhập thật qua Google/email.
- **Landing page đa ngôn ngữ đầy đủ trên cả 3 trang** (`/`, `/brand`, `/contact`) với 3 thứ tiếng: English, Tiếng Việt, 日本語. Trước đây trang Thương hiệu và Liên hệ mới thêm chỉ có tiếng Việt.
- **Hệ thống giới thiệu (referral) cộng credit**: mỗi người dùng có mã và link giới thiệu riêng (hiện ở card "Giới thiệu bạn bè" trên `/profile`, kèm số người đã giới thiệu). Khi có người mới đăng ký qua link: người mới được cộng thẳng một khoản credit thưởng vào tài khoản ngay khi tạo tài khoản, còn người giới thiệu tích luỹ credit và phải bấm **Nhận (claim)** mới cộng vào số dư — số credit thưởng cho người giới thiệu tính theo mức admin đang đặt tại thời điểm claim. Người giới thiệu cũng nhận được thông báo (Pushover/Email/Telegram, nếu đã bật) khi có người đăng ký qua link. Admin cấu hình 2 mức thưởng (thưởng người giới thiệu / thưởng người đăng ký mới) ở tab **Credits** trong `/admin`. Chống lạm dụng: mỗi người chỉ được ghi nhận giới thiệu một lần và không tự giới thiệu chính mình.

### Changed
- **Model mặc định cho tạo đề bằng AI đổi sang `deepseek/deepseek-v4-flash`** (trước đây production đặt `moonshotai/kimi-k2.5`). Đo trên cùng một request từ server production: **$0.000054 so với $0.00295 — rẻ hơn khoảng 54 lần**, context 1M token nên nuốt trọn tài liệu dài. Chênh lệch lớn hơn nhiều so với bảng giá vì Kimi sinh ra rất nhiều token cho mỗi câu trả lời. Migration tự đổi giá trị đang lưu trong DB; admin chỉnh lại được ở tab "Tạo đề bằng AI" trong `/admin`.
- **Thêm `scripts/test-openrouter-models.sh`** để kiểm tra một model OpenRouter có dùng được không trước khi đặt làm mặc định — script gọi thật và báo model nào bị chặn theo khu vực, model nào trả JSON sai schema. Phải chạy trên server production vì hạn chế khu vực tính theo nơi gọi. Ghi lại trong `CLAUDE.md`: server Lightsail đặt ở Hong Kong nên **toàn bộ model `google/*` và `openai/*` đều bị chặn** (403), kể cả những lựa chọn rẻ nhất trên bảng giá — đi qua OpenRouter không gỡ được hạn chế khu vực của nhà cung cấp.

### Fixed
- **Link đăng nhập qua email (magic link) báo lỗi 404 "page not found"**: link gửi trong email trỏ thẳng vào domain gốc (`.../verify?...`) thay vì đi qua đường dẫn `/auth/` mà Nginx dùng để chuyển tiếp tới GoTrue, nên rơi vào giao diện app (không có trang này) thay vì tới đúng nơi xử lý xác thực. Đã sửa để link đăng nhập luôn đi đúng đường.
- **Tạo đề bằng AI từ file PDF báo lỗi "LLM không sinh được câu hỏi nào"**: model nhận được tên file nhưng không nhận được nội dung PDF, nên trả lời (đúng khuôn dạng JSON) rằng tài liệu rỗng và xin gửi lại tài liệu. Nguyên nhân là engine đọc PDF của OpenRouter bị cố định cứng ở `native` — engine này gửi thẳng file cho model nên **chỉ chạy được với model có hỗ trợ đọc file**, gặp model khác thì thất bại âm thầm. Giờ engine đọc PDF là tuỳ chọn của admin ở tab "Tạo đề bằng AI" trong `/admin`, mặc định `cloudflare-ai` (miễn phí, OpenRouter tự trích xuất text nên chạy với mọi model), còn `mistral-ocr` (có phí) dành cho PDF scan và `native` giữ lại cho model hỗ trợ đọc file khi cần giữ bố cục/hình ảnh.
- **Lỗi tạo đề bằng AI giờ nói rõ nguyên nhân thay vì bắt admin mở dashboard OpenRouter**: trang lịch sử `/exams/generate/jobs` hiện thông báo hướng dẫn đổi engine, kèm phần chi tiết có nguyên văn lời giải thích của model, engine/model đã dùng, loại và dung lượng file. Trường hợp model trả về một "câu hỏi" là lời xin lỗi (không có đáp án nào) cũng được nhận diện đúng là lỗi không đọc được tài liệu. File DOCX/text rỗng bị chặn ngay từ đầu, không tốn một lượt gọi LLM. Tên file thật được gửi kèm cho model thay vì `document.pdf` cố định.

### Changed
- **Email thông báo được viết lại hoàn toàn: có template riêng cho từng loại sự kiện, tiêu đề rõ ràng và nội dung đầy đủ thông tin** (mặc định tiếng Anh). Trước đây email gửi ra rất sơ sài: tiêu đề là mã sự kiện thô (`referral.completed.owner`), nội dung là JSON payload dump (`{"referredName":"..."}`) với những sự kiện chưa có template, còn những sự kiện đã có template thì chỉ là một dòng chữ trần trong `<p>`, không thương hiệu, không link. Giờ mỗi email có: header thương hiệu NovaQuiz, tiêu đề mô tả đúng việc đã xảy ra (ví dụ *"Tran Phu just joined NovaQuiz with your invite link"*), đoạn mở đầu giải thích, **bảng thông tin chi tiết** theo từng loại sự kiện (điểm số dạng `26/30 points (86.67%)` + ngưỡng đạt, người được giới thiệu + thời gian đăng ký + số credit thưởng, hạng mục báo cáo + nguyên văn nội dung báo cáo/phản hồi, model AI + file nguồn khi tạo đề...), nút hành động dẫn tới đúng trang trong app, và footer giới thiệu NovaQuiz + lý do nhận email + link đổi tuỳ chọn thông báo. Email gửi kèm cả bản plain-text (tốt cho client chỉ đọc text và giảm điểm spam). Thời gian hiển thị theo giờ Việt Nam (`26 Jul 2026, 16:05 GMT+7`), không còn ISO string. Email của người khác khi hiện cho người thứ ba (người được giới thiệu, người báo cáo) được che bớt (`ph•••@gmail.com`).
- **Bổ sung dữ liệu vào 12 điểm phát sự kiện ở các service** (submission/grader/interaction/generator/user) để email có thông tin thật thay vì chỉ có tiêu đề: điểm số + tổng điểm + ngưỡng đạt, thời điểm xảy ra, nội dung báo cáo, model/file nguồn của lượt tạo đề AI, số dư credit hiện tại khi trừ credit thất bại, và toàn bộ thông tin người được giới thiệu (tên, email, thời gian đăng ký, credit thưởng, tổng số người đã giới thiệu).
- **Sự kiện "có người đăng ký qua link giới thiệu" giờ có thêm bản dành cho admin** (`referral.completed.admin`) — trước đây referral là sự kiện duy nhất không có kênh theo dõi cho admin, trong khi mọi sự kiện khác đều có. Admin bật/tắt ở tab Thông báo trong `/admin`.
- **Email từ form liên hệ ở landing page cũng dùng chung layout mới** (thay cho một khối `<br/>` không định dạng), có nút "Reply to ..." mở sẵn mail tới người gửi.
- **Tuỳ chọn thông báo của người dùng thường (student/teacher) rút gọn còn đúng một kênh Email** — card "Tuỳ chọn thông báo" ở `/profile` trước đây dùng chung y hệt giao diện với tab Thông báo của admin: bảng sự kiện × 3 kênh (Pushover/Email/Telegram) kèm 3 ô nhập Pushover User Key, Telegram Chat ID và email nhận thông báo. Giờ với mọi vai trò không phải admin, đây là một danh sách bật/tắt theo sự kiện, gửi thẳng tới **email tài khoản** (hiển thị sẵn, không phải nhập gì). Ngoài việc bớt rối, điều này sửa một lỗi âm thầm: học viên tick Pushover/Telegram mà không có key sẽ tạo ra thông báo không bao giờ gửi được (thử lại 5 lần rồi chết trong hàng đợi). Giới hạn kênh được kiểm tra ở phía server chứ không chỉ ẩn trên giao diện, và migration mới dọn dữ liệu cũ (tắt đăng ký kênh Pushover/Telegram, xoá thông tin kênh liên hệ và huỷ các thông báo đang chờ gửi của user không phải admin). Admin không đổi: vẫn đủ 3 kênh ở cả `/profile` lẫn tab Thông báo trong `/admin`.
- **Bộ chọn ngôn ngữ trong app đổi sang selectbox** (giống landing page): người dùng chọn trực tiếp từ dropdown menu hiển thị tên ngôn ngữ đầy đủ (Tiếng Việt / English / 日本語), thay vì nút bấm chữ tắt VI/EN/JA. Giữ lựa chọn trong `localStorage` (khoá `quiz-lang`) để các lần truy cập sau nhớ ngôn ngữ. Hỗ trợ fallback browser language nếu chưa chọn (JA → English → Tiếng Việt).
- **Hiển thị số credit hiện tại của user trực tiếp trên sidebar**: thêm hàng "Credit" ở phía trên user profile, nền highlight (gradient primary), số credit đặt trong box trắng. Cập nhật real-time khi profile được fetch. Ẩn khi sidebar collapsed hoặc chưa load được profile.
- **Ẩn 3 social link option (Zalo, TikTok, YouTube) khỏi form profile**: xoá các input field cho Zalo, TikTok, YouTube khỏi giao diện edit profile cá nhân (`/profile`), admin edit user (`/admin/users/[id]/edit`), và trang public profile (`/users/[id]`). Backend và schema DB vẫn giữ nguyên các field `zalo`, `tiktok_url`, `youtube_url` để bảo đảm dữ liệu không bị mất.
- **Bộ chọn ngôn ngữ đổi từ nút bấm-xoay-vòng sang selectbox** (chọn trực tiếp cho dễ), xuất hiện thống nhất trên cả 3 trang landing. **Ngôn ngữ mặc định giờ là English** (trước đây tự đoán theo trình duyệt). Lựa chọn ngôn ngữ được **lưu vào `localStorage`** (khoá `landing-lang`, dùng chung giữa 3 trang) nên các lần truy cập sau hiển thị đúng ngôn ngữ đã chọn; tiêu đề tab (`<title>`) của trang Thương hiệu/Liên hệ cũng đổi theo ngôn ngữ.
- **Liên kết tới trang Thương hiệu/Liên hệ chuyển hẳn xuống footer** (bỏ khỏi thanh header) trên cả 3 trang, để header gọn hơn — người dùng cần thì click ở footer.
- **Setup SSL/TLS cho `novaquiz.net` bằng Cloudflare certs (full DNS + edge protection)**: Nginx config cập nhật, server block mới lắng nghe port 443 với chứng chỉ PEM/key từ Cloudflare (`/opt/nginx/ssl/novaquiz.net.{pem,key}`), include `cloudflare.conf` (CA root + cấu hình edge security), HTTP traffic tự động redirect về HTTPS. Landing page và app quiz đều tuân theo setup này.

---

## [Unreleased] — 2026-07-25

### Added
- **Đổi thương hiệu sang NovaQuiz, gắn với tên miền mới `novaquiz.net`** (landing) / `app.novaquiz.net` (ứng dụng), thay cho `QuizPlatform` / `phutx.top` cũ. Cập nhật đồng bộ: tên thương hiệu trong toàn bộ giao diện (sidebar, trang đăng nhập, API docs, landing page), domain trong Nginx (`server_name`, `GOTRUE_URI_ALLOW_LIST`), header `HTTP-Referer` gửi lên OpenRouter, và tài liệu (`README.md`, `DESIGN.md`, `CLAUDE.md`). Không đổi tên tổ chức/dự án trên các dịch vụ ngoài đã gắn với domain cũ (Zoho PageSense, Sentry org/project) — cần đăng ký lại thủ công trên các nền tảng đó khi domain mới lên production.
- **Bộ nhận diện thương hiệu đầy đủ** (logo, favicon, banner) ở các kích thước chuẩn web hiện đại: icon mark SVG nguồn dùng để xuất `favicon.ico` đa độ phân giải (16/32/48px), `apple-touch-icon.png` (180px), icon PWA/Android (192/512px, có `manifest.webmanifest`), và banner OG/social-share (1200×630px, dùng cho thẻ `og:image`/`twitter:image` ở cả app lẫn landing page). Logo dạng lockup ngang có bản cho nền sáng và nền tối. Toàn bộ nguồn SVG + PNG xuất sẵn được công khai tải về tại trang mới `/brand`.
- **Trang "Thương hiệu" (`/brand`) và "Liên hệ" (`/contact`) trên landing page**, cùng logic Nginx phục vụ static page mới. Trang `/brand` giới thiệu logo, bảng màu, typography và nguyên tắc sử dụng. Trang `/contact` có form liên hệ (họ tên, email, nội dung) gửi thẳng email tới admin qua endpoint công khai mới `POST /api/notifications/contact` (notification-service) — endpoint này là ngoại lệ duy nhất không cần đăng nhập trong notification-service, gửi trực tiếp qua Resend thay vì qua hàng đợi/subscription (không có user đăng nhập để tra cứu), có giới hạn tần suất riêng (5 lần/phút) để chống spam. Nhận email tại `CONTACT_EMAIL_TO` (fallback `NOTIFICATION_EMAIL_FROM` nếu chưa cấu hình).

### Fixed
- **Validate email của form liên hệ dùng regex an toàn trước ReDoS** — regex email cũ (`[^\s@]+@[^\s@]+\.[^\s@]+`) có thể backtracking đa thức với chuỗi độc hại (CodeQL `js/polynomial-redos`) và lại chạy trước cả khi kiểm tra độ dài. Giờ tách `@` làm phân tách cứng (regex tuyến tính, không overlap), kiểm tra dấu chấm ở domain riêng, và chặn độ dài (>200 ký tự) trước khi chạy regex.

---

## [Unreleased] — 2026-07-24

### Added
- **Màn hình "Hệ thống" mới cho admin** (`/admin` → tab Hệ thống): xem trạng thái từng service (container đang chạy/lỗi, uptime, số lần restart, kết nối DB), xem log Docker gần nhất của từng service (không cần SSH vào server), và tình trạng database dùng chung (dung lượng, số kết nối, dung lượng theo từng schema, lịch sử migration) — trước đây chỉ xem được qua SSH + `docker compose logs`/`psql` thủ công. Đọc log/trạng thái container qua một sidecar `docker-socket-proxy` (chỉ cho phép GET danh sách/inspect/log container, chặn hết exec/restart/tạo container...) thay vì cho `user-service` truy cập trực tiếp `docker.sock` — kể cả nếu `user-service` bị chiếm quyền, kẻ tấn công cũng không thể exec/restart bất cứ container nào qua đường này. Toàn bộ tính năng chỉ đọc (read-only), không có nút restart/stop trên UI. `/health` ở cả 6 service và 3 route mới của `/admin/system/*` đều có rate limit riêng (đóng cảnh báo CodeQL `js/missing-rate-limiting` phát hiện trên PR).
- **Khởi tạo `notification-service` + dashboard cấu hình cho admin và người dùng (nền tảng cho hệ thống thông báo qua Pushover/Email/Telegram)**: schema `quiz_notifications` mới (bảng `event_types` seed sẵn 20 loại sự kiện, `user_channel_targets`, `notification_subscriptions`, `notification_queue`) và service khung đã lên `docker-compose`. Service có endpoint nội bộ `POST /internal/notify` (nhận sự kiện từ service khác, tự fan-out ra người subscribe admin + người liên quan cụ thể), một worker polling hàng đợi (Postgres, không BullMQ/Redis) mỗi 10 giây kèm cơ chế thử lại/backoff và đánh dấu "dead" sau 5 lần thất bại, và 3 kênh gửi (Pushover, Email qua Resend, Telegram). Đã nối đủ 8 sự kiện nghiệp vụ vào các service liên quan (fire-and-forget, không chặn response chính): nộp bài xong/hết giờ (`submission-service`, `grader-service`), đạt huy hiệu, báo cáo đề thi mới/đã xử lý (`interaction-service`), tạo đề AI xong/lỗi (`generator-service`), trừ credit thất bại và nâng cấp giáo viên (`user-service`). Trên frontend: tab "Thông báo" mới ở `/admin` (admin tự chọn sự kiện hệ thống + kênh muốn nhận, kênh liên hệ riêng, xem nhật ký gửi/thử lại thủ công) và card "Tuỳ chọn thông báo" mới ở `/profile` cho mọi user (chọn sự kiện liên quan vai trò mình + kênh muốn nhận, nhập Pushover key/Telegram chat ID). Đã verify end-to-end bằng container thật + Nginx thật + trình duyệt thật: toggle checkbox, lưu, và dữ liệu vào đúng DB. Đã lên đủ CI build (`build-push.yml`) và deploy (`deploy.sh` health-check) cho service mới, sẵn sàng deploy production.
- **Enforce tự động 2 quy tắc bắt buộc trong `CLAUDE.md` bằng Claude Code hook** (`.claude/settings.json`, không phải code app): (1) chặn sửa file qua `Edit|Write` khi đang ở main worktree, trừ doc/config (`CLAUDE.md`, `CHANGELOG.md`, `README.md`, `DESIGN.md`, `.claude/*`) — buộc phải tạo git worktree/branch riêng trước khi sửa source code; (2) chặn `git commit` nếu `CHANGELOG.md` chưa được stage. Đồng thời rút gọn 2 mục "Git workflow" và "Changelog" trong `CLAUDE.md` xuống còn phần tóm tắt + ghi chú được enforce tự động, thay vì liệt kê từng bước.

### Changed
- **`POST /api/generator/generate` chuyển sang xử lý bất đồng bộ** — trả về ngay `202 {job_id}` với status `processing` thay vì chờ LLM sinh xong đề (có thể mất 30s-vài phút tuỳ model) rồi mới trả response. Trước đây, với model chậm, kết nối bị Cloudflare tự cắt ở lớp edge sau ~100s (giới hạn riêng của Cloudflare, độc lập và ngắn hơn `proxy_read_timeout` 180s của Nginx) và trả `524` cho client dù backend vẫn đang xử lý bình thường phía sau. Trang `/exams/generate` giờ poll `GET /generate/jobs/:id` mỗi 3 giây tới khi có kết quả; người dùng có thể rời trang và xem lại ở `/exams/generate/jobs` sau. Giới hạn đã biết: nếu generator-service restart/crash giữa lúc đang xử lý, job sẽ kẹt ở trạng thái `processing` vĩnh viễn (chưa có cơ chế reconcile lúc khởi động như grader-service) — chấp nhận đánh đổi ở v1, giáo viên chỉ cần thử tạo lại.

### Fixed
- **Sinh đề bằng AI crash với lỗi `q.options.map is not a function` khi dùng model OpenRouter không tuân thủ nghiêm ngặt structured output** (thường gặp với model bên thứ ba không phải Anthropic/OpenAI, chọn qua tính năng "key riêng" của giáo viên). Model trả về JSON không đúng shape đã khai báo (`options` không phải mảng, `correct_answer` không phải mảng...) khiến việc chuẩn hoá kết quả crash với lỗi khó hiểu thay vì báo lỗi rõ ràng. Giờ việc chuẩn hoá kiểm tra shape trước khi xử lý và báo lỗi cụ thể theo từng câu hỏi.

---

## [Unreleased] — 2026-07-23

### Added
- **Admin cấu hình được model AI mặc định; giáo viên dùng key riêng được chọn model tuỳ ý; thêm màn hình quản lý API key AI cho cả admin và giáo viên.** Trước đây model chọn trên `/exams/generate` không có tác dụng (giá trị dropdown không khớp định dạng model của backend, luôn rơi về mặc định cứng). Giờ: (1) admin cấu hình "model mặc định" tại `/admin` → tab "Tạo đề bằng AI" — mọi lượt sinh đề bằng **key nền tảng** dùng đúng model này, không cho chọn khác (admin kiểm soát chi phí); (2) giáo viên dùng **key OpenRouter riêng** được nhập model tự do (không giới hạn danh sách — chi phí là của họ); (3) trang mới `/exams/generate/keys` (liên kết ở sidebar) cho giáo viên/admin xem, thêm, thu hồi các OpenRouter key đã lưu, và admin quản lý thêm key OpenRouter dùng chung cho toàn nền tảng (mã hoá AES-256-GCM tại chỗ, thay thế được mà không cần redeploy — vẫn fallback về biến môi trường `OPENROUTER_API_KEY` nếu chưa cấu hình qua UI).
- **Trang lịch sử tạo đề bằng AI** (`/exams/generate/jobs`, liên kết từ `/exams/generate`): xem lại các lượt tạo đề gần đây (thành công/thất bại), và với lượt thất bại có thể xem chi tiết kỹ thuật đầy đủ của lỗi (mã lỗi, thông điệp từ OpenRouter/provider, lý do bị cắt output, v.v.) thay vì chỉ một dòng thông báo chung chung — lưu trong cột `generation_jobs.error_detail` (JSONB) mới.

### Fixed
- **Sinh đề bị crash với lỗi "Unterminated string in JSON" khi output LLM bị cắt do vượt `max_tokens`** — commit này lẽ ra đã nằm trong PR trước nhưng bị merge sớm hơn một nhịp nên chưa lên `main`; giờ đã gộp vào đây. `max_tokens` giờ scale theo số câu hỏi thay vì cố định 16000, và có check `finish_reason === 'length'` để báo lỗi rõ ràng thay vì để `JSON.parse` crash.

### Changed
- **Trình tạo đề bằng AI (generator-service) chuyển sang gọi LLM qua OpenRouter thay vì gọi trực tiếp Anthropic API**: một số môi trường deploy (VD: AWS Lightsail) bị Cloudflare — lớp edge đứng trước `api.anthropic.com` — chặn `403 Request not allowed` ở tầng network/IP-reputation, tái hiện được cả bằng `curl` thuần từ server (không liên quan code) và không hết sau khi đổi static IP, nên không thể khắc phục trong repo. Route qua OpenRouter (`https://openrouter.ai`, tương thích OpenAI) giúp server chỉ cần gọi tới OpenRouter — chính OpenRouter mới là bên gọi lên Anthropic — nên tránh được block này. Model đề xuất vẫn là các model Claude (qua slug OpenRouter, VD `anthropic/claude-sonnet-5`), không đổi trải nghiệm người dùng. Biến môi trường `ANTHROPIC_API_KEY` đổi tên thành `OPENROUTER_API_KEY`; key "tự mang" (BYO) của giáo viên giờ là OpenRouter key (`sk-or-v1-...`) thay vì key Anthropic.

---

## [Unreleased] — 2026-07-19

### Added
- **Rate limit riêng theo từng route nhạy cảm** (bắt đầu với `auth-service` và collections trong `exam-service`), phân theo mức độ rủi ro thay vì chỉ dựa vào giới hạn chung 300 request/phút/IP đã có: `POST /register` (5/phút), `POST /verify` (20/phút) ở auth-service; tạo/sửa/xoá collection (20/phút), xem chi tiết collection (60/phút), route nội bộ check-badge (100/phút) ở exam-service. Nhằm khắc phục dứt điểm các cảnh báo CodeQL `js/missing-rate-limiting` còn lại trên từng route cụ thể (giới hạn chung trước đây không đủ cụ thể để CodeQL nhận diện). Đây là phần đầu của một đợt áp dụng rộng hơn trên tất cả các service còn lại (sẽ tiếp tục ở PR sau).
- **Hoàn tất rate limit theo route trên các service còn lại**: áp dụng tiếp cho toàn bộ route của `exam-service` (exams), `user-service` (quản lý API key, upload ảnh, quản lý user), `submission-service` (làm bài/nộp bài), `interaction-service` (comment/like/report) và `generator-service` (tạo đề bằng AI) — mỗi route gắn mức giới hạn theo rủi ro: thao tác tạo tài nguyên/nặng (5/phút), CRUD thường (20/phút), đọc dữ liệu (60/phút), heartbeat khi làm bài (120/phút), route nội bộ (100/phút). Đóng toàn bộ các cảnh báo CodeQL `js/missing-rate-limiting` còn lại trên từng route cụ thể trong repo.

---

## [Unreleased] — 2026-07-19

### Changed
- **Nâng cấp Fastify 4 → 5 trên cả 6 backend service** (`user`, `exam`, `submission`, `interaction`, `generator`, `auth`) cùng các plugin liên quan (`@fastify/cors`, `@fastify/multipart`, `@fastify/rate-limit`) lên bản major tương ứng hỗ trợ Fastify 5. **Nâng cấp Vite 5 → 6 và `@sveltejs/vite-plugin-svelte` 4 → 6 trên frontend.** Khắc phục toàn bộ cảnh báo Dependabot liên quan đến các lỗ hổng đã biết của Fastify 4.x và Vite 5.x. Đã kiểm tra không có breaking change nào trong repo bị ảnh hưởng (không dùng route-level JSON schema, `reply.redirect()`, `fastify-plugin`, custom pino logger, glob range-brace, v.v.) và khởi động thử từng service + build thử frontend đều thành công.

---

## [Unreleased] — 2026-07-19

### Added
- **Rate limiting trên toàn bộ 6 backend service** (`user`, `exam`, `submission`, `interaction`, `generator`, `auth`): mỗi service giờ giới hạn 300 request/phút/IP (`@fastify/rate-limit`, `trustProxy: true` để đọc đúng IP thật qua Nginx), request nội bộ giữa các service (mang `x-internal-key`) được bỏ qua giới hạn. Riêng route đăng nhập (auth-service) và route tạo API key (user-service) có giới hạn chặt hơn (10/phút và 5/phút) để chống brute-force/spam. Khắc phục 61 cảnh báo CodeQL `js/missing-rate-limiting`.

### Fixed
- **SSRF khi tạo/nộp bài thi (submission-service)**: `exam_id` (đến từ request của client) được dùng trực tiếp để dựng URL gọi nội bộ sang exam-service — giờ được kiểm tra đúng định dạng UUID trước khi dùng, chặn khả năng dò quét host nội bộ bằng giá trị `exam_id` giả mạo.
- **ReDoS trong kiểm tra định dạng email (user-service)**: regex email cũ có thể bị khai thác backtracking với input được soạn có chủ đích, gây treo service. Thay bằng hàm kiểm tra tuyến tính không dùng regex backtracking.
- **Sanitize HTML chưa triệt để (frontend)**: các hàm rút gọn text từ HTML (`htmlToText`, `isHtmlEmpty`) chỉ xoá thẻ một lượt, có thể để sót thẻ lồng nhau kiểu `<<script>script>`. Giờ lặp lại việc xoá thẻ đến khi không còn thay đổi (fixed-point).
- **Thiếu khai báo quyền cho GitHub Actions workflow deploy**: `deploy.yml` không set `permissions`, mặc định kế thừa quyền rộng của repo dù chỉ SSH ra server ngoài, không gọi GitHub API. Giờ khai báo `permissions: {}` (không quyền nào), theo nguyên tắc least-privilege.

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
