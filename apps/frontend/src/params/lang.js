// Language prefix for the public, indexable pages (/{lang}/exams/...).
//
// Every language the switcher offers matches here, even one with zero
// published exams yet — the catalog page has its own empty state, so there is
// no 404 to design around. Adding a new prefix means: PUBLIC_LANGS in
// $lib/seo.js (which this reads, and which also drives the switcher and the
// hreflang set), a dictionary in $lib/i18n/public.js, and CATALOG_PATH in
// scripts/build-landing-i18n.js so the landing pages link at it.
import { PUBLIC_LANGS } from '$lib/seo'

/** @param {string} param */
export function match(param) {
  return PUBLIC_LANGS.includes(param)
}
