import { sentrySvelteKit } from '@sentry/sveltekit'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // Must come before sveltekit(). Uploads source maps to Sentry when a
    // SENTRY_AUTH_TOKEN is present at build time; silently skips otherwise.
    sentrySvelteKit({
      org: 'phutx-ltd',
      project: 'phutxtop'
    }),
    sveltekit()
  ]
})
