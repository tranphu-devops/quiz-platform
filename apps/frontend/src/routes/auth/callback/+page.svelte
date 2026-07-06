<script>
  import { auth } from '$lib/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { t } from '$lib/i18n'

  let error = $state('')

  onMount(async () => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')

    if (code) {
      // PKCE flow: exchange code for session
      const { error: err } = await auth.exchangeCodeForSession(window.location.href)
      if (err) { error = err.message; return }
    }
    // Implicit flow: GoTrueClient (detectSessionInUrl:true) already set session from hash

    const { data: { session } } = await auth.getSession()
    if (session) { goto('/dashboard'); return }

    // Wait for auth state change if session not ready yet
    const { data: { subscription } } = auth.onAuthStateChange((_event, s) => {
      if (s) { subscription.unsubscribe(); goto('/dashboard') }
    })

    setTimeout(() => { error = $t('authCallback.authFailed') }, 10000)
  })
</script>

{#if error}
  <p style="color: #dc2626; text-align: center; margin-top: 4rem">
    {$t('authCallback.authError', { error })}<br />
    <a href="/login" style="color: #1e40af">{$t('authCallback.backToLogin')}</a>
  </p>
{:else}
  <p style="text-align: center; margin-top: 4rem; color: #6b7280">{$t('authCallback.processing')}</p>
{/if}
