// Lightweight client-side HTML sanitizer for rich-text descriptions.
// Allowlist of tags → permitted attributes. Everything else is unwrapped
// (text kept) or, for dangerous elements, removed entirely. Used both when
// saving (RichTextEditor on blur) and when rendering ({@html}) as defense in depth.

const ALLOWED = {
  P: [], BR: [], DIV: [], SPAN: [],
  STRONG: [], B: [], EM: [], I: [], U: [], S: [], STRIKE: [],
  UL: [], OL: [], LI: [],
  H3: [], H4: [], BLOCKQUOTE: [],
  A: ['href']
}
const REMOVE_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'NOSCRIPT', 'SVG'])

function unwrap(node) {
  const parent = node.parentNode
  if (!parent) return
  while (node.firstChild) parent.insertBefore(node.firstChild, node)
  parent.removeChild(node)
}

function clean(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue }

    const tag = child.tagName.toUpperCase()
    if (REMOVE_WITH_CONTENT.has(tag)) { child.remove(); continue }

    const allowedAttrs = ALLOWED[tag]
    if (!allowedAttrs) { clean(child); unwrap(child); continue }

    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase()
      if (!allowedAttrs.includes(name)) { child.removeAttribute(attr.name); continue }
      if (name === 'href' && /^\s*(javascript|data):/i.test(attr.value)) child.removeAttribute(attr.name)
    }
    if (tag === 'A' && child.hasAttribute('href')) {
      child.setAttribute('target', '_blank')
      child.setAttribute('rel', 'noopener noreferrer nofollow')
    }
    clean(child)
  }
}

// Repeatedly strips tags until a fixed point — a single pass can leave new
// tags behind when a match like "<<script>script>" collapses into "<script>".
function stripTagsToFixedPoint(str, replacement = '') {
  let prev, out = String(str)
  do {
    prev = out
    out = out.replace(/<[^>]*>/g, replacement)
  } while (out !== prev)
  return out
}

export function sanitizeHtml(html) {
  if (!html || typeof document === 'undefined') return ''
  const wrapper = document.createElement('div')
  wrapper.innerHTML = String(html)
  clean(wrapper)
  return wrapper.innerHTML.trim()
}

// Plain-text excerpt of rich HTML — for card previews / line-clamped summaries.
export function htmlToText(html) {
  if (!html) return ''
  if (typeof document === 'undefined') return stripTagsToFixedPoint(html, ' ').replace(/\s+/g, ' ').trim()
  const wrapper = document.createElement('div')
  wrapper.innerHTML = String(html)
  return (wrapper.textContent || '').replace(/\s+/g, ' ').trim()
}

// True when the HTML has no visible content (empty tags / whitespace only).
export function isHtmlEmpty(html) {
  if (!html) return true
  if (typeof document === 'undefined') return !stripTagsToFixedPoint(html).trim()
  const wrapper = document.createElement('div')
  wrapper.innerHTML = String(html)
  return !wrapper.textContent.trim() && !wrapper.querySelector('img, br')
}
