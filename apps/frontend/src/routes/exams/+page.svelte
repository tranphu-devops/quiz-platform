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
            if (!map[s.exam_id] || new Date(s.submitted_at) > new Date(map[s.exam_id].submitted_at)) {
              map[s.exam_id] = s
            }
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

  function initial(title) {
    return (title ?? '?').charAt(0).toUpperCase()
  }

  function fmtMeta(exam) {
    const parts = [`${exam.time_limit} phút`]
    if (exam.passing_score != null) parts.push(`Đạt: ${exam.passing_score}%`)
    if (exam.allow_retake) parts.push('Thực hành')
    return parts.join(' · ')
  }

  async function deleteExam(id) {
    if (!confirm('Xoá đề thi này?')) return
    await examApi.remove(id)
    exams = exams.filter(e => e.id !== id)
  }
</script>

<style>
  /* header */
  .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.75rem; }
  .page-header h1 { font-size: 1.5rem; font-weight: 700; }
  .btn-create { background: #1e40af; color: white; padding: 0.55rem 1.1rem; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.9rem; font-weight: 600; }

  /* grid */
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
  @media (max-width: 780px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }

  /* card */
  .card {
    background: white; border-radius: 10px; overflow: hidden;
    box-shadow: 0 1px 6px rgba(0,0,0,.1); display: flex; flex-direction: column;
    transition: box-shadow 0.18s, transform 0.18s; cursor: default;
  }
  .card:hover { box-shadow: 0 6px 24px rgba(0,0,0,.14); transform: translateY(-2px); }

  /* cover */
  .cover-wrap { position: relative; width: 100%; aspect-ratio: 16/9; overflow: hidden; flex-shrink: 0; }
  .cover-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cover-placeholder {
    width: 100%; height: 100%;
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 2.8rem; font-weight: 800; color: rgba(255,255,255,0.9); user-select: none;
  }

  /* status ribbon */
  .ribbon {
    position: absolute; top: 0.6rem; left: 0.6rem;
    padding: 0.18rem 0.55rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .ribbon.passed  { background: #16a34a; color: white; }
  .ribbon.failed  { background: #dc2626; color: white; }
  .ribbon.published { background: #15803d; color: white; }
  .ribbon.draft   { background: #92400e; color: white; }
  .ribbon.new     { display: none; }

  /* body */
  .card-body { padding: 0.9rem 1rem; flex: 1; display: flex; flex-direction: column; gap: 0.35rem; }
  .card-title { font-size: 0.98rem; font-weight: 700; line-height: 1.35; color: #111827;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-desc { font-size: 0.82rem; color: #6b7280; line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 2.3em; }
  .card-meta { font-size: 0.78rem; color: #9ca3af; margin-top: auto; padding-top: 0.3rem; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; }
  .tag { background: #eff6ff; color: #1d4ed8; border-radius: 99px; padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 500; }

  /* footer */
  .card-footer { padding: 0.7rem 1rem; border-top: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .score-badge { font-size: 0.78rem; font-weight: 600; }
  .score-badge.passed { color: #16a34a; }
  .score-badge.failed { color: #dc2626; }
  .actions { display: flex; gap: 0.4rem; }
  .btn-view  { padding: 0.3rem 0.75rem; border-radius: 5px; font-size: 0.82rem; font-weight: 600; cursor: pointer; text-decoration: none; background: #1e40af; color: white; border: none; }
  .btn-edit  { padding: 0.3rem 0.65rem; border-radius: 5px; font-size: 0.82rem; cursor: pointer; text-decoration: none; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
  .btn-del   { padding: 0.3rem 0.65rem; border-radius: 5px; font-size: 0.82rem; cursor: pointer; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }

  .empty { text-align: center; padding: 3rem 1rem; color: #6b7280; }
  .error { color: #dc2626; }
</style>

<div class="page-header">
  <h1>Đề thi</h1>
  {#if $user && $user.role !== 'student'}
    <a href="/exams/create" class="btn-create">+ Tạo đề thi</a>
  {/if}
</div>

{#if loading}
  <p style="color:#6b7280">Đang tải...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if exams.length === 0}
  <div class="empty">
    <p style="font-size:1.1rem; font-weight:600; margin-bottom:0.5rem">Chưa có đề thi nào</p>
    {#if $user?.role !== 'student'}
      <p>Nhấn <strong>+ Tạo đề thi</strong> để bắt đầu.</p>
    {:else}
      <p>Hiện chưa có đề thi nào được xuất bản.</p>
    {/if}
  </div>
{:else}
  <div class="grid">
    {#each exams as exam}
      {@const st = statusOf(exam)}
      {@const sub = latestSub[exam.id]}
      <div class="card">
        <div class="cover-wrap">
          {#if exam.cover_image_url}
            <img src={exam.cover_image_url} alt={exam.title} />
          {:else}
            <div class="cover-placeholder">{initial(exam.title)}</div>
          {/if}
          {#if st !== 'new'}
            <span class="ribbon {st}">
              {st === 'passed' ? '✓ Đã pass' : st === 'failed' ? 'Chưa đạt' : st === 'published' ? 'Đã xuất bản' : 'Nháp'}
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
          <div>
            {#if sub}
              <span class="score-badge {isPassed(exam) ? 'passed' : 'failed'}">
                {isPassed(exam) ? `✓ ${sub.percentage?.toFixed(0)}%` : `✗ ${sub.percentage?.toFixed(0)}%`}
              </span>
            {/if}
          </div>
          <div class="actions">
            <a href="/exams/{exam.id}" class="btn-view">Xem</a>
            {#if $user?.role !== 'student' && (exam.created_by === $user?.id || $user?.role === 'admin')}
              <a href="/exams/{exam.id}/edit" class="btn-edit">Sửa</a>
              <button class="btn-del" onclick={() => deleteExam(exam.id)}>Xoá</button>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
