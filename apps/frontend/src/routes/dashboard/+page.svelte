<script>
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  onMount(() => {
    if (!$user) goto('/login')
  })
</script>

<style>
  .welcome { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  h1 { margin-bottom: 0.5rem; }
  .role-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 0.2rem 0.7rem; border-radius: 999px; font-size: 0.85rem; margin-bottom: 1.5rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
  .card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; text-decoration: none; color: inherit; }
  .card:hover { background: #dbeafe; }
  .card h3 { margin-bottom: 0.4rem; }
</style>

{#if $user}
<div class="welcome">
  <h1>Xin chào, {$user.email}!</h1>
  <span class="role-badge">{$user.role}</span>
  <p>Chào mừng đến với Quiz Platform</p>

  <div class="cards">
    <a href="/exams" class="card">
      <h3>📋 Đề thi</h3>
      <p>{$user.role === 'student' ? 'Xem và làm bài thi' : 'Quản lý đề thi'}</p>
    </a>
    {#if $user.role !== 'student'}
    <a href="/exams/create" class="card">
      <h3>➕ Tạo đề thi</h3>
      <p>Soạn đề thi mới</p>
    </a>
    {/if}
  </div>
</div>
{/if}
