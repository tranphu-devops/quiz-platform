<script>
  import { examApi, submissionApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let exams = $state([])
  let latestSub = $state({})
  let loading = $state(true)
  let error = $state('')

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    try {
      const res = await examApi.list()
      if (!res.ok) { error = 'Không thể tải danh sách đề thi'; return }
      exams = await res.json()

      if ($user.role === 'student') {
        const subRes = await submissionApi.list()
        if (subRes.ok) {
          const subs = await subRes.json()
          const map = {}
          for (const s of subs) {
            if (!map[s.exam_id] || new Date(s.submitted_at) > new Date(map[s.exam_id].submitted_at))
              map[s.exam_id] = s
          }
          latestSub = map
        }
      }
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }
  })

  function isPassed(exam) {
    const sub = latestSub[exam.id]
    if (!sub) return false
    return exam.passing_score == null || sub.percentage >= exam.passing_score
  }

  function statusOf(exam) {
    if ($user?.role === 'student') {
      if (isPassed(exam)) return 'passed'
      if (latestSub[exam.id]) return 'failed'
      return 'new'
    }
    return exam.is_published ? 'published' : 'draft'
  }

  function initial(title) { return (title ?? '?').charAt(0).toUpperCase() }

  function fmtMeta(exam) {
    const parts = [`${exam.time_limit} phút`]
    if (exam.passing_score != null) parts.push(`Đạt ≥${exam.passing_score}%`)
    if (exam.allow_retake) parts.push('Thực hành')
    return parts.join(' · ')
  }

  async function deleteExam(id) {
    if (!confirm('Xoá đề thi này?')) return
    await examApi.remove(id)
    exams = exams.filter(e => e.id !== id)
  }

  const GRADIENTS = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#3b82f6,#6366f1)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'linear-gradient(135deg,#0ea5e9,#6366f1)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#10b981,#3b82f6)',
  ]
  function gradientFor(title) {
    const i = (title ?? '').charCodeAt(0) % GRADIENTS.length
    return GRADIENTS[i]
  }
</script>

