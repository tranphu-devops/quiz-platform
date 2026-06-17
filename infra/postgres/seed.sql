-- =============================================================
-- QUIZ PLATFORM — SAMPLE DATA
-- Password tất cả tài khoản test: Test@1234
--
-- Tài khoản:
--   admin@quiz.test      role: admin
--   gv.nguyen@quiz.test  role: teacher  (tạo đề Lịch sử + JS)
--   gv.tran@quiz.test    role: teacher  (tạo đề Toán)
--   hs.minh@quiz.test    role: student  (đã pass Lịch sử)
--   hs.linh@quiz.test    role: student  (fail Toán)
--   hs.hung@quiz.test    role: student  (đã pass JS)
--
-- Đề thi:
--   [e1] Lịch sử Việt Nam      — chính thức, pass_score=60, 5 câu (1 multiple)
--   [e2] Toán học cơ bản       — thực hành,  pass_score=50, 5 câu (1 multiple)
--   [e3] JavaScript cơ bản     — chính thức, pass_score=70, 5 câu (1 multiple)
--
-- Submissions (để test pass/fail UI):
--   hs.minh  → [e1] score=8/10 80% → PASS
--   hs.linh  → [e2] score=4/10 40% → FAIL
--   hs.hung  → [e3] score=8/10 80% → PASS
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- USERS
-- =============================================================
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  ( 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'admin@quiz.test',     crypt('Test@1234', gen_salt('bf',10)), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin","full_name":"Admin Hệ Thống"}',
    NOW(), NOW() ),
  ( 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'gv.nguyen@quiz.test', crypt('Test@1234', gen_salt('bf',10)), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"teacher","full_name":"Nguyễn Văn Giáo"}',
    NOW(), NOW() ),
  ( 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
    'gv.tran@quiz.test',   crypt('Test@1234', gen_salt('bf',10)), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"teacher","full_name":"Trần Thị Hương"}',
    NOW(), NOW() ),
  ( 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
    'hs.minh@quiz.test',   crypt('Test@1234', gen_salt('bf',10)), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"student","full_name":"Lê Văn Minh"}',
    NOW(), NOW() ),
  ( 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
    'hs.linh@quiz.test',   crypt('Test@1234', gen_salt('bf',10)), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"student","full_name":"Phạm Thị Linh"}',
    NOW(), NOW() ),
  ( 'a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
    'hs.hung@quiz.test',   crypt('Test@1234', gen_salt('bf',10)), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"student","full_name":"Nguyễn Mạnh Hùng"}',
    NOW(), NOW() )
ON CONFLICT (email) WHERE is_sso_user = false DO NOTHING;

-- =============================================================
-- EXAM 1: Lịch sử Việt Nam
--   chính thức | pass=60% | teacher: gv.nguyen
-- =============================================================
INSERT INTO quiz_exams.exams
  (id, title, description, time_limit, passing_score, created_by, is_published, tags, show_explanation, allow_retake)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'Kiến thức Lịch sử Việt Nam',
  'Bộ câu hỏi ôn tập lịch sử Việt Nam từ thời kỳ dựng nước đến hiện đại.',
  20, 60,
  'a0000000-0000-0000-0000-000000000002',
  true,
  ARRAY['Lịch sử', 'Việt Nam', 'Lớp 12'],
  true, false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_exams.questions
  (id, exam_id, content, options, correct_answer, points, order_index, explanation, question_type)
