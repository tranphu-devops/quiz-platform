<script>
  import { user, clearAuth } from '$lib/stores/auth'
  import { goto } from '$app/navigation'

  async function logout() {
    await clearAuth()
    goto('/login')
  }
</script>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; }
  nav { background: #1e40af; color: white; padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 1.5rem; }
  nav a { color: white; text-decoration: none; font-weight: 500; }
  nav a:hover { text-decoration: underline; }
  .spacer { flex: 1; }
  .brand { font-size: 1.2rem; font-weight: 700; }
  button { background: none; border: 1px solid white; color: white; padding: 0.3rem 0.8rem; border-radius: 4px; cursor: pointer; }
  main { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
</style>

<nav>
  <span class="brand">QuizPlatform</span>
  {#if $user}
    <a href="/dashboard">Dashboard</a>
    <a href="/exams">Đề thi</a>
    {#if $user?.role === 'admin'}
      <a href="/admin">Admin</a>
    {/if}
    <span class="spacer"></span>
    <span>{$user.email} ({$user.role})</span>
    <button onclick={logout}>Đăng xuất</button>
  {:else}
    <span class="spacer"></span>
    <a href="/login">Đăng nhập</a>
    <a href="/register">Đăng ký</a>
  {/if}
</nav>

<main>
  <slot />
</main>