<style>
  .page-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;
  }
  .page-title {
    font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .btn-create {
    display: flex; align-items: center; gap: 0.4rem;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: white; padding: 0.6rem 1.25rem;
    border: none; border-radius: var(--radius-btn);
    cursor: pointer; text-decoration: none;
    font-size: 0.9rem; font-weight: 700;
    box-shadow: 0 4px 14px rgba(99,102,241,0.35);
    transition: all 0.2s;
  }
  .btn-create:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.45); }

  /* Grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 860px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 520px) { .grid { grid-template-columns: 1fr; } }

  /* Card */
  .card {
    background: var(--surface); border-radius: var(--radius-card);
    overflow: hidden; display: flex; flex-direction: column;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    transition: all 0.2s;
  }
  .card:hover {
    box-shadow: var(--shadow-hover);
    transform: translateY(-3px);
    border-color: #c4b5fd;
  }

  /* Cover */
  .cover-wrap {
    position: relative; width: 100%; aspect-ratio: 16/9;
    overflow: hidden; flex-shrink: 0;
  }
  .cover-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cover-placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 3rem; font-weight: 800; color: rgba(255,255,255,0.9);
    user-select: none; letter-spacing: -0.05em;
  }
  .cover-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.25), transparent);
    opacity: 0; transition: opacity 0.2s;
  }
  .card:hover .cover-overlay { opacity: 1; }

  /* Badge */
  .badge {
    position: absolute; top: 0.65rem; left: 0.65rem;
    padding: 0.2rem 0.6rem; border-radius: 99px;
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .badge.passed   { background: #dcfce7; color: #15803d; }
  .badge.failed   { background: #fee2e2; color: #dc2626; }
  .badge.published{ background: rgba(255,255,255,0.9); color: #15803d; }
  .badge.draft    { background: rgba(255,255,255,0.85); color: #92400e; }
  .badge.new      { display: none; }

  /* Body */
  .card-body { padding: 1rem 1.1rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
  .card-title {
    font-size: 0.98rem; font-weight: 700; line-height: 1.4; color: var(--text);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .card-desc {
    font-size: 0.82rem; color: var(--muted); line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 2.4em;
  }
  .card-meta { font-size: 0.77rem; color: #a0aec0; margin-top: auto; padding-top: 0.35rem; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
  .tag {
    background: var(--primary-light); color: var(--primary);
    border-radius: 99px; padding: 0.1rem 0.55rem;
    font-size: 0.7rem; font-weight: 600;
  }

  /* Footer */
  .card-footer {
    padding: 0.75rem 1.1rem; border-top: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
  }

  .score-wrap { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
  .score-text { font-size: 0.78rem; font-weight: 600; }
  .score-text.passed { color: #15803d; }
  .score-text.failed { color: var(--danger); }
  .score-bar { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 99px; transition: width 0.4s; }
  .score-bar-fill.passed { background: var(--success); }
  .score-bar-fill.failed { background: var(--danger); }

  .actions { display: flex; gap: 0.35rem; flex-shrink: 0; }
  .btn {
    padding: 0.35rem 0.7rem; border-radius: 8px;
    font-size: 0.8rem; font-weight: 600; cursor: pointer;
    text-decoration: none; border: none; transition: all 0.15s;
  }
  .btn-primary {
    background: var(--primary); color: white;
    box-shadow: 0 2px 8px rgba(99,102,241,0.3);
  }
  .btn-primary:hover { background: var(--primary-dark); }
  .btn-ghost { background: var(--bg); color: var(--text); border: 1px solid var(--border); }
  .btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
  .btn-danger { background: #fee2e2; color: var(--danger); border: 1px solid #fecaca; }
  .btn-danger:hover { background: #fecaca; }

  /* States */
  .loading-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
  }
  @media (max-width: 860px) { .loading-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 520px) { .loading-grid { grid-template-columns: 1fr; } }
  .skeleton-card {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border); overflow: hidden;
  }
  .skeleton-cover { aspect-ratio: 16/9; background: linear-gradient(90deg,#f0eeff,#e9e4ff,#f0eeff); background-size: 200%; animation: shimmer 1.5s infinite; }
  .skeleton-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .skeleton-line {
    height: 12px; border-radius: 6px;
    background: linear-gradient(90deg,#f0eeff,#e9e4ff,#f0eeff);
    background-size: 200%; animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

  .empty {
    text-align: center; padding: 4rem 2rem;
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border);
  }
  .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
  .empty h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.4rem; }
  .empty p { color: var(--muted); font-size: 0.9rem; }
  .error { color: var(--danger); }
</style>

<div class="page-header">
  <h1 class="page-title">Đề thi</h1>
  {#if $user && $user.role !== 'student'}
    <a href="/exams/create" class="btn-create">
      <span>＋</span> Tạo đề thi
    </a>
  {/if}
</div>

{#if loading}
  <div class="loading-grid">
    {#each Array(6) as _}
      <div class="skeleton-card">
        <div class="skeleton-cover"></div>
        <div class="skeleton-body">
          <div class="skeleton-line" style="width:80%"></div>
          <div class="skeleton-line" style="width:60%"></div>
          <div class="skeleton-line" style="width:40%"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if error}
  <p class="error">{error}</p>
{:else if exams.length === 0}
  <div class="empty">
    <div class="empty-icon">📋</div>
    <h3>Chưa có đề thi nào</h3>
    <p>
      {#if $user?.role !== 'student'}
        Nhấn <strong>Tạo đề thi</strong> để bắt đầu.
      {:else}
        Hiện chưa có đề thi nào được xuất bản.
      {/if}
    </p>
  </div>
{:else}
  <div class="grid">
    {#each exams as exam}
      {@const st = statusOf(exam)}
      {@const sub = latestSub[exam.id]}
      {@const pct = sub?.percentage ?? 0}
      <div class="card">
        <div class="cover-wrap">
          {#if exam.cover_image_url}
            <img src={exam.cover_image_url} alt={exam.title} />
          {:else}
            <div class="cover-placeholder" style="background:{gradientFor(exam.title)}">{initial(exam.title)}</div>
          {/if}
          <div class="cover-overlay"></div>
          {#if st !== 'new'}
            <span class="badge {st}">
              {st === 'passed' ? '✓ Đã pass' : st === 'failed' ? '✗ Chưa đạt' : st === 'published' ? '✓ Xuất bản' : 'Nháp'}
            </span>
          {/if}
        </div>

        <div class="card-body">
          <div class="card-title">{exam.title}</div>
          <div class="card-desc">{exam.description ?? 'Không có mô tả'}</div>
          <div class="card-meta">{fmtMeta(exam)}</div>
          {#if exam.tags?.length}
            <div class="tags">
              {#each exam.tags.slice(0, 3) as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}
        </div>

        <div class="card-footer">
          <div class="score-wrap">
            {#if sub}
              <span class="score-text {isPassed(exam) ? 'passed' : 'failed'}">
                {isPassed(exam) ? '✓' : '✗'} {pct.toFixed(0)}%
              </span>
              <div class="score-bar">
                <div class="score-bar-fill {isPassed(exam) ? 'passed' : 'failed'}" style="width:{pct}%"></div>
              </div>
            {/if}
          </div>
          <div class="actions">
            <a href="/exams/{exam.id}" class="btn btn-primary">Xem</a>
            {#if $user?.role !== 'student' && (exam.created_by === $user?.id || $user?.role === 'admin')}
              <a href="/exams/{exam.id}/edit" class="btn btn-ghost">Sửa</a>
              <button class="btn btn-danger" onclick={() => deleteExam(exam.id)}>Xoá</button>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
