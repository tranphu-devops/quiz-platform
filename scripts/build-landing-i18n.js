#!/usr/bin/env node
/**
 * Pre-renders every landing page into one static HTML file per language.
 *
 *   landing/index.src.html    →  index.html (/)        vi.html (/vi)          ja.html (/ja)
 *   landing/brand.src.html    →  brand.html (/brand)   brand.vi.html (/vi/brand)   brand.ja.html (/ja/brand)
 *   landing/contact.src.html  →  contact.html …        contact.vi.html …           contact.ja.html …
 *
 * Why pre-render instead of the previous runtime `applyLang()` swap: with a
 * single URL only one language could ever be indexed, and the markup language
 * (vi) disagreed with what a crawler actually rendered (en). Each output file
 * now ships its own <html lang>, title/description, canonical, hreflang set
 * and JSON-LD, so all three are independently indexable with no JS required.
 *
 * Header, footer, the shared <head> tail and the base/chrome CSS live once in
 * landing/partials/ and are injected at INCLUDE markers, so the pages cannot
 * drift apart again. Shared nav/footer strings live in partials/i18n.json and
 * are merged under each page's own dictionary.
 *
 * landing/sitemap.xml is generated here too — adding a page to PAGES is enough.
 *
 * `landing/` is a read-only bind mount with no build step (docker-compose.yml),
 * so the generated files are committed — same arrangement as generate-badges.js.
 *
 * Run after editing any *.src.html or partial:  node scripts/build-landing-i18n.js
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const landing = join(root, 'landing')

const ORIGIN = 'https://novaquiz.net'
const OG_IMAGE = `${ORIGIN}/brand-assets/banner-og.png`
const APP_LOGIN = 'https://app.novaquiz.net/login'

// `/` is the x-default: unknown/undetected visitors land on English.
const LANGS = [
  { code: 'en', ogLocale: 'en_US', label: 'English' },
  { code: 'vi', ogLocale: 'vi_VN', label: 'Tiếng Việt' },
  { code: 'ja', ogLocale: 'ja_JP', label: '日本語' }
]

// Every landing page. `slug` drives both the URL and the output filename, and
// is what a new page needs to be picked up by the sitemap and the hreflang set.
const PAGES = [
  { src: 'index.src.html',   slug: '',        changefreq: 'weekly',  priority: '1.0' },
  { src: 'brand.src.html',   slug: 'brand',   changefreq: 'monthly', priority: '0.5' },
  { src: 'contact.src.html', slug: 'contact', changefreq: 'monthly', priority: '0.5' }
]

// Where each language's landing page links into the public exam catalog. Only
// Vietnamese exams exist today, so all three point at /vi/exams; when an /en or
// /ja catalog ships, change the value here and re-run. A token rather than a
// literal href keeps that switch to one line instead of a hunt through the
// generated files.
const CATALOG_PATH = { en: '/vi/exams', vi: '/vi/exams', ja: '/vi/exams' }

// en lives at the root, the other languages under a /<lang> prefix.
const pagePath = (slug, code) =>
  code === 'en' ? (slug ? `/${slug}` : '/') : slug ? `/${code}/${slug}` : `/${code}`

const outFile = (slug, code) =>
  slug
    ? code === 'en'
      ? `${slug}.html`
      : `${slug}.${code}.html`
    : code === 'en'
      ? 'index.html'
      : `${code}.html`

// ── Partials ───────────────────────────────────────────────────────────
// The leading authoring comment in each partial is stripped: it documents the
// source, and repeating it across nine generated files is noise.
function readPartial(file, commentRe) {
  const body = readFileSync(join(landing, 'partials', file), 'utf8').replace(commentRe, '').trim()
  // An HTML comment ends at the first "-->", so writing that sequence inside
  // the authoring block truncates the strip and leaks prose into every page.
  if (file.endsWith('.html') && !body.startsWith('<')) {
    throw new Error(`partials/${file}: leading comment was not stripped cleanly — do not write "-->" inside it`)
  }
  return body
}

const HTML_COMMENT = /^<!--[\s\S]*?-->\s*/
const CSS_COMMENT = /^\/\*[\s\S]*?\*\/\s*/

const PARTIAL_FILES = ['head.html', 'chrome.css', 'header.html', 'footer.html', 'i18n.json']

const INCLUDES = [
  { marker: /^([ \t]*)<!-- INCLUDE:head -->[ \t]*$/m,        body: readPartial('head.html', HTML_COMMENT) },
  { marker: /^([ \t]*)\/\* INCLUDE:chrome-css \*\/[ \t]*$/m, body: readPartial('chrome.css', CSS_COMMENT) },
  { marker: /^([ \t]*)<!-- INCLUDE:header -->[ \t]*$/m,      body: readPartial('header.html', HTML_COMMENT) },
  { marker: /^([ \t]*)<!-- INCLUDE:footer -->[ \t]*$/m,      body: readPartial('footer.html', HTML_COMMENT) }
]

