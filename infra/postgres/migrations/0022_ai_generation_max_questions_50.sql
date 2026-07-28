-- Đổi số câu hỏi tối đa mặc định khi sinh đề bằng AI từ 30 lên 50.
--
-- Khác với 0013 (INSERT ... DO NOTHING, chỉ seed khi chưa có), migration này
-- CỐ Ý ghi đè giá trị admin đang đặt (cùng cách làm với 0021), vì admin_settings
-- đã có sẵn row 'ai_generation_max_questions' = '30' từ 0013 nên một INSERT
-- thường sẽ không có tác dụng trên các bản đã deploy.
--
-- Admin vẫn tự chỉnh lại được ở tab "Tạo đề bằng AI" trong /admin sau khi deploy.
INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('ai_generation_max_questions', '50')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
