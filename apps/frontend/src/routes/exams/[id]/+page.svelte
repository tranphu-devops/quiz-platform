<script>
  import { examApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'

  let exam = $state(null)
  let loading = $state(true)
  let error = $state('')
  let publishing = $state(false)

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const id = $page.params.id
    try {
      const res = await examApi.get(id)
      if (!res.ok) { error = 'Không tìm thấy đề thi'; return }
      exam = await res.json()
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }
  })

  async function togglePublish() {
    publishing = true
    try {
      await examApi.update(exam.id, { is_published: !exam.is_published })
      exam = { ...exam, is_published: !exam.is_published }
    } finally {
      publishing = false
    }
  }
</script>

<style>
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
  .meta { color: #6b7280; font-size: 0.9rem; margin-top: 0.25rem; }
  .actions { display: flex; gap: 0.75rem; }
  .btn { padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem; text-decoration: none; border: none; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-success { background: #166534; color: white; }
  .btn-outline { background: white; border: 1px solid #d1d5db; color: #374151; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 0.75rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .q-num { font-weight: 600; margin-bottom: 0.5rem; }
  .options { list-style: none; margin-top: 0.5rem; }
  .options li { padding: 0.25rem 0; }
  .correct { color: #166534; font-weight: 600; }
  .error { color: #dc2626; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.8rem; margin-left: 0.5rem; }
  .published { background: #dcfce7; color: #166534; }
  .draft { background: #fef9c3; color: #854d0e; }
</style>

{#if loading}<p>Đang tải...</p>
{:else if error}<p class="error">{error}</p>
{:else if exam}
<div class="header">
  <div>
    <h1>
      {exam.title}
      <span class="badge {exam.is_published ? 'published' : 'draft'}">
        {exam.is_published ? 'Đã xuất bản' : 'Nháp'}
      </span>
    </h1>
    <p class="meta">{exam.description ?? ''} · {exam.time_limit} phút · {exam.questions?.length ?? 0} câu</p>
  </div>
  <div class="actions">
    {#if $user?.role === 'student'}
      <a href="/exams/{exam.id}/take" class="btn btn-primary">Bắt đầu làm bài</a>
    {:else}
      <button class="btn {exam.is_published ? 'btn-outline' : 'btn-success'}" onclick={togglePublish} disabled={publishing}>
        {exam.is_published ? 'Gỡ xuất bản' : 'Xuất bản'}
      </button>
      <a href="/exams/{exam.id}/take" class="btn btn-outline">Xem trước</a>
    {/if}
  </div>
</div>

{#each exam.questions ?? [] as q, i}
<div class="card">
  <p class="q-num">Câu {i + 1} · {q.points} điểm</p>
  <p>{q.content}</p>
  <ul class="options">
    {#each q.options as opt}
      <li class="{q.correct_answer === opt.key ? 'correct' : ''}">
        {opt.key}. {opt.text}
        {#if q.correct_answer === opt.key && $user?.role !== 'student'} ✓{/if}
      </li>
    {/each}
  </ul>
</div>
{/each}
{/if}
