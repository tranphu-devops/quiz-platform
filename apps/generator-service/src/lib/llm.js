const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

// Attaches a structured `.detail` to the thrown Error so routes/generate.js
// can persist it into generation_jobs.error_detail (JSONB) for the job
// history UI, instead of only the flattened message string.
function llmError(message, detail) {
  return Object.assign(new Error(message), { detail })
}

// Model ids are OpenRouter slugs (provider-prefixed, dot-separated version),
// not the bare Anthropic model names used when calling Anthropic directly.
// Fallback only — the actual default is admin-configurable
// (admin_settings.ai_generation_default_model, read in routes/generate.js).
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-5'

// Structured-output schema for the generated exam. Mirrors exam-service's
// Teacher API shape (POST /exams + POST /exams/:id/questions) so the result
// can be imported with no transformation beyond the per-question POST loop.
// correct_answer is always an array of option keys — exam-service sorts and
// joins it into a comma-separated string for both single and multiple types,
// so a single-answer question is just a one-element array.
const EXAM_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          question_type: { type: 'string', enum: ['single', 'multiple'] },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                text: { type: 'string' }
              },
              required: ['key', 'text'],
              additionalProperties: false
            }
          },
          correct_answer: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'string' },
          points: { type: 'number' }
        },
        required: ['content', 'question_type', 'options', 'correct_answer', 'explanation', 'points'],
        additionalProperties: false
      }
    }
  },
  required: ['title', 'description', 'tags', 'questions'],
  additionalProperties: false
}

// PDF and plain text go to the model as OpenAI-compatible file/text content
// blocks (OpenRouter's chat completions API). DOCX must already be
// pre-extracted to plain text by lib/docParse.js — there is no native .docx
// content block.
export function buildDocumentBlock({ mimetype, buffer, extractedText }) {
  if (mimetype === 'application/pdf') {
    return {
      type: 'file',
      file: {
        filename: 'document.pdf',
        file_data: `data:application/pdf;base64,${buffer.toString('base64')}`
      }
    }
  }
  const text = extractedText ?? buffer.toString('utf8')
  return { type: 'text', text: `Nội dung tài liệu nguồn:\n\n${text}` }
}

function buildPrompt({ questionCount, language, difficulty }) {
  return `Bạn là chuyên gia biên soạn đề thi trắc nghiệm. Dựa trên tài liệu nguồn được đính kèm, hãy sinh một đề thi trắc nghiệm hoàn chỉnh.

Yêu cầu:
- Số câu hỏi: khoảng ${questionCount} câu.
- Ngôn ngữ đầu ra: ${language === 'en' ? 'tiếng Anh' : 'tiếng Việt'}.
- Độ khó: ${difficulty}.
- Mỗi câu hỏi có 4 lựa chọn (option key là chữ in hoa A, B, C, D...), duy nhất, không trùng nội dung.
- "question_type" là "single" (1 đáp án đúng) hoặc "multiple" (từ 2 đáp án đúng trở lên). Ưu tiên "single" trừ khi nội dung tự nhiên đòi hỏi nhiều đáp án.
- "correct_answer" là mảng các option key đúng (một phần tử với câu "single").
- Mỗi câu có "explanation" ngắn gọn giải thích vì sao đáp án đúng.
- Không bịa thông tin ngoài tài liệu nguồn; câu hỏi phải kiểm tra đúng nội dung tài liệu.
- "tags" là 3-6 từ khoá chủ đề ngắn gọn rút ra từ tài liệu.
- Không có hai câu hỏi trùng hoặc gần giống nhau.`
}

