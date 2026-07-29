#!/usr/bin/env node
/**
 * Pre-renders landing/index.src.html into one static HTML file per language.
 *
 *   landing/index.src.html  →  landing/index.html  (en, served at /)
 *                              landing/vi.html     (served at /vi)
 *                              landing/ja.html     (served at /ja)
 *
 * Why pre-render instead of the previous runtime `applyLang()` swap: with a
 * single URL only one language could ever be indexed, and the markup language
 * (vi) disagreed with what a crawler actually rendered (en). Each output file
 * now ships its own <html lang>, title/description, canonical, hreflang set
 * and JSON-LD, so all three are independently indexable with no JS required.
 *
 * `landing/` is a read-only bind mount with no build step (docker-compose.yml),
 * so the generated files are committed — same arrangement as generate-badges.js.
 *
 * Run after editing index.src.html:  node scripts/build-landing-i18n.js
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'landing', 'index.src.html')

const ORIGIN = 'https://novaquiz.net'
const OG_IMAGE = `${ORIGIN}/brand-assets/banner-og.png`

// `/` is the x-default: unknown/undetected visitors land on English.
const LANGS = [
  { code: 'en', path: '/',    file: 'index.html', ogLocale: 'en_US' },
  { code: 'vi', path: '/vi',  file: 'vi.html',    ogLocale: 'vi_VN' },
  { code: 'ja', path: '/ja',  file: 'ja.html',    ogLocale: 'ja_JP' }
]

const src = readFileSync(SRC, 'utf8')

// ── Pull the I18N dictionary out of the source's inline <script> ────────
// Brace-match from `var I18N = {` so the surrounding applyLang()/initLang()
// code (which touches document/localStorage) is never evaluated here.
function extractDict(html) {
  const start = html.indexOf('var I18N = {')
  if (start === -1) throw new Error('index.src.html: `var I18N = {` not found')
  const open = html.indexOf('{', start)
  let depth = 0
  let inStr = null
  for (let i = open; i < html.length; i++) {
    const ch = html[i]
    if (inStr) {
      if (ch === '\\') i++
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'") inStr = ch
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return new Function(`return ${html.slice(open, i + 1)}`)()
      }
    }
  }
  throw new Error('index.src.html: unterminated I18N object literal')
}

const I18N = extractDict(src)

for (const { code } of LANGS) {
  if (!I18N[code]) throw new Error(`I18N dictionary has no "${code}" entry`)
}

const escapeHtml = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttr = s => escapeHtml(s).replace(/"/g, '&quot;')

// Keep a stray "</script>" inside any translated string from closing the
// JSON-LD block early.
const jsonLd = obj => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')

// ── Per-language <head> block ──────────────────────────────────────────
function seoHead(lang, dict) {
  const title = dict['meta.title']
  const desc = dict['meta.description']
  const url = ORIGIN + (lang.path === '/' ? '/' : lang.path)

  const faq = []
  for (let i = 1; dict[`faq.q${i}`]; i++) {
    faq.push({
      '@type': 'Question',
      name: dict[`faq.q${i}`],
      acceptedAnswer: { '@type': 'Answer', text: dict[`faq.a${i}`] }
    })
  }

  const graph = [
    {
      '@type': 'Organization',
      '@id': `${ORIGIN}/#organization`,
      name: 'NovaQuiz',
      url: `${ORIGIN}/`,
      logo: OG_IMAGE,
      description: desc
    },
    {
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      url: `${ORIGIN}/`,
      name: 'NovaQuiz',
      description: desc,
      inLanguage: lang.code,
      publisher: { '@id': `${ORIGIN}/#organization` }
    }
  ]
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: lang.code,
      mainEntity: faq
    })
  }

  const alternates = LANGS.map(
    l => `  <link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${l.path === '/' ? '/' : l.path}" />`
  ).join('\n')

  return `  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(desc)}" />
  <link rel="canonical" href="${url}" />
${alternates}
  <link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="NovaQuiz" />
  <meta property="og:locale" content="${lang.ogLocale}" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(desc)}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:url" content="${url}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(desc)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <script type="application/ld+json">
${jsonLd({ '@context': 'https://schema.org', '@graph': graph })}
  </script>`
}

// ── Language switcher: navigate instead of swapping text in place ──────
// The cookie tells nginx the visitor chose a language explicitly, so the
// geo-IP redirect on `/` stops overriding them (see infra/nginx/nginx.conf).
function langSelect(lang) {
  const options = LANGS.map(l => {
    const label = { en: 'English', vi: 'Tiếng Việt', ja: '日本語' }[l.code]
    const selected = l.code === lang.code ? ' selected' : ''
    return `      <option value="${l.code}"${selected}>${label}</option>`
  }).join('\n')

  return `<select class="lang-select" onchange="nqSetLang(this.value)" aria-label="Language">
${options}
    </select>`
}

// Both `code` and `path` are re-derived as string literals inside the branch
// rather than carried over from the <select> value. That is deliberate: a
// DOM-read string reaching `location.href` is a javascript:-URL sink
// (CodeQL js/xss-through-dom, high) and reaching `document.cookie` is cookie
// injection. Neither is reachable through our own <option> values, but an
// allowlist costs nothing, states the intent, and keeps the value provably
// untainted — a lookup table indexed by the raw input would not, since the
// tainted key taints the result.
const langBranches = LANGS.map(
  (l, i) =>
    `    ${i === 0 ? 'if' : 'else if'} (input === '${l.code}') { code = '${l.code}'; path = '${l.path}'; }`
).join('\n')

const LANG_SCRIPT = `<script>
  function nqSetLang(input) {
    var code, path;
${langBranches}
    else return;
    document.cookie = 'nqlang=' + code + ';path=/;max-age=31536000;samesite=lax';
    location.href = path;
  }
</script>`

// ── Render ─────────────────────────────────────────────────────────────
const SEO_MARKER = /^\s*<!-- SEO:HEAD[\s\S]*?-->\n/m
const I18N_SCRIPT = /<script>\n\s*var I18N = \{[\s\S]*?<\/script>/
const LANG_SELECT = /<select class="lang-select"[\s\S]*?<\/select>/
const I18N_EL = /<([a-zA-Z0-9]+)([^>]*\sdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g

if (!SEO_MARKER.test(src)) throw new Error('index.src.html: SEO:HEAD marker not found')
if (!I18N_SCRIPT.test(src)) throw new Error('index.src.html: I18N <script> block not found')
if (!LANG_SELECT.test(src)) throw new Error('index.src.html: .lang-select not found')

const totalKeys = (src.match(/\sdata-i18n="/g) || []).length

for (const lang of LANGS) {
  const dict = I18N[lang.code]
  const missing = []
  let applied = 0

  let out = src
    .replace(SEO_MARKER, seoHead(lang, dict) + '\n')
    .replace(I18N_SCRIPT, LANG_SCRIPT)
    .replace(LANG_SELECT, langSelect(lang))
    .replace(/^<html lang="[^"]*">/m, `<html lang="${lang.code}">`)
    .replace(I18N_EL, (match, tag, attrs, key, body) => {
      applied++
      const value = dict[key]
      if (value === undefined) {
        missing.push(key)
        return match
      }
      const isHtml = /\sdata-i18n-html="true"/.test(attrs)
      return `<${tag}${attrs}>${isHtml ? value : escapeHtml(value)}</${tag}>`
    })

  out = out.replace(
    /^<!DOCTYPE html>/m,
    '<!DOCTYPE html>\n<!-- Generated by scripts/build-landing-i18n.js from landing/index.src.html — do not edit. -->'
  )

  if (applied !== totalKeys) {
    throw new Error(
      `${lang.code}: matched ${applied} of ${totalKeys} data-i18n elements — ` +
      'an element is probably nested inside another with the same tag name'
    )
  }
  if (missing.length) {
    console.warn(`  ⚠ ${lang.code}: ${missing.length} untranslated key(s): ${missing.join(', ')}`)
  }

  writeFileSync(join(root, 'landing', lang.file), out)
  console.log(`  ✓ landing/${lang.file}  (${lang.code}, ${applied} strings, ${faqCount(dict)} FAQ entries)`)
}

function faqCount(dict) {
  let n = 0
  while (dict[`faq.q${n + 1}`]) n++
  return n
}

console.log(`\nDone. Remember to commit the generated files — landing/ is a read-only bind mount.`)
