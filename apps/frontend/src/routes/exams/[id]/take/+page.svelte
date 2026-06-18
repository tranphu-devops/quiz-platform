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
  let creditError = $state('')
  let limitError = $state('')   // 429: cooldown or max_attempts
  let myCredits = $state(null)
  let timeLeft = $state(0)
  let timer = null
  let currentIdx = $state(0)
  let showConfirm = $state(false)

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function randomizeExam(e) {
    return {
      ...e,
      questions: shuffle(e.questions ?? []).map(q => ({
        ...q,
        options: shuffle(q.options ?? [])
      }))
    }
  }

  function sessionKey(id) { return `quiz-session-${id}` }
  function saveSession(id) {
    try { localStorage.setItem(sessionKey(id), JSON.stringify({ answers, timeLeft, savedAt: Date.now(), credit_deducted: true })) } catch {}
  }
  function loadSession(id) {
    try {
      const raw = localStorage.getItem(sessionKey(id))
      if (!raw) return null
      const s = JSON.parse(raw)
      s.timeLeft = Math.max(0, s.timeLeft - Math.floor((Date.now() - s.savedAt) / 1000))
      return s
    } catch { return null }
  }
  function clearSession(id) {
    try { localStorage.removeItem(sessionKey(id)) } catch {}
  }

  function isAnswered(q) {
    const a = answers[q.id]
    if (!a) return false
    if (q.question_type === 'multiple') return Array.isArray(a) && a.length > 0
    return true
  }

  let answeredCount = $derived((exam?.questions ?? []).filter(q => isAnswered(q)).length)
  let totalCount    = $derived(exam?.questions?.length ?? 0)
  let pct           = $derived(totalCount > 0 ? Math.round(answeredCount / totalCount * 100) : 0)
  let currentQ      = $derived(exam?.questions?.[currentIdx] ?? null)
  let isUrgent      = $derived(timeLeft > 0 && timeLeft < 60)

  function toggleMultiAnswer(qid, key) {
    const cur = answers[qid] ?? []
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
    answers = { ...answers, [qid]: next }
    saveSession(exam.id)
  }
  function setAnswer(qid, value) {
    answers = { ...answers, [qid]: value }
    saveSession(exam.id)
  }

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const id = $page.params.id
    try {
      const res = await examApi.get(id)
      if (!res.ok) { error = 'Không tìm thấy đề thi'; return }
      exam = randomizeExam(await res.json())

      if ($user.role === 'student' && !exam.allow_retake) {
        const subRes = await submissionApi.list({ examId: id })
        if (subRes.ok) {
          const subs = await subRes.json()
          const latest = subs[0] ?? null
          if (latest && (exam.passing_score == null || latest.percentage >= exam.passing_score)) {
            goto(`/exams/${id}`); return
          }
        }
      }

      const saved = loadSession(id)

      // Deduct credits only if no active session (first visit or after submit)
      if (!saved?.credit_deducted && $user.role === 'student') {
        const startRes = await submissionApi.start(id)
        if (startRes.status === 402) {
          const d = await startRes.json()
          creditError = d.error ?? 'Không đủ credit để làm bài này'
          return
        }
        if (startRes.status === 429) {
          const d = await startRes.json()
          limitError = d.error ?? 'Không thể bắt đầu bài thi lúc này'
          return
        }
        if (!startRes.ok) {
          error = 'Lỗi khi kiểm tra credit. Vui lòng thử lại.'
          return
        }
        const startData = await startRes.json()
        myCredits = startData.new_balance
      } else if (saved?.credit_deducted) {
        // Resume session — credits already deducted
      }

      if (saved && saved.timeLeft > 0) { answers = saved.answers; timeLeft = saved.timeLeft }
      else timeLeft = (exam.time_limit ?? 30) * 60

      // Mark session as credit deducted immediately
      saveSession(exam.id)

      timer = setInterval(() => {
        timeLeft--
        saveSession(exam.id)
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
    const m = Math.floor(s / 60), sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function requestSubmit() {
    const unanswered = (exam?.questions ?? []).filter(q => !isAnswered(q)).length
    if (unanswered > 0) { showConfirm = true; return }
    submitExam()
  }

  async function submitExam() {
    showConfirm = false; clearInterval(timer); submitting = true
    try {
      const res = await submissionApi.submit({ exam_id: exam.id, answers })
      const data = await res.json()
      if (!res.ok) { error = data.error; submitting = false; return }
      clearSession(exam.id)
      goto(`/exams/${exam.id}/result?submissionId=${data.id}`, { replaceState: true })
    } catch {
      error = 'Lỗi khi nộp bài'; submitting = false
    }
  }
</script>

<style>
  /* ── Top bar ─────────────────────────────────────────────────────────────────*/
  .top-bar {
    position: sticky; top: 60px; z-index: 30;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    padding: 0.85rem 1.25rem;
    display: flex; justify-content: space-between; align-items: center;
    gap: 1rem; margin: -2rem -1.5rem 1.5rem;
    box-shadow: 0 2px 12px rgba(99,102,241,0.06);
  }
  .exam-title {
    font-weight: 700; font-size: 0.95rem; color: var(--text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 55%;
  }
  .top-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
  .credit-badge {
    font-size: 0.78rem; font-weight: 700;
    background: #f0fdf4; color: #16a34a;
    border: 1px solid #bbf7d0; border-radius: 99px;
    padding: 0.2rem 0.65rem;
    white-space: nowrap;
  }
  .timer {
    font-size: 1.35rem; font-weight: 800; color: var(--primary);
    font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
  }
  .timer.urgent {
    color: var(--danger);
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }

  /* ── Progress ─────────────────────────────────────────────────────────────────*/
  .progress-wrap { margin-bottom: 1.5rem; }
  .progress-meta {
    display: flex; justify-content: space-between;
    font-size: 0.85rem; color: var(--muted); margin-bottom: 0.5rem; font-weight: 500;
  }
  .progress-meta .pct { color: var(--primary); font-weight: 700; }
  .progress-meta .pct.done { color: var(--success); }
  .bar-track { background: var(--border); border-radius: 99px; height: 8px; overflow: hidden; }
  .bar-fill {
    height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, var(--primary), var(--accent));
    transition: width 0.35s ease;
  }
  .bar-fill.done { background: linear-gradient(90deg, #22c55e, #16a34a); }

  /* ── Layout ───────────────────────────────────────────────────────────────────*/
  .layout { display: grid; grid-template-columns: 1fr 260px; gap: 1.5rem; align-items: start; }

  /* ── Question card ────────────────────────────────────────────────────────────*/
  .q-card {
    background: var(--surface); border-radius: var(--radius-card);
    padding: 1.75rem; box-shadow: var(--shadow);
    border: 1px solid var(--border);
  }
  .q-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
  .q-label {
    font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--primary);
    background: var(--primary-light); padding: 0.25rem 0.75rem; border-radius: 99px;
  }
  .q-points { font-size: 0.82rem; color: var(--muted); font-weight: 500; }
  .q-content { font-size: 1.05rem; line-height: 1.65; margin-bottom: 1.25rem; color: var(--text); }
  .q-image {
    display: block; max-width: 100%; max-height: 300px;
    border-radius: 10px; margin-bottom: 1.25rem; object-fit: contain;
    border: 1px solid var(--border);
  }
  .multi-hint {
    font-size: 0.8rem; color: var(--muted); margin-bottom: 0.75rem;
    background: #fef9c3; padding: 0.35rem 0.75rem; border-radius: 8px; display: inline-block;
  }

  .options { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
  .options label {
    display: flex; align-items: flex-start; gap: 0.9rem;
    cursor: pointer; padding: 0.85rem 1rem; border-radius: 12px;
    border: 1.5px solid var(--border); background: white;
    transition: all 0.15s; font-size: 0.95rem; line-height: 1.5;
    color: var(--text);
  }
  .options label:hover { border-color: var(--primary); background: var(--primary-light); }
  .options label.selected {
    border-color: var(--primary); background: var(--primary-light);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
  }
  .options input[type=radio], .options input[type=checkbox] {
    accent-color: var(--primary); width: 17px; height: 17px; flex-shrink: 0; margin-top: 2px;
  }
  .opt-key { font-weight: 700; color: var(--primary); min-width: 1.1rem; flex-shrink: 0; }

  /* ── Nav row ──────────────────────────────────────────────────────────────────*/
  .nav-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 1.25rem; gap: 0.75rem;
  }
  .btn { border: none; cursor: pointer; font-weight: 600; transition: all 0.15s; }
  .btn:disabled { opacity: 0.35; cursor: default; }
  .btn-prev {
    padding: 0.6rem 1.25rem; border-radius: var(--radius-btn);
    background: var(--bg); color: var(--text); border: 1px solid var(--border);
  }
  .btn-prev:not(:disabled):hover { border-color: var(--primary); color: var(--primary); }
  .btn-next {
    padding: 0.6rem 1.25rem; border-radius: var(--radius-btn);
    background: linear-gradient(135deg, var(--primary), var(--accent)); color: white;
    box-shadow: 0 4px 12px rgba(99,102,241,0.3);
  }
  .btn-next:not(:disabled):hover { box-shadow: 0 6px 18px rgba(99,102,241,0.4); }
  .q-counter { font-size: 0.85rem; color: var(--muted); font-weight: 500; }

  /* ── Sidebar ──────────────────────────────────────────────────────────────────*/
  .sidebar { position: sticky; top: calc(60px + 57px + 1rem); }
  .sidebar-card {
    background: var(--surface); border-radius: var(--radius-card);
    padding: 1.1rem; box-shadow: var(--shadow); border: 1px solid var(--border);
  }
  .sidebar-title {
    font-size: 0.75rem; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.85rem;
  }
  .q-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; margin-bottom: 1rem; }
  .q-dot {
    width: 100%; aspect-ratio: 1; border-radius: 8px;
    border: 1.5px solid var(--border); background: white;
    font-size: 0.72rem; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--muted); transition: all 0.15s;
  }
  .q-dot:hover { border-color: var(--primary); color: var(--primary); }
  .q-dot.answered { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
  .q-dot.current  { background: var(--primary); border-color: var(--primary); color: white; }

  .legend { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; font-size: 0.78rem; color: var(--muted); }
  .legend-item { display: flex; align-items: center; gap: 0.5rem; }
  .legend-dot { width: 11px; height: 11px; border-radius: 3px; border: 1.5px solid; flex-shrink: 0; }
  .legend-dot.answered { background: var(--primary-light); border-color: var(--primary); }
  .legend-dot.current  { background: var(--primary); border-color: var(--primary); }
  .legend-dot.empty    { background: white; border-color: var(--border); }

  .btn-submit {
    width: 100%; padding: 0.8rem;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white; border: none; border-radius: var(--radius-btn);
    font-size: 0.9rem; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 12px rgba(34,197,94,0.3);
    transition: all 0.2s;
  }
  .btn-submit:hover:not(:disabled) { box-shadow: 0 6px 18px rgba(34,197,94,0.4); }
  .btn-submit:disabled { opacity: 0.6; cursor: default; }

  /* ── Credit error ─────────────────────────────────────────────────────────────*/
  .credit-error-wrap {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 50vh; text-align: center; gap: 1rem;
  }
  .credit-error-icon { font-size: 3rem; }
  .credit-error-title { font-size: 1.3rem; font-weight: 700; color: var(--text); }
  .credit-error-msg { color: var(--muted); font-size: 0.95rem; }
  .btn-back {
    padding: 0.65rem 1.5rem; border-radius: var(--radius-btn);
    background: var(--primary); color: white; border: none;
    font-weight: 600; cursor: pointer; font-size: 0.95rem;
    transition: opacity 0.15s;
  }
  .btn-back:hover { opacity: 0.85; }

  /* ── Modal ────────────────────────────────────────────────────────────────────*/
  .overlay {
    position: fixed; inset: 0;
    background: rgba(26,23,48,0.55); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 100;
  }
  .modal {
    background: white; border-radius: 20px; padding: 2rem;
    max-width: 380px; width: 90%;
    box-shadow: 0 20px 60px rgba(99,102,241,0.2);
    border: 1px solid var(--border);
  }
  .modal h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
  .modal p { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5; }
  .modal-actions { display: flex; gap: 0.75rem; }
  .btn-outline {
    flex: 1; padding: 0.65rem; border-radius: var(--radius-btn);
    border: 1px solid var(--border); background: white; color: var(--text);
    font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  }
  .btn-outline:hover { border-color: var(--primary); color: var(--primary); }
  .btn-confirm {
    flex: 1; padding: 0.65rem; border-radius: var(--radius-btn);
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white; border: none; font-size: 0.9rem; font-weight: 700;
    cursor: pointer; transition: all 0.15s;
  }
  .btn-confirm:disabled { opacity: 0.6; cursor: default; }
  .btn-confirm:not(:disabled):hover { box-shadow: 0 4px 12px rgba(34,197,94,0.4); }

  .error { color: var(--danger); margin-top: 0.75rem; font-size: 0.9rem; }

  /* ── Mobile ───────────────────────────────────────────────────────────────────*/
  @media (max-width: 720px) {
    .top-bar { margin: -1.25rem -1rem 1.25rem; top: 60px; }
    .layout { grid-template-columns: 1fr; }
    .sidebar { position: static; }
    .q-grid { grid-template-columns: repeat(8, 1fr); overflow-x: auto; }
    .q-dot { min-width: 36px; }
  }
</style>

{#if loading}
  <div style="text-align:center;padding:4rem 0;color:var(--muted)">Đang tải đề thi...</div>
{:else if creditError}
  <div class="credit-error-wrap">
    <div class="credit-error-icon">💳</div>
    <div class="credit-error-title">Không đủ credit</div>
    <div class="credit-error-msg">{creditError}</div>
    <button class="btn-back" onclick={() => history.back()}>Quay lại</button>
  </div>
{:else if limitError}
  <div class="credit-error-wrap">
    <div class="credit-error-icon">⏳</div>
    <div class="credit-error-title">Không thể bắt đầu</div>
    <div class="credit-error-msg">{limitError}</div>
    <button class="btn-back" onclick={() => history.back()}>Quay lại</button>
  </div>
{:else if error}
  <p class="error">{error}</p>
{:else if exam}

<div class="top-bar">
  <span class="exam-title">{exam.title}</span>
  <div class="top-right">
    {#if myCredits !== null}
      <span class="credit-badge">💳 {myCredits} credit còn lại</span>
    {/if}
    <span class="timer {isUrgent ? 'urgent' : ''}">{formatTime(timeLeft)}</span>
  </div>
</div>

<div class="progress-wrap">
  <div class="progress-meta">
    <span>{answeredCount}/{totalCount} câu đã trả lời</span>
    <span class="pct {pct === 100 ? 'done' : ''}">{pct}%</span>
  </div>
  <div class="bar-track">
    <div class="bar-fill {pct === 100 ? 'done' : ''}" style="width:{pct}%"></div>
  </div>
</div>

<div class="layout">
  <div>
    {#if currentQ}
    <div class="q-card">
      <div class="q-header">
        <span class="q-label">Câu {currentIdx + 1}</span>
        <span class="q-points">{currentQ.points} điểm</span>
      </div>
      <p class="q-content">{currentQ.content}</p>
      {#if currentQ.image_url}
        <img src={currentQ.image_url} alt="Hình minh họa" class="q-image" />
      {/if}
      {#if currentQ.question_type === 'multiple'}
        <span class="multi-hint">Chọn {currentQ.correct_count ?? '?'} đáp án đúng</span>
      {/if}
      <ul class="options">
        {#each currentQ.options as opt}
        <li>
          {#if currentQ.question_type === 'multiple'}
            {@const chosen = (answers[currentQ.id] ?? [])}
            <label class="{chosen.includes(opt.key) ? 'selected' : ''}">
              <input type="checkbox"
                checked={chosen.includes(opt.key)}
                onchange={() => toggleMultiAnswer(currentQ.id, opt.key)} />
              <span class="opt-key">{opt.key}.</span>
              {opt.text}
            </label>
          {:else}
            <label class="{answers[currentQ.id] === opt.key ? 'selected' : ''}">
              <input type="radio" name="q_{currentQ.id}" value={opt.key}
                checked={answers[currentQ.id] === opt.key}
                onchange={() => setAnswer(currentQ.id, opt.key)} />
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
    {#if error}<p class="error">{error}</p>{/if}
  </div>

  <div class="sidebar">
    <div class="sidebar-card">
      <div class="sidebar-title">Danh sách câu hỏi</div>
      <div class="q-grid">
        {#each exam.questions ?? [] as q, i}
          <button
            class="q-dot {i === currentIdx ? 'current' : isAnswered(q) ? 'answered' : ''}"
            onclick={() => currentIdx = i}
          >{i + 1}</button>
        {/each}
      </div>
      <div class="legend">
        <div class="legend-item"><div class="legend-dot current"></div>Đang làm</div>
        <div class="legend-item"><div class="legend-dot answered"></div>Đã trả lời</div>
        <div class="legend-item"><div class="legend-dot empty"></div>Chưa trả lời</div>
      </div>
      <button class="btn-submit" onclick={requestSubmit} disabled={submitting}>
        {submitting ? 'Đang nộp...' : 'Nộp bài'}
      </button>
    </div>
  </div>
</div>
{/if}

{#if showConfirm}
{@const unanswered = (exam?.questions ?? []).filter(q => !isAnswered(q)).length}
<div class="overlay" role="dialog" aria-modal="true">
  <div class="modal">
    <h3>Xác nhận nộp bài</h3>
    <p>Còn <strong>{unanswered} câu chưa trả lời</strong>. Những câu này sẽ bị tính 0 điểm. Bạn có chắc muốn nộp?</p>
    <div class="modal-actions">
      <button class="btn-outline" onclick={() => showConfirm = false}>Làm tiếp</button>
      <button class="btn-confirm" onclick={submitExam} disabled={submitting}>
        {submitting ? 'Đang nộp...' : 'Xác nhận nộp'}
      </button>
    </div>
  </div>
</div>
{/if}
