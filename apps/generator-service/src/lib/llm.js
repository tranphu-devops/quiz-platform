const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

// Attaches a structured `.detail` to the thrown Error so routes/generate.js
// can persist it into generation_jobs.error_detail (JSONB) for the job
// history UI, instead of only the flattened message string.
function llmError(message, detail) {
  return Object.assign(new Error(message), { detail })
}

// Model ids are OpenRouter slugs (provider-prefixed, dot-separated version),
// not the bare provider model names used when calling a provider directly.
// Fallback only — the actual default is admin-configurable
// (admin_settings.ai_generation_default_model, read in routes/generate.js).
//
// Chosen on cost + what is actually reachable from the production server, in
// that order. The Lightsail host is in Hong Kong, where BOTH `google/*` and
// `openai/*` return `403 "This model is not available in your region"` —
// routing through OpenRouter does not launder the provider's geo-restriction,
// so every OpenAI/Google slug is unusable here no matter how well it scores
// on price. Measured on one identical request from that host:
// deepseek-v4-flash $0.000054, mistral-medium-3.1 $0.000184,
// moonshotai/kimi-k2.5 (the previous production default) $0.00295 — i.e. Kimi
// cost ~54x more for the same output, far worse than its sticker price
// suggests because it emits many more tokens per answer.
//
// It has no `file` in its OpenRouter `input_modalities`, which is fine: the
// default PDF engine is `cloudflare-ai` (OpenRouter parses the PDF to text
// before the model sees it). Switching the PDF engine to `native` requires
// swapping this for a file-capable model — from HK that means
// `mistralai/mistral-medium-3.1`, not the obvious Gemini/GPT picks.
export const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash'

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

// OpenRouter's file-parser engines for a PDF content block. `cloudflare-ai`
// (free; the old `pdf-text` id is deprecated and redirects here) has
// OpenRouter itself parse the PDF to markdown and inject it as text, so it
// works with *any* model. `native` forwards the raw PDF to the provider and
// therefore only works on models whose `input_modalities` include `file` —
// on anything else the model receives the filename with no content and
// politely reports an empty document instead of failing loudly.
// `mistral-ocr` is the paid OCR path, needed for scanned/image-only PDFs.
//
// `firecrawl` is the odd one out: it is NOT an OpenRouter file-parser engine.
// Firecrawl is a separate API that only accepts a URL, so that path uploads
// the PDF privately, hands Firecrawl a short-lived signed URL, and feeds the
// returned markdown to the model as a `text` block — no `plugins` field is
// sent at all (see routes/generate.js and lib/firecrawl.js). Keeping it in
// this same allowlist is deliberate: from the admin's point of view it is
// just another way to turn a PDF into something the model can read.
export const PDF_ENGINES = ['cloudflare-ai', 'mistral-ocr', 'native', 'firecrawl']
export const DEFAULT_PDF_ENGINE = 'cloudflare-ai'

// Engines handled by us before the LLM call rather than by OpenRouter's
// file-parser plugin.
export const PRE_EXTRACTED_PDF_ENGINES = ['firecrawl']

// Below this, a text document is treated as "nothing to work with".
const MIN_DOCUMENT_CHARS = 30

// The model is told the real filename (it often carries topic information),
// but only ever the basename with a guaranteed .pdf suffix — OpenRouter keys
// its parser off the extension.
function pdfFilename(filename) {
  const base = String(filename ?? '').split(/[\\/]/).pop().trim().slice(-120)
  if (!base) return 'document.pdf'
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
}

