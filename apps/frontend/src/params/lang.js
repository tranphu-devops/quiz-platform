// Language prefix for the public, indexable pages (/{lang}/exams/...).
//
// Only languages that actually have published content belong here. A prefix
// that matches but has nothing behind it produces empty listings, which is
// exactly the thin content these pages exist to avoid — so /en and /ja stay
// 404 until exams are published in them. Adding one is a one-word change here
// plus a hreflang set (see buildHreflang in $lib/seo.js).
const ENABLED = ['vi']

/** @param {string} param */
export function match(param) {
  return ENABLED.includes(param)
}
