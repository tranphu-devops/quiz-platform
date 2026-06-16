import { GoTrueClient } from '@supabase/auth-js'
import { browser } from '$app/environment'

function getGoTrueUrl() {
  const env = import.meta.env.PUBLIC_GOTRUE_URL
  if (env) return env
  if (browser) return `${window.location.origin}/auth`
  return 'http://gotrue:9999'
}

export const auth = new GoTrueClient({
  url: getGoTrueUrl(),
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  storageKey: 'quiz_session'
})