export async function generateExam({ apiKey, model, documentBlock, questionCount, language, difficulty }) {
  // Scale with questionCount — a fixed 16000 was getting hit (and silently
  // truncating the JSON output, surfacing as a confusing "Unterminated
  // string in JSON" parse error) once teachers asked for larger exams.
  const maxTokens = Math.min(32000, 4000 + questionCount * 900)
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [documentBlock, { type: 'text', text: buildPrompt({ questionCount, language, difficulty }) }]
    }],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'exam', strict: true, schema: EXAM_SCHEMA }
    },
    // Only relevant when documentBlock is a PDF file block — "native" hands
    // the PDF to the underlying model directly (Claude models support it
    // natively) instead of OpenRouter's default OCR parsing, which costs
    // extra and isn't needed here.
    ...(documentBlock.type === 'file' ? { plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }] } : {})
  }

  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://phutx.top',
      'X-Title': 'Quiz Platform - AI Exam Generator'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const providerError = data?.error
    throw llmError(providerError?.message ?? `OpenRouter request thất bại (${res.status})`, {
      source: 'openrouter', http_status: res.status,
      code: providerError?.code, metadata: providerError?.metadata, model
    })
  }

  const choice = data.choices?.[0]
  if (!choice) {
    throw llmError('LLM không trả về nội dung hợp lệ', { source: 'openrouter', reason: 'no_choice', model, response: data })
  }
  if (choice.message?.refusal || choice.finish_reason === 'content_filter') {
    throw llmError('LLM từ chối sinh nội dung cho tài liệu này', {
      source: 'openrouter', reason: 'refusal', model,
      refusal: choice.message?.refusal, finish_reason: choice.finish_reason
    })
  }
  if (choice.finish_reason === 'length') {
    throw llmError('LLM output bị cắt do vượt giới hạn token — vui lòng giảm số câu hỏi mong muốn hoặc chọn model khác', {
      source: 'openrouter', reason: 'length', model, max_tokens: maxTokens, question_count: questionCount
    })
  }

  const content = choice.message?.content
  if (!content) {
    throw llmError('LLM không trả về nội dung hợp lệ', { source: 'openrouter', reason: 'empty_content', model, finish_reason: choice.finish_reason })
  }

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (err) {
    throw llmError('LLM trả về JSON không hợp lệ, vui lòng thử lại', {
      source: 'openrouter', reason: 'parse_error', model,
      parse_error: err.message, content_length: content.length,
      content_excerpt: content.length > 1000 ? `${content.slice(0, 500)}…[cut]…${content.slice(-500)}` : content
    })
  }
  try {
    return { exam: normalizeExam(parsed), usage: data.usage }
  } catch (err) {
    throw llmError(err.message, { source: 'validation', model })
  }
}

// Defensive re-validation on top of the schema guarantee: unique option
// keys per question, correct_answer subset of option keys, order_index
// assigned sequentially (exam-service defaults order_index to 0 for every
// question if the caller omits it — must be set explicitly per question).
// Shapes are also re-checked here (not just re-validated) because
// `response_format.json_schema.strict` is honored inconsistently across
// OpenRouter providers — some non-Anthropic/non-OpenAI models (teacher
// "own key" generations accept any model slug) return best-effort JSON
// that merely resembles the schema, so `options`/`correct_answer` can come
// back as something other than an array and crash `.map`/`.filter` with an
// opaque TypeError instead of a reportable validation error.
function normalizeExam(exam) {
  if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
    throw new Error('LLM không sinh được câu hỏi nào')
  }
  const questions = exam.questions.map((q, index) => {
    if (!Array.isArray(q.options) || q.options.length === 0 || !q.options.every(o => o && typeof o.key === 'string' && typeof o.text === 'string')) {
      throw new Error(`Câu hỏi #${index + 1} có "options" không đúng định dạng — model không tuân theo schema, vui lòng thử lại hoặc chọn model khác`)
    }
    const optionKeys = q.options.map(o => o.key)
    const uniqueKeys = new Set(optionKeys)
    if (uniqueKeys.size !== optionKeys.length) {
      throw new Error(`Câu hỏi #${index + 1} có option key trùng lặp`)
    }
    const rawCorrectAnswer = Array.isArray(q.correct_answer) ? q.correct_answer : []
    const correctAnswer = rawCorrectAnswer.filter(k => uniqueKeys.has(k))
    if (correctAnswer.length === 0) {
      throw new Error(`Câu hỏi #${index + 1} không có đáp án đúng hợp lệ`)
    }
    if (q.question_type === 'multiple' && correctAnswer.length < 2) {
      throw new Error(`Câu hỏi #${index + 1} là "multiple" nhưng chỉ có 1 đáp án đúng`)
    }
    return {
      content: q.content,
      question_type: q.question_type,
      options: q.options,
      correct_answer: correctAnswer,
      explanation: q.explanation,
      points: q.points || 1,
      order_index: index
    }
  })

  return {
    title: exam.title,
    description: exam.description,
    tags: exam.tags ?? [],
    questions
  }
}
