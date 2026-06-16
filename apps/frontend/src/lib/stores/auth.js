import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'
import { auth } from '$lib/auth'

export const session = writable(null)

if (browser) {
  auth.getSession().then(({ data: { session: s } }) => {
    session.set(s)
  })

  auth.onAuthStateChange((_event, s) => {
    session.set(s)
  })
}

export const user = derived(session, ($session) => {
  if (!$session?.user) return null
  return {
    id: $session.user.id,
    email: $session.user.email,
    role: $session.user.user_metadata?.role ?? 'student'
  }
})

export const token = derived(session, ($session) => $session?.access_token ?? null)

export async function clearAuth() {
  await auth.signOut()
  session.set(null)
}
