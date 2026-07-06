<script>
  import { user, session, clearAuth } from '$lib/stores/auth'
  import { userApi } from '$lib/api'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import Sidebar from '$lib/components/ui/Sidebar.svelte'
  import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte'
  import { t } from '$lib/i18n'

  let { children } = $props()

  let mobileSidebarOpen = $state(false)
  let sidebarCollapsed = $state(false)
  let avatarUrl = $state(null)
  let theme = $state('light')

  onMount(() => {
    theme = localStorage.getItem('quiz-theme') || 'light'
    document.documentElement.dataset.theme = theme
    sidebarCollapsed = localStorage.getItem('quiz-sidebar-collapsed') === 'true'
  })

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed
    localStorage.setItem('quiz-sidebar-collapsed', String(sidebarCollapsed))
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    theme = next
    localStorage.setItem('quiz-theme', next)
    document.documentElement.dataset.theme = next
  }

  const themeIcon  = $derived(theme === 'dark' ? '☀️' : '🌙')
  const themeLabel = $derived(theme === 'dark' ? $t('layout.themeLight') : $t('layout.themeDark'))

  $effect(() => {
    const u = $user
    const s = $session
    if (!u?.id) { avatarUrl = null; return }

    userApi.getProfile(u.id).then(async (r) => {
      if (r.ok) {
        const p = await r.json()
        avatarUrl = p?.avatar_url ?? null
      } else if (r.status === 404) {
        const meta = s?.user?.user_metadata ?? {}
        const res = await userApi.updateProfile(u.id, {
          full_name: meta.full_name ?? meta.name ?? null,
          avatar_url: meta.avatar_url ?? meta.picture ?? null
        })
        if (res.ok) {
          const p = await res.json()
          avatarUrl = p?.avatar_url ?? null
        }
      }
    }).catch(() => {})
  })

  let isBanned = $derived($user?.role === 'banned')

  $effect(() => {
    if (isBanned) clearAuth()
  })

  async function logout() {
    mobileSidebarOpen = false
    await clearAuth()
    goto('/login')
  }

  // ── Icons ────────────────────────────────────────────────────────────────────
  const I = {
    home:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7L8 2l6 5v7H10.5v-4h-5v4H2z"/></svg>`,
    document: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="1.5" width="10" height="13" rx="1.5"/><line x1="5.5" y1="5.5" x2="10.5" y2="5.5"/><line x1="5.5" y1="8" x2="10.5" y2="8"/><line x1="5.5" y1="10.5" x2="8.5" y2="10.5"/></svg>`,
    folder:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 4a1 1 0 011-1H6l1.5 2H13a1 1 0 011 1v6.5a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4z"/></svg>`,
    plus:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="1.5" width="10" height="13" rx="1.5"/><line x1="6" y1="6" x2="10" y2="6"/><line x1="8" y1="4" x2="8" y2="8"/><line x1="5.5" y1="10" x2="10.5" y2="10"/></svg>`,
    person:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="5.5" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5"/></svg>`,
    shield:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5L2 4.5v3.5c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4.5z"/></svg>`,
    menu:     `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2.5" y1="5" x2="15.5" y2="5"/><line x1="2.5" y1="9" x2="15.5" y2="9"/><line x1="2.5" y1="13" x2="15.5" y2="13"/></svg>`,
    code:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l4 4-4 4"/><path d="M6 12L2 8l4-4"/></svg>`,
  }

  // ── Sidebar sections (reactive) ──────────────────────────────────────────────
  let sections = $derived(!$user ? [] : [
    {
      label: $t('nav.sectionNav'),
      items: [
        { icon: I.home,     label: $t('nav.dashboard'), href: '/dashboard',    active: $page.url.pathname === '/dashboard' },
        { icon: I.document, label: $t('nav.exams'),    href: '/exams',        active: $page.url.pathname.startsWith('/exams') && !$page.url.pathname.startsWith('/exams/create') },
        ...($user.role !== 'student' ? [
          { icon: I.plus,   label: $t('nav.createExam'), href: '/exams/create',  active: $page.url.pathname === '/exams/create' },
          { icon: I.folder, label: $t('nav.collections'),       href: '/collections',   active: $page.url.pathname.startsWith('/collections') },
        ] : []),
      ]
    },
    ...($user.role === 'admin' ? [{
      label: $t('nav.sectionAdmin'),
      items: [
        { icon: I.shield, label: $t('nav.admin'), href: '/admin', active: $page.url.pathname === '/admin' },
      ]
    }] : []),
    {
      label: $t('nav.sectionAccount'),
      items: [
        { icon: I.person, label: $t('nav.profile'), href: '/profile', active: $page.url.pathname === '/profile' },
        ...($user.role !== 'student' ? [
          { icon: I.code, label: $t('nav.apiDocs'), href: '/api-docs', active: $page.url.pathname === '/api-docs' },
        ] : []),
      ]
    }
  ])

  let userInfo = $derived(!$user ? null : {
    name:     $session?.user?.user_metadata?.full_name ?? null,
    email:    $user.email ?? '',
    role:     $user.role  ?? '',
    avatarUrl: avatarUrl,
  })
