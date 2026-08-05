// Firecrawl as a PDF text-extraction step. Unlike the other three PDF engines
// (`cloudflare-ai`, `mistral-ocr`, `native`), which are values of OpenRouter's
// own `file-parser` plugin and never touch our code, Firecrawl is a separate
// API we call ourselves: it converts the PDF to markdown, and we then send the
// result to the model as a plain `text` block — structurally the same path
// DOCX already takes through lib/docParse.js.
//
// The practical consequence: with this engine the model never receives the PDF
// itself, so it works with any model (like `cloudflare-ai`) but preserves
// table/heading structure markedly better, which is what makes it worth the
// extra hop for exam material.
const FIRECRAWL_BASE_URL = process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev'

// `auto` = fast text extraction with an OCR fallback, so a scanned PDF still
// comes back with content instead of an empty string. Costs more on scanned
// input than `fast`, but silently returning nothing is the failure mode this
// whole engine exists to avoid.
const PDF_PARSER_MODE = 'auto'

const REQUEST_TIMEOUT_MS = 120_000

function firecrawlError(message, detail) {
  return Object.assign(new Error(message), { detail: { source: 'firecrawl', ...detail } })
}

export function isFirecrawlConfigured() {
  return Boolean(process.env.FIRECRAWL_API_KEY)
}

// Returns the PDF's text content as markdown. Throws with `.detail.source =
// 'firecrawl'` so generation_jobs.error_detail keeps pointing at the real
// culprit (see the error_detail contract in this service's CLAUDE.md).
export async function scrapePdfToMarkdown({ url, maxPages }) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) throw firecrawlError('Chưa cấu hình FIRECRAWL_API_KEY', { reason: 'not_configured' })

  const body = {
    url,
    formats: ['markdown'],
    parsers: [{ type: 'pdf', mode: PDF_PARSER_MODE, ...(maxPages ? { maxPages } : {}) }],
    // The source document is a teacher's private upload behind a signed URL
    // that expires in minutes. Opting out of Firecrawl's cache (on by default,
    // 2-day maxAge) keeps the extracted text from being retained or served to
    // a later request for the same URL.
    storeInCache: false,
    maxAge: 0
  }

  let res
  try {
    res = await fetch(`${FIRECRAWL_BASE_URL}/v2/scrape`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (err) {
    throw firecrawlError(`Không gọi được Firecrawl: ${err.message}`, { reason: 'network_error' })
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw firecrawlError(
      data?.error ?? `Firecrawl trả về lỗi (${res.status})`,
      { reason: 'http_error', http_status: res.status, message: data?.error }
    )
  }

  const markdown = (data?.data?.markdown ?? '').trim()
  if (!markdown) {
    // Firecrawl answered 200 with no text — an image-only PDF it could not
    // OCR, or a fetch it silently gave up on. Fail here rather than handing
    // the model an empty document, which comes back as a valid-JSON empty
    // exam and is far harder to diagnose (same reasoning as buildDocumentBlock).
    throw firecrawlError(
      'Firecrawl không trích xuất được nội dung từ PDF — file có thể là bản scan không đọc được',
      { reason: 'empty_extraction' }
    )
  }

  return markdown
}
