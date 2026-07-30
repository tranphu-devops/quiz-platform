// Overrides `export const ssr = false` in src/routes/+layout.js for this
// subtree only — these pages exist to be readable without running JavaScript.
export const ssr = true

// No JS is shipped at all. Nothing here is interactive (the CTA is a plain
// link), and turning hydration off removes the whole class of SSR/CSR mismatch
// bugs along with the post-hydration language flip that $lib/i18n would cause.
export const csr = false

export const prerender = false
