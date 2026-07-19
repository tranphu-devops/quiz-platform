import mammoth from 'mammoth'

// Claude's document content block natively understands PDF and plain text
// only — .docx is not a supported document media type, so we extract its
// text client-side before sending it to the LLM as a text block.
export async function extractDocxText(buffer) {
  const { value } = await mammoth.extractRawText({ buffer })
  return value.trim()
}