VALUES
  ( 'b1000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'Năm nào Bác Hồ đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình?',
    '[{"key":"A","text":"1944"},{"key":"B","text":"1945"},{"key":"C","text":"1946"},{"key":"D","text":"1954"}]',
    'B', 2, 0,
    'Ngày 2/9/1945, Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình, Hà Nội.',
    'single' ),

  ( 'b1000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000001',
    'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?',
    '[{"key":"A","text":"1950"},{"key":"B","text":"1952"},{"key":"C","text":"1954"},{"key":"D","text":"1956"}]',
    'C', 2, 1,
    'Chiến dịch Điện Biên Phủ kết thúc ngày 7/5/1954, buộc Pháp ký Hiệp định Genève.',
    'single' ),

  ( 'b1000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000001',
    'Hiệp định Paris về Việt Nam được ký kết vào năm nào?',
    '[{"key":"A","text":"1968"},{"key":"B","text":"1973"},{"key":"C","text":"1975"},{"key":"D","text":"1976"}]',
    'B', 2, 2,
    'Hiệp định Paris ký ngày 27/1/1973, buộc Mỹ rút quân khỏi Việt Nam.',
    'single' ),

  ( 'b1000000-0000-0000-0000-000000000004',
    'e0000000-0000-0000-0000-000000000001',
    'Đại thắng mùa Xuân 1975 kết thúc với sự kiện nào?',
    '[{"key":"A","text":"Giải phóng Đà Nẵng"},{"key":"B","text":"Chiến dịch Hồ Chí Minh toàn thắng"},{"key":"C","text":"Giải phóng Huế"},{"key":"D","text":"Ký Hiệp định hòa bình"}]',
    'B', 2, 3,
    'Chiến dịch Hồ Chí Minh kết thúc ngày 30/4/1975, giải phóng Sài Gòn, thống nhất đất nước.',
    'single' ),

  ( 'b1000000-0000-0000-0000-000000000005',
    'e0000000-0000-0000-0000-000000000001',
    'Những thành tựu nào là kết quả của công cuộc Đổi mới từ 1986? (chọn tất cả đúng)',
    '[{"key":"A","text":"Kinh tế tăng trưởng ổn định"},{"key":"B","text":"Xóa bỏ bao cấp trong nông nghiệp"},{"key":"C","text":"Mở cửa thu hút đầu tư nước ngoài"},{"key":"D","text":"Gia nhập ASEAN năm 1995"}]',
    'A,B,C,D', 2, 4,
    'Đổi mới 1986 dẫn đến kinh tế thị trường định hướng XHCN, xóa bao cấp, mở cửa FDI và hội nhập quốc tế.',
    'multiple' )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- EXAM 2: Toán học cơ bản
--   thực hành | pass=50% | teacher: gv.tran
-- =============================================================
INSERT INTO quiz_exams.exams
  (id, title, description, time_limit, passing_score, created_by, is_published, tags, show_explanation, allow_retake)
