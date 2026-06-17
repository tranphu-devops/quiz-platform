<script>
  import { auth } from '$lib/auth'
  import { browser } from '$app/environment'

  async function loginWithGoogle() {
    if (!browser) return
    await auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth-callback` }
    })
  }
</script>

<style>
  .wrap { display: flex; align-items: center; justify-content: center; min-height: 60vh; }
  .box { background: white; border-radius: 12px; padding: 3rem 2.5rem; max-width: 380px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,.1); text-align: center; }
  .logo { font-size: 1.8rem; font-weight: 800; color: #1e40af; margin-bottom: 0.5rem; }
  h1 { font-size: 1.4rem; margin-bottom: 0.4rem; }
  .subtitle { color: #6b7280; font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5; }
  .btn-google {
    width: 100%; padding: 0.8rem 1rem; border: 1.5px solid #d1d5db; border-radius: 8px;
    background: white; cursor: pointer; font-size: 1rem; font-weight: 500;
    display: flex; align-items: center; justify-content: center; gap: 0.75rem;
    transition: background 0.15s, box-shadow 0.15s; color: #374151;
  }
  .btn-google:hover { background: #f9fafb; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
</style>

<div class="wrap">
  <div class="box">
    <div class="logo">QuizPlatform</div>
    <h1>Đăng nhập</h1>
    <p class="subtitle">Sử dụng tài khoản Google<br>để tiếp tục</p>
    <button class="btn-google" onclick={loginWithGoogle}>
      <svg width="20" height="20" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      Đăng nhập với Google
    </button>
  </div>
</div>
