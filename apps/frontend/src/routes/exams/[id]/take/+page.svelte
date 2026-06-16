<script>
  import { examApi, submissionApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'

  let exam = $state(null)
  let answers = $state({})
  let loading = $state(true)
  let submitting = $state(false)
  let error = $state('')
  let timeLeft = $state(0)
  let timer = null

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const id = $page.params.id
    try {
      const res = await examApi.get(id)
      if (!res.ok) { error = 'Không tìm thấy đề thi'; return }
      exam = await res.json()
      timeLeft = (exam.time_limit ?? 30) * 60
      timer = setInterval(() => {
        timeLeft--
        if (timeLeft <= 0) { clearInterval(timer); submitExam() }
      }, 1000)
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }

    return () => clearInterval(timer)
  })

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  async function submitExam() {
    clearInterval(timer)
    submitting = true
    try {
      const res = await submissionApi.submit({ exam_id: exam.id, answers })
      const data = await res.json()
      if (!res.ok) { error = data.error; submitting = false; return }
      goto(`/exams/${exam.id}/result?submissionId=${data.id}`)
    } catch {
      error = 'Lỗi khi nộp bài'
      submitting = false
    }
  }
</script>

<style>
  .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: white; padding: 1rem 1.25rem; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .timer { font-size: 1.25rem; font-weight: 700; color: #1e40af; }
  .timer.urgent { color: #dc2626; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .q-num { font-weight: 600; margin-bottom: 0.5rem; }
  .options { list-style: none; margin-top: 0.75rem; }
  .options li { margin-bottom: 0.5rem; }
  .options label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.4rem 0.75rem; border-radius: 6px; border: 1px solid #e5e7eb; }
  .options label:has(input:checked) { background: #eff6ff; border-color: #1e40af; }
  .btn-submit { background: #1e40af; color: white; padding: 0.7rem 2rem; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; width: 100%; margin-top: 1rem; }
  .btn-submit:disabled { opacity: 0.6; }
  .error { color: #dc2626; }
  .progress { color: #6b7280; font-size: 0.9rem; }
</style>

{#if loading}<p>Đang tải...</p>
{:else if error}<p class="error">{error}</p>
{:else if exam}
<div class="top-bar">
  <div>
    <strong>{exam.title}</strong>
    <p class="progress">{Object.keys(answers).length}/{exam.questions?.length} câu đã trả lời</p>
  </div>
  <span class="timer {timeLeft < 60 ? 'urgent' : ''}">{formatTime(timeLeft)}</span>
</div>

{#each exam.questions ?? [] as q, i}
<div class="card">
  <p class="q-num">Câu {i + 1} ({q.points} điểm)</p>
  <p>{q.content}</p>
  <ul class="options">
    {#each q.options as opt}
    <li>
      <label>
        <input type="radio" name="q_{q.id}" value={opt.key}
          checked={answers[q.id] === opt.key}
          onchange={() => answers = { ...answers, [q.id]: opt.key }} />
        <strong>{opt.key}.</strong> {opt.text}
      </label>
    </li>
    {/each}
  </ul>
</div>
{/each}

<button class="btn-submit" onclick={submitExam} disabled={submitting}>
  {submitting ? 'Đang nộp bài...' : 'Nộp bài'}
</button>
{/if}
