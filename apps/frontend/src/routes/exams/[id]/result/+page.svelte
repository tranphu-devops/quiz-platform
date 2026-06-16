<script>
  import { submissionApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'

  let submission = $state(null)
  let loading = $state(true)
  let error = $state('')

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const submissionId = $page.url.searchParams.get('submissionId')
    if (!submissionId) { goto('/exams'); return }

    try {
      const res = await submissionApi.get(submissionId)
      if (!res.ok) { error = 'Không tìm thấy kết quả'; return }
      submission = await res.json()
    } catch {
      error = 'Không thể tải kết quả'
    } finally {
      loading = false
    }
  })

  function grade(pct) {
    if (pct >= 90) return { label: 'Xuất sắc', color: '#166534' }
    if (pct >= 70) return { label: 'Tốt', color: '#1e40af' }
    if (pct >= 50) return { label: 'Trung bình', color: '#854d0e' }
    return { label: 'Chưa đạt', color: '#dc2626' }
  }
</script>

<style>
  .result-card { background: white; border-radius: 12px; padding: 2.5rem; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,.1); max-width: 480px; margin: 0 auto; }
  .score-circle { width: 140px; height: 140px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 1.5rem auto; border: 6px solid; }
  .score-pct { font-size: 2rem; font-weight: 700; }
  .score-label { font-size: 0.9rem; margin-top: 0.25rem; }
  .details { margin-top: 1.5rem; color: #6b7280; font-size: 0.95rem; }
  .details p { margin: 0.3rem 0; }
  .actions { margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; }
  .btn { padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-size: 0.95rem; border: none; cursor: pointer; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-outline { background: white; border: 1px solid #d1d5db; color: #374151; }
  .error { color: #dc2626; }
</style>

{#if loading}<p>Đang tải kết quả...</p>
{:else if error}<p class="error">{error}</p>
{:else if submission}
{@const g = grade(submission.percentage)}
<div class="result-card">
  <h1>Kết quả bài thi</h1>

  <div class="score-circle" style="border-color: {g.color}; color: {g.color}">
    <span class="score-pct">{Math.round(submission.percentage)}%</span>
    <span class="score-label">{g.label}</span>
  </div>

  <div class="details">
    <p>Điểm: <strong>{submission.score}</strong> / {submission.total_points}</p>
    <p>Nộp lúc: {new Date(submission.submitted_at).toLocaleString('vi-VN')}</p>
  </div>

  <div class="actions">
    <a href="/exams/{submission.exam_id}" class="btn btn-outline">Xem lại đề</a>
    <a href="/exams" class="btn btn-primary">Về danh sách đề</a>
  </div>
</div>
{/if}
