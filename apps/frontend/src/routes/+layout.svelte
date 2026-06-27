<script>
  import { user, session, clearAuth } from '$lib/stores/auth'
  import { userApi } from '$lib/api'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'

  let { children } = $props()

  let sidebarOpen = $state(false)
  let avatarUrl = $state(null)
  let theme = $state('light')  // 'light' | 'dark'

  onMount(() => {
    theme = localStorage.getItem('quiz-theme') || 'light'
    document.documentElement.dataset.theme = theme
  })

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    theme = next
    localStorage.setItem('quiz-theme', next)
    document.documentElement.dataset.theme = next
  }

  const themeIcon  = $derived(theme === 'dark' ? '☀️' : '🌙')
  const themeLabel = $derived(theme === 'dark' ? 'Sáng' : 'Tối')

  $effect(() => {
    const u = $user
    const s = $session
    if (!u?.id) { avatarUrl = null; return }

    userApi.getProfile(u.id).then(async (r) => {
      if (r.ok) {
        const p = await r.json()
        avatarUrl = p?.avatar_url ?? null
      } else if (r.status === 404) {
        // New user — auto-create profile with Google metadata if available
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
    if (isBanned) {
      clearAuth()
    }
  })

  async function logout() {
    sidebarOpen = false
    await clearAuth()
    goto('/login')
  }

  function closeSidebar() { sidebarOpen = false }
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
    --nav-bg:         rgba(255,255,255,0.92);
    --sidebar-bg:     #ffffff;
  }

  :global([data-theme="dark"]) {
    --bg:             #202331;
    --surface:        #2d2b42;
    --border:         #3d4055;
    --text:           #f1f5f9;
    --muted:          #94a3b8;
    --primary-light:  rgba(86,37,209,0.18);
    --shadow:         0 4px 20px rgba(0,0,0,0.4);
    --shadow-hover:   0 12px 36px rgba(0,0,0,0.55);
    --nav-bg:         rgba(32,35,49,0.94);
    --sidebar-bg:     #2d2b42;
  }

  /* ── Global dark mode corrections ─────────────────────────────────────────── */
  /* Form controls */
  :global([data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="range"])),
  :global([data-theme="dark"] select),
  :global([data-theme="dark"] textarea) {
    background: var(--surface);
    color: var(--text);
    border-color: var(--border);
  }
  /* Common white-card patterns used across pages */
  :global([data-theme="dark"] .card),
  :global([data-theme="dark"] .stat),
  :global([data-theme="dark"] .settings-card),
  :global([data-theme="dark"] .col-card) {
    background: var(--surface);
    color: var(--text);
  }
  /* Table rows */
  :global([data-theme="dark"] tr:hover td) {
    background: var(--primary-light) !important;
  }
  :global([data-theme="dark"] td) {
    border-color: var(--border) !important;
  }
  /* Login right panel */
  :global([data-theme="dark"] .login-right) {
    background: var(--surface);
  }
  /* Option buttons in take page */
  :global([data-theme="dark"] .option-btn) {
    background: var(--surface);
    color: var(--text);
  }
  /* Modal / overlay cards */
  :global([data-theme="dark"] .session-modal),
  :global([data-theme="dark"] .confirm-card),
  :global([data-theme="dark"] .modal-card) {
    background: var(--surface);
    color: var(--text);
  }
  /* Google OAuth button */
  :global([data-theme="dark"] .btn-google) {
    background: var(--surface);
    color: var(--text);
    border-color: var(--border);
  }

  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html) { scroll-behavior: smooth; }
  :global(body) {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Navbar ─────────────────────────────────────────────────────────────────── */
  nav {
    position: sticky; top: 0; z-index: 50;
    background: var(--nav-bg);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 1.5rem;
    height: 60px;
    display: flex; align-items: center; gap: 0;
  }

  .brand {
    font-size: 1.2rem; font-weight: 800;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    text-decoration: none; letter-spacing: -0.02em;
    flex-shrink: 0;
  }

  .nav-links {
    display: flex; align-items: center; gap: 0.25rem;
    margin-left: 2rem;
  }
  .nav-links a {
    color: var(--muted); text-decoration: none; font-size: 0.9rem; font-weight: 500;
    padding: 0.4rem 0.75rem; border-radius: 8px;
    transition: color 0.15s, background 0.15s;
  }
  .nav-links a:hover { color: var(--primary); background: var(--primary-light); }
  .nav-links a.active { color: var(--primary); background: var(--primary-light); font-weight: 600; }

  .spacer { flex: 1; }

  .nav-right { display: flex; align-items: center; gap: 0.75rem; }
  .user-chip {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.85rem; font-weight: 500; color: var(--muted);
    padding: 0.3rem 0.75rem 0.3rem 0.3rem; border-radius: 99px; background: var(--bg);
    border: 1px solid var(--border); text-decoration: none;
    transition: border-color 0.15s;
    max-width: 200px;
  }
  .user-chip:hover { border-color: var(--primary); color: var(--primary); }
  .user-chip .chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .avatar {
    width: 28px; height: 28px; border-radius: 50%; object-fit: cover;
    flex-shrink: 0; border: 1.5px solid var(--border);
  }
  .avatar-initials {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; font-weight: 700; color: white;
  }
  .btn-logout {
    background: none; border: 1px solid var(--border); color: var(--muted);
    padding: 0.35rem 0.75rem; border-radius: var(--radius-btn);
    cursor: pointer; font-size: 0.85rem; font-weight: 500;
    transition: all 0.15s;
  }
  .btn-logout:hover { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,0.08); }

  .theme-toggle {
    width: 34px; height: 34px; border: 1px solid var(--border);
    border-radius: 8px; background: var(--bg); cursor: pointer;
    font-size: 1rem; display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, background 0.15s; flex-shrink: 0;
  }
  .theme-toggle:hover { border-color: var(--primary); background: var(--primary-light); }

  .theme-row {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.5rem 0; font-size: 0.85rem; color: var(--muted);
  }
  .theme-row span { flex: 1; }

  /* ── Hamburger ────────────────────────────────────────────────────────────────*/
  .hamburger {
    display: none;
    flex-direction: column; justify-content: center; align-items: center;
    gap: 5px; width: 40px; height: 40px; border: none;
    background: none; cursor: pointer; border-radius: 8px; padding: 0;
    transition: background 0.15s;
  }
  .hamburger:hover { background: var(--primary-light); }
  .hamburger span {
    display: block; width: 22px; height: 2px;
    background: var(--text); border-radius: 2px;
    transition: all 0.25s;
  }
  .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .hamburger.open span:nth-child(2) { opacity: 0; }
  .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* ── Sidebar overlay ──────────────────────────────────────────────────────────*/
  .sidebar-overlay {
    display: none;
    position: fixed; inset: 0; background: rgba(26,23,48,0.5);
    z-index: 80; backdrop-filter: blur(2px);
  }
  .sidebar-overlay.open { display: block; }

  .sidebar {
    position: fixed; top: 0; right: -300px; bottom: 0;
    width: 280px; background: var(--sidebar-bg); z-index: 90;
    box-shadow: -8px 0 32px rgba(86,37,209,0.15);
    display: flex; flex-direction: column;
    transition: right 0.3s cubic-bezier(0.4,0,0.2,1);
    padding: 0;
  }
  .sidebar.open { right: 0; }

  .sidebar-header {
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .sidebar-brand {
    font-size: 1.1rem; font-weight: 800;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sidebar-close {
    width: 32px; height: 32px; border: none; background: var(--bg);
    border-radius: 8px; cursor: pointer; font-size: 1.1rem;
    display: flex; align-items: center; justify-content: center;
    color: var(--muted);
  }

  .sidebar-user {
    padding: 1rem 1.25rem;
    background: var(--bg); border-bottom: 1px solid var(--border);
  }
  .sidebar-user .name { font-weight: 600; font-size: 0.9rem; color: var(--text); }
  .sidebar-user .email { font-size: 0.8rem; color: var(--muted); margin-top: 2px; }
  .sidebar-user .role-pill {
    display: inline-block; margin-top: 0.5rem;
    padding: 0.15rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600;
  }
  .role-pill.student { background: rgba(86,37,209,0.15);  color: var(--primary); }
  .role-pill.teacher { background: rgba(234,179,8,0.15);   color: #a16207; }
  .role-pill.admin   { background: rgba(236,72,153,0.15);  color: #9d174d; }
  .role-pill.banned  { background: rgba(239,68,68,0.15);   color: #dc2626; }

  /* ── Banned screen ─────────────────────────────────────────────────────────── */
  .banned-screen {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--bg); padding: 2rem;
  }
  .banned-card {
    background: var(--surface); border-radius: 16px; padding: 3rem 2.5rem;
    max-width: 400px; width: 100%; text-align: center;
    border: 1.5px solid #fca5a5; box-shadow: 0 8px 32px rgba(239,68,68,0.12);
  }
  .banned-icon { font-size: 3rem; margin-bottom: 1rem; }
  .banned-title { font-size: 1.3rem; font-weight: 700; color: #991b1b; margin-bottom: 0.75rem; }
  .banned-msg { color: #595d72; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.75rem; }
  .banned-back {
    display: inline-block; padding: 0.65rem 1.5rem;
    background: #ef4444; color: white; border-radius: 8px;
    font-weight: 600; font-size: 0.9rem; text-decoration: none;
    transition: background 0.15s;
  }
  .banned-back:hover { background: #dc2626; }

  .sidebar-nav {
    flex: 1; padding: 0.75rem; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0.25rem;
  }
  .sidebar-nav a {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.75rem 1rem; border-radius: 10px;
    color: var(--text); text-decoration: none; font-size: 0.95rem; font-weight: 500;
    transition: all 0.15s; width: 100%;
  }
  .sidebar-nav a:hover  { background: var(--primary-light); color: var(--primary); }
  .sidebar-nav a.active { background: var(--primary-light); color: var(--primary); font-weight: 600; }
  .sidebar-nav .icon { font-size: 1.1rem; width: 24px; text-align: center; }

  .sidebar-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border);
  }
  .btn-sidebar-logout {
    width: 100%; padding: 0.7rem; border-radius: var(--radius-btn);
    border: 1px solid var(--border); background: none;
    color: var(--danger); font-size: 0.9rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .btn-sidebar-logout:hover { background: rgba(239,68,68,0.08); border-color: var(--danger); }

  /* ── Main ─────────────────────────────────────────────────────────────────────*/
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  /* ── Mobile ───────────────────────────────────────────────────────────────────*/
  @media (max-width: 768px) {
    .nav-links { display: none; }
    .nav-right  { display: none; }
    .hamburger  { display: flex; }
    main { padding: 1.25rem 1rem; }
  }
</style>

{#if isBanned}
<div class="banned-screen">
  <div class="banned-card">
    <div class="banned-icon">🚫</div>
    <h2 class="banned-title">Tài khoản bị khoá</h2>
    <p class="banned-msg">Tài khoản của bạn đã bị quản trị viên tạm khoá. Vui lòng liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.</p>
    <a href="/login" class="banned-back">Về trang đăng nhập</a>
  </div>
</div>
{:else}

<nav>
  <a href="/" class="brand">QuizPlatform</a>

  {#if $user}
    <div class="nav-links">
      <a href="/dashboard" class:active={$page.url.pathname === '/dashboard'}>Dashboard</a>
      <a href="/exams"     class:active={$page.url.pathname.startsWith('/exams') && !$page.url.pathname.startsWith('/exams/create')}>Đề thi</a>
      {#if $user.role !== 'student'}
        <a href="/collections" class:active={$page.url.pathname.startsWith('/collections')}>Bộ đề</a>
      {/if}
      {#if $user.role === 'admin'}
        <a href="/admin"   class:active={$page.url.pathname === '/admin'}>Admin</a>
      {/if}
    </div>
    <div class="spacer"></div>
    <div class="nav-right">
      <button class="theme-toggle" onclick={toggleTheme} title="{themeLabel}">
        {themeIcon}
      </button>
      <a href="/profile" class="user-chip">
        {#if avatarUrl}
          <img src={avatarUrl} alt="avatar" class="avatar" />
        {:else}
          <div class="avatar-initials">
            {($session?.user?.user_metadata?.full_name || $user.email).charAt(0).toUpperCase()}
          </div>
        {/if}
        <span class="chip-name">{$session?.user?.user_metadata?.full_name || $user.email}</span>
      </a>
      <button class="btn-logout" onclick={logout}>Đăng xuất</button>
    </div>
    <button class="hamburger {sidebarOpen ? 'open' : ''}" onclick={() => sidebarOpen = !sidebarOpen} aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  {:else}
    <div class="spacer"></div>
    <div class="nav-links">
      <a href="/login">Đăng nhập</a>
    </div>
  {/if}
</nav>

<!-- Mobile Sidebar -->
{#if $user}
  <div class="sidebar-overlay {sidebarOpen ? 'open' : ''}" role="presentation" onclick={closeSidebar} onkeydown={closeSidebar}></div>
  <aside class="sidebar {sidebarOpen ? 'open' : ''}">
    <div class="sidebar-header">
      <span class="sidebar-brand">QuizPlatform</span>
      <button class="sidebar-close" onclick={closeSidebar}>✕</button>
    </div>
    <div class="sidebar-user">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.6rem">
        {#if avatarUrl}
          <img src={avatarUrl} alt="avatar" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--border);flex-shrink:0" />
        {:else}
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;color:white;flex-shrink:0">
            {($session?.user?.user_metadata?.full_name || $user.email).charAt(0).toUpperCase()}
          </div>
        {/if}
        <div>
          <div class="name">{$session?.user?.user_metadata?.full_name || 'Người dùng'}</div>
          <div class="email">{$user.email}</div>
        </div>
      </div>
      <span class="role-pill {$user.role}">
        {$user.role === 'student' ? '🎓 Học sinh' : $user.role === 'teacher' ? '👨‍🏫 Giáo viên' : $user.role === 'admin' ? '⚙️ Admin' : '🚫 Bị khoá'}
      </span>
    </div>
    <nav class="sidebar-nav">
      <a href="/dashboard" class:active={$page.url.pathname === '/dashboard'} onclick={closeSidebar}>
        <span class="icon">🏠</span> Dashboard
      </a>
      <a href="/exams" class:active={$page.url.pathname.startsWith('/exams')} onclick={closeSidebar}>
        <span class="icon">📝</span> Đề thi
      </a>
      {#if $user.role !== 'student'}
        <a href="/exams/create" class:active={$page.url.pathname === '/exams/create'} onclick={closeSidebar}>
          <span class="icon">✚</span> Tạo đề thi
        </a>
        <a href="/collections" class:active={$page.url.pathname.startsWith('/collections')} onclick={closeSidebar}>
          <span class="icon">🗂️</span> Bộ đề
        </a>
      {/if}
      {#if $user.role === 'admin'}
        <a href="/admin" class:active={$page.url.pathname === '/admin'} onclick={closeSidebar}>
          <span class="icon">⚙️</span> Admin
        </a>
      {/if}
      <a href="/profile" class:active={$page.url.pathname === '/profile'} onclick={closeSidebar}>
        <span class="icon">👤</span> Tài khoản
      </a>
    </nav>
    <div class="sidebar-footer">
      <div class="theme-row">
        <span>Giao diện: <strong>{theme === 'dark' ? 'Tối 🌙' : 'Sáng ☀️'}</strong></span>
        <button class="theme-toggle" onclick={toggleTheme} title="Chuyển sang {themeLabel}">{themeIcon}</button>
      </div>
      <button class="btn-sidebar-logout" onclick={logout}>↩ Đăng xuất</button>
    </div>
  </aside>
{/if}

<main>
  {@render children()}
</main>
{/if}
