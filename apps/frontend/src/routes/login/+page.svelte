<script>
  import { auth } from '$lib/auth'
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'

  let email = $state('')
  let password = $state('')
  let error = $state('')
  let loading = $state(false)

  async function submit(e) {
    e.preventDefault()
    error = ''
    loading = true
    try {
      const { error: err } = await auth.signInWithPassword({ email, password })
      if (err) { error = err.message; return }
      goto('/dashboard')
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }
  }

  async function loginWithGoogle() {
    if (!browser) return
    await auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth-callback` }
    })
  }
</script>

<style>
  form { background: white; padding: 2rem; border-radius: 8px; max-width: 420px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  h1 { margin-bottom: 1.5rem; font-size: 1.5rem; }
  label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
  input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; margin-bottom: 1rem; }
  button { width: 100%; padding: 0.6rem; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
  button:disabled { opacity: 0.6; }
  .btn-primary { background: #1e40af; color: white; margin-bottom: 0.75rem; }
  .btn-google { background: white; border: 1px solid #d1d5db; color: #374151; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
  .btn-google:hover { background: #f9fafb; }
  .divider { text-align: center; color: #9ca3af; font-size: 0.85rem; margin: 0.75rem 0; }
  .error { color: #dc2626; margin-bottom: 1rem; font-size: 0.9rem; }
  .link { text-align: center; margin-top: 1rem; font-size: 0.9rem; }
  .link a { color: #1e40af; }
</style>

<form onsubmit={submit}>
  <h1>Đăng nhập</h1>
  {#if error}<p class="error">{error}</p>{/if}
  <label>Email</label>
  <input type="email" bind:value={email} required autocomplete="email" />
  <label>Mật khẩu</label>
  <input type="password" bind:value={password} required autocomplete="current-password" />
  <button class="btn-primary" disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
  <div class="divider">hoặc</div>
  <button type="button" class="btn-google" onclick={loginWithGoogle}>
    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
    Đăng nhập với Google
  </button>
  <p class="link"><a href="/register">Chưa có tài khoản? Đăng ký</a></p>
</form>
