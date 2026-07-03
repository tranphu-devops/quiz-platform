<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { collectionApi } from '$lib/api'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'

  let collections = $state([])
  let loading = $state(true)
  let error = $state('')
  let deletingId = $state(null)

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    if ($user.role === 'student') { goto('/dashboard'); return }
    try {
      const res = await collectionApi.list()
      if (res.ok) collections = await res.json()
    } catch {
      error = 'Không thể tải danh sách bộ đề'
    } finally {
      loading = false
    }
  })

  async function remove(id) {
    if (!confirm('Xoá bộ đề này? Hành động không thể hoàn tác.')) return
    deletingId = id
    try {
      const res = await collectionApi.remove(id)
      if (res.ok) collections = collections.filter(c => c.id !== id)
    } catch {
      alert('Lỗi xoá bộ đề')
    } finally {
      deletingId = null
    }
  }
</script>

<style>
  .btn-create {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 16px; background: var(--ix-btn-black-bg);
    color: var(--ix-btn-black-fg); border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none;
    font-family: inherit; transition: opacity 0.1s;
  }
  .btn-create:hover { opacity: 0.82; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .card {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border); box-shadow: var(--shadow);
    transition: box-shadow 0.2s, transform 0.2s; overflow: hidden;
  }
  .card:hover { box-shadow: var(--shadow-hover); transform: translateY(-2px); }

  .card-header {
    padding: 1.1rem 1.25rem 0.75rem;
    display: flex; align-items: center; gap: 0.85rem;
  }
  .badge-thumb { width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; object-fit: cover; }
  .badge-placeholder {
    width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    display: flex; align-items: center; justify-content: center; font-size: 1.4rem;
  }
  .card-title { font-size: 1rem; font-weight: 700; line-height: 1.3; margin-bottom: 0.2rem; }
  .card-desc { font-size: 0.82rem; color: var(--muted); }

  .card-meta {
    padding: 0 1.25rem 0.75rem;
    display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  }
  .pill {
    font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.6rem; border-radius: 99px;
    background: var(--bg); color: var(--muted); border: 1px solid var(--border);
  }
  .pill.published { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }

  .col-tags { padding: 0 1.25rem 0.85rem; display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: -0.15rem; }
  .col-tag {
    font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.55rem; border-radius: 99px;
    background: var(--primary-light); color: var(--primary);
  }

  .card-actions {
    padding: 0.65rem 1.25rem; border-top: 1px solid var(--border);
    display: flex; gap: 0.5rem;
  }
  .btn-sm {
    padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.82rem; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border); background: var(--bg); color: var(--text);
    text-decoration: none; transition: all 0.12s;
  }
  .btn-sm:hover { border-color: var(--primary); color: var(--primary); }
  .btn-sm.danger:hover { border-color: var(--danger); color: var(--danger); background: #fef2f2; }
  .empty { text-align: center; padding: 3rem 1rem; color: var(--muted); }
  .empty h3 { font-size: 1.1rem; margin-bottom: 0.5rem; }
</style>

<PageHeader title="Bộ đề ({collections.length})">
  <a href="/collections/create" class="btn-create">+ Tạo bộ đề mới</a>
</PageHeader>

{#if loading}
  <p style="color:var(--muted)">Đang tải...</p>
{:else if error}
  <p style="color:var(--danger)">{error}</p>
{:else if collections.length === 0}
  <div class="empty">
    <div style="font-size:3rem;margin-bottom:0.75rem">🗂️</div>
    <h3>Chưa có bộ đề nào</h3>
    <p>Tạo bộ đề đầu tiên để nhóm các đề thi và tặng huy hiệu cho student.</p>
  </div>
{:else}
  <div class="grid">
    {#each collections as col}
      <div class="card">
        <div class="card-header">
          {#if col.badge_image_url}
            <img src={col.badge_image_url} alt="" class="badge-thumb" />
          {:else}
            <div class="badge-placeholder">🎖️</div>
          {/if}
          <div>
            <div class="card-title">{col.title}</div>
            {#if col.description}
              <div class="card-desc">{col.description}</div>
            {/if}
          </div>
        </div>
        <div class="card-meta">
          <span class="pill">{col.exams?.length ?? 0} đề thi</span>
          <span class="pill {col.is_published ? 'published' : ''}">
            {col.is_published ? '● Đã xuất bản' : '○ Nháp'}
          </span>
        </div>
        {#if col.tags?.length}
          <div class="col-tags">
            {#each col.tags as t}<span class="col-tag">{t}</span>{/each}
          </div>
        {/if}
        <div class="card-actions">
          <a href="/collections/{col.id}/edit" class="btn-sm">✏️ Sửa</a>
          <button class="btn-sm danger" onclick={() => remove(col.id)} disabled={deletingId === col.id}>
            {deletingId === col.id ? '...' : '🗑 Xoá'}
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}
