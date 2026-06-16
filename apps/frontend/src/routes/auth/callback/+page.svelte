<script>
  import { auth } from '$lib/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let error = $state('')

  onMount(async () => {
    const { error: err } = await auth.exchangeCodeForSession(window.location.href)
    if (err) {
      error = err.message
      return
    }
    goto('/dashboard')
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