// PDF and plain text go to the model as OpenAI-compatible file/text content
// blocks (OpenRouter's chat completions API). DOCX must already be
// pre-extracted to plain text by lib/docParse.js — there is no native .docx
// content block.
export function buildDocumentBlock({ mimetype, buffer, extractedText, filename }) {
  // A PDF whose text was already extracted for us (the `firecrawl` engine)
  // takes the text path below — the model must not also receive the raw file,
  // and OpenRouter must not be asked to parse it a second time.
  if (mimetype === 'application/pdf' && extractedText == null) {
    return {
      type: 'file',
      file: {
        filename: pdfFilename(filename),
        file_data: `data:application/pdf;base64,${buffer.toString('base64')}`
      }
    }
  }
  const text = (extractedText ?? buffer.toString('utf8')).trim()
  // Fail here rather than asking the model to invent an exam from nothing —
  // an empty .docx/.txt otherwise comes back as a "please provide the
  // document" answer that only trips the downstream questions-array check.
  if (text.length < MIN_DOCUMENT_CHARS) {
    throw llmError('Không trích xuất được nội dung văn bản từ tài liệu — file có thể rỗng hoặc chỉ chứa ảnh', {
      source: 'validation', reason: 'empty_document', extracted_chars: text.length
    })
  }
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
- Không có hai câu hỏi trùng hoặc gần giống nhau.
- Nếu bạn KHÔNG đọc được nội dung tài liệu đính kèm (tệp rỗng, không trích xuất được chữ), hãy trả về "questions" là mảng rỗng và ghi lý do vào "description" — tuyệt đối không tạo câu hỏi giả, không tạo câu hỏi có nội dung là lời xin lỗi hay yêu cầu gửi lại tài liệu.`
}

export async function generateExam({ apiKey, model, documentBlock, questionCount, language, difficulty, pdfEngine = DEFAULT_PDF_ENGINE }) {
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
    // Only relevant when documentBlock is a PDF file block. Engine is
    // admin-configurable (see PDF_ENGINES) because the right choice depends
    // on the model and the document: `native` needs a file-capable model,
    // `mistral-ocr` is the only one that reads scanned pages, and the
    // `cloudflare-ai` default works everywhere for free.
    ...(documentBlock.type === 'file' ? { plugins: [{ id: 'file-parser', pdf: { engine: pdfEngine } }] } : {})
  }

  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://novaquiz.net',
      'X-Title': 'NovaQuiz - AI Exam Generator'
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
    // Keep what the model itself said. When a document doesn't reach the
    // model it answers *inside* the schema ("tệp document.pdf xuất hiện
    // trống…") with an empty questions array, so its own title/description
    // is the only explanation of the failure — without this the job history
    // showed a bare "LLM không sinh được câu hỏi nào" and the real reason
    // was only visible in OpenRouter's dashboard.
    const isPdf = documentBlock.type === 'file'
    const reason = err.detail?.reason ?? 'invalid_exam'
    const message = reason === 'empty_exam' && isPdf
      ? `Model không đọc được nội dung file PDF (engine "${pdfEngine}"). Nếu PDF là bản scan hãy đổi engine sang "mistral-ocr" hoặc "firecrawl"; nếu model không hỗ trợ đọc file thì dùng engine "cloudflare-ai" hoặc "firecrawl".`
      : err.message
    throw llmError(message, {
      source: 'validation',
      reason,
      model,
      llm_title: truncate(parsed.title),
      llm_description: truncate(parsed.description),
      finish_reason: choice.finish_reason,
      ...(isPdf ? { pdf_engine: pdfEngine } : {})
    })
  }
}

function truncate(value, max = 500) {
  if (typeof value !== 'string') return undefined
  return value.length > max ? `${value.slice(0, max)}…` : value
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
    throw llmError('LLM không sinh được câu hỏi nào', { reason: 'empty_exam' })
  }
  // A model that couldn't read the document sometimes answers with a single
  // optionless "please resend the file" pseudo-question instead of an empty
  // array — same failure, so report it as the same reason.
  if (exam.questions.every(q => !Array.isArray(q.options) || q.options.length === 0)) {
    throw llmError('LLM không sinh được câu hỏi nào (mọi câu đều không có đáp án)', { reason: 'empty_exam' })
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
