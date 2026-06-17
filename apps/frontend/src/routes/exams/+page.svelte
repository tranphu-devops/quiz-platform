<script>
  import { examApi, submissionApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let exams = $state([])
  let latestSub = $state({})   // examId → latest submission
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

  async function deleteExam(id) {
    if (!confirm('Xoá đề thi này?')) return
    await examApi.remove(id)
    exams = exams.filter(e => e.id !== id)
  }
</script>

<style>
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  .btn { background: #1e40af; color: white; padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.9rem; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 0.75rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); display: flex; align-items: center; gap: 1rem; border-left: 4px solid transparent; }
  .card.passed { background: #f0fdf4; border-left-color: #22c55e; }
  .card-info { flex: 1; }
  .card h3 { margin-bottom: 0.2rem; }
  .meta { font-size: 0.85rem; color: #6b7280; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.8rem; }
  .published { background: #dcfce7; color: #166534; }
  .draft { background: #fef9c3; color: #854d0e; }
  .pass-badge { background: #dcfce7; color: #15803d; border: 1px solid #86efac; border-radius: 999px; padding: 0.15rem 0.6rem; font-size: 0.8rem; font-weight: 600; }
  .fail-badge { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 999px; padding: 0.15rem 0.6rem; font-size: 0.8rem; }
  .actions { display: flex; gap: 0.5rem; align-items: center; }
  .actions a, .actions button { padding: 0.3rem 0.7rem; border-radius: 4px; font-size: 0.85rem; cursor: pointer; text-decoration: none; }
  .btn-view { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
  .btn-edit { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
  .btn-del { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
  .error { color: #dc2626; }
</style>

<div class="header">
  <h1>Đề thi</h1>
  {#if $user && $user.role !== 'student'}
    <a href="/exams/create" class="btn">+ Tạo đề thi</a>
  {/if}
</div>

{#if loading}<p>Đang tải...</p>
{:else if error}<p class="error">{error}</p>
{:else if exams.length === 0}<p>Chưa có đề thi nào.</p>
{:else}
  {#each exams as exam}
  {@const passed = $user?.role === 'student' && isPassed(exam)}
  {@const attempted = $user?.role === 'student' && !!latestSub[exam.id]}
    <div class="card" class:passed>
      <div class="card-info">
        <h3>{exam.title}</h3>
        <p class="meta">
          {exam.description ?? ''}{exam.description ? ' · ' : ''}{exam.time_limit} phút
          {#if exam.passing_score != null} · Điểm đạt: {exam.passing_score}%{/if}
          {#if exam.allow_retake} · <em>Thực hành</em>{/if}
        </p>
      </div>
      {#if $user?.role === 'student'}
        {#if passed}
          <span class="pass-badge">✓ Đã pass</span>
        {:else if attempted}
          <span class="fail-badge">Chưa đạt</span>
        {/if}
      {:else}
        <span class="badge {exam.is_published ? 'published' : 'draft'}">
          {exam.is_published ? 'Đã xuất bản' : 'Nháp'}
        </span>
      {/if}
      <div class="actions">
        <a href="/exams/{exam.id}" class="btn-view">Xem</a>
        {#if $user && $user.role !== 'student' && (exam.created_by === $user.id || $user.role === 'admin')}
          <a href="/exams/{exam.id}/edit" class="btn-edit">Sửa</a>
          <button class="btn-del" onclick={() => deleteExam(exam.id)}>Xoá</button>
        {/if}
      </div>
    </div>
  {/each}
{/if}
