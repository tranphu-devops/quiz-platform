<script>
  import { auth } from '$lib/auth'
  import { browser } from '$app/environment'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { t } from '$lib/i18n'
  import { safeNext, rememberNext } from '$lib/nextUrl'

  let email = $state('')
  let sending = $state(false)
  let sent = $state(false)
  let magicError = $state('')
  let cooldown = $state(0)

  // ?next= is set by app pages that bounce an anonymous visitor here, so a
  // journey that starts on a public exam page ends on that exam rather than on
  // the dashboard.
  const next = $derived(safeNext($page.url.searchParams.get('next')))

  onMount(() => {
    if ($user) goto(next ?? '/dashboard')
    else rememberNext(next)
  })

  async function loginWithGoogle() {
    if (!browser) return
    rememberNext(next)
    await auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth-callback` }
    })
  }

  function startCooldown() {
    cooldown = 60
    const iv = setInterval(() => {
      cooldown -= 1
      if (cooldown <= 0) clearInterval(iv)
    }, 1000)
  }

  async function sendMagicLink() {
    if (!browser || sending || cooldown > 0) return
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      magicError = $t('login.invalidEmail')
      return
    }

    sending = true
    magicError = ''
    rememberNext(next)
    const { error } = await auth.signInWithOtp({
      email: trimmed,
      // /auth-callback, not /auth/callback — nginx proxies all of /auth/* to
      // GoTrue, so the hyphenated route is the only callback the SPA can serve
      // (same reason the Google button above uses it).
      options: { emailRedirectTo: `${window.location.origin}/auth-callback` }
    })
    sending = false

    if (error) {
      magicError = error.status === 429
        ? $t('login.magicLinkRateLimited')
        : (error.message || $t('login.magicLinkGenericError'))
      return
    }

    sent = true
    startCooldown()
  }

  function resend() {
    sent = false
    sendMagicLink()
  }
</script>

<style>
  .login-wrap {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
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
    background: var(--surface); border-radius: 20px;
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
    background: var(--surface); cursor: pointer; font-size: 0.95rem; font-weight: 600;
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

  .magic-form {
    display: flex; flex-direction: column; gap: 0.6rem; margin-top: 1.25rem;
  }
  .magic-input {
    width: 100%; padding: 0.75rem 1rem;
    border: 1.5px solid var(--border); border-radius: var(--radius-btn);
    background: var(--surface); color: var(--text); font-size: 0.92rem;
    box-sizing: border-box;
  }
  .magic-input:focus {
    outline: none; border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
  .btn-magic {
    width: 100%; padding: 0.85rem 1.25rem;
    border: none; border-radius: var(--radius-btn);
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: #fff; cursor: pointer; font-size: 0.92rem; font-weight: 600;
    transition: opacity 0.2s;
  }
  .btn-magic:disabled { opacity: 0.6; cursor: not-allowed; }
  .magic-error {
    font-size: 0.8rem; color: #dc2626;
  }
  .magic-sent {
    text-align: center; padding: 0.5rem 0;
  }
  .magic-sent p {
    font-size: 0.85rem; color: var(--text); line-height: 1.5; margin: 0 0 0.4rem;
  }
  .magic-sent .headline {
    font-weight: 700; margin-bottom: 0.3rem;
  }
  .btn-resend {
    background: none; border: none; color: var(--primary); cursor: pointer;
    font-size: 0.82rem; font-weight: 600; padding: 0;
  }
  .btn-resend:disabled { color: var(--muted); cursor: not-allowed; }

  /* Mobile */
  @media (max-width: 768px) {
    .login-wrap { grid-template-columns: 1fr; }
    .panel-left { display: none; }
    .panel-right {
      min-height: 100vh;
      background: linear-gradient(145deg, #4f46e5 0%, #6366f1 40%, #8b5cf6 100%);
      padding: 2rem 1rem;
    }
    .card { box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
  }
</style>

<div class="login-wrap">
  <div class="panel-left">
    <div class="inner">
      <div class="hero-logo">NovaQuiz</div>
      <p class="hero-sub">{@html $t('login.heroSub')}</p>
      <div class="deco-dots">
        {#each Array(12) as _}
          <span></span>
        {/each}
      </div>
    </div>
  </div>

  <div class="panel-right">
    <div class="card">
      <div class="card-logo">NovaQuiz</div>
      <h1>{$t('login.welcome')}</h1>
      <p class="sub">{$t('login.subtitle')}</p>
      <div class="divider">{$t('login.signInWith')}</div>
      <button class="btn-google" onclick={loginWithGoogle}>
        <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        {$t('login.continueWithGoogle')}
      </button>

      <div class="divider">{$t('login.orDivider')}</div>

      {#if sent}
        <div class="magic-sent">
          <p class="headline">{$t('login.magicLinkSent')}</p>
          <p>{$t('login.magicLinkSentDetail', { email })}</p>
          <button class="btn-resend" onclick={resend} disabled={cooldown > 0}>
            {cooldown > 0 ? $t('login.resendCooldown', { seconds: cooldown }) : $t('login.resend')}
          </button>
        </div>
      {:else}
        <form class="magic-form" onsubmit={(e) => { e.preventDefault(); sendMagicLink() }}>
          <input
            type="email"
            class="magic-input"
            placeholder={$t('login.emailPlaceholder')}
            bind:value={email}
            autocomplete="email"
          />
          <button class="btn-magic" type="submit" disabled={sending || cooldown > 0}>
            {sending ? $t('login.sendingMagicLink') : $t('login.sendMagicLink')}
          </button>
          {#if magicError}
            <p class="magic-error">{magicError}</p>
          {/if}
        </form>
      {/if}

      <p class="card-note">{@html $t('login.termsNote')}</p>
    </div>
  </div>
</div>
