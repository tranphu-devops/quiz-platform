// Server-side sanitizer for the rich-text exam `description`.
//
// Until now nothing on the backend sanitized this field — only the browser did
// (apps/frontend/src/lib/sanitizeHtml.js, which needs a DOM), so anything
// written through the Teacher API landed in the database as-is. That was
// tolerable while every reader was a logged-in SPA doing its own client-side
// pass; it stops being tolerable the moment the public SSR pages render the
// stored HTML directly, because the browser sanitizer returns '' on the server
// (no `document`) and so cannot be part of that path.
//
// The allowlist below mirrors the frontend ALLOWED/REMOVE_WITH_CONTENT maps
// exactly, so a description renders identically in the app and on the public
// page. Keep the two in sync.

import sanitizeHtmlLib from 'sanitize-html'

const OPTIONS = {
  allowedTags: [
    'p', 'br', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'ul', 'ol', 'li',
    'h3', 'h4', 'blockquote',
    'a'
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  // 'discard' drops the tag but keeps its text — the frontend's unwrap().
  disallowedTagsMode: 'discard',
  // These are removed with their content — the frontend's REMOVE_WITH_CONTENT.
  // Getting this list wrong silently deletes description text.
  nonTextTags: [
    'script', 'style', 'iframe', 'object', 'embed',
    'link', 'meta', 'noscript', 'svg', 'textarea', 'option'
  ],
  transformTags: {
    a: sanitizeHtmlLib.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow'
    })
  }
}

/** Sanitize rich-text HTML down to the allowlist. Returns '' for empty input. */
export function sanitizeDescription(html) {
  if (!html || typeof html !== 'string') return ''
  return sanitizeHtmlLib(html, OPTIONS)
}

/**
 * Plain text from description HTML — used for list excerpts and <meta
 * name="description">. Mirrors htmlToText()'s server-side fallback in
 * apps/frontend/src/lib/sanitizeHtml.js so both sides agree on the output.
 */
export function descriptionToText(html) {
  if (!html || typeof html !== 'string') return ''
  // Strip repeatedly: a single pass leaves text like `<<p>>` half-tagged.
  let prev = html
  let out = html.replace(/<[^>]*>/g, ' ')
  while (out !== prev) {
    prev = out
    out = out.replace(/<[^>]*>/g, ' ')
  }
  return out
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Plain-text excerpt, cut on a word boundary. */
export function excerpt(html, maxLen = 200) {
  const text = descriptionToText(html)
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