// Partials are authored unindented; re-indent them to wherever the marker sat
// so the generated file reads like it was written by hand.
const reindent = (body, indent) =>
  body.split('\n').map(line => (line ? indent + line : line)).join('\n')

const SHARED_I18N = JSON.parse(readFileSync(join(landing, 'partials', 'i18n.json'), 'utf8'))

// ── Pull a page's I18N dictionary out of its inline <script> ────────────
// Brace-match from `var I18N = {` so the surrounding page code (which touches
// document/localStorage) is never evaluated here.
function extractDict(html, name) {
  const start = html.indexOf('var I18N = {')
  if (start === -1) throw new Error(`${name}: \`var I18N = {\` not found`)
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
  throw new Error(`${name}: unterminated I18N object literal`)
}

const escapeHtml = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttr = s => escapeHtml(s).replace(/"/g, '&quot;')

// Keep a stray "</script>" inside any translated string from closing the
// surrounding <script> block early.
const jsLiteral = obj => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')

// ── Per-page, per-language <head> block ────────────────────────────────
function seoHead(page, lang, dict) {
  const title = dict['meta.title']
  const desc = dict['meta.description']
  if (!title || !desc) {
    throw new Error(`${page.src} (${lang.code}): dictionary is missing meta.title/meta.description`)
  }
  const url = ORIGIN + pagePath(page.slug, lang.code)

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
      logo: OG_IMAGE
    },
    {
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      url: `${ORIGIN}/`,
      name: 'NovaQuiz',
      inLanguage: lang.code,
      publisher: { '@id': `${ORIGIN}/#organization` }
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description: desc,
      inLanguage: lang.code,
      isPartOf: { '@id': `${ORIGIN}/#website` }
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
    l => `  <link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${pagePath(page.slug, l.code)}" />`
  ).join('\n')

  return `  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(desc)}" />
  <link rel="canonical" href="${url}" />
${alternates}
  <link rel="alternate" hreflang="x-default" href="${ORIGIN}${pagePath(page.slug, 'en')}" />
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
${jsLiteral({ '@context': 'https://schema.org', '@graph': graph })}
  </script>`
}

