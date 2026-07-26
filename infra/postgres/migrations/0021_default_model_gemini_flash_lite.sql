-- Đổi model mặc định cho lượt sinh đề bằng key nền tảng sang
-- google/gemini-2.5-flash-lite.
--
-- Khác với 0014 (INSERT ... DO NOTHING, chỉ seed khi chưa có), migration này
-- CỐ Ý ghi đè giá trị admin đang đặt: production đang chạy
-- moonshotai/kimi-k2.5 — model không có 'file' trong input_modalities nên
-- không đọc được PDF, chi phí lại cao hơn (~$0.57/$2.85 so với $0.10/$0.40
-- mỗi 1M token). Đây là một lần đổi có chủ đích; admin vẫn tự chỉnh lại được
-- ở tab "Tạo đề bằng AI" trong /admin sau khi deploy.
INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('ai_generation_default_model', 'google/gemini-2.5-flash-lite')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
