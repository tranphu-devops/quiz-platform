-- ================================================================
-- seed_exam_01.sql
-- 100 đề thi mẫu · mỗi đề 10 câu · thời gian 15 phút
--
-- Yêu cầu: seed.sql đã chạy (cần teacher UUIDs bên dưới)
--   gv.nguyen: a0000000-0000-0000-0000-000000000002
--   gv.tran:   a0000000-0000-0000-0000-000000000003
--
-- Chủ đề (10 topic × 10 đề):
--   01-10  Lịch sử Việt Nam
--   11-20  Toán học phổ thông
--   21-30  Tiếng Anh cơ bản
--   31-40  JavaScript
--   41-50  Python
--   51-60  Vật lý
--   61-70  Hóa học
--   71-80  Địa lý Việt Nam
--   81-90  Tin học văn phòng
--   91-100 Kinh tế cơ bản
-- ================================================================

DO $$
DECLARE
  v_exam_id UUID;
  t1 CONSTANT UUID := 'a0000000-0000-0000-0000-000000000002';  -- gv.nguyen
  t2 CONSTANT UUID := 'a0000000-0000-0000-0000-000000000003';  -- gv.tran
  i    INT;
  v_tg INT;   -- topic group 1-10
  v_en INT;   -- exam number within group 1-10
  v_title       TEXT;
  v_description TEXT;
  v_tags        TEXT[];
  v_teacher     UUID;
  rec RECORD;