</script>

<style>
  /* ── Design tokens ─────────────────────────────────────────────────────────── */
  :global(:root) {
    --primary:        #5625d1;
    --primary-dark:   #4318b0;
    --primary-light:  #ede6ff;
    --accent:         #6d29d3;
    --success:        #22c55e;
    --danger:         #ef4444;
    --warning:        #f59e0b;
    --bg:             #f8f7ff;
    --surface:        #ffffff;
    --border:         #d0d2e1;
    --text:           #2b2a3f;
    --muted:          #595d72;
    --radius-card:    16px;
    --radius-btn:     10px;
    --shadow:         0 4px 20px rgba(86,37,209,0.08);
    --shadow-hover:   0 12px 36px rgba(86,37,209,0.18);

    /* Mobile topbar height — used by sticky elements inside pages */
    --mobile-bar-h:   56px;

    /* ── imgix-style tokens ──────────────────────────────────────────────── */
    --ix-bg-app:          #FBFBF8;
    --ix-bg-surface:      #FFFFFF;
    --ix-bg-sidebar:      #FBFBF8;
    --ix-bg-hover:        #F1F1ED;
    --ix-text-primary:    #18181B;
    --ix-text-secondary:  #52525B;
    --ix-text-muted:      #9CA3AF;
    --ix-border:          #EAEAE5;
    --ix-btn-black-bg:    #18181B;
    --ix-btn-black-fg:    #FFFFFF;
    --ix-cta-green-bg:    #3F9A6E;
    --ix-cta-green-fg:    #FFFFFF;
    --ix-focus-ring:      rgba(24,24,27,0.15);
    --ix-shadow-card:     0 1px 2px rgba(0,0,0,0.04);
  }

  :global([data-theme="dark"]) {
    --bg:             #202331;
    --surface:        #2d2b42;
    --border:         #3d4055;
    --text:           #f1f5f9;
    --muted:          #94a3b8;
    /* Lighter than the light-mode brand purple (#5625d1) — that value has only ~1.9:1
       contrast against these dark backgrounds. purple-400/500/fuchsia-400 read at ~6:1. */
    --primary:        #c084fc;
    --primary-dark:   #a855f7;
    --accent:         #e879f9;
    --primary-light:  rgba(192,132,252,0.18);
    --shadow:         0 4px 20px rgba(0,0,0,0.4);
    --shadow-hover:   0 12px 36px rgba(0,0,0,0.55);

    /* imgix dark overrides */
    --ix-bg-app:          #1C1C1F;
    --ix-bg-surface:      #28282D;
    --ix-bg-sidebar:      #1C1C1F;
    --ix-bg-hover:        #323237;
    --ix-text-primary:    #F4F4F5;
    --ix-text-secondary:  #A1A1AA;
    --ix-text-muted:      #71717A;
    --ix-border:          #3F3F46;
    --ix-btn-black-bg:    #E4E4E7;
    --ix-btn-black-fg:    #18181B;
    --ix-cta-green-bg:    #2D7A55;
    --ix-cta-green-fg:    #FFFFFF;
    --ix-focus-ring:      rgba(244,244,245,0.15);
  }

  /* ── Global dark mode corrections ─────────────────────────────────────────── */
  :global([data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="range"])),
  :global([data-theme="dark"] select),
  :global([data-theme="dark"] textarea) {
    background: var(--surface);
    color: var(--text);
    border-color: var(--border);
  }
  :global([data-theme="dark"] .card),
  :global([data-theme="dark"] .stat),
  :global([data-theme="dark"] .settings-card),
  :global([data-theme="dark"] .col-card) {
    background: var(--surface);
    color: var(--text);
  }
  :global([data-theme="dark"] tr:hover td) {
    background: var(--primary-light) !important;
  }
  :global([data-theme="dark"] td) {
    border-color: var(--border) !important;
  }
  :global([data-theme="dark"] .login-right) {
    background: var(--surface);
  }
  :global([data-theme="dark"] .option-btn) {
    background: var(--surface);
    color: var(--text);
  }
  :global([data-theme="dark"] .session-modal),
  :global([data-theme="dark"] .confirm-card),
  :global([data-theme="dark"] .modal-card) {
    background: var(--surface);
    color: var(--text);
  }
  :global([data-theme="dark"] .btn-google) {
    background: var(--surface);
    color: var(--text);
    border-color: var(--border);
  }

  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html) { scroll-behavior: smooth; }
  :global(body) {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--ix-bg-app);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Date / time inputs (consistent, themed) ───────────────────────────────── */
  :global(input[type="datetime-local"]),
  :global(input[type="date"]),
  :global(input[type="time"]) {
    font-family: inherit; font-size: 0.9rem;
    color: var(--text); background: var(--surface);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 0.5rem 0.7rem; line-height: 1.3;
    color-scheme: light;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  :global(input[type="datetime-local"]:focus),
  :global(input[type="date"]:focus),
  :global(input[type="time"]:focus) {
    outline: none; border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
  :global(input[type="datetime-local"]::-webkit-calendar-picker-indicator),
  :global(input[type="date"]::-webkit-calendar-picker-indicator),
  :global(input[type="time"]::-webkit-calendar-picker-indicator) {
    cursor: pointer; opacity: 0.65; border-radius: 4px; padding: 2px;
  }
  :global(input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover),
  :global(input[type="date"]::-webkit-calendar-picker-indicator:hover),
  :global(input[type="time"]::-webkit-calendar-picker-indicator:hover) {
    opacity: 1; background: var(--primary-light);
  }
  /* Dark mode: let the native picker + spinners render dark to match the app */
  :global([data-theme="dark"] input[type="datetime-local"]),
  :global([data-theme="dark"] input[type="date"]),
  :global([data-theme="dark"] input[type="time"]) { color-scheme: dark; }

  /* ── App shell (authenticated) ─────────────────────────────────────────────── */
  .app-shell {
    display: flex;
    min-height: 100vh;
    background: var(--ix-bg-app);
  }

  .app-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  /* ── Mobile topbar ─────────────────────────────────────────────────────────── */
  .app-mobile-bar {
    display: none;
    height: var(--mobile-bar-h, 56px);
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background: var(--ix-bg-sidebar);
    border-bottom: 1px solid var(--ix-border);
    position: sticky;
    top: 0;
    z-index: 100;
    flex-shrink: 0;
  }

  .mobile-ham {
    width: 36px;
    height: 36px;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--ix-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 0;
  }
  .mobile-ham:hover { background: var(--ix-bg-hover); }

  .mobile-brand {
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--ix-text-primary);
    text-decoration: none;
    letter-spacing: -0.02em;
  }

  /* ── Sidebar theme row (inside Sidebar children slot) ─────────────────────── */
  .sb-theme-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--ix-text-secondary);
  }

  .sb-theme-btn {
    width: 30px;
    height: 30px;
    border: 1px solid var(--ix-border);
    border-radius: 7px;
    background: var(--ix-bg-surface);
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s;
    flex-shrink: 0;
  }
  .sb-theme-btn:hover { background: var(--ix-bg-hover); }

  /* ── Main content ──────────────────────────────────────────────────────────── */
  main {
    flex: 1;
    padding: 2rem 1.5rem;
    background: var(--ix-bg-app);
    min-width: 0;
  }

  /* ── No-auth (unauthenticated pages) ───────────────────────────────────────── */
  .no-auth {
    min-height: 100vh;
    background: var(--bg);
    position: relative;
  }
  .no-auth-lang {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 200;
  }

  /* ── App overlay (mobile sidebar backdrop) ─────────────────────────────────── */
  .app-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 150;
    backdrop-filter: blur(2px);
  }

  /* ── Banned screen ─────────────────────────────────────────────────────────── */
  .banned-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    padding: 2rem;
  }
  .banned-card {
    background: var(--surface);
    border-radius: 16px;
    padding: 3rem 2.5rem;
    max-width: 400px;
    width: 100%;
    text-align: center;
    border: 1.5px solid #fca5a5;
    box-shadow: 0 8px 32px rgba(239,68,68,0.12);
  }
  .banned-icon  { font-size: 3rem; margin-bottom: 1rem; }
  .banned-title { font-size: 1.3rem; font-weight: 700; color: #991b1b; margin-bottom: 0.75rem; }
  .banned-msg   { color: #595d72; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.75rem; }
  .banned-back  {
    display: inline-block;
    padding: 0.65rem 1.5rem;
    background: #ef4444;
    color: white;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
    transition: background 0.15s;
  }
  .banned-back:hover { background: #dc2626; }

  /* ── Mobile ────────────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .app-mobile-bar { display: flex; }
    main { padding: 1.25rem 1rem; }
  }
</style>

{#if isBanned}
  <div class="banned-screen">
    <div class="banned-card">
      <div class="banned-icon">🚫</div>
      <h2 class="banned-title">{$t('layout.bannedTitle')}</h2>
      <p class="banned-msg">{$t('layout.bannedMsg')}</p>
      <a href="/login" class="banned-back">{$t('layout.bannedBack')}</a>
    </div>
  </div>

{:else if $user}
  <!-- Authenticated: app shell with permanent sidebar -->
  {#if mobileSidebarOpen}
    <div
      class="app-overlay"
      role="presentation"
      onclick={() => mobileSidebarOpen = false}
      onkeydown={() => mobileSidebarOpen = false}
    ></div>
  {/if}

  <div class="app-shell">
    <Sidebar
      {sections}
      {userInfo}
      onLogout={logout}
      collapsed={sidebarCollapsed}
      onToggleCollapse={toggleSidebar}
      mobileOpen={mobileSidebarOpen}
      onMobileClose={() => mobileSidebarOpen = false}
    >
      <!-- Theme + language toggles in sidebar extra area -->
      <div class="sb-theme-row">
        <span>{theme === 'dark' ? $t('layout.themeDark') + ' 🌙' : $t('layout.themeLight') + ' ☀️'}</span>
        <div style="display:flex; gap:6px; align-items:center;">
          <LanguageSwitcher variant="compact" />
          <button class="sb-theme-btn" onclick={toggleTheme} aria-label={$t('layout.switchToTheme', { theme: themeLabel })}>{themeIcon}</button>
        </div>
      </div>
    </Sidebar>

    <div class="app-body">
      <!-- Mobile topbar (hamburger + brand + theme) -->
      <div class="app-mobile-bar">
        <button class="mobile-ham" onclick={() => mobileSidebarOpen = true} aria-label={$t('nav.openMenu')}>
          {@html I.menu}
        </button>
        <a href="/dashboard" class="mobile-brand">QuizPlatform</a>
        <div style="display:flex; gap:6px; align-items:center;">
          <LanguageSwitcher variant="compact" />
          <button class="sb-theme-btn" onclick={toggleTheme} aria-label={themeLabel}>{themeIcon}</button>
        </div>
      </div>

      <main>
        {@render children()}
      </main>
    </div>
  </div>

{:else}
  <!-- Unauthenticated: full-screen, no sidebar -->
  <div class="no-auth">
    <div class="no-auth-lang">
      <LanguageSwitcher />
    </div>
    {@render children()}
  </div>
{/if}
