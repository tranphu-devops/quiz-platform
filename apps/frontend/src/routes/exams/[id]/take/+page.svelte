<script>
  import { examApi, submissionApi, userApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/stores'

  let exam = $state(null)
  let answers = $state({})
  let loading = $state(true)
  let submitting = $state(false)
  let error = $state('')
  let creditError = $state('')
  let limitError = $state('')   // 429: cooldown or max_attempts
  let myCredits = $state(null)
  let currentCredits = $state(null)
  let showStartConfirm = $state(false)
  let timeLeft = $state(0)
  let timer = null
  let currentIdx = $state(0)
  let showConfirm = $state(false)
  // One scratch note for the whole exam session — shared across all questions,
  // unchanged when navigating between them. Kept in memory only (not persisted;
  // lost on refresh). Hidden by default, toggled via a floating button.
  let note = $state('')
  let showNote = $state(false)
  let _examId = null

  // Set after a successful start — used for progress saves and submit
  let submissionId = null
  let expiresAt = null
  // In-memory only (not localStorage): per-tab exam session token.
  // Sent as x-exam-session header; server rejects saves from mismatched sessions.
  let sessionId = null
  let heartbeatTimer = null
  let sessionConflict = $state(false)

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
    try {
      localStorage.setItem(sessionKey(id), JSON.stringify({
        answers, timeLeft, savedAt: Date.now(),
        submission_id: submissionId,
        expires_at: expiresAt,
        session_id: sessionId  // persisted so same browser can reclaim on reload
      }))
    } catch {}
  }

  function loadSession(id) {
    try {
      const raw = localStorage.getItem(sessionKey(id))
      if (!raw) return null
      const s = JSON.parse(raw)
      // Use server-authoritative expires_at when available
      if (s.expires_at) {
        s.timeLeft = Math.max(0, Math.floor((new Date(s.expires_at) - Date.now()) / 1000))
      } else {
        s.timeLeft = Math.max(0, s.timeLeft - Math.floor((Date.now() - s.savedAt) / 1000))
      }
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

  // Called on "Câu sau →" — saves progress to backend (fire-and-forget) then advances
  function goNext() {
    if (submissionId) {
      submissionApi.saveProgress(submissionId, answers, sessionId).catch(() => {})
    }
    currentIdx++
  }

  onDestroy(() => { clearInterval(timer); clearInterval(heartbeatTimer) })

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const id = $page.params.id
    _examId = id
    try {
      const res = await examApi.get(id)
      if (!res.ok) { error = 'Không tìm thấy đề thi'; loading = false; return }
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

      // Same-device resume: localStorage has a submission_id — verify it server-side
      if (saved?.submission_id && $user.role === 'student') {
        const subRes = await submissionApi.get(saved.submission_id)
        if (subRes.ok) {
          const sub = await subRes.json()
          if (sub.status === 'completed' || sub.status === 'timed_out') {
            clearSession(id)
            goto(`/exams/${id}/result?submissionId=${sub.id}`, { replaceState: true })
            return
          }
          // Still in_progress — restore session_id from localStorage (same browser = same session)
          submissionId = sub.id
          expiresAt = sub.expires_at
          sessionId = saved.session_id ?? null
          const merged = { ...(sub.answers ?? {}), ...(saved.answers ?? {}) }
          await _beginExam(id, { ...saved, answers: merged })
          return
        }
        // Stale session — clear and fall through to cross-device check
        clearSession(id)
      }

      // Cross-device / re-login resume: no localStorage — check server for an active submission.
      // Handles the case where user lost the tab, cleared browser data, or switched device.
      if ($user.role === 'student') {
        const activeRes = await submissionApi.getActive(id).catch(() => null)
        if (activeRes?.status === 423) {
          // Another device is actively taking this exam
          sessionConflict = true
          loading = false
          return
        }
        if (activeRes?.ok) {
          const activeSub = await activeRes.json()
          submissionId = activeSub.id
          expiresAt = activeSub.expires_at
          sessionId = activeSub.session_id ?? null
          const remaining = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000))
          await _beginExam(id, { answers: activeSub.answers ?? {}, timeLeft: remaining })
          return
        }
      }

      // No server-side in_progress submission was resumed above → this is a fresh
      // attempt. Always route students through the confirm dialog → /start so credit
      // is charged. /start is idempotent: if an in_progress row still exists it
      // resumes without charging again (credit_cost: 0). Never trust a localStorage
      // flag to skip the charge — that was the credit-leak path.
      if ($user.role === 'student') {
        const profileRes = await userApi.getProfile($user.id).catch(() => null)
        if (profileRes?.ok) {
          const p = await profileRes.json()
          currentCredits = p.credits ?? null
        }
        showStartConfirm = true
        loading = false
        return
      }

      await _beginExam(id, saved)
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }
  })

  async function handleConfirmStart() {
    showStartConfirm = false
    loading = true
    const id = _examId
    try {
      const startRes = await submissionApi.start(id)
      if (startRes.status === 402) {
        const d = await startRes.json()
        creditError = d.error ?? 'Không đủ credit để làm bài này'
        loading = false; return
      }
      if (startRes.status === 423) {
        const d = await startRes.json()
        if (d.reason === 'session_conflict') {
          sessionConflict = true
          loading = false; return
        }
        limitError = d.error ?? 'Đề thi chưa mở. Vui lòng quay lại sau.'
        loading = false; return
      }
      if (startRes.status === 429) {
        const d = await startRes.json()
        limitError = d.error ?? 'Không thể bắt đầu bài thi lúc này'
        loading = false; return
      }
      if (!startRes.ok) {
        error = 'Lỗi khi kiểm tra credit. Vui lòng thử lại.'
        loading = false; return
      }
      const startData = await startRes.json()
      if (startData.new_balance !== null) myCredits = startData.new_balance
      submissionId = startData.submission_id
      expiresAt = startData.expires_at
      sessionId = startData.session_id ?? null
      await _beginExam(id, null)
    } catch {
      error = 'Không thể kết nối server'
      loading = false
    }
  }

  async function _beginExam(id, saved) {
    if (saved?.answers) answers = saved.answers
    timeLeft = saved?.timeLeft > 0 ? saved.timeLeft : (exam.time_limit ?? 30) * 60
    saveSession(exam.id)
    // Touch session immediately so server sees it as active
    if (submissionId) submissionApi.saveProgress(submissionId, answers, sessionId).catch(() => {})
    timer = setInterval(() => {
      timeLeft--
      saveSession(exam.id)
      if (timeLeft <= 0) { clearInterval(timer); clearInterval(heartbeatTimer); submitExam() }
    }, 1000)
    // Heartbeat every 30s — keeps session alive even when user is reading (not clicking Next)
    heartbeatTimer = setInterval(async () => {
      if (!submissionId) return
      const res = await submissionApi.saveProgress(submissionId, answers, sessionId).catch(() => null)
      if (res?.status === 409) {
        const d = await res.json().catch(() => ({}))
        if (d.reason === 'session_conflict') {
          clearInterval(timer); clearInterval(heartbeatTimer)
          sessionConflict = true
        }
      }
    }, 30000)
    loading = false
  }

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
    showConfirm = false
    // No active submission means the credit/start gate never ran — never grade for free.
    if (!submissionId) {
      error = 'Phiên làm bài không hợp lệ. Vui lòng bắt đầu lại đề thi.'
      return
    }
    clearInterval(timer); clearInterval(heartbeatTimer); submitting = true
    try {
      const res = await submissionApi.submitById(submissionId, answers, sessionId)
      if (res.status === 409) {
        const d = await res.json().catch(() => ({}))
        if (d.reason === 'session_conflict') {
          sessionConflict = true; submitting = false; return
        }
        // Batch grader already graded it — redirect to result
        clearSession(exam.id)
        goto(`/exams/${exam.id}/result?submissionId=${submissionId}`, { replaceState: true })
        return
      }
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
    position: sticky; top: 0; z-index: 30;
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
    border: 1.5px solid var(--border); background: var(--surface);
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
  /* ── Floating scratch-note widget ─────────────────────────────────────────────*/
  .note-widget {
    position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 50;
    display: flex; flex-direction: column; align-items: flex-end; gap: 0.6rem;
  }
  .note-fab {
    display: inline-flex; align-items: center; gap: 0.35rem; position: relative;
    background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff;
    border: none; border-radius: 99px; cursor: pointer;
    padding: 0.65rem 1.1rem; font-size: 0.9rem; font-weight: 700;
    box-shadow: 0 6px 20px rgba(86,37,209,0.35); transition: transform 0.12s, box-shadow 0.15s;
  }
  .note-fab:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(86,37,209,0.45); }
  .note-fab.active { background: var(--surface); color: var(--text); border: 1px solid var(--border); box-shadow: var(--shadow); }
  .note-fab-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #fbbf24;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.6);
  }
  .note-panel {
    width: min(340px, calc(100vw - 2.5rem));
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: 0 16px 44px rgba(0,0,0,0.22);
    padding: 0.9rem; display: flex; flex-direction: column; gap: 0.55rem;
  }
  .note-panel-head { display: flex; align-items: center; justify-content: space-between; }
  .note-panel-title { font-size: 0.85rem; font-weight: 700; color: var(--text); }
  .note-panel-close {
    background: none; border: none; cursor: pointer; color: var(--muted);
    font-size: 0.95rem; line-height: 1; padding: 0.15rem 0.3rem; border-radius: 6px;
  }
  .note-panel-close:hover { color: var(--text); background: var(--bg); }
  .note-panel-area {
    width: 100%; box-sizing: border-box; resize: vertical; min-height: 140px;
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 0.6rem 0.7rem; font: inherit; font-size: 0.88rem; line-height: 1.5;
  }
  .note-panel-area:focus { outline: none; border-color: var(--primary); }
  .note-panel-hint { font-size: 0.72rem; color: var(--muted); margin: 0; }

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
    border: 1.5px solid var(--border); background: var(--surface);
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
  .legend-dot.empty    { background: var(--surface); border-color: var(--border); }

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
    background: var(--surface); border-radius: 20px; padding: 2rem;
    max-width: 380px; width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    border: 1px solid var(--border);
  }
  .modal h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text); }
  .modal p { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5; }
  .modal-actions { display: flex; gap: 0.75rem; }
  .btn-outline {
    flex: 1; padding: 0.65rem; border-radius: var(--radius-btn);
    border: 1px solid var(--border); background: var(--surface); color: var(--text);
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

  /* ── Start confirmation ───────────────────────────────────────────────────────*/
  .start-confirm-wrap {
    min-height: 60vh; display: flex; align-items: center; justify-content: center;
    padding: 2rem 1rem;
  }
  .start-confirm-card {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border); box-shadow: var(--shadow);
    padding: 2.5rem 2rem; max-width: 440px; width: 100%; text-align: center;
  }
  .start-confirm-icon { font-size: 2.5rem; margin-bottom: 1rem; }
  .start-confirm-title {
    font-size: 1.2rem; font-weight: 700; color: var(--text);
    margin-bottom: 0.5rem; line-height: 1.4;
  }
  .start-confirm-sub { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
  .start-confirm-info {
    background: var(--bg); border-radius: 12px;
    border: 1px solid var(--border); padding: 1rem;
    margin-bottom: 1.25rem; text-align: left;
  }
  .info-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.45rem 0;
    border-bottom: 1px solid var(--border);
  }
  .info-row:last-child { border-bottom: none; }
  .info-row.highlight { background: rgba(99,102,241,0.04); margin: 0 -0.5rem; padding: 0.55rem 0.5rem; border-radius: 8px; border-bottom: none; }
  .info-label { font-size: 0.87rem; color: var(--muted); font-weight: 500; }
  .info-val { font-size: 0.9rem; font-weight: 700; color: var(--text); }
  .info-val.credit-cost { color: var(--primary); font-size: 1rem; }
  .info-val.text-danger { color: var(--danger); }
  .start-confirm-note {
    font-size: 0.82rem; color: var(--muted); margin-bottom: 1.75rem; line-height: 1.5;
  }
  .start-confirm-actions { display: flex; gap: 0.75rem; }
  .btn-start {
    flex: 2; padding: 0.8rem 1.25rem; border-radius: var(--radius-btn);
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: white; border: none; font-size: 0.95rem; font-weight: 700;
    cursor: pointer; transition: all 0.15s;
  }
  .btn-start:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn-start:not(:disabled):hover { box-shadow: 0 4px 16px rgba(99,102,241,0.4); transform: translateY(-1px); }

  /* ── Mobile ───────────────────────────────────────────────────────────────────*/
  @media (max-width: 720px) {
    .top-bar { margin: -1.25rem -1rem 1.25rem; top: var(--mobile-bar-h, 56px); }
    .layout { grid-template-columns: 1fr; }
    .sidebar { position: static; }
    .q-grid { grid-template-columns: repeat(8, 1fr); overflow-x: auto; }
    .q-dot { min-width: 36px; }
  }

  /* ── Session conflict overlay ────────────────────────────────────────────────*/
  .session-conflict-wrap {
    min-height: 60vh; display: flex; align-items: center; justify-content: center;
    padding: 2rem 1rem;
  }
  .session-conflict-card {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid #fca5a544; box-shadow: 0 8px 32px rgba(239,68,68,0.12);
    padding: 2.5rem 2rem; max-width: 420px; width: 100%; text-align: center;
  }
  .session-conflict-icon { font-size: 2.8rem; margin-bottom: 1rem; }
  .session-conflict-title { font-size: 1.2rem; font-weight: 800; color: var(--text); margin-bottom: 0.6rem; }
  .session-conflict-msg { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.75rem; line-height: 1.6; }
