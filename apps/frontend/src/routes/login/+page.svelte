<script>
  import { auth } from '$lib/auth'
  import { browser } from '$app/environment'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  onMount(() => {
    if ($user) goto('/dashboard')
  })

  async function loginWithGoogle() {
    if (!browser) return
    await auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth-callback` }
    })
  }
</script>

<style>
  .login-wrap {
    min-height: calc(100vh - 60px);
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: -2rem -1.5rem;
  }

  /* Left panel */
  .panel-left {
    background: linear-gradient(145deg, #4f46e5 0%, #6366f1 40%, #8b5cf6 100%);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 3rem; position: relative; overflow: hidden;
  }
  .panel-left::before {
    content: '';
    position: absolute; width: 320px; height: 320px;
    background: rgba(255,255,255,0.08); border-radius: 50%;
    top: -80px; right: -80px;
  }
  .panel-left::after {
    content: '';
    position: absolute; width: 200px; height: 200px;
    background: rgba(255,255,255,0.06); border-radius: 50%;
    bottom: -50px; left: -50px;
  }
  .panel-left .inner { position: relative; z-index: 1; text-align: center; color: white; }
  .panel-left .hero-logo {
    font-size: 2.5rem; font-weight: 800; letter-spacing: -0.04em;
    margin-bottom: 1rem;
  }
  .panel-left .hero-sub {
    font-size: 1.05rem; opacity: 0.85; line-height: 1.6; max-width: 300px;
  }
  .deco-dots {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
    margin-top: 2.5rem;
  }
  .deco-dots span {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(255,255,255,0.3);
  }
  .deco-dots span:nth-child(odd) { background: rgba(255,255,255,0.6); }

  /* Right panel */
  .panel-right {
    display: flex; align-items: center; justify-content: center;
    padding: 3rem;
    background: var(--bg);
  }
  .card {
    width: 100%; max-width: 380px;
    background: white; border-radius: 20px;
    padding: 2.5rem 2rem;
    box-shadow: 0 8px 40px rgba(99,102,241,0.12);
    border: 1px solid var(--border);
  }
  .card-logo {
    font-size: 1.05rem; font-weight: 800;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
  }
  .card h1 { font-size: 1.6rem; font-weight: 800; color: var(--text); margin-bottom: 0.3rem; }
  .card .sub { font-size: 0.9rem; color: var(--muted); line-height: 1.5; margin-bottom: 2rem; }

  .divider {
    display: flex; align-items: center; gap: 0.75rem;
    margin-bottom: 1.5rem; color: var(--muted); font-size: 0.82rem;
  }
  .divider::before, .divider::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }

  .btn-google {
    width: 100%; padding: 0.9rem 1.25rem;
    border: 1.5px solid var(--border); border-radius: var(--radius-btn);
    background: white; cursor: pointer; font-size: 0.95rem; font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 0.75rem;
    color: var(--text); transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .btn-google:hover {
    border-color: var(--primary);
    box-shadow: 0 4px 16px rgba(99,102,241,0.16);
    transform: translateY(-1px);
  }
  .btn-google:active { transform: none; }

  .card-note {
    margin-top: 1.5rem; text-align: center;
    font-size: 0.78rem; color: var(--muted); line-height: 1.5;
  }

  /* Mobile */
  @media (max-width: 768px) {
    .login-wrap { grid-template-columns: 1fr; margin: -1.25rem -1rem; }
    .panel-left { display: none; }
    .panel-right {
      min-height: calc(100vh - 60px);
      background: linear-gradient(145deg, #4f46e5 0%, #6366f1 40%, #8b5cf6 100%);
      padding: 2rem 1rem;
    }
    .card { box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
  }
</style>

<div class="login-wrap">
  <div class="panel-left">
    <div class="inner">
      <div class="hero-logo">QuizPlatform</div>
      <p class="hero-sub">Nền tảng ôn tập chứng chỉ thông minh.<br>Học, luyện tập và theo dõi tiến độ.</p>
      <div class="deco-dots">
        {#each Array(12) as _}
          <span></span>
        {/each}
      </div>
    </div>
  </div>

  <div class="panel-right">
    <div class="card">
      <div class="card-logo">QuizPlatform</div>
      <h1>Chào mừng!</h1>
      <p class="sub">Đăng nhập để tiếp tục học tập và ôn luyện.</p>
      <div class="divider">Đăng nhập bằng</div>
      <button class="btn-google" onclick={loginWithGoogle}>
        <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        Tiếp tục với Google
      </button>
      <p class="card-note">Bằng cách đăng nhập, bạn đồng ý với<br>điều khoản sử dụng của chúng tôi.</p>
    </div>
  </div>
</div>
