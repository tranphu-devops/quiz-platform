-- Đổi model mặc định cho lượt sinh đề bằng key nền tảng sang
-- deepseek/deepseek-v4-flash.
--
-- Khác với 0014 (INSERT ... DO NOTHING, chỉ seed khi chưa có), migration này
-- CỐ Ý ghi đè giá trị admin đang đặt: production đang chạy
-- moonshotai/kimi-k2.5 — model không có 'file' trong input_modalities nên
-- không đọc được PDF, và đo trên cùng một request thì đắt hơn ~54 lần
-- ($0.00295 so với $0.000054).
--
-- Vì sao không phải Gemini/GPT (rẻ hơn trên bảng giá): server Lightsail đặt ở
-- Hong Kong, cả google/* lẫn openai/* đều trả 403 "This model is not
-- available in your region" — OpenRouter không che được geo-restriction của
-- provider.
--
-- Đây là một lần đổi có chủ đích; admin vẫn tự chỉnh lại được ở tab
-- "Tạo đề bằng AI" trong /admin sau khi deploy.
INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('ai_generation_default_model', 'deepseek/deepseek-v4-flash')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