</style>

{#if sessionConflict}
  <div class="session-conflict-wrap">
    <div class="session-conflict-card">
      <div class="session-conflict-icon">🔒</div>
      <div class="session-conflict-title">Bài thi đang mở trên thiết bị khác</div>
      <div class="session-conflict-msg">
        Tài khoản này đang làm bài thi trên một thiết bị hoặc trình duyệt khác.<br>
        Mỗi tài khoản chỉ được phép làm bài trên một thiết bị tại một thời điểm.<br><br>
        Nếu thiết bị đó gặp sự cố hoặc bị đóng, vui lòng thử lại sau vài phút.
      </div>
      <button class="btn-back" onclick={() => goto(`/exams/${_examId}`)}>Quay lại đề thi</button>
    </div>
  </div>
{:else if loading}
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
{:else if showStartConfirm && exam}
  <div class="start-confirm-wrap">
    <div class="start-confirm-card">
      <div class="start-confirm-icon">📋</div>
      <h2 class="start-confirm-title">{exam.title}</h2>
      <p class="start-confirm-sub">Bạn sắp bắt đầu bài thi. Thông tin quan trọng:</p>
      <div class="start-confirm-info">
        <div class="info-row">
          <span class="info-label">Thời gian</span>
          <span class="info-val">{exam.time_limit ?? 30} phút</span>
        </div>
        <div class="info-row">
          <span class="info-label">Số câu hỏi</span>
          <span class="info-val">{exam.question_count ?? exam.questions?.length ?? '?'} câu</span>
        </div>
        {#if exam.passing_score != null}
        <div class="info-row">
          <span class="info-label">Điểm đậu</span>
          <span class="info-val">{exam.passing_score}%</span>
        </div>
        {/if}
        <div class="info-row highlight">
          <span class="info-label">💳 Chi phí</span>
          <span class="info-val credit-cost">{exam.credit_cost ?? 10} credit</span>
        </div>
        {#if currentCredits !== null}
        <div class="info-row">
          <span class="info-label">Số dư hiện tại</span>
          <span class="info-val {currentCredits < (exam.credit_cost ?? 10) ? 'text-danger' : ''}">{currentCredits} credit</span>
        </div>
        {/if}
      </div>
      <p class="start-confirm-note">Sau khi bắt đầu, credit sẽ bị trừ và đồng hồ đếm ngược sẽ chạy. Mỗi câu trả lời được tự động lưu khi bạn chuyển sang câu tiếp theo.</p>
      <div class="start-confirm-actions">
        <button class="btn-back" onclick={() => history.back()}>Huỷ</button>
        <button class="btn-start" onclick={handleConfirmStart}
          disabled={currentCredits !== null && currentCredits < (exam.credit_cost ?? 10)}>
          {currentCredits !== null && currentCredits < (exam.credit_cost ?? 10) ? 'Không đủ credit' : 'Xác nhận bắt đầu →'}
        </button>
      </div>
    </div>
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
      <button class="btn btn-next" disabled={currentIdx === totalCount - 1} onclick={goNext}>Câu sau →</button>
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

<!-- Floating scratch note: one note for the whole exam, hidden by default -->
<div class="note-widget">
  {#if showNote}
    <div class="note-panel">
      <div class="note-panel-head">
        <span class="note-panel-title">📝 Ghi chú nháp</span>
        <button class="note-panel-close" onclick={() => (showNote = false)} aria-label="Ẩn ghi chú">✕</button>
      </div>
      <textarea
        class="note-panel-area"
        bind:value={note}
        placeholder="Ghi chú dùng chung cho cả bài thi — giữ nguyên khi bạn chuyển câu..."
      ></textarea>
      <p class="note-panel-hint">Chỉ hỗ trợ khi làm bài · sẽ mất khi tải lại trang (F5), không được lưu.</p>
    </div>
  {/if}
  <button class="note-fab {showNote ? 'active' : ''}" onclick={() => (showNote = !showNote)}>
    {#if showNote}✕ Ẩn ghi chú{:else}📝 Ghi chú{#if note.trim()}<span class="note-fab-dot"></span>{/if}{/if}
  </button>
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
