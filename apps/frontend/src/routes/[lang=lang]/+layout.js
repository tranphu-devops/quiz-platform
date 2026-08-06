// Overrides `export const ssr = false` in src/routes/+layout.js for this
// subtree only — these pages exist to be readable without running JavaScript.
export const ssr = true

// No SvelteKit/hydration bundle is shipped at all — that removes the whole
// class of SSR/CSR mismatch bugs, along with the post-hydration language flip
// that $lib/i18n would cause. The language <select> in PublicChrome.svelte is
// still interactive: its onchange handler is a hand-written inline <script>
// injected via {@html} (see NQ_SET_LANG_SCRIPT in
// scripts/build-landing-i18n.js), plain HTML text at render time rather than
// Svelte-managed markup, so it works with zero framework JS on the page.
export const csr = false

export const prerender = false
