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
  let currentIdx = $state(0)

  function isAnswered(q) {
    const a = answers[q.id]
    if (!a) return false
    if (q.question_type === 'multiple') return Array.isArray(a) && a.length > 0
    return true
  }

  let answeredCount = $derived((exam?.questions ?? []).filter(q => isAnswered(q)).length)
  let totalCount = $derived(exam?.questions?.length ?? 0)
  let pct = $derived(totalCount > 0 ? Math.round(answeredCount / totalCount * 100) : 0)
  let currentQ = $derived(exam?.questions?.[currentIdx] ?? null)

  function toggleMultiAnswer(qid, key) {
    const cur = answers[qid] ?? []
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
    answers = { ...answers, [qid]: next }
  }

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
  .layout { display: grid; grid-template-columns: 1fr 240px; gap: 1.25rem; align-items: start; }

  /* top bar */
  .top-bar { display: flex; justify-content: space-between; align-items: center; background: white; padding: 0.875rem 1.25rem; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 1.25rem; }
  .exam-title { font-weight: 700; font-size: 1rem; }
  .timer { font-size: 1.25rem; font-weight: 700; color: #1e40af; font-variant-numeric: tabular-nums; }
  .timer.urgent { color: #dc2626; }

  /* progress bar */
  .progress-wrap { margin-bottom: 1.25rem; }
  .progress-meta { display: flex; justify-content: space-between; font-size: 0.85rem; color: #6b7280; margin-bottom: 0.4rem; }
  .progress-meta .pct { font-weight: 700; color: #1e40af; }
  .progress-meta .pct.done { color: #16a34a; }
  .bar-track { background: #e5e7eb; border-radius: 99px; height: 8px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 99px; background: #1e40af; transition: width 0.3s ease; }
  .bar-fill.done { background: #16a34a; }

  /* question card */
  .q-card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .q-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; }
  .q-label { font-weight: 700; font-size: 1rem; color: #1e40af; }
  .q-points { font-size: 0.8rem; color: #6b7280; }
  .q-content { font-size: 1rem; line-height: 1.6; margin-bottom: 1.25rem; }
  .options { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
  .options label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.65rem 1rem; border-radius: 8px; border: 1.5px solid #e5e7eb; transition: all 0.15s; font-size: 0.95rem; }
  .options label:hover { border-color: #93c5fd; background: #f0f9ff; }
  .options label.selected { background: #eff6ff; border-color: #1e40af; }
  .options input[type=radio] { accent-color: #1e40af; width: 16px; height: 16px; flex-shrink: 0; }
  .opt-key { font-weight: 700; color: #1e40af; min-width: 1rem; }

  /* nav buttons */
  .nav-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; gap: 0.75rem; }
  .btn { padding: 0.6rem 1.25rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: opacity 0.15s; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .btn-prev { background: #f3f4f6; color: #374151; }
  .btn-prev:not(:disabled):hover { background: #e5e7eb; }
  .btn-next { background: #1e40af; color: white; }
  .btn-next:not(:disabled):hover { background: #1d3899; }
  .q-counter { font-size: 0.85rem; color: #6b7280; }

  /* sidebar */
  .sidebar { position: sticky; top: 1rem; }
  .sidebar-card { background: white; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .sidebar-title { font-size: 0.8rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
  .q-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; margin-bottom: 1rem; }
  .q-dot { width: 100%; aspect-ratio: 1; border-radius: 6px; border: 1.5px solid #e5e7eb; background: white; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; transition: all 0.15s; }
  .q-dot:hover { border-color: #93c5fd; }
  .q-dot.answered { background: #eff6ff; border-color: #1e40af; color: #1e40af; }
  .q-dot.current { background: #1e40af; border-color: #1e40af; color: white; }
  .legend { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; font-size: 0.78rem; color: #6b7280; }
  .legend-item { display: flex; align-items: center; gap: 0.4rem; }
  .legend-dot { width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid; flex-shrink: 0; }
  .legend-dot.answered { background: #eff6ff; border-color: #1e40af; }
  .legend-dot.current { background: #1e40af; border-color: #1e40af; }
  .legend-dot.empty { background: white; border-color: #e5e7eb; }

  .btn-submit { width: 100%; background: #16a34a; color: white; padding: 0.7rem; border: none; border-radius: 6px; font-size: 0.9rem; font-weight: 700; cursor: pointer; margin-top: 0.25rem; }
  .btn-submit:hover:not(:disabled) { background: #15803d; }
  .btn-submit:disabled { opacity: 0.6; cursor: default; }

  .error { color: #dc2626; }

  @media (max-width: 680px) {
    .layout { grid-template-columns: 1fr; }
    .sidebar { position: static; }
    .q-grid { grid-template-columns: repeat(8, 1fr); }
  }
</style>

{#if loading}<p>Đang tải...</p>
{:else if error}<p class="error">{error}</p>
{:else if exam}

<div class="top-bar">
  <span class="exam-title">{exam.title}</span>
  <span class="timer {timeLeft < 60 ? 'urgent' : ''}">{formatTime(timeLeft)}</span>
</div>

<div class="progress-wrap">
  <div class="progress-meta">
    <span>{answeredCount}/{totalCount} câu đã trả lời</span>
    <span class="pct {pct === 100 ? 'done' : ''}">{pct}%</span>
  </div>
  <div class="bar-track">
    <div class="bar-fill {pct === 100 ? 'done' : ''}" style="width: {pct}%"></div>
  </div>
</div>

<div class="layout">
  <!-- main question -->
  <div>
    {#if currentQ}
    <div class="q-card">
      <div class="q-header">
        <span class="q-label">Câu {currentIdx + 1}</span>
        <span class="q-points">{currentQ.points} điểm</span>
      </div>
      <p class="q-content">{currentQ.content}</p>
      {#if currentQ.question_type === 'multiple'}
        <p style="font-size:0.82rem; color:#6b7280; margin-bottom:0.5rem">
          Chọn {currentQ.correct_count ?? '?'} đáp án đúng
        </p>
      {/if}
      <ul class="options">
        {#each currentQ.options as opt}
        <li>
          {#if currentQ.question_type === 'multiple'}
            {@const chosen = (answers[currentQ.id] ?? [])}
            <label class="{chosen.includes(opt.key) ? 'selected' : ''}">
              <input type="checkbox"
                checked={chosen.includes(opt.key)}
                onchange={() => toggleMultiAnswer(currentQ.id, opt.key)}
                style="accent-color:#1e40af; width:16px; height:16px; flex-shrink:0" />
              <span class="opt-key">{opt.key}.</span>
              {opt.text}
            </label>
          {:else}
            <label class="{answers[currentQ.id] === opt.key ? 'selected' : ''}">
              <input type="radio" name="q_{currentQ.id}" value={opt.key}
                checked={answers[currentQ.id] === opt.key}
                onchange={() => answers = { ...answers, [currentQ.id]: opt.key }} />
              <span class="opt-key">{opt.key}.</span>
              {opt.text}
            </label>
          {/if}
        </li>
        {/each}
      </ul>
    </div>
    {/if}

    <div class="nav-row">
      <button class="btn btn-prev" disabled={currentIdx === 0} onclick={() => currentIdx--}>← Câu trước</button>
      <span class="q-counter">{currentIdx + 1} / {totalCount}</span>
      <button class="btn btn-next" disabled={currentIdx === totalCount - 1} onclick={() => currentIdx++}>Câu sau →</button>
    </div>
  </div>

  <!-- sidebar -->
  <div class="sidebar">
    <div class="sidebar-card">
      <div class="sidebar-title">Danh sách câu hỏi</div>
      <div class="q-grid">
        {#each exam.questions ?? [] as q, i}
        <button
          class="q-dot {i === currentIdx ? 'current' : answers[q.id] ? 'answered' : ''}"
          onclick={() => currentIdx = i}
        >{i + 1}</button>
        {/each}
      </div>
      <div class="legend">
        <div class="legend-item"><div class="legend-dot current"></div> Đang làm</div>
        <div class="legend-item"><div class="legend-dot answered"></div> Đã trả lời</div>
        <div class="legend-item"><div class="legend-dot empty"></div> Chưa trả lời</div>
      </div>
      <button class="btn-submit" onclick={submitExam} disabled={submitting}>
        {submitting ? 'Đang nộp...' : 'Nộp bài'}
      </button>
    </div>
  </div>
</div>
{/if}