// ── Language switcher: navigate instead of swapping text in place ──────
// The cookie tells nginx the visitor chose a language explicitly, so the
// geo-IP redirect on `/` stops overriding them (see infra/nginx/nginx.conf).
// The switcher stays on the same page, one language over.
function langSelect(lang) {
  const options = LANGS.map(l => {
    const selected = l.code === lang.code ? ' selected' : ''
    return `      <option value="${l.code}"${selected}>${l.label}</option>`
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
function pageScript(page, dict) {
  const branches = LANGS.map(
    (l, i) =>
      `    ${i === 0 ? 'if' : 'else if'} (input === '${l.code}') { code = '${l.code}'; path = '${pagePath(page.slug, l.code)}'; }`
  ).join('\n')

  // Strings a page still needs after render (e.g. contact's form states) are
  // declared in the source with `<!-- RUNTIME-STRINGS: a, b -->`; only those
  // are emitted, so a fully static page ships no dictionary at all.
  const runtime = {}
  for (const key of page.runtimeStrings) {
    if (dict[key] === undefined) throw new Error(`${page.src}: RUNTIME-STRINGS key "${key}" is not in the dictionary`)
    runtime[key] = dict[key]
  }

  const runtimeBlock = page.runtimeStrings.length
    ? `  var NQ_T = ${jsLiteral(runtime).replace(/\n/g, '\n  ')};
  function t(key) { return Object.prototype.hasOwnProperty.call(NQ_T, key) ? NQ_T[key] : key; }

`
    : ''

  return `<script>
${runtimeBlock}  function nqSetLang(input) {
    var code, path;
${branches}
    else return;
    document.cookie = 'nqlang=' + code + ';path=/;max-age=31536000;samesite=lax';
    location.href = path;
  }
</script>`
}

// ── Render ─────────────────────────────────────────────────────────────
const SEO_MARKER = /^\s*<!-- SEO:HEAD[\s\S]*?-->\n/m
const I18N_SCRIPT = /<script>\n\s*var I18N = \{[\s\S]*?<\/script>/
const LANG_SELECT = /<select class="lang-select"[\s\S]*?<\/select>/
const I18N_EL = /<([a-zA-Z0-9]+)([^>]*\sdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g
const RUNTIME_STRINGS = /^\s*<!-- RUNTIME-STRINGS:([^>]*)-->/m
const LEFTOVER_TOKEN = /%[A-Z_]+%/

let built = 0

for (const page of PAGES) {
  const src = readFileSync(join(landing, page.src), 'utf8')

  if (!SEO_MARKER.test(src)) throw new Error(`${page.src}: SEO:HEAD marker not found`)
  if (!I18N_SCRIPT.test(src)) throw new Error(`${page.src}: I18N <script> block not found`)
  for (const { marker } of INCLUDES) {
    if (!marker.test(src)) throw new Error(`${page.src}: missing INCLUDE marker ${marker.source}`)
  }

  const runtimeMatch = src.match(RUNTIME_STRINGS)
  page.runtimeStrings = runtimeMatch
    ? runtimeMatch[1].split(',').map(s => s.trim()).filter(Boolean)
    : []

  const pageDict = extractDict(src, page.src)
  for (const { code } of LANGS) {
    if (!pageDict[code]) throw new Error(`${page.src}: dictionary has no "${code}" entry`)
  }

  // Partials first: the nav they bring in carries the .lang-select and the
  // %…% tokens that the per-language passes below rewrite.
  let withPartials = src
  for (const { marker, body } of INCLUDES) {
    withPartials = withPartials.replace(marker, (_, indent) => reindent(body, indent))
  }

  const totalKeys = (withPartials.match(/\sdata-i18n="/g) || []).length

  for (const lang of LANGS) {
    const dict = { ...SHARED_I18N[lang.code], ...pageDict[lang.code] }
    const missing = []
    let applied = 0

    let out = withPartials
      .replace(SEO_MARKER, seoHead(page, lang, dict) + '\n')
      .replace(RUNTIME_STRINGS, '')
      .replace(I18N_SCRIPT, pageScript(page, dict))
      .replace(LANG_SELECT, langSelect(lang))
      .replace(/%HOME_PATH%/g, pagePath('', lang.code))
      .replace(/%BRAND_PATH%/g, pagePath('brand', lang.code))
      .replace(/%CONTACT_PATH%/g, pagePath('contact', lang.code))
      .replace(/%CATALOG_PATH%/g, CATALOG_PATH[lang.code])
      .replace(/%APP_LOGIN%/g, APP_LOGIN)
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
      `<!DOCTYPE html>\n<!-- Generated by scripts/build-landing-i18n.js from landing/${page.src} — do not edit. -->`
    )

    if (applied !== totalKeys) {
      throw new Error(
        `${page.src} (${lang.code}): matched ${applied} of ${totalKeys} data-i18n elements — ` +
        'an element is probably nested inside another with the same tag name'
      )
    }
    const leftover = out.match(LEFTOVER_TOKEN)
    if (leftover) throw new Error(`${page.src} (${lang.code}): unreplaced token ${leftover[0]}`)
    if (missing.length) {
      console.warn(`  ⚠ ${lang.code}: ${missing.length} untranslated key(s): ${missing.join(', ')}`)
    }

    const file = outFile(page.slug, lang.code)
    writeFileSync(join(landing, file), out)
    built++
    console.log(`  ✓ landing/${file}  (${lang.code}, ${applied} strings${faqCount(dict) ? `, ${faqCount(dict)} FAQ entries` : ''})`)
  }
}

function faqCount(dict) {
  let n = 0
  while (dict[`faq.q${n + 1}`]) n++
  return n
}

// ── sitemap.xml ────────────────────────────────────────────────────────
// Dates come from git so a rebuild that changes nothing does not churn every
// <lastmod>; a source (or shared partial) with uncommitted edits is "today".
function lastmod(files) {
  const dates = files.map(rel => {
    try {
      const dirty = execFileSync('git', ['status', '--porcelain', '--', rel], { cwd: root }).toString().trim()
      if (!dirty) {
        const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', rel], { cwd: root }).toString().trim()
        if (d) return d
      }
    } catch { /* no git, or file never committed */ }
    return new Date().toISOString().slice(0, 10)
  })
  return dates.sort().pop()
}

const partialPaths = PARTIAL_FILES.map(f => `landing/partials/${f}`)

const urls = PAGES.flatMap(page => {
  const modified = lastmod([`landing/${page.src}`, ...partialPaths])
  return LANGS.map(lang => {
    const alternates = [
      ...LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${pagePath(page.slug, l.code)}" />`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${pagePath(page.slug, 'en')}" />`
    ].join('\n')
    return `  <url>
    <loc>${ORIGIN}${pagePath(page.slug, lang.code)}</loc>
${alternates}
    <lastmod>${modified}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  })
}).join('\n\n')

writeFileSync(
  join(landing, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Generated by scripts/build-landing-i18n.js — do not edit.

  Landing pages only (novaquiz.net). The app (app.novaquiz.net) is a
  login-gated client-rendered SPA and is excluded via its own robots.txt.
  Every page ships in three languages that declare each other with
  xhtml:link alternates, matching the hreflang tags in each HTML file.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

${urls}

</urlset>
`
)
console.log(`  ✓ landing/sitemap.xml  (${PAGES.length * LANGS.length} URLs)`)

console.log(`\nDone — ${built} pages. Remember to commit the generated files: landing/ is a read-only bind mount.`)