VALUES (
  'e0000000-0000-0000-0000-000000000002',
  'Toán học cơ bản',
  'Ôn tập các phép tính và khái niệm toán học cơ bản. Có thể làm lại nhiều lần để luyện tập.',
  15, 50,
  'a0000000-0000-0000-0000-000000000003',
  true,
  ARRAY['Toán', 'Cơ bản', 'Luyện tập'],
  true, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_exams.questions
  (id, exam_id, content, options, correct_answer, points, order_index, explanation, question_type)
VALUES
  ( 'b2000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000002',
    'Kết quả của 15 × 12 là bao nhiêu?',
    '[{"key":"A","text":"160"},{"key":"B","text":"170"},{"key":"C","text":"180"},{"key":"D","text":"190"}]',
    'C', 2, 0,
    '15 × 12 = 15 × 10 + 15 × 2 = 150 + 30 = 180.',
    'single' ),

  ( 'b2000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000002',
    'Căn bậc hai của 144 là bao nhiêu?',
    '[{"key":"A","text":"10"},{"key":"B","text":"11"},{"key":"C","text":"12"},{"key":"D","text":"13"}]',
    'C', 2, 1,
    '√144 = 12 vì 12² = 144.',
    'single' ),

  ( 'b2000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000002',
    'Một tam giác đều có cạnh 6 cm. Chu vi tam giác là bao nhiêu?',
    '[{"key":"A","text":"12 cm"},{"key":"B","text":"18 cm"},{"key":"C","text":"24 cm"},{"key":"D","text":"36 cm"}]',
    'B', 2, 2,
    'Tam giác đều có 3 cạnh bằng nhau. Chu vi = 3 × 6 = 18 cm.',
    'single' ),

  ( 'b2000000-0000-0000-0000-000000000004',
    'e0000000-0000-0000-0000-000000000002',
    'Số nào sau đây là số nguyên tố? (chọn tất cả đúng)',
    '[{"key":"A","text":"2"},{"key":"B","text":"7"},{"key":"C","text":"13"},{"key":"D","text":"17"}]',
    'A,B,C,D', 2, 3,
    '2, 7, 13, 17 đều là số nguyên tố (chỉ chia hết cho 1 và chính nó).',
    'multiple' ),

  ( 'b2000000-0000-0000-0000-000000000005',
    'e0000000-0000-0000-0000-000000000002',
    '2³ + 3² = ?',
    '[{"key":"A","text":"13"},{"key":"B","text":"17"},{"key":"C","text":"19"},{"key":"D","text":"25"}]',
    'B', 2, 4,
    '2³ = 8 và 3² = 9. Vậy 8 + 9 = 17.',
    'single' )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- EXAM 3: JavaScript cơ bản
--   chính thức | pass=70% | teacher: gv.nguyen
-- =============================================================
INSERT INTO quiz_exams.exams
  (id, title, description, time_limit, passing_score, created_by, is_published, tags, show_explanation, allow_retake)
VALUES (
  'e0000000-0000-0000-0000-000000000003',
  'Lập trình JavaScript cơ bản',
  'Kiểm tra kiến thức JS: cú pháp, kiểu dữ liệu, array, hàm. Thi chính thức — pass 1 lần, không thi lại.',
  25, 70,
  'a0000000-0000-0000-0000-000000000002',
  true,
  ARRAY['JavaScript', 'Lập trình', 'Web'],
  true, false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_exams.questions
  (id, exam_id, content, options, correct_answer, points, order_index, explanation, question_type)
VALUES
  ( 'b3000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000003',
    'Kết quả của `typeof null` trong JavaScript là gì?',
    '[{"key":"A","text":"\"null\""},{"key":"B","text":"\"undefined\""},{"key":"C","text":"\"object\""},{"key":"D","text":"\"boolean\""}]',
    'C', 2, 0,
    '`typeof null` trả về `"object"` — đây là bug nổi tiếng từ phiên bản JS đầu tiên, được giữ lại để backward compatibility.',
    'single' ),

  ( 'b3000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000003',
    'Phương thức nào thêm phần tử vào cuối mảng trong JavaScript?',
    '[{"key":"A","text":"unshift()"},{"key":"B","text":"push()"},{"key":"C","text":"append()"},{"key":"D","text":"add()"}]',
    'B', 2, 1,
    '`Array.push()` thêm 1 hoặc nhiều phần tử vào cuối mảng và trả về độ dài mới.',
    'single' ),

  ( 'b3000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000003',
    'Đoạn code `console.log(0.1 + 0.2 === 0.3)` in ra gì?',
    '[{"key":"A","text":"true"},{"key":"B","text":"false"},{"key":"C","text":"undefined"},{"key":"D","text":"NaN"}]',
    'B', 2, 2,
    'Do floating-point precision: `0.1 + 0.2 = 0.30000000000000004`. Dùng `Math.abs(a-b) < Number.EPSILON` để so sánh số thực.',
    'single' ),

  ( 'b3000000-0000-0000-0000-000000000004',
    'e0000000-0000-0000-0000-000000000003',
    'Cách khai báo biến nào hợp lệ trong JavaScript ES6+? (chọn tất cả đúng)',
    '[{"key":"A","text":"let x = 1"},{"key":"B","text":"const y = 2"},{"key":"C","text":"var z = 3"},{"key":"D","text":"int n = 4"}]',
    'A,B,C', 2, 3,
    '`let`, `const`, `var` đều hợp lệ. `int` không phải keyword của JavaScript.',
    'multiple' ),

  ( 'b3000000-0000-0000-0000-000000000005',
    'e0000000-0000-0000-0000-000000000003',
    'Arrow function `const add = (a, b) => a + b` tương đương với cách viết nào?',
    '[{"key":"A","text":"function add(a,b){ return a+b; }"},{"key":"B","text":"function add(a,b){ a+b; }"},{"key":"C","text":"const add = function(a,b){ a+b }"},{"key":"D","text":"add = (a,b) => { a+b }"}]',
    'A', 2, 4,
    'Arrow function với concise body `=> expr` tự động return giá trị biểu thức, tương đương `return a+b`.',
    'single' )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- SUBMISSIONS (để test UI pass/fail)
--
-- hs.minh  → Lịch sử: đúng 4/5 câu đơn + sai câu multiple → 8/10 = 80% → PASS
-- hs.linh  → Toán:    đúng 2/5 câu                        → 4/10 = 40% → FAIL
-- hs.hung  → JS:      đúng 4/5 câu                        → 8/10 = 80% → PASS
-- =============================================================

-- hs.minh PASS Lịch sử (8/10 = 80%)
INSERT INTO quiz_submissions.submissions
  (id, exam_id, user_id, answers, score, total_points, percentage, results_detail, submitted_at)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000004',
  '{
    "b1000000-0000-0000-0000-000000000001": "B",
    "b1000000-0000-0000-0000-000000000002": "C",
    "b1000000-0000-0000-0000-000000000003": "B",
    "b1000000-0000-0000-0000-000000000004": "B",
    "b1000000-0000-0000-0000-000000000005": ["A","B","C"]
  }',
  8, 10, 80,
  '{
    "show_explanation": true,
    "questions": [
      {"id":"b1000000-0000-0000-0000-000000000001","content":"Năm nào Bác Hồ đọc Tuyên ngôn Độc lập?","question_type":"single","correct_answer":"B","student_answer":"B","is_correct":true,"points":2,"earned":2},
      {"id":"b1000000-0000-0000-0000-000000000002","content":"Chiến thắng Điện Biên Phủ diễn ra vào năm nào?","question_type":"single","correct_answer":"C","student_answer":"C","is_correct":true,"points":2,"earned":2},
      {"id":"b1000000-0000-0000-0000-000000000003","content":"Hiệp định Paris ký vào năm nào?","question_type":"single","correct_answer":"B","student_answer":"B","is_correct":true,"points":2,"earned":2},
      {"id":"b1000000-0000-0000-0000-000000000004","content":"Đại thắng 1975 kết thúc với sự kiện nào?","question_type":"single","correct_answer":"B","student_answer":"B","is_correct":true,"points":2,"earned":2},
      {"id":"b1000000-0000-0000-0000-000000000005","content":"Thành tựu Đổi mới từ 1986?","question_type":"multiple","correct_answer":"A,B,C,D","student_answer":["A","B","C"],"is_correct":false,"points":2,"earned":0}
    ]
  }',
  NOW() - INTERVAL '2 days'
) ON CONFLICT (id) DO NOTHING;

