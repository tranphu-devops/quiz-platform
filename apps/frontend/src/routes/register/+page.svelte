<script>
  import { auth } from '$lib/auth'
  import { goto } from '$app/navigation'

  let email = $state('')
  let password = $state('')
  let role = $state('student')
  let error = $state('')
  let loading = $state(false)

  async function submit(e) {
    e.preventDefault()
    error = ''
    loading = true
    try {
      const { error: err } = await auth.signUp({
        email,
        password,
        options: { data: { role } }
      })
      if (err) { error = err.message; return }
      goto('/dashboard')
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }
  }
</script>

<style>
  form { background: white; padding: 2rem; border-radius: 8px; max-width: 420px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  h1 { margin-bottom: 1.5rem; font-size: 1.5rem; }
  label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
  input, select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; margin-bottom: 1rem; }
  button { width: 100%; padding: 0.6rem; background: #1e40af; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
  button:disabled { opacity: 0.6; }
  .error { color: #dc2626; margin-bottom: 1rem; font-size: 0.9rem; }
  .link { text-align: center; margin-top: 1rem; font-size: 0.9rem; }
  .link a { color: #1e40af; }
</style>

<form onsubmit={submit}>
  <h1>Đăng ký</h1>
  {#if error}<p class="error">{error}</p>{/if}
  <label>Email</label>
  <input type="email" bind:value={email} required autocomplete="email" />
  <label>Mật khẩu</label>
  <input type="password" bind:value={password} required minlength="6" autocomplete="new-password" />
  <label>Vai trò</label>
  <select bind:value={role}>
    <option value="student">Học sinh</option>
    <option value="teacher">Giáo viên</option>
  </select>
  <button disabled={loading}>{loading ? 'Đang đăng ký...' : 'Đăng ký'}</button>
  <p class="link"><a href="/login">Đã có tài khoản? Đăng nhập</a></p>
</form>
