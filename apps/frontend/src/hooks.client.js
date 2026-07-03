import { handleErrorWithSentry } from '@sentry/sveltekit'
import * as Sentry from '@sentry/sveltekit'

Sentry.init({
  dsn: 'https://e7ebd0288ccdf0549338a567dd6272e7@o4511670908878848.ingest.us.sentry.io/4511670913859584',
  // Only report from production builds (skip local `vite dev`)
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1
})

export const handleError = handleErrorWithSentry()