-- hs.linh FAIL Toán (4/10 = 40%)
INSERT INTO quiz_submissions.submissions
  (id, exam_id, user_id, answers, score, total_points, percentage, results_detail, submitted_at)
VALUES (
  'f0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000005',
  '{
    "b2000000-0000-0000-0000-000000000001": "A",
    "b2000000-0000-0000-0000-000000000002": "C",
    "b2000000-0000-0000-0000-000000000003": "C",
    "b2000000-0000-0000-0000-000000000004": ["A","B","C","D"],
    "b2000000-0000-0000-0000-000000000005": "A"
  }',
  4, 10, 40,
  '{
    "show_explanation": true,
    "questions": [
      {"id":"b2000000-0000-0000-0000-000000000001","content":"15 × 12 = ?","question_type":"single","correct_answer":"C","student_answer":"A","is_correct":false,"points":2,"earned":0},
      {"id":"b2000000-0000-0000-0000-000000000002","content":"Căn bậc hai của 144?","question_type":"single","correct_answer":"C","student_answer":"C","is_correct":true,"points":2,"earned":2},
      {"id":"b2000000-0000-0000-0000-000000000003","content":"Chu vi tam giác đều cạnh 6cm?","question_type":"single","correct_answer":"B","student_answer":"C","is_correct":false,"points":2,"earned":0},
      {"id":"b2000000-0000-0000-0000-000000000004","content":"Số nguyên tố nào sau đây?","question_type":"multiple","correct_answer":"A,B,C,D","student_answer":["A","B","C","D"],"is_correct":true,"points":2,"earned":2},
      {"id":"b2000000-0000-0000-0000-000000000005","content":"2³ + 3² = ?","question_type":"single","correct_answer":"B","student_answer":"A","is_correct":false,"points":2,"earned":0}
    ]
  }',
  NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO NOTHING;

-- hs.hung PASS JavaScript (8/10 = 80%)
INSERT INTO quiz_submissions.submissions
  (id, exam_id, user_id, answers, score, total_points, percentage, results_detail, submitted_at)
VALUES (
  'f0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000006',
  '{
    "b3000000-0000-0000-0000-000000000001": "C",
    "b3000000-0000-0000-0000-000000000002": "B",
    "b3000000-0000-0000-0000-000000000003": "A",
    "b3000000-0000-0000-0000-000000000004": ["A","B","C"],
    "b3000000-0000-0000-0000-000000000005": "A"
  }',
  8, 10, 80,
  '{
    "show_explanation": true,
    "questions": [
      {"id":"b3000000-0000-0000-0000-000000000001","content":"typeof null = ?","question_type":"single","correct_answer":"C","student_answer":"C","is_correct":true,"points":2,"earned":2},
      {"id":"b3000000-0000-0000-0000-000000000002","content":"Thêm phần tử vào cuối mảng?","question_type":"single","correct_answer":"B","student_answer":"B","is_correct":true,"points":2,"earned":2},
      {"id":"b3000000-0000-0000-0000-000000000003","content":"0.1 + 0.2 === 0.3?","question_type":"single","correct_answer":"B","student_answer":"A","is_correct":false,"points":2,"earned":0},
      {"id":"b3000000-0000-0000-0000-000000000004","content":"Khai báo biến hợp lệ ES6+?","question_type":"multiple","correct_answer":"A,B,C","student_answer":["A","B","C"],"is_correct":true,"points":2,"earned":2},
      {"id":"b3000000-0000-0000-0000-000000000005","content":"Arrow function tương đương?","question_type":"single","correct_answer":"A","student_answer":"A","is_correct":true,"points":2,"earned":2}
    ]
  }',
  NOW() - INTERVAL '3 hours'
) ON CONFLICT (id) DO NOTHING;
