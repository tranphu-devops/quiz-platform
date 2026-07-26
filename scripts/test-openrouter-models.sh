#!/usr/bin/env bash
# Kiểm tra model OpenRouter nào DÙNG ĐƯỢC làm ai_generation_default_model:
# gọi được từ region của server, và tuân thủ json_schema strict như
# generator-service yêu cầu (lib/llm.js). Chạy trước mỗi lần đổi default model.
#
# PHẢI chạy TRÊN SERVER PRODUCTION — restriction tính theo region của bên gọi,
# nên kết quả chạy từ laptop không có giá trị. Cần curl + jq.
#
#   export OPENROUTER_API_KEY=sk-or-v1-...
#   bash scripts/test-openrouter-models.sh                    # danh sách mặc định
#   bash scripts/test-openrouter-models.sh qwen/qwen3.5-plus   # chỉ định model
#
# Kết quả đo từ Lightsail Hong Kong (2026-07-26): google/* và openai/* đều
# 403 "not available in your region"; qwen3.5-flash 400; glm-4.7-flash trả 200
# nhưng JSON sai schema; deepseek/mistral/kimi OK.

set -u
: "${OPENROUTER_API_KEY:?Thiếu OPENROUTER_API_KEY}"

if [ "$#" -gt 0 ]; then
  MODELS=("$@")
else
  MODELS=(
    "deepseek/deepseek-v4-flash"
    "mistralai/mistral-medium-3.1"
    "moonshotai/kimi-k2.5"
    "z-ai/glm-4.7-flash"
    "qwen/qwen3.5-flash-02-23"
    "openai/gpt-5-nano"
    "google/gemini-2.5-flash-lite"
  )
fi

SCHEMA='{"type":"object","properties":{"title":{"type":"string"},"questions":{"type":"array","items":{"type":"object","properties":{"content":{"type":"string"},"correct_answer":{"type":"array","items":{"type":"string"}}},"required":["content","correct_answer"],"additionalProperties":false}}},"required":["title","questions"],"additionalProperties":false}'

printf '%-32s %-6s %s\n' "MODEL" "HTTP" "KẾT QUẢ"
printf '%.0s-' {1..90}; echo

for m in "${MODELS[@]}"; do
  body=$(jq -n --arg m "$m" --argjson schema "$SCHEMA" '{
    model: $m,
    max_tokens: 600,
    messages: [{role:"user",content:"Tạo 1 câu hỏi trắc nghiệm tiếng Việt về điện toán đám mây, kèm đáp án đúng."}],
    response_format: {type:"json_schema", json_schema:{name:"exam", strict:true, schema:$schema}}
  }')

  resp=$(curl -s -w '\n%{http_code}' https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "$body")
  code=$(tail -n1 <<<"$resp")
  json=$(sed '$d' <<<"$resp")

  if [ "$code" != "200" ]; then
    msg=$(jq -r '.error.message // "?"' <<<"$json" 2>/dev/null | head -c 60)
    printf '%-32s %-6s ✗ %s\n' "$m" "$code" "$msg"
    continue
  fi

  content=$(jq -r '.choices[0].message.content // ""' <<<"$json")
  cost=$(jq -r '.usage.cost // "?"' <<<"$json")
  if jq -e '.questions | type == "array" and length > 0' >/dev/null 2>&1 <<<"$content"; then
    printf '%-32s %-6s ✓ JSON hợp lệ, cost=$%s\n' "$m" "$code" "$cost"
  else
    printf '%-32s %-6s ⚠ 200 nhưng JSON sai schema: %s\n' "$m" "$code" "$(head -c 50 <<<"$content")"
  fi
done
