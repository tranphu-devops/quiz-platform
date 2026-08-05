// Language prefix for the public, indexable pages (/{lang}/exams/...).
//
// Only languages that actually have published content belong here. A prefix
// that matches but has nothing behind it produces empty listings, which is
// exactly the thin content these pages exist to avoid — so /ja stays 404 until
// exams are published in it. Adding one means: PUBLIC_LANGS in $lib/seo.js
// (which this reads, and which also drives the switcher and the hreflang set),
// a dictionary in $lib/i18n/public.js, and CATALOG_PATH in
// scripts/build-landing-i18n.js so the landing pages link at it.
import { PUBLIC_LANGS } from '$lib/seo'

/** @param {string} param */
export function match(param) {
  return PUBLIC_LANGS.includes(param)
}
