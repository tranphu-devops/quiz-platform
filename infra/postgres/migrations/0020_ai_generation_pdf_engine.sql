-- Chọn engine đọc PDF của OpenRouter cho tính năng tạo đề bằng AI.
-- Giá trị hợp lệ: 'cloudflare-ai' (miễn phí, OpenRouter tự parse PDF ra text —
-- chạy được với mọi model), 'mistral-ocr' (có phí, đọc được PDF scan),
-- 'native' (đưa thẳng file cho model — chỉ model hỗ trợ input 'file' mới đọc
-- được, ngược lại model chỉ nhận được tên file và báo tài liệu rỗng).
INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('ai_generation_pdf_engine', 'cloudflare-ai')
ON CONFLICT (key) DO NOTHING;