BEGIN

  -- ---------------------------------------------------------------
  -- Bảng tạm: ngân hàng câu hỏi (10 chủ đề × 10 câu = 100 câu)
  -- ---------------------------------------------------------------
  CREATE TEMP TABLE _qbank (
    tg      INT,
    qi      INT,   -- thứ tự câu trong đề (0-9)
    content TEXT,
    opts    TEXT,  -- JSONB string
    correct TEXT,
    expl    TEXT,
    qtype   TEXT DEFAULT 'single'
  );

  -- ==============================================================
  -- TOPIC 1: Lịch sử Việt Nam
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (1,0,
   'Nước Việt Nam Dân chủ Cộng hòa được khai sinh vào ngày nào?',
   '[{"key":"A","text":"19/8/1945"},{"key":"B","text":"2/9/1945"},{"key":"C","text":"30/4/1975"},{"key":"D","text":"1/1/1976"}]',
   'B',
   'Ngày 2/9/1945, Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình, khai sinh nước VNDCCH.'),
  (1,1,
   'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?',
   '[{"key":"A","text":"1950"},{"key":"B","text":"1952"},{"key":"C","text":"1954"},{"key":"D","text":"1956"}]',
   'C',
   'Chiến dịch Điện Biên Phủ kết thúc ngày 7/5/1954, buộc thực dân Pháp ký Hiệp định Genève.'),
  (1,2,
   'Vua Lý Công Uẩn dời đô từ Hoa Lư về đâu vào năm 1010?',
   '[{"key":"A","text":"Phú Xuân"},{"key":"B","text":"Thăng Long"},{"key":"C","text":"Đại La"},{"key":"D","text":"Cổ Loa"}]',
   'B',
   'Năm 1010, Lý Công Uẩn ban Chiếu dời đô, chuyển kinh đô từ Hoa Lư về Thăng Long (Hà Nội ngày nay).'),
  (1,3,
   'Ai là người chỉ huy quân dân Đại Việt đánh tan quân Mông Nguyên lần thứ hai và thứ ba?',
   '[{"key":"A","text":"Lý Thường Kiệt"},{"key":"B","text":"Trần Hưng Đạo"},{"key":"C","text":"Nguyễn Huệ"},{"key":"D","text":"Đinh Bộ Lĩnh"}]',
   'B',
   'Hưng Đạo Đại vương Trần Quốc Tuấn lãnh đạo 3 lần kháng chiến chống quân Mông Nguyên (1258, 1285, 1288).'),
  (1,4,
   'Hiệp định Paris về chấm dứt chiến tranh ở Việt Nam được ký kết năm nào?',
   '[{"key":"A","text":"1968"},{"key":"B","text":"1973"},{"key":"C","text":"1975"},{"key":"D","text":"1976"}]',
   'B',
   'Hiệp định Paris ký ngày 27/1/1973, buộc Mỹ rút quân và thừa nhận độc lập, chủ quyền của Việt Nam.'),
  (1,5,
   'Ngày 30/4/1975 gắn với sự kiện lịch sử nào?',
   '[{"key":"A","text":"Ký Hiệp định Genève"},{"key":"B","text":"Giải phóng Đà Nẵng"},{"key":"C","text":"Giải phóng Sài Gòn, thống nhất đất nước"},{"key":"D","text":"Thành lập nước CHXHCNVN"}]',
   'C',
   'Ngày 30/4/1975, Chiến dịch Hồ Chí Minh toàn thắng, Sài Gòn được giải phóng, kết thúc chiến tranh chống Mỹ.'),
  (1,6,
   'Công cuộc Đổi mới của Việt Nam bắt đầu từ Đại hội Đảng lần thứ mấy?',
   '[{"key":"A","text":"V (1982)"},{"key":"B","text":"VI (1986)"},{"key":"C","text":"VII (1991)"},{"key":"D","text":"VIII (1996)"}]',
   'B',
   'Đại hội Đảng lần VI (12/1986) đề ra đường lối Đổi mới toàn diện, chuyển sang kinh tế thị trường định hướng XHCN.'),
  (1,7,
   'Việt Nam chính thức gia nhập ASEAN vào năm nào?',
   '[{"key":"A","text":"1992"},{"key":"B","text":"1995"},{"key":"C","text":"1997"},{"key":"D","text":"2000"}]',
   'B',
   'Ngày 28/7/1995, Việt Nam trở thành thành viên thứ 7 của ASEAN, đánh dấu bước hội nhập khu vực quan trọng.'),
  (1,8,
   'Ai là người đánh tan quân Nam Hán trên sông Bạch Đằng năm 938?',
   '[{"key":"A","text":"Ngô Quyền"},{"key":"B","text":"Đinh Bộ Lĩnh"},{"key":"C","text":"Lê Hoàn"},{"key":"D","text":"Lý Bí"}]',
   'A',
   'Ngô Quyền chỉ huy trận Bạch Đằng năm 938, nhấn chìm thuyền chiến Nam Hán, kết thúc 1000 năm Bắc thuộc.'),
  (1,9,
   'Khởi nghĩa Hai Bà Trưng nổ ra vào năm nào?',
   '[{"key":"A","text":"40 SCN"},{"key":"B","text":"248 SCN"},{"key":"C","text":"544 SCN"},{"key":"D","text":"938 SCN"}]',
   'A',
   'Năm 40 SCN, Trưng Trắc và Trưng Nhị phất cờ khởi nghĩa chống ách đô hộ của nhà Đông Hán.');

  -- ==============================================================
  -- TOPIC 2: Toán học phổ thông
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (2,0,
   'Kết quả của 15 × 12 là bao nhiêu?',
   '[{"key":"A","text":"160"},{"key":"B","text":"170"},{"key":"C","text":"180"},{"key":"D","text":"190"}]',
   'C',
   '15 × 12 = 15 × 10 + 15 × 2 = 150 + 30 = 180.'),
  (2,1,
   'Căn bậc hai của 144 là bao nhiêu?',
   '[{"key":"A","text":"10"},{"key":"B","text":"11"},{"key":"C","text":"12"},{"key":"D","text":"13"}]',
   'C',
   '√144 = 12 vì 12² = 144.'),
  (2,2,
   '2³ + 3² bằng bao nhiêu?',
   '[{"key":"A","text":"13"},{"key":"B","text":"17"},{"key":"C","text":"19"},{"key":"D","text":"25"}]',
   'B',
   '2³ = 8, 3² = 9. Vậy 8 + 9 = 17.'),
  (2,3,
   'Diện tích hình tròn có bán kính r = 5 cm là bao nhiêu?',
   '[{"key":"A","text":"10π cm²"},{"key":"B","text":"25π cm²"},{"key":"C","text":"50π cm²"},{"key":"D","text":"100π cm²"}]',
   'B',
   'S = πr² = π × 5² = 25π cm².'),
  (2,4,
   'Phương trình x² - 5x + 6 = 0 có nghiệm là?',
   '[{"key":"A","text":"x = 1 và x = 6"},{"key":"B","text":"x = -2 và x = -3"},{"key":"C","text":"x = 2 và x = 3"},{"key":"D","text":"x = 0 và x = 5"}]',
   'C',
   'x² - 5x + 6 = (x-2)(x-3) = 0 → x = 2 hoặc x = 3.'),
  (2,5,
   'log₂(8) bằng bao nhiêu?',
   '[{"key":"A","text":"2"},{"key":"B","text":"3"},{"key":"C","text":"4"},{"key":"D","text":"6"}]',
   'B',
   'log₂(8) = 3 vì 2³ = 8.'),
  (2,6,
   'Đạo hàm của hàm số f(x) = x³ là?',
   '[{"key":"A","text":"x²"},{"key":"B","text":"2x²"},{"key":"C","text":"3x²"},{"key":"D","text":"3x³"}]',
   'C',
   'Theo quy tắc đạo hàm lũy thừa: (xⁿ)'' = n·xⁿ⁻¹, nên (x³)'' = 3x².'),
  (2,7,
   'sin(90°) bằng bao nhiêu?',
   '[{"key":"A","text":"0"},{"key":"B","text":"0.5"},{"key":"C","text":"√2/2"},{"key":"D","text":"1"}]',
   'D',
   'sin(90°) = 1 là giá trị cực đại của hàm sin.'),
  (2,8,
   'Dãy Fibonacci: 1, 1, 2, 3, 5, 8, ... Số tiếp theo là?',
   '[{"key":"A","text":"11"},{"key":"B","text":"12"},{"key":"C","text":"13"},{"key":"D","text":"14"}]',
   'C',
   'Mỗi số là tổng hai số trước: 5 + 8 = 13.'),
  (2,9,
   'Một tam giác đều có cạnh 6 cm. Chu vi tam giác là bao nhiêu?',
   '[{"key":"A","text":"12 cm"},{"key":"B","text":"18 cm"},{"key":"C","text":"24 cm"},{"key":"D","text":"36 cm"}]',
   'B',
   'Tam giác đều có 3 cạnh bằng nhau. Chu vi = 3 × 6 = 18 cm.');

  -- ==============================================================
  -- TOPIC 3: Tiếng Anh cơ bản
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (3,0,
   'Choose the correct verb form: "She ___ to school every day."',
   '[{"key":"A","text":"go"},{"key":"B","text":"goes"},{"key":"C","text":"going"},{"key":"D","text":"gone"}]',
   'B',
   'Third person singular (she/he/it) in simple present takes -s/-es: "goes".'),
  (3,1,
   'What is the past tense of the verb "go"?',
   '[{"key":"A","text":"goed"},{"key":"B","text":"goes"},{"key":"C","text":"went"},{"key":"D","text":"gone"}]',
   'C',
   '"Go" is an irregular verb. Its simple past tense is "went".'),
  (3,2,
   'Fill in the blank: "I have been waiting ___ 3 hours."',
   '[{"key":"A","text":"for"},{"key":"B","text":"since"},{"key":"C","text":"during"},{"key":"D","text":"while"}]',
   'A',
   'Use "for" with a duration (3 hours). Use "since" with a point in time (3 o''clock).'),
  (3,3,
   'Which word is a synonym of "big"?',
   '[{"key":"A","text":"tiny"},{"key":"B","text":"small"},{"key":"C","text":"large"},{"key":"D","text":"little"}]',
   'C',
   '"Large" means the same as "big". The others are antonyms.'),
  (3,4,
   'What is the antonym of "happy"?',
   '[{"key":"A","text":"joyful"},{"key":"B","text":"unhappy"},{"key":"C","text":"glad"},{"key":"D","text":"cheerful"}]',
   'B',
   '"Unhappy" is the direct antonym of "happy". The others are synonyms.'),
  (3,5,
   'Fill in the blank: "The book ___ written by Shakespeare."',
   '[{"key":"A","text":"is"},{"key":"B","text":"has"},{"key":"C","text":"was"},{"key":"D","text":"were"}]',
   'C',
   'This is passive voice in simple past tense: "was written" (subject is singular "the book").'),
  (3,6,
   'Which sentence is grammatically correct?',
   '[{"key":"A","text":"She is more taller than me."},{"key":"B","text":"She is taller than I am."},{"key":"C","text":"She is tallest than me."},{"key":"D","text":"She is more tall than me."}]',
   'B',
   '"Taller" is the comparative form of "tall". Never use "more" with a one-syllable adjective.'),
  (3,7,
   'What part of speech is the word "beautiful"?',
   '[{"key":"A","text":"Adjective"},{"key":"B","text":"Adverb"},{"key":"C","text":"Noun"},{"key":"D","text":"Verb"}]',
   'A',
   '"Beautiful" describes a noun, so it is an adjective. The adverb form is "beautifully".'),
  (3,8,
   'What is the plural of the word "child"?',
   '[{"key":"A","text":"childs"},{"key":"B","text":"childes"},{"key":"C","text":"children"},{"key":"D","text":"childrens"}]',
   'C',
   '"Child" is an irregular noun. Its plural is "children", not "childs".'),
  (3,9,
   'Choose the correct form: "She can''t come because she ___ sick."',
   '[{"key":"A","text":"be"},{"key":"B","text":"is"},{"key":"C","text":"are"},{"key":"D","text":"am"}]',
   'B',
   'Third person singular (she) uses "is" with the verb "to be" in simple present.');

  -- ==============================================================
  -- TOPIC 4: JavaScript
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (4,0,
   'Kết quả của `typeof null` trong JavaScript là gì?',
   '[{"key":"A","text":"\"null\""},{"key":"B","text":"\"undefined\""},{"key":"C","text":"\"object\""},{"key":"D","text":"\"boolean\""}]',
   'C',
   '`typeof null` trả về `"object"` — đây là bug lịch sử từ phiên bản JS đầu tiên, được giữ lại vì backward compatibility.'),
  (4,1,
   'Phương thức nào thêm phần tử vào CUỐI mảng trong JavaScript?',
   '[{"key":"A","text":"unshift()"},{"key":"B","text":"push()"},{"key":"C","text":"append()"},{"key":"D","text":"add()"}]',
   'B',
   '`Array.push()` thêm một hoặc nhiều phần tử vào cuối mảng và trả về độ dài mới.'),
  (4,2,
   'Đoạn code `console.log(0.1 + 0.2 === 0.3)` in ra gì?',
   '[{"key":"A","text":"true"},{"key":"B","text":"false"},{"key":"C","text":"undefined"},{"key":"D","text":"NaN"}]',
   'B',
   'Do floating-point precision: `0.1 + 0.2 = 0.30000000000000004` ≠ 0.3.'),
  (4,3,
   'Kết quả của biểu thức `2 ** 3` trong JavaScript là bao nhiêu?',
   '[{"key":"A","text":"6"},{"key":"B","text":"5"},{"key":"C","text":"8"},{"key":"D","text":"9"}]',
   'C',
   '`**` là toán tử lũy thừa (ES2016). `2 ** 3 = 2³ = 8`.'),
  (4,4,
   'Sự khác biệt giữa `===` và `==` trong JavaScript là gì?',
   '[{"key":"A","text":"Không có sự khác biệt"},{"key":"B","text":"=== kiểm tra cả giá trị lẫn kiểu dữ liệu, == chỉ kiểm tra giá trị"},{"key":"C","text":"== nhanh hơn ==="},{"key":"D","text":"=== chỉ dùng cho số"}]',
   'B',
   '`===` (strict equality) kiểm tra cả value và type, không ép kiểu. `==` có thể ép kiểu trước khi so sánh.'),
  (4,5,
   'Phương thức `Array.map()` trả về gì?',
   '[{"key":"A","text":"Mảng mới với cùng số phần tử"},{"key":"B","text":"Boolean"},{"key":"C","text":"Phần tử đầu tiên thỏa điều kiện"},{"key":"D","text":"Không trả về gì (undefined)"}]',
   'A',
   '`map()` tạo và trả về mảng mới có cùng số phần tử, mỗi phần tử là kết quả của callback.'),
  (4,6,
   'Đoạn code sau có hợp lệ không? `const obj = {}; obj.name = "JS";`',
   '[{"key":"A","text":"Hợp lệ, vì const chỉ ngăn reassign biến, không ngăn thay đổi thuộc tính"},{"key":"B","text":"Lỗi, vì obj là const"},{"key":"C","text":"Lỗi, vì obj chưa có thuộc tính name"},{"key":"D","text":"Hợp lệ nhưng name sẽ là undefined"}]',
   'A',
   '`const` ngăn gán lại biến (`obj = ...`) nhưng không ngăn thay đổi nội dung object/mảng mà biến trỏ tới.'),
  (4,7,
   '`Promise.all([p1, p2, p3])` hoạt động như thế nào?',
   '[{"key":"A","text":"Chạy lần lượt từng promise"},{"key":"B","text":"Chờ tất cả promise resolve, reject ngay nếu có 1 promise reject"},{"key":"C","text":"Trả về kết quả promise đầu tiên hoàn thành"},{"key":"D","text":"Bỏ qua promise bị reject"}]',
   'B',
   '`Promise.all()` chạy song song tất cả promise, resolve khi tất cả thành công, reject ngay khi có bất kỳ promise nào thất bại.'),
  (4,8,
   'Closure trong JavaScript là gì?',
   '[{"key":"A","text":"Hàm có thể truy cập biến của hàm cha sau khi hàm cha đã kết thúc"},{"key":"B","text":"Từ khóa đóng một block code"},{"key":"C","text":"Cách khai báo class"},{"key":"D","text":"Phương thức để đóng kết nối"}]',
   'A',
   'Closure là hàm "nhớ" biến từ scope bên ngoài ngay cả sau khi scope đó đã chạy xong.'),
  (4,9,
   'Kết quả của `JSON.parse(''{"a":1}'').a` là gì?',
   '[{"key":"A","text":"\"1\""},{"key":"B","text":"1"},{"key":"C","text":"undefined"},{"key":"D","text":"null"}]',
   'B',
   '`JSON.parse()` chuyển chuỗi JSON thành object. Truy cập `.a` trả về số nguyên `1`.'),
  -- ==============================================================
  -- TOPIC 5: Python
  -- ==============================================================
  (5,0,
   'Kết quả của `[x**2 for x in range(3)]` trong Python là gì?',
   '[{"key":"A","text":"[1, 4, 9]"},{"key":"B","text":"[0, 2, 4]"},{"key":"C","text":"[0, 1, 4]"},{"key":"D","text":"[1, 2, 3]"}]',
   'C',
   'range(3) tạo ra 0, 1, 2. Bình phương mỗi số: 0²=0, 1²=1, 2²=4.'),
  (5,1,
   'Kết quả của `len("hello world")` trong Python là bao nhiêu?',
   '[{"key":"A","text":"10"},{"key":"B","text":"11"},{"key":"C","text":"5"},{"key":"D","text":"12"}]',
   'B',
   '"hello world" có 11 ký tự (kể cả dấu cách).'),
  (5,2,
   'Kiểu dữ liệu nào là IMMUTABLE (không thể thay đổi) trong Python?',
   '[{"key":"A","text":"list"},{"key":"B","text":"tuple"},{"key":"C","text":"dict"},{"key":"D","text":"set"}]',
   'B',
   'Tuple là immutable: không thể thêm, xóa, hay thay đổi phần tử sau khi tạo.'),
  (5,3,
   '`range(1, 5)` trong Python tạo ra dãy nào?',
   '[{"key":"A","text":"[1, 2, 3, 4, 5]"},{"key":"B","text":"[1, 2, 3, 4]"},{"key":"C","text":"[0, 1, 2, 3, 4]"},{"key":"D","text":"[2, 3, 4, 5]"}]',
   'B',
   '`range(start, stop)` tạo dãy từ start đến stop-1. range(1,5) → 1, 2, 3, 4.'),
  (5,4,
   'Kết quả của `7 // 2` trong Python là bao nhiêu?',
   '[{"key":"A","text":"3.5"},{"key":"B","text":"3"},{"key":"C","text":"4"},{"key":"D","text":"1"}]',
   'B',
   '`//` là toán tử chia lấy phần nguyên (floor division). 7 // 2 = 3 (phần dư 1 bị bỏ).'),
  (5,5,
   '`type(3.14)` trả về gì trong Python?',
   '[{"key":"A","text":"<class ''int''>"},{"key":"B","text":"<class ''float''>"},{"key":"C","text":"<class ''double''>"},{"key":"D","text":"<class ''number''>"}]',
   'B',
   '3.14 là số thực nên thuộc kiểu `float` trong Python.'),
  (5,6,
   'Lambda `(lambda x: x * 2)(5)` trả về gì?',
   '[{"key":"A","text":"5"},{"key":"B","text":"10"},{"key":"C","text":"25"},{"key":"D","text":"Lỗi"}]',
   'B',
   'Lambda tạo hàm vô danh nhận x và trả về x*2. Gọi ngay với x=5 → 5*2 = 10.'),
  (5,7,
   '"hello".upper() trả về gì?',
   '[{"key":"A","text":"\"hello\""},{"key":"B","text":"\"Hello\""},{"key":"C","text":"\"HELLO\""},{"key":"D","text":"\"HELLO!\""}]',
   'C',
   '`.upper()` chuyển toàn bộ ký tự thành chữ hoa.'),
  (5,8,
   '[1, 2, 3].append(4) trả về gì trong Python?',
   '[{"key":"A","text":"[1, 2, 3, 4]"},{"key":"B","text":"None"},{"key":"C","text":"4"},{"key":"D","text":"True"}]',
   'B',
   '`.append()` sửa mảng tại chỗ (in-place) và trả về None. Để lấy mảng mới dùng list + [4].'),
  (5,9,
   'Sự khác biệt giữa `is` và `==` trong Python là gì?',
   '[{"key":"A","text":"Không có sự khác biệt"},{"key":"B","text":"is so sánh identity (cùng object), == so sánh giá trị"},{"key":"C","text":"is nhanh hơn =="},{"key":"D","text":"== chỉ dùng cho số"}]',
   'B',
   '`is` kiểm tra hai biến có trỏ đến cùng object hay không. `==` kiểm tra giá trị bằng nhau.');

  -- ==============================================================
  -- TOPIC 6: Vật lý
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (6,0,
   'Gia tốc trọng trường g tại bề mặt Trái Đất xấp xỉ bằng bao nhiêu?',
   '[{"key":"A","text":"8.9 m/s²"},{"key":"B","text":"9.8 m/s²"},{"key":"C","text":"10.8 m/s²"},{"key":"D","text":"12 m/s²"}]',
   'B',
   'Gia tốc trọng trường g ≈ 9.8 m/s² (thường làm tròn thành 10 m/s² trong bài tập phổ thông).'),
  (6,1,
   'Theo định luật II Newton, lực F được tính bằng công thức?',
   '[{"key":"A","text":"F = m/a"},{"key":"B","text":"F = a/m"},{"key":"C","text":"F = m × a"},{"key":"D","text":"F = m + a"}]',
   'C',
   'Định luật II Newton: F = ma. Lực = khối lượng × gia tốc. Đơn vị: Newton (N) = kg·m/s².'),
  (6,2,
   'Vận tốc ánh sáng trong chân không xấp xỉ bằng bao nhiêu?',
   '[{"key":"A","text":"3 × 10⁶ m/s"},{"key":"B","text":"3 × 10⁷ m/s"},{"key":"C","text":"3 × 10⁸ m/s"},{"key":"D","text":"3 × 10⁹ m/s"}]',
   'C',
   'Vận tốc ánh sáng c ≈ 2.998 × 10⁸ m/s ≈ 300.000 km/s, thường viết tắt là 3 × 10⁸ m/s.'),
  (6,3,
   'Theo định luật Ohm, cường độ dòng điện I được tính bằng?',
   '[{"key":"A","text":"I = U × R"},{"key":"B","text":"I = U / R"},{"key":"C","text":"I = R / U"},{"key":"D","text":"I = U + R"}]',
   'B',
   'Định luật Ohm: I = U/R. Cường độ dòng điện = Hiệu điện thế / Điện trở. Đơn vị: Ampere (A).'),
  (6,4,
   'Công thức tính động năng của một vật khối lượng m, vận tốc v là?',
   '[{"key":"A","text":"W = mv"},{"key":"B","text":"W = ½mv²"},{"key":"C","text":"W = mv²"},{"key":"D","text":"W = 2mv²"}]',
   'B',
   'Động năng W_đ = ½mv². Đây là năng lượng mà vật có được do chuyển động.'),
  (6,5,
   'Hai điện trở R₁ = 3Ω và R₂ = 6Ω mắc song song. Điện trở tương đương là?',
   '[{"key":"A","text":"9Ω"},{"key":"B","text":"2Ω"},{"key":"C","text":"4.5Ω"},{"key":"D","text":"18Ω"}]',
   'B',
   '1/R = 1/R₁ + 1/R₂ = 1/3 + 1/6 = 1/2. Vậy R = 2Ω. Điện trở song song luôn nhỏ hơn điện trở nhỏ nhất.'),
  (6,6,
   '0 Kelvin (0 K) tương đương với nhiệt độ bao nhiêu độ Celsius?',
   '[{"key":"A","text":"-100°C"},{"key":"B","text":"-273.15°C"},{"key":"C","text":"-373.15°C"},{"key":"D","text":"0°C"}]',
   'B',
   '0 K = -273.15°C là nhiệt độ không tuyệt đối — điểm thấp nhất có thể về mặt lý thuyết.'),
  (6,7,
   'Nguyên lý bảo toàn năng lượng phát biểu rằng:',
   '[{"key":"A","text":"Năng lượng không tự sinh ra hay mất đi, chỉ chuyển hóa từ dạng này sang dạng khác"},{"key":"B","text":"Năng lượng luôn tăng theo thời gian"},{"key":"C","text":"Năng lượng nhiệt không thể chuyển thành cơ năng"},{"key":"D","text":"Năng lượng của vật cô lập bằng 0"}]',
   'A',
   'Nguyên lý bảo toàn năng lượng: năng lượng không tự sinh ra hay biến mất mà chỉ chuyển từ dạng này sang dạng khác.'),
  (6,8,
   'Bước sóng λ liên hệ với vận tốc v và tần số f theo công thức nào?',
   '[{"key":"A","text":"λ = f/v"},{"key":"B","text":"λ = v/f"},{"key":"C","text":"λ = v × f"},{"key":"D","text":"λ = f × v²"}]',
   'B',
   'λ = v/f. Bước sóng = vận tốc chia tần số. Đơn vị λ: mét (m).'),
  (6,9,
   'Công thức tính thế năng trọng lực của vật khối lượng m ở độ cao h là?',
   '[{"key":"A","text":"W = m/gh"},{"key":"B","text":"W = mgh"},{"key":"C","text":"W = ½mgh"},{"key":"D","text":"W = mg/h"}]',
   'B',
   'Thế năng trọng lực W_t = mgh. Trong đó g ≈ 9.8 m/s², h là độ cao so với mốc thế năng.');

  -- ==============================================================
  -- TOPIC 7: Hóa học
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (7,0,
   'Số proton của nguyên tố Carbon (C) trong bảng tuần hoàn là bao nhiêu?',
   '[{"key":"A","text":"4"},{"key":"B","text":"6"},{"key":"C","text":"8"},{"key":"D","text":"12"}]',
   'B',
   'Carbon (C) có số nguyên tử Z = 6, tức là có 6 proton trong hạt nhân.'),
  (7,1,
   'Công thức phân tử của nước là gì?',
   '[{"key":"A","text":"H₂O"},{"key":"B","text":"HO₂"},{"key":"C","text":"H₂O₂"},{"key":"D","text":"H₃O"}]',
   'A',
   'Nước có công thức H₂O: 2 nguyên tử Hydro liên kết cộng hóa trị với 1 nguyên tử Oxy.'),
  (7,2,
   'Dung dịch có tính axit khi chỉ số pH nhỏ hơn bao nhiêu?',
   '[{"key":"A","text":"5"},{"key":"B","text":"7"},{"key":"C","text":"9"},{"key":"D","text":"14"}]',
   'B',
   'pH < 7: tính axit. pH = 7: trung tính. pH > 7: tính bazơ. Thang pH từ 0 đến 14.'),
  (7,3,
   'NaCl là ký hiệu hóa học của chất gì?',
   '[{"key":"A","text":"Natri hidroxit"},{"key":"B","text":"Axit clohidric"},{"key":"C","text":"Natri clorua (muối ăn)"},{"key":"D","text":"Natri carbonat"}]',
   'C',
   'NaCl = Natri clorua, còn gọi là muối ăn, được tạo thành từ ion Na⁺ và Cl⁻.'),
  (7,4,
   'Phản ứng đốt cháy hoàn toàn metan (CH₄) tạo ra sản phẩm gì?',
   '[{"key":"A","text":"CO + H₂O"},{"key":"B","text":"CO₂ + H₂O"},{"key":"C","text":"C + H₂O"},{"key":"D","text":"CO₂ + H₂"}]',
   'B',
   'CH₄ + 2O₂ → CO₂ + 2H₂O. Đốt cháy hoàn toàn hydrocarbon luôn tạo CO₂ và H₂O.'),
  (7,5,
   'Kim loại nào có độ dẫn điện tốt nhất trong các kim loại phổ biến?',
   '[{"key":"A","text":"Bạc (Ag)"},{"key":"B","text":"Đồng (Cu)"},{"key":"C","text":"Vàng (Au)"},{"key":"D","text":"Nhôm (Al)"}]',
   'A',
   'Bạc (Ag) là kim loại dẫn điện tốt nhất. Trong thực tế, đồng (Cu) được dùng phổ biến hơn vì rẻ hơn.'),
  (7,6,
   'Nguyên tố nào chiếm tỉ lệ khối lượng nhiều nhất trong vỏ Trái Đất?',
   '[{"key":"A","text":"Silicon (Si)"},{"key":"B","text":"Oxy (O)"},{"key":"C","text":"Sắt (Fe)"},{"key":"D","text":"Nhôm (Al)"}]',
   'B',
   'Oxy chiếm khoảng 46% khối lượng vỏ Trái Đất, chủ yếu ở dạng hợp chất oxit và silicat.'),
  (7,7,
   'Phản ứng giữa axit HCl và bazơ NaOH tạo ra sản phẩm gì?',
   '[{"key":"A","text":"NaCl + H₂O₂"},{"key":"B","text":"NaCl + H₂O"},{"key":"C","text":"Na₂Cl + H₂"},{"key":"D","text":"NaOH + Cl₂"}]',
   'B',
   'HCl + NaOH → NaCl + H₂O. Đây là phản ứng trung hòa (axit-bazơ) tạo muối và nước.'),
  (7,8,
   'CaCO₃ là công thức của chất gì?',
   '[{"key":"A","text":"Thạch cao"},{"key":"B","text":"Đá vôi (Canxi carbonat)"},{"key":"C","text":"Muối ăn"},{"key":"D","text":"Baking soda"}]',
   'B',
   'CaCO₃ = Canxi carbonat, thành phần chính của đá vôi, vỏ sò, san hô. Bị phân hủy bởi axit.'),
  (7,9,
   'Electron mang điện tích gì?',
   '[{"key":"A","text":"Dương (+)"},{"key":"B","text":"Âm (-)"},{"key":"C","text":"Trung hòa (không mang điện)"},{"key":"D","text":"Vừa dương vừa âm"}]',
   'B',
   'Electron mang điện tích âm (-e = -1.6 × 10⁻¹⁹ C). Proton mang điện dương, neutron trung hòa.');

  -- ==============================================================
  -- TOPIC 8: Địa lý Việt Nam
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (8,0,
   'Thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam là thành phố nào?',
   '[{"key":"A","text":"Hà Nội"},{"key":"B","text":"TP. Hồ Chí Minh"},{"key":"C","text":"Đà Nẵng"},{"key":"D","text":"Huế"}]',
   'A',
   'Hà Nội là thủ đô của Việt Nam. Trước năm 1010 kinh đô đặt tại Hoa Lư; Lý Công Uẩn dời đô về Thăng Long (Hà Nội).'),
  (8,1,
   'Việt Nam hiện có bao nhiêu tỉnh, thành phố trực thuộc Trung ương?',
   '[{"key":"A","text":"58"},{"key":"B","text":"61"},{"key":"C","text":"63"},{"key":"D","text":"64"}]',
   'C',
   'Việt Nam có 63 tỉnh, thành phố trực thuộc Trung ương (5 thành phố trực thuộc TW và 58 tỉnh).'),
  (8,2,
   'Đỉnh núi cao nhất Việt Nam là đỉnh nào?',
   '[{"key":"A","text":"Núi Bà Đen"},{"key":"B","text":"Fansipan"},{"key":"C","text":"Phu Si Lung"},{"key":"D","text":"Ngọc Linh"}]',
   'B',
   'Fansipan (3.143 m) thuộc dãy Hoàng Liên Sơn, Lào Cai — được mệnh danh là "nóc nhà Đông Dương".'),
  (8,3,
   'Vịnh Hạ Long được công nhận là Di sản thiên nhiên thế giới thuộc tỉnh nào?',
   '[{"key":"A","text":"Hải Phòng"},{"key":"B","text":"Hải Dương"},{"key":"C","text":"Quảng Ninh"},{"key":"D","text":"Ninh Bình"}]',
   'C',
   'Vịnh Hạ Long nằm ở tỉnh Quảng Ninh, được UNESCO công nhận là Di sản thiên nhiên thế giới năm 1994 và 2000.'),
  (8,4,
   'Thành phố nào đông dân nhất Việt Nam?',
   '[{"key":"A","text":"Hà Nội"},{"key":"B","text":"TP. Hồ Chí Minh"},{"key":"C","text":"Đà Nẵng"},{"key":"D","text":"Cần Thơ"}]',
   'B',
   'TP. Hồ Chí Minh (tên cũ: Sài Gòn) là thành phố đông dân nhất Việt Nam với hơn 9 triệu người (2020).'),
  (8,5,
   'Việt Nam tiếp giáp với Biển Đông ở phía nào?',
   '[{"key":"A","text":"Phía Tây"},{"key":"B","text":"Phía Đông"},{"key":"C","text":"Phía Bắc"},{"key":"D","text":"Phía Nam"}]',
   'B',
   'Việt Nam có đường bờ biển dài hơn 3.260 km, tiếp giáp Biển Đông ở phía Đông và phía Nam.'),
  (8,6,
   'Đồng bằng nào lớn nhất Việt Nam?',
   '[{"key":"A","text":"Đồng bằng sông Hồng"},{"key":"B","text":"Đồng bằng sông Cửu Long"},{"key":"C","text":"Đồng bằng ven biển miền Trung"},{"key":"D","text":"Cánh đồng Mường Thanh"}]',
   'B',
   'Đồng bằng sông Cửu Long (miền Tây Nam Bộ) rộng khoảng 40.000 km², là đồng bằng lớn nhất Việt Nam.'),
  (8,7,
   'Đảo lớn nhất của Việt Nam là đảo nào?',
   '[{"key":"A","text":"Côn Đảo"},{"key":"B","text":"Phú Quốc"},{"key":"C","text":"Cát Bà"},{"key":"D","text":"Lý Sơn"}]',
   'B',
   'Phú Quốc thuộc tỉnh Kiên Giang, có diện tích khoảng 574 km² — đảo lớn nhất Việt Nam.'),
  (8,8,
   'Việt Nam có chung đường biên giới đất liền với bao nhiêu quốc gia?',
   '[{"key":"A","text":"2"},{"key":"B","text":"3"},{"key":"C","text":"4"},{"key":"D","text":"5"}]',
   'B',
   'Việt Nam tiếp giáp đất liền với 3 quốc gia: Trung Quốc (phía Bắc), Lào và Campuchia (phía Tây).'),
  (8,9,
   'Sông nào là sông lớn nhất chảy qua đồng bằng Bắc Bộ?',
   '[{"key":"A","text":"Sông Đà"},{"key":"B","text":"Sông Hồng"},{"key":"C","text":"Sông Thái Bình"},{"key":"D","text":"Sông Mã"}]',
   'B',
   'Sông Hồng (dài ~1.200 km, đoạn qua VN ~500 km) bồi đắp tạo nên đồng bằng sông Hồng màu mỡ.');

  -- ==============================================================
  -- TOPIC 9: Tin học văn phòng
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (9,0,
   'Phím tắt để sao chép (Copy) trong Windows / Office là gì?',
   '[{"key":"A","text":"Ctrl+C"},{"key":"B","text":"Ctrl+V"},{"key":"C","text":"Ctrl+X"},{"key":"D","text":"Ctrl+Z"}]',
   'A',
   'Ctrl+C = Copy (Sao chép). Ctrl+V = Paste (Dán). Ctrl+X = Cut (Cắt). Ctrl+Z = Undo (Hoàn tác).'),
  (9,1,
   'Định dạng file Microsoft Excel hiện đại (.xlsx) là định dạng gì?',
   '[{"key":"A","text":"Định dạng nhị phân cũ (.xls)"},{"key":"B","text":"Định dạng XML-based (Office Open XML)"},{"key":"C","text":"Định dạng PDF"},{"key":"D","text":"Định dạng CSV"}]',
   'B',
   '.xlsx là định dạng Office Open XML (dựa trên XML + ZIP) giới thiệu từ Office 2007, thay thế .xls nhị phân.'),
  (9,2,
   'Hàm SUM trong Excel dùng để làm gì?',
   '[{"key":"A","text":"Tính tổng các giá trị trong vùng chọn"},{"key":"B","text":"Tính trung bình cộng"},{"key":"C","text":"Đếm số ô có dữ liệu"},{"key":"D","text":"Tìm giá trị lớn nhất"}]',
   'A',
   '=SUM(A1:A10) tính tổng các giá trị trong vùng A1 đến A10. AVERAGE tính trung bình, COUNT đếm ô.'),
  (9,3,
   'Nhấn phím F2 khi đang chọn một ô trong Excel có tác dụng gì?',
   '[{"key":"A","text":"Lưu file"},{"key":"B","text":"Chuyển sang chế độ chỉnh sửa nội dung ô"},{"key":"C","text":"Mở hộp thoại Format Cells"},{"key":"D","text":"Xóa nội dung ô"}]',
   'B',
   'F2 kích hoạt chế độ Edit cho ô đang chọn (con trỏ xuất hiện trong ô), tương đương double-click vào ô.'),
  (9,4,
   'Đuôi file mặc định của Microsoft PowerPoint 2019/2021/365 là gì?',
   '[{"key":"A","text":".ppt"},{"key":"B","text":".pps"},{"key":"C","text":".pptx"},{"key":"D","text":".ppsx"}]',
   'C',
   '.pptx là định dạng mặc định từ PowerPoint 2007 trở đi. .ppt là định dạng cũ trước Office 2007.'),
  (9,5,
   'Phím tắt Ctrl+Z trong các ứng dụng Office có tác dụng gì?',
   '[{"key":"A","text":"Lưu file (Save)"},{"key":"B","text":"Hoàn tác hành động vừa thực hiện (Undo)"},{"key":"C","text":"Làm lại (Redo)"},{"key":"D","text":"Đóng file"}]',
   'B',
   'Ctrl+Z = Undo (Hoàn tác). Ctrl+Y = Redo (Làm lại). Ctrl+S = Save (Lưu). Ctrl+W = Close.'),
  (9,6,
   'Hàm VLOOKUP trong Excel dùng để làm gì?',
   '[{"key":"A","text":"Tính tổng có điều kiện"},{"key":"B","text":"Tìm kiếm giá trị theo chiều dọc trong bảng và trả về giá trị cùng hàng"},{"key":"C","text":"Đếm ô thỏa điều kiện"},{"key":"D","text":"Tính trung bình có điều kiện"}]',
   'B',
   'VLOOKUP(lookup_value, table_array, col_index, [range_lookup]) tìm kiếm theo cột đầu tiên và trả về giá trị cột chỉ định.'),
  (9,7,
   'Mail Merge trong Microsoft Word được dùng để làm gì?',
   '[{"key":"A","text":"Tạo hàng loạt thư/nhãn cá nhân hóa từ một mẫu chung và danh sách dữ liệu"},{"key":"B","text":"Gửi email trực tiếp từ Word"},{"key":"C","text":"Ghép nhiều file Word lại"},{"key":"D","text":"Nén file để gửi email"}]',
   'A',
   'Mail Merge kết hợp mẫu thư (Word) với nguồn dữ liệu (Excel/CSV) để tạo hàng loạt thư/nhãn/phong bì cá nhân hóa.'),
  (9,8,
   'Pivot Table trong Excel được dùng để làm gì?',
   '[{"key":"A","text":"Tóm tắt, phân tích và trực quan hóa dữ liệu lớn nhanh chóng"},{"key":"B","text":"Tạo biểu đồ"},{"key":"C","text":"Lọc dữ liệu đơn giản"},{"key":"D","text":"Sắp xếp dữ liệu theo thứ tự"}]',
   'A',
   'Pivot Table (Bảng tổng hợp) cho phép kéo-thả trường dữ liệu để tóm tắt, nhóm và phân tích dữ liệu theo nhiều chiều.'),
  (9,9,
   'PDF là viết tắt của cụm từ nào?',
   '[{"key":"A","text":"Printed Document File"},{"key":"B","text":"Page Definition Format"},{"key":"C","text":"Portable Document Format"},{"key":"D","text":"Public Data File"}]',
   'C',
   'PDF = Portable Document Format, định dạng tài liệu di động do Adobe phát triển năm 1993, hiển thị nhất quán trên mọi thiết bị.');

  -- ==============================================================
  -- TOPIC 10: Kinh tế cơ bản
  -- ==============================================================
  INSERT INTO _qbank (tg, qi, content, opts, correct, expl) VALUES
  (10,0,
   'GDP là viết tắt của cụm từ nào?',
   '[{"key":"A","text":"General Domestic Product"},{"key":"B","text":"Gross Domestic Product"},{"key":"C","text":"Global Development Plan"},{"key":"D","text":"Government Debt Policy"}]',
   'B',
   'GDP (Gross Domestic Product) = Tổng sản phẩm quốc nội: tổng giá trị hàng hóa, dịch vụ sản xuất trong một quốc gia trong một năm.'),
  (10,1,
   'Lạm phát (inflation) là hiện tượng gì?',
   '[{"key":"A","text":"Kinh tế tăng trưởng nhanh"},{"key":"B","text":"Mức giá chung tăng liên tục theo thời gian, làm giảm sức mua"},{"key":"C","text":"Thất nghiệp gia tăng"},{"key":"D","text":"Xuất khẩu giảm"}]',
   'B',
   'Lạm phát là sự tăng liên tục mức giá chung. Khi lạm phát cao, cùng lượng tiền mua được ít hàng hóa hơn.'),
  (10,2,
   'WTO là tên viết tắt của tổ chức nào?',
   '[{"key":"A","text":"World Tourism Organization"},{"key":"B","text":"World Treaty Organization"},{"key":"C","text":"World Trade Organization"},{"key":"D","text":"World Technology Organization"}]',
   'C',
   'WTO (World Trade Organization) = Tổ chức Thương mại Thế giới, thành lập 1995, quy định thương mại quốc tế.'),
  (10,3,
   'Cổ phiếu (stock/share) đại diện cho điều gì?',
   '[{"key":"A","text":"Khoản vay của nhà đầu tư cho công ty"},{"key":"B","text":"Phần sở hữu trong công ty cổ phần"},{"key":"C","text":"Cam kết trả lãi cố định"},{"key":"D","text":"Tiền gửi ngân hàng"}]',
   'B',
   'Cổ phiếu là chứng chỉ xác nhận quyền sở hữu một phần trong công ty. Cổ đông được chia cổ tức và tham gia quản trị.'),
  (10,4,
   'Khi Ngân hàng Trung ương tăng lãi suất cơ bản, điều gì thường xảy ra?',
   '[{"key":"A","text":"Vay vốn rẻ hơn, kích thích tiêu dùng"},{"key":"B","text":"Vay vốn đắt hơn, giảm tín dụng và tiêu dùng"},{"key":"C","text":"Lạm phát tăng ngay lập tức"},{"key":"D","text":"Thất nghiệp giảm"}]',
   'B',
   'Tăng lãi suất → vay vốn đắt hơn → giảm chi tiêu và đầu tư → kiểm soát lạm phát nhưng có thể làm chậm tăng trưởng.'),
  (10,5,
   'Theo quy luật cung cầu, nếu cầu tăng trong khi cung không đổi, giá sẽ?',
   '[{"key":"A","text":"Giảm"},{"key":"B","text":"Tăng"},{"key":"C","text":"Không đổi"},{"key":"D","text":"Bằng 0"}]',
   'B',
   'Khi cầu tăng > cung, người mua cạnh tranh nhau → đẩy giá lên. Đây là quy luật cơ bản của kinh tế thị trường.'),
  (10,6,
   'FDI là viết tắt của cụm từ nào?',
   '[{"key":"A","text":"Federal Direct Initiative"},{"key":"B","text":"Foreign Direct Investment"},{"key":"C","text":"Financial Derivative Index"},{"key":"D","text":"Free Domestic Industry"}]',
   'B',
   'FDI (Foreign Direct Investment) = Đầu tư trực tiếp nước ngoài: nhà đầu tư nước ngoài thiết lập hoặc mua cổ phần kiểm soát tại doanh nghiệp trong nước.'),
  (10,7,
   'Ngân hàng Trung ương của Việt Nam là cơ quan nào?',
   '[{"key":"A","text":"Bộ Tài chính"},{"key":"B","text":"Ngân hàng Nhà nước Việt Nam (NHNN)"},{"key":"C","text":"Vietcombank"},{"key":"D","text":"BIDV"}]',
   'B',
   'Ngân hàng Nhà nước Việt Nam (NHNN) là ngân hàng trung ương, thực hiện chính sách tiền tệ quốc gia và quản lý hệ thống ngân hàng.'),
  (10,8,
   'Chỉ số VN-Index theo dõi điều gì?',
   '[{"key":"A","text":"Tốc độ tăng trưởng GDP của Việt Nam"},{"key":"B","text":"Biến động giá cổ phiếu trên Sở Giao dịch Chứng khoán TP.HCM (HOSE)"},{"key":"C","text":"Tỷ giá hối đoái USD/VND"},{"key":"D","text":"Chỉ số giá tiêu dùng (CPI)"}]',
   'B',
   'VN-Index là chỉ số tổng hợp phản ánh biến động giá của toàn bộ cổ phiếu niêm yết trên HOSE (Sở GDCK TP.HCM).'),
  (10,9,
   'Đặc trưng cơ bản nhất của kinh tế thị trường là gì?',
   '[{"key":"A","text":"Nhà nước kiểm soát toàn bộ giá cả"},{"key":"B","text":"Giá cả do cung cầu thị trường quyết định, có cạnh tranh tự do"},{"key":"C","text":"Không có tư hữu tài sản"},{"key":"D","text":"Mọi người có thu nhập bằng nhau"}]',
   'B',
   'Trong kinh tế thị trường, giá cả hàng hóa và dịch vụ được xác định bởi cung-cầu thông qua cạnh tranh tự do giữa người mua và người bán.');

  -- ---------------------------------------------------------------
  -- Tạo 100 đề thi (10 chủ đề × 10 đề mỗi chủ đề)
  -- ---------------------------------------------------------------
  FOR i IN 1..100 LOOP
    v_tg := (i - 1) / 10 + 1;
    v_en := (i - 1) % 10 + 1;

    -- Chọn giáo viên xen kẽ
    v_teacher := CASE WHEN v_en % 2 = 0 THEN t1 ELSE t2 END;

    -- Tên đề thi theo chủ đề
    v_title := CASE v_tg
      WHEN 1  THEN 'Lịch sử Việt Nam — Đề ' || v_en
      WHEN 2  THEN 'Toán học phổ thông — Đề ' || v_en
      WHEN 3  THEN 'Tiếng Anh cơ bản — Đề ' || v_en
      WHEN 4  THEN 'Lập trình JavaScript — Đề ' || v_en
      WHEN 5  THEN 'Lập trình Python — Đề ' || v_en
      WHEN 6  THEN 'Vật lý đại cương — Đề ' || v_en
      WHEN 7  THEN 'Hóa học phổ thông — Đề ' || v_en
      WHEN 8  THEN 'Địa lý Việt Nam — Đề ' || v_en
      WHEN 9  THEN 'Tin học văn phòng — Đề ' || v_en
      WHEN 10 THEN 'Kinh tế cơ bản — Đề ' || v_en
    END;

    -- Mô tả đề thi
    v_description := CASE v_tg
      WHEN 1  THEN 'Ôn tập kiến thức lịch sử Việt Nam từ thời kỳ dựng nước đến hiện đại. Đề ' || v_en || '/10.'
      WHEN 2  THEN 'Kiểm tra các khái niệm toán học cơ bản: số học, đại số, hình học. Đề ' || v_en || '/10.'
      WHEN 3  THEN 'Luyện tập ngữ pháp và từ vựng tiếng Anh căn bản. Đề ' || v_en || '/10.'
      WHEN 4  THEN 'Kiểm tra kiến thức JavaScript: cú pháp, kiểu dữ liệu, array, async. Đề ' || v_en || '/10.'
      WHEN 5  THEN 'Kiểm tra kiến thức Python: cú pháp, cấu trúc dữ liệu, hàm. Đề ' || v_en || '/10.'
      WHEN 6  THEN 'Ôn tập vật lý: cơ học, điện học, quang học. Đề ' || v_en || '/10.'
      WHEN 7  THEN 'Kiểm tra hóa học: nguyên tử, liên kết, phản ứng, axit-bazơ. Đề ' || v_en || '/10.'
      WHEN 8  THEN 'Ôn tập địa lý Việt Nam: địa hình, khí hậu, dân số, hành chính. Đề ' || v_en || '/10.'
      WHEN 9  THEN 'Luyện tập kỹ năng tin học văn phòng: Word, Excel, PowerPoint. Đề ' || v_en || '/10.'
      WHEN 10 THEN 'Kiểm tra kiến thức kinh tế căn bản: vi mô, vĩ mô, tài chính. Đề ' || v_en || '/10.'
    END;

    -- Tags theo chủ đề
    v_tags := CASE v_tg
      WHEN 1  THEN ARRAY['Lịch sử', 'Việt Nam', 'Ôn thi']
      WHEN 2  THEN ARRAY['Toán học', 'Đại số', 'Hình học']
      WHEN 3  THEN ARRAY['Tiếng Anh', 'Grammar', 'Vocabulary']
      WHEN 4  THEN ARRAY['JavaScript', 'Lập trình', 'Web']
      WHEN 5  THEN ARRAY['Python', 'Lập trình', 'Backend']
      WHEN 6  THEN ARRAY['Vật lý', 'Cơ học', 'Điện học']
      WHEN 7  THEN ARRAY['Hóa học', 'Nguyên tử', 'Phản ứng']
      WHEN 8  THEN ARRAY['Địa lý', 'Việt Nam', 'Hành chính']
      WHEN 9  THEN ARRAY['Tin học', 'Excel', 'Word']
      WHEN 10 THEN ARRAY['Kinh tế', 'Tài chính', 'Thị trường']
    END;

    v_exam_id := gen_random_uuid();

    INSERT INTO quiz_exams.exams
      (id, title, description, time_limit, passing_score, created_by,
       is_published, tags, show_explanation, allow_retake, credit_cost)
    VALUES
      (v_exam_id, v_title, v_description, 15, 60, v_teacher,
       true, v_tags, true, true, 0);

    -- Chèn 10 câu hỏi từ ngân hàng câu hỏi của chủ đề tương ứng
    INSERT INTO quiz_exams.questions
      (exam_id, content, options, correct_answer, points, order_index, explanation, question_type)
    SELECT
      v_exam_id,
      content,
      opts::JSONB,
      correct,
      1.0,
      qi,
      expl,
      qtype
    FROM _qbank
    WHERE _qbank.tg = v_tg
    ORDER BY qi;

  END LOOP;

  DROP TABLE _qbank;

  RAISE NOTICE 'seed_exam_01: đã tạo 100 đề thi, mỗi đề 10 câu.';
END $$;
