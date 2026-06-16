<script>
  import { auth } from '$lib/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let error = $state('')

  onMount(async () => {
    // GoTrueClient (detectSessionInUrl:true) auto-detects #access_token= from implicit OAuth flow
    const { data: { session } } = await auth.getSession()
    if (session) { goto('/dashboard'); return }

    // Wait for auth state change if session not ready yet
    const { data: { subscription } } = auth.onAuthStateChange((_event, s) => {
      if (s) { subscription.unsubscribe(); goto('/dashboard') }
    })

    setTimeout(() => { error = 'Xác thực thất bại. Vui lòng thử lại.' }, 10000)
  })
</script>

{#if error}
  <p style="color: #dc2626; text-align: center; margin-top: 4rem">
    Lỗi xác thực: {error}<br />
    <a href="/login" style="color: #1e40af">Quay lại đăng nhập</a>
  </p>
{:else}
  <p style="text-align: center; margin-top: 4rem; color: #6b7280">Đang xử lý đăng nhập...</p>
{/if}
