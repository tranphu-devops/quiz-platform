<script>
  import { user, session, clearAuth } from '$lib/stores/auth'
  import { userApi } from '$lib/api'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'

  let { children } = $props()

  let sidebarOpen = $state(false)
  let avatarUrl = $state(null)

  $effect(() => {
    const u = $user
    if (u?.id) {
      userApi.getProfile(u.id).then(r => r.ok ? r.json() : null).then(p => {
        avatarUrl = p?.avatar_url ?? null
      }).catch(() => {})
    } else {
      avatarUrl = null
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
    --primary:        #6366f1;
    --primary-dark:   #4f46e5;
    --primary-light:  #ede9fe;
    --accent:         #8b5cf6;
    --success:        #22c55e;
    --danger:         #ef4444;
    --warning:        #f59e0b;
    --bg:             #f8f7ff;
    --surface:        #ffffff;
    --border:         #e5e3f7;
    --text:           #1a1730;
    --muted:          #6b7280;
    --radius-card:    16px;
    --radius-btn:     10px;
    --shadow:         0 4px 20px rgba(99,102,241,0.08);
    --shadow-hover:   0 12px 36px rgba(99,102,241,0.18);
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
    background: rgba(255,255,255,0.92);
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
  .btn-logout:hover { border-color: var(--danger); color: var(--danger); background: #fff1f2; }

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
    width: 280px; background: white; z-index: 90;
    box-shadow: -8px 0 32px rgba(99,102,241,0.15);
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
  .role-pill.student { background: #ede9fe; color: var(--primary); }
  .role-pill.teacher { background: #fef9c3; color: #854d0e; }
  .role-pill.admin   { background: #fce7f3; color: #9d174d; }

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
  .btn-sidebar-logout:hover { background: #fff1f2; border-color: var(--danger); }

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
        {$user.role === 'student' ? '🎓 Học sinh' : $user.role === 'teacher' ? '👨‍🏫 Giáo viên' : '⚙️ Admin'}
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
      <button class="btn-sidebar-logout" onclick={logout}>↩ Đăng xuất</button>
    </div>
  </aside>
{/if}

<main>
  {@render children()}
</main>
