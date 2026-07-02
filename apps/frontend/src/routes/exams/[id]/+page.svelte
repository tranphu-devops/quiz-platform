<script>
  import { examApi, submissionApi, userApi, commentApi, likeApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { marked } from 'marked'

  let now = $state(Date.now())
  onMount(() => {
    const t = setInterval(() => { now = Date.now() }, 1000)
    return () => clearInterval(t)
  })

  let exam = $state(null)
  let mySubmissions = $state([])
  let myCredits = $state(null)
  let loading = $state(true)
  let error = $state('')
  let publishing = $state(false)
  let expandedExpl = $state(new Set())

  const mySubmission = $derived(mySubmissions[0] ?? null)
  const isTeacher = $derived($user?.role === 'teacher' || $user?.role === 'admin')
  const isScheduledLocked = $derived(
    exam?.scheduled_at && new Date(exam.scheduled_at).getTime() > now
  )
  const scheduledCountdown = $derived.by(() => {
    if (!exam?.scheduled_at) return null
    const diff = new Date(exam.scheduled_at).getTime() - now
    if (diff <= 0) return null
    const s = Math.floor(diff / 1000)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const parts = []
    if (d > 0) parts.push(`${d} ngày`)
    if (h > 0 || d > 0) parts.push(`${h} giờ`)
    if (m > 0 || h > 0 || d > 0) parts.push(`${m} phút`)
    parts.push(`${sec < 10 ? '0' : ''}${sec} giây`)
    return parts.join(' ')
  })
  const hasPassed = $derived(
    mySubmission != null && (exam?.passing_score == null || mySubmission.percentage >= exam.passing_score)
  )
  const canStart = $derived(!mySubmission || !!exam?.allow_retake || !hasPassed)
  const creditCost = $derived(exam?.credit_cost ?? 10)
  const hasEnoughCredits = $derived(myCredits === null || myCredits >= creditCost)
  const previewQuestions = $derived((exam?.questions ?? []).slice(0, 3))
  const totalQuestions = $derived(exam?.question_count ?? exam?.questions?.length ?? 0)
  const hiddenCount = $derived(totalQuestions - previewQuestions.length)

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const id = $page.params.id
    try {
      // Students get preview (first 3 questions only); teachers/admins get full
      const res = $user.role === 'student'
        ? await examApi.getPreview(id)
        : await examApi.get(id)
      if (!res.ok) { error = 'Không tìm thấy đề thi'; return }
      exam = await res.json()

      if ($user.role === 'student') {
        const [subRes, profileRes] = await Promise.all([
          submissionApi.list({ examId: id }),
          userApi.getProfile($user.id)
        ])
        if (subRes.ok) mySubmissions = await subRes.json()
        if (profileRes.ok) {
          const profile = await profileRes.json()
          myCredits = profile.credits ?? null
        }
      }
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      loading = false
    }

    // Likes + comments load for everyone (independent of role/errors above)
    await Promise.all([loadSummary(id), loadComments(id, 1)])
  })

  // ── Likes + comments ──────────────────────────────────────────────────────
  let likeCount = $state(0)
  let liked = $state(false)
  let commentCount = $state(0)
  let likeBusy = $state(false)

  let comments = $state([])
  let commentPage = $state(1)
  let commentTotalPages = $state(1)
  let commentsLoading = $state(false)
  let newComment = $state('')
  let postingComment = $state(false)
  let editingId = $state(null)
  let editContent = $state('')

  const isStudent = $derived($user?.role === 'student')

  async function loadSummary(id) {
    try {
      const res = await commentApi.summary(id)
      if (res.ok) {
        const s = await res.json()
        likeCount = s.like_count
        liked = s.liked
        commentCount = s.comment_count
      }
    } catch {}
  }

  async function loadComments(id, p = 1) {
    commentsLoading = true
    try {
      const res = await commentApi.list(id, p)
      if (res.ok) {
        const data = await res.json()
        comments = data.comments
        commentPage = data.page
        commentTotalPages = data.total_pages
        commentCount = data.total
      }
    } catch {} finally {
      commentsLoading = false
    }
  }

  async function toggleLike() {
    if (!isStudent || likeBusy) return
    likeBusy = true
    try {
      const res = await likeApi.toggle(exam.id)
      if (res.ok) {
        const d = await res.json()
        liked = d.liked
        likeCount = d.like_count
      }
    } finally {
      likeBusy = false
    }
  }

  async function postComment() {
    const content = newComment.trim()
    if (!content || postingComment) return
    postingComment = true
    try {
      const res = await commentApi.create(exam.id, content)
      if (res.ok) {
        newComment = ''
        await loadComments(exam.id, 1)
      }
    } finally {
      postingComment = false
    }
  }

  function startEdit(c) {
    editingId = c.id
    editContent = c.content
  }

  async function saveEdit(c) {
    const content = editContent.trim()
    if (!content) return
    const res = await commentApi.update(c.id, content)
    if (res.ok) {
      editingId = null
      await loadComments(exam.id, commentPage)
    }
  }

  async function deleteComment(c) {
    const res = await commentApi.remove(c.id)
    if (res.ok) {
      // If last item on a page beyond the first, step back a page
      const targetPage = comments.length === 1 && commentPage > 1 ? commentPage - 1 : commentPage
      await loadComments(exam.id, targetPage)
      await loadSummary(exam.id)
    }
  }

  function canModerate(c) {
    return c.user_id === $user?.id || $user?.role === 'admin'
  }

  async function togglePublish() {
    publishing = true
    try {
      await examApi.update(exam.id, { is_published: !exam.is_published })
      exam = { ...exam, is_published: !exam.is_published }
    } finally {
      publishing = false
    }
  }

  function toggleExpl(i) {
    const next = new Set(expandedExpl)
    next.has(i) ? next.delete(i) : next.add(i)
    expandedExpl = next
  }

  function correctAnswers(q) {
    if (q.question_type === 'multiple') return (q.correct_answer ?? '').split(',').filter(Boolean)
    return q.correct_answer ? [q.correct_answer] : []
  }

  function fmtDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
</script>

<style>
  /* ── Hero ─────────────────────────────────────────────────────────────────────*/
  .hero {
    position: relative; border-radius: var(--radius-card); overflow: hidden;
    margin-bottom: 1.75rem; min-height: 200px;
    display: flex; flex-direction: column; justify-content: flex-end;
    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  }
  .hero-img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; display: block;
  }
  .hero-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(26,23,72,0.88) 0%, rgba(26,23,72,0.35) 60%, transparent 100%);
  }
  .hero-body {
    position: relative; z-index: 1; padding: 1.75rem 1.5rem 1.5rem;
  }
  .hero-top { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
  .badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700;
  }
  .badge-published  { background: rgba(34,197,94,0.2); color: #86efac; border: 1px solid rgba(134,239,172,0.3); }
  .badge-draft      { background: rgba(251,191,36,0.2); color: #fde68a; border: 1px solid rgba(253,230,138,0.3); }
  .badge-scheduled  { background: rgba(124,58,237,0.25); color: #c4b5fd; border: 1px solid rgba(196,181,253,0.3); }
  .hero h1 {
    font-size: clamp(1.2rem, 3vw, 1.65rem); font-weight: 800;
    color: #fff; line-height: 1.3; margin-bottom: 0.6rem;
  }
  .hero-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .hero-tag {
    background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9);
    border: 1px solid rgba(255,255,255,0.2); border-radius: 99px;
    padding: 0.15rem 0.6rem; font-size: 0.78rem;
  }
  .hero-social { display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; }
  .like-btn {
    display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
    background: rgba(255,255,255,0.15); color: #fff; font-weight: 700;
    border: 1px solid rgba(255,255,255,0.25); border-radius: 99px;
    padding: 0.35rem 0.85rem; font-size: 0.85rem; transition: background 0.15s, transform 0.1s;
  }
  .like-btn:hover:not(:disabled) { background: rgba(255,255,255,0.28); }
  .like-btn:active:not(:disabled) { transform: scale(0.94); }
  .like-btn.liked { background: rgba(244,63,94,0.25); border-color: rgba(244,63,94,0.5); }
  .like-btn.readonly { cursor: default; }
  .like-btn:disabled { opacity: 0.85; }
  .like-heart { font-size: 1rem; line-height: 1; }
  .hero-social-stat {
    color: rgba(255,255,255,0.9); font-size: 0.85rem; font-weight: 600;
    text-decoration: none;
  }
  .hero-social-stat:hover { color: #fff; text-decoration: underline; }

  /* ── Comments ────────────────────────────────────────────────────────────────*/
  .comments-wrap {
    margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border);
    max-width: 760px;
  }
  .comment-composer { margin-bottom: 1.5rem; }
  .comment-composer textarea, .comment-body textarea {
    width: 100%; box-sizing: border-box; resize: vertical;
    background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 0.7rem 0.85rem; font: inherit; font-size: 0.9rem;
  }
  .comment-composer textarea:focus, .comment-body textarea:focus {
    outline: none; border-color: var(--primary);
  }
  .composer-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .comment-list { display: flex; flex-direction: column; gap: 1.1rem; }
  .comment-item { display: flex; gap: 0.75rem; }
  .comment-avatar {
    flex: 0 0 40px; width: 40px; height: 40px; border-radius: 50%;
    overflow: hidden; background: linear-gradient(135deg, var(--primary), var(--accent));
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700;
  }
  .comment-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .comment-body { flex: 1; min-width: 0; }
  .comment-meta { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 0.2rem; }
  .comment-author { font-weight: 700; font-size: 0.9rem; color: var(--text); }
  .comment-date { font-size: 0.75rem; color: var(--muted); }
  .comment-content { font-size: 0.9rem; line-height: 1.5; color: var(--text); white-space: pre-wrap; word-break: break-word; }
  .comment-tools { display: flex; gap: 0.75rem; margin-top: 0.35rem; }
  .comment-tools button {
    background: none; border: none; padding: 0; cursor: pointer;
    font-size: 0.78rem; color: var(--muted); font-weight: 600;
  }
  .comment-tools button:hover { color: var(--primary); }
  .comment-tools button.danger:hover { color: var(--danger); }
  .comment-pager {
    display: flex; align-items: center; justify-content: center; gap: 1rem;
    margin-top: 1.5rem; font-size: 0.85rem; color: var(--muted);
  }
  .comment-pager button:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Two-column layout ────────────────────────────────────────────────────────*/
  .layout {
    display: grid;
    grid-template-columns: 1fr 310px;
    gap: 1.5rem;
    align-items: start;
  }
  /* On mobile: sidebar first, then main */
  @media (max-width: 768px) {
    .layout { grid-template-columns: 1fr; }
    .sidebar { order: -1; }
  }

  /* ── Action sidebar ───────────────────────────────────────────────────────────*/
  .sidebar { position: sticky; top: calc(60px + 1rem); }
  .action-card {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border); box-shadow: var(--shadow);
    overflow: hidden;
  }
  .action-header {
    background: linear-gradient(135deg, var(--primary), var(--accent));
    padding: 1.1rem 1.25rem;
  }
  .action-title { color: #fff; font-size: 0.8rem; font-weight: 600; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem; }
  .action-price {
    color: #fff; font-size: 1.5rem; font-weight: 800; display: flex; align-items: baseline; gap: 0.3rem;
  }
  .action-price span { font-size: 0.85rem; font-weight: 400; opacity: 0.75; }
  .action-body { padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: 0.65rem; }

  /* Stats grid */
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.25rem; }
  .stat-item { background: var(--bg); border-radius: 10px; padding: 0.6rem 0.75rem; }
  .stat-label { font-size: 0.7rem; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.15rem; }
  .stat-value { font-size: 1rem; font-weight: 700; color: var(--text); }

  /* Status strip */
  .status-strip {
    border-radius: 10px; padding: 0.75rem 1rem;
    display: flex; align-items: center; gap: 0.6rem; font-size: 0.88rem; font-weight: 600;
  }
  .status-strip.passed { background: #f0fdf4; color: #15803d; border: 1px solid #86efac; }
  .status-strip.failed { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
  .status-strip.pending { background: var(--primary-light); color: var(--primary-dark); border: 1px solid var(--border); }
  .status-strip-icon { font-size: 1.1rem; flex-shrink: 0; }

  /* Credit info */
  .credit-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
  .credit-ok { color: #15803d; font-weight: 600; }
  .credit-bad { color: #dc2626; font-weight: 600; }

  /* Action buttons */
  .btn-block {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    width: 100%; padding: 0.8rem 1rem; border-radius: var(--radius-btn);
    font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: all 0.15s;
    text-decoration: none; border: none;
  }
  .btn-primary { background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff; box-shadow: 0 4px 14px rgba(99,102,241,0.35); }
  .btn-primary:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(99,102,241,0.5); transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.5; cursor: default; transform: none; box-shadow: none; }
  .btn-success { background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; box-shadow: 0 4px 14px rgba(34,197,94,0.3); }
  .btn-success:hover { box-shadow: 0 6px 20px rgba(34,197,94,0.45); transform: translateY(-1px); }
  .btn-outline {
    background: transparent; color: var(--primary);
    border: 1.5px solid var(--primary); box-shadow: none;
  }
  .btn-outline:hover { background: var(--primary-light); }
  .btn-ghost {
    background: var(--bg); color: var(--muted);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
  .divider { border: none; border-top: 1px solid var(--border); margin: 0; }

  /* ── Main column ──────────────────────────────────────────────────────────────*/
  .section { margin-bottom: 1.75rem; }
  .section-title {
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); margin-bottom: 0.85rem;
    display: flex; align-items: center; gap: 0.5rem;
  }
  .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* Question preview cards */
  .q-card {
    background: var(--surface); border-radius: 12px;
    border: 1px solid var(--border); padding: 1.1rem 1.25rem;
    margin-bottom: 0.6rem; box-shadow: 0 1px 6px rgba(99,102,241,0.05);
  }
  .q-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
  .q-num-badge {
    width: 26px; height: 26px; border-radius: 50%;
    background: var(--primary-light); color: var(--primary);
    font-size: 0.78rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .q-content { font-size: 0.95rem; line-height: 1.6; color: var(--text); flex: 1; }
  .q-type { font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 99px; flex-shrink: 0; }
  .q-type.single { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .q-type.multi  { background: #fefce8; color: #ca8a04; border: 1px solid #fde68a; }
  .q-options { list-style: none; margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .q-options li {
    font-size: 0.88rem; color: var(--muted); padding: 0.3rem 0.6rem;
    border-radius: 6px; border: 1px solid var(--border); background: var(--bg);
  }
  .q-options .opt-key { font-weight: 700; color: var(--primary); margin-right: 0.3rem; }

  /* More questions teaser */
  .more-teaser {
    background: var(--surface); border-radius: 12px;
    border: 1px dashed var(--border); padding: 1rem 1.25rem;
    text-align: center; color: var(--muted); font-size: 0.875rem;
  }
  .more-teaser strong { color: var(--primary); }

  /* Teacher full question list */
  .teacher-q-card {
    background: var(--surface); border-radius: 12px;
    border: 1px solid var(--border); padding: 1.1rem 1.25rem;
    margin-bottom: 0.6rem;
  }
  .correct-opt { color: #15803d; font-weight: 600; }
  .expl-toggle { background: none; border: none; color: var(--muted); font-size: 0.8rem; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px; margin-top: 0.4rem; }
  .expl-toggle:hover { background: var(--bg); }
  .expl-box { margin-top: 0.5rem; background: var(--bg); border-left: 3px solid #93c5fd; padding: 0.6rem 0.75rem; border-radius: 0 8px 8px 0; font-size: 0.88rem; line-height: 1.6; }
  .expl-box :global(p) { margin: 0 0 0.4rem; }
  .expl-box :global(p:last-child) { margin: 0; }
  .expl-box :global(code) { background: #e5e7eb; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.88em; }

  /* Result status in main column (student, after submission) */
  .result-banner {
    border-radius: var(--radius-card); padding: 1.25rem 1.5rem;
    display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;
  }
  .result-banner.passed { background: #f0fdf4; border: 1.5px solid #86efac; }
  .result-banner.failed { background: #fef2f2; border: 1.5px solid #fca5a5; }
  .result-icon { font-size: 2rem; flex-shrink: 0; }
  .result-info { flex: 1; }
  .result-title { font-weight: 700; font-size: 1rem; margin-bottom: 0.2rem; }
  .result-title.passed { color: #15803d; }
  .result-title.failed { color: #dc2626; }
  .result-score { font-size: 0.88rem; color: var(--muted); }

  /* History table */
  .history-card {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid var(--border); overflow: hidden;
  }
  .history-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  .history-table th { text-align: left; padding: 0.65rem 1rem; font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); background: var(--bg); font-weight: 600; }
  .history-table td { padding: 0.7rem 1rem; border-bottom: 1px solid var(--border); }
  .history-table tr:last-child td { border-bottom: none; }
  .h-pass { color: #15803d; font-weight: 600; }
  .h-fail { color: #dc2626; }
  .h-link { color: var(--primary); text-decoration: none; font-size: 0.82rem; font-weight: 600; }
  .h-link:hover { text-decoration: underline; }

  /* Scheduled countdown banner */
  .countdown-banner {
    border-radius: var(--radius-card); padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, rgba(124,58,237,0.12), rgba(99,102,241,0.08));
    border: 1.5px solid rgba(124,58,237,0.3);
    text-align: center; margin-bottom: 0.75rem;
  }
  .countdown-banner-icon { font-size: 2rem; margin-bottom: 0.4rem; }
  .countdown-banner-title { font-weight: 800; font-size: 0.95rem; color: #7c3aed; margin-bottom: 0.2rem; }
  .countdown-banner-datetime { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.65rem; }
  .countdown-banner-timer {
    font-size: 1.25rem; font-weight: 800; letter-spacing: 0.02em;
    color: var(--text);
    background: rgba(124,58,237,0.12); border-radius: 8px;
    padding: 0.35rem 0.9rem; display: inline-block;
  }

  /* Misc */
  .error { color: var(--danger); padding: 1rem 0; }
  .teacher-meta { font-size: 0.8rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-top: 0.5rem; }
  .teacher-meta-item { display: flex; align-items: center; gap: 0.3rem; }
  .mode-badge { font-size: 0.72rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 99px; padding: 0.1rem 0.55rem; font-weight: 600; }
</style>

{#if loading}
  <div style="text-align:center; padding: 4rem 0; color: var(--muted)">Đang tải...</div>
{:else if error}
  <p class="error">{error}</p>
{:else if exam}

<!-- ── Hero ──────────────────────────────────────────────────────────────────── -->
<div class="hero">
  {#if exam.cover_image_url}
    <img src={exam.cover_image_url} alt="" class="hero-img" />
  {/if}
  <div class="hero-overlay"></div>
  <div class="hero-body">
    <div class="hero-top">
      <span class="badge {isScheduledLocked ? 'badge-scheduled' : exam.is_published ? 'badge-published' : 'badge-draft'}">
        {isScheduledLocked ? '🔒 Chưa mở' : exam.is_published ? '● Đã xuất bản' : '○ Nháp'}
      </span>
      {#if isTeacher}
        <span class="mode-badge">{exam.allow_retake ? 'Thi thực hành' : 'Thi chính thức'}</span>
      {/if}
    </div>
    <h1>{exam.title}</h1>
    {#if exam.tags?.length}
      <div class="hero-tags">
        {#each exam.tags as t}<span class="hero-tag">{t}</span>{/each}
      </div>
    {/if}
    <div class="hero-social">
      <button
        class="like-btn"
        class:liked
        class:readonly={!isStudent}
        onclick={toggleLike}
        disabled={likeBusy || !isStudent}
        title={isStudent ? (liked ? 'Bỏ thích' : 'Thích đề thi này') : 'Chỉ học viên mới có thể thích'}
      >
        <span class="like-heart">{liked ? '❤️' : '🤍'}</span>
        <span>{likeCount}</span>
      </button>
      <a href="#comments" class="hero-social-stat">💬 {commentCount} bình luận</a>
    </div>
  </div>
</div>

<!-- ── Two-column layout ─────────────────────────────────────────────────────── -->
<div class="layout">

  <!-- ── Main column ─────────────────────────────────────────────────────────── -->
  <div>

    <!-- Result banner (student, has submission) -->
    {#if !isTeacher && mySubmission}
      <div class="result-banner {hasPassed ? 'passed' : 'failed'}">
        <div class="result-icon">{hasPassed ? '🎉' : '❌'}</div>
        <div class="result-info">
          <div class="result-title {hasPassed ? 'passed' : 'failed'}">
            {hasPassed ? 'Bạn đã đạt bài thi này!' : 'Chưa đạt — hãy thử lại'}
          </div>
          <div class="result-score">
            Điểm: <strong>{mySubmission.score}/{mySubmission.total_points}</strong>
            ({mySubmission.percentage?.toFixed(1)}%)
            {#if exam.passing_score != null} · Cần đạt: <strong>{exam.passing_score}%</strong>{/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Question preview section (student or teacher) -->
    {#if !isTeacher}
      <div class="section">
        <div class="section-title">Xem trước nội dung</div>
        {#each previewQuestions as q, i}
          <div class="q-card">
            <div class="q-header">
              <div class="q-num-badge">{i + 1}</div>
              <div class="q-content">{q.content}</div>
              <span class="q-type {q.question_type === 'multiple' ? 'multi' : 'single'}">
                {q.question_type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án'}
              </span>
            </div>
            {#if q.image_url}
              <img src={q.image_url} alt="" style="max-width:100%;max-height:180px;object-fit:contain;border-radius:8px;margin-bottom:0.5rem;border:1px solid var(--border)" />
            {/if}
            <ul class="q-options">
              {#each (q.options ?? []) as opt}
                <li><span class="opt-key">{opt.key}.</span>{opt.text}</li>
              {/each}
            </ul>
          </div>
        {/each}

        {#if hiddenCount > 0}
          <div class="more-teaser">
            Còn <strong>{hiddenCount} câu hỏi</strong> khác trong bài thi này.
            Bắt đầu làm bài để xem toàn bộ nội dung.
          </div>
        {:else if previewQuestions.length === 0}
          <div class="more-teaser">Bài thi này chưa có câu hỏi nào.</div>
        {/if}
      </div>
    {/if}

    <!-- Teacher: full question list with answers -->
    {#if isTeacher}
      <div class="teacher-meta" style="margin-bottom: 1.25rem;">
        {#if exam.description}
          <span>{exam.description}</span>
        {/if}
        <div class="teacher-meta-item">Giải thích: <strong>{exam.show_explanation ? 'Hiển thị' : 'Ẩn'}</strong></div>
      </div>
      <div class="section">
        <div class="section-title">Câu hỏi ({totalQuestions})</div>
        {#each exam.questions ?? [] as q, i}
          {@const corrects = correctAnswers(q)}
          <div class="teacher-q-card">
            <div class="q-header" style="margin-bottom:0.5rem">
              <div class="q-num-badge">{i + 1}</div>
              <div class="q-content">{q.content}</div>
              <span class="q-type {q.question_type === 'multiple' ? 'multi' : 'single'}">
                {q.question_type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án'}
              </span>
            </div>
            {#if q.image_url}
              <img src={q.image_url} alt="" style="max-width:100%;max-height:200px;object-fit:contain;border-radius:8px;margin-bottom:0.5rem;border:1px solid var(--border)" />
            {/if}
            <ul class="q-options" style="margin-top:0.4rem">
              {#each q.options ?? [] as opt}
                <li class="{corrects.includes(opt.key) ? 'correct-opt' : ''}">
                  <span class="opt-key">{opt.key}.</span>{opt.text}
                  {#if corrects.includes(opt.key)} ✓{/if}
                </li>
              {/each}
            </ul>
            {#if q.explanation}
              <button class="expl-toggle" onclick={() => toggleExpl(i)}>
                {expandedExpl.has(i) ? '▲ Ẩn giải thích' : '▼ Xem giải thích'}
              </button>
              {#if expandedExpl.has(i)}
                <div class="expl-box">{@html marked(q.explanation)}</div>
              {/if}
            {/if}
            <div style="font-size:0.75rem; color:var(--muted); margin-top:0.5rem">{q.points} điểm</div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- History (student, allow_retake) -->
    {#if !isTeacher && exam.allow_retake && mySubmissions.length > 0}
      <div class="section">
        <div class="section-title">Lịch sử làm bài ({mySubmissions.length} lần)</div>
        <div class="history-card">
          <table class="history-table">
            <thead>
              <tr>
                <th>Lần</th>
                <th>Điểm</th>
                <th>Kết quả</th>
                <th>Thời gian nộp</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each mySubmissions as sub, i}
                {@const subPassed = exam.passing_score == null || sub.percentage >= exam.passing_score}
                <tr>
                  <td style="font-weight:600">{mySubmissions.length - i}</td>
                  <td>{sub.score}/{sub.total_points} <span style="color:var(--muted);font-size:0.82rem">({sub.percentage?.toFixed(1)}%)</span></td>
                  <td class="{subPassed ? 'h-pass' : 'h-fail'}">{subPassed ? '✓ Đạt' : '✗ Chưa đạt'}</td>
                  <td style="color:var(--muted); font-size:0.82rem">{fmtDate(sub.submitted_at)}</td>
                  <td>
                    {#if subPassed}
                      <a href="/exams/{exam.id}/result?submissionId={sub.id}" class="h-link">Xem →</a>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- [Future slot: Teacher intro] -->
    <!-- [Future slot: Student reviews] -->

  </div>

  <!-- ── Sidebar ──────────────────────────────────────────────────────────────── -->
  <div class="sidebar">
    <div class="action-card">
      <!-- Header: credit cost / price -->
      <div class="action-header">
        <div class="action-title">Chi phí làm bài</div>
        <div class="action-price">
          💳 {creditCost}
          <span>credit / lần</span>
        </div>
      </div>

      <div class="action-body">
        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">Câu hỏi</div>
            <div class="stat-value">{totalQuestions}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Thời gian</div>
            <div class="stat-value">{exam.time_limit} phút</div>
          </div>
          {#if exam.passing_score != null}
            <div class="stat-item">
              <div class="stat-label">Điểm đạt</div>
              <div class="stat-value">{exam.passing_score}%</div>
            </div>
          {/if}
          <div class="stat-item">
            <div class="stat-label">Chế độ</div>
            <div class="stat-value" style="font-size:0.82rem">{exam.allow_retake ? 'Thực hành' : 'Chính thức'}</div>
          </div>
        </div>

        <!-- Student status + credit check -->
        {#if $user?.role === 'student'}
          {#if mySubmission}
            <div class="status-strip {hasPassed ? 'passed' : 'failed'}">
              <span class="status-strip-icon">{hasPassed ? '🏆' : '📝'}</span>
              <span>{hasPassed ? 'Đã đạt' : 'Chưa đạt'} · {mySubmission.percentage?.toFixed(1)}%</span>
            </div>
          {:else}
            <div class="status-strip pending">
              <span class="status-strip-icon">📋</span>
              <span>Chưa làm bài</span>
            </div>
          {/if}

          {#if myCredits !== null}
            <div class="credit-row">
              <span style="color:var(--muted)">Số dư của bạn</span>
              {#if hasEnoughCredits}
                <span class="credit-ok">💳 {myCredits} credit</span>
              {:else}
                <span class="credit-bad">💳 {myCredits} / {creditCost}</span>
              {/if}
            </div>
            {#if !hasEnoughCredits}
              <p style="font-size:0.8rem; color:var(--danger); text-align:center; margin-top:-0.25rem">
                Cần thêm {creditCost - myCredits} credit để làm bài
              </p>
            {/if}
          {/if}
        {/if}

        <hr class="divider" />

        <!-- Scheduled countdown banner (student) -->
        {#if $user?.role === 'student' && isScheduledLocked}
          <div class="countdown-banner">
            <div class="countdown-banner-icon">🔒</div>
            <div class="countdown-banner-title">Đề thi chưa mở</div>
            <div class="countdown-banner-datetime">
              Mở lúc {new Date(exam.scheduled_at).toLocaleString('vi-VN', {weekday:'short', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
            </div>
            {#if scheduledCountdown}
              <div class="countdown-banner-timer">{scheduledCountdown}</div>
            {:else}
              <div class="countdown-banner-timer">Đang mở...</div>
            {/if}
          </div>
        {/if}

        <!-- Action buttons -->
        {#if $user?.role === 'student'}
          {#if isScheduledLocked}
            <button class="btn-block btn-primary" disabled>🔒 Chưa đến giờ mở</button>
          {:else if !mySubmission}
            {#if hasEnoughCredits}
              <a href="/exams/{exam.id}/take" class="btn-block btn-primary">▶ Bắt đầu làm bài</a>
            {:else}
              <button class="btn-block btn-primary" disabled>Không đủ credit</button>
            {/if}
          {:else}
            <a href="/exams/{exam.id}/result?submissionId={mySubmission.id}" class="btn-block btn-success">Xem kết quả chi tiết</a>
            {#if canStart}
              {#if hasEnoughCredits}
                <a href="/exams/{exam.id}/take" class="btn-block btn-outline">↺ Làm lại</a>
              {:else}
                <button class="btn-block btn-outline" disabled>Không đủ credit để làm lại</button>
              {/if}
            {/if}
          {/if}

        {:else}
          <!-- Teacher / Admin actions -->
          <a href="/exams/{exam.id}/take" class="btn-block btn-ghost">👁 Xem trước</a>
          {#if exam.created_by === $user?.id || $user?.role === 'admin'}
            <a href="/exams/{exam.id}/edit" class="btn-block btn-outline">✏️ Sửa đề thi</a>
          {/if}
          <button
            class="btn-block {exam.is_published ? 'btn-ghost' : 'btn-success'}"
            onclick={togglePublish}
            disabled={publishing}
          >
            {publishing ? 'Đang xử lý...' : exam.is_published ? '⬇ Gỡ xuất bản' : '🚀 Xuất bản'}
          </button>
        {/if}

        <p style="font-size:0.75rem; color:var(--muted); text-align:center; margin-top: -0.25rem">
          {#if $user?.role === 'student'}
            Credit được trừ ngay khi bắt đầu làm bài
          {:else}
            * Role mới của student có hiệu lực sau khi đăng nhập lại
          {/if}
        </p>
      </div>
    </div>
  </div>

</div>

<!-- ── Comments ─────────────────────────────────────────────────────────────── -->
<div class="comments-wrap" id="comments">
  <div class="section-title">Bình luận ({commentCount})</div>

  {#if $user}
    <div class="comment-composer">
      <textarea
        bind:value={newComment}
        placeholder="Chia sẻ suy nghĩ của bạn về đề thi này..."
        rows="3"
        maxlength="2000"
      ></textarea>
      <div class="composer-actions">
        <button class="btn-primary" onclick={postComment} disabled={postingComment || !newComment.trim()}>
          {postingComment ? 'Đang gửi...' : 'Gửi bình luận'}
        </button>
      </div>
    </div>
  {/if}

  {#if commentsLoading}
    <p style="color:var(--muted); padding:1rem 0">Đang tải bình luận...</p>
  {:else if comments.length === 0}
    <p style="color:var(--muted); padding:1rem 0">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
  {:else}
    <div class="comment-list">
      {#each comments as c (c.id)}
        <div class="comment-item">
          <div class="comment-avatar">
            {#if c.avatar_url}
              <img src={c.avatar_url} alt="" />
            {:else}
              <span>{(c.full_name ?? '?').charAt(0).toUpperCase()}</span>
            {/if}
          </div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-author">{c.full_name ?? 'Người dùng'}</span>
              <span class="comment-date">{fmtDate(c.created_at)}{c.updated_at !== c.created_at ? ' (đã sửa)' : ''}</span>
            </div>
            {#if editingId === c.id}
              <textarea bind:value={editContent} rows="3" maxlength="2000"></textarea>
              <div class="composer-actions">
                <button class="btn-primary" onclick={() => saveEdit(c)}>Lưu</button>
                <button class="btn-ghost" onclick={() => (editingId = null)}>Huỷ</button>
              </div>
            {:else}
              <div class="comment-content">{c.content}</div>
              {#if canModerate(c)}
                <div class="comment-tools">
                  {#if c.user_id === $user?.id}
                    <button onclick={() => startEdit(c)}>Sửa</button>
                  {/if}
                  <button class="danger" onclick={() => deleteComment(c)}>Xoá</button>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if commentTotalPages > 1}
      <div class="comment-pager">
        <button
          class="btn-ghost"
          disabled={commentPage <= 1}
          onclick={() => loadComments(exam.id, commentPage - 1)}
        >← Trước</button>
        <span>Trang {commentPage} / {commentTotalPages}</span>
        <button
          class="btn-ghost"
          disabled={commentPage >= commentTotalPages}
          onclick={() => loadComments(exam.id, commentPage + 1)}
        >Sau →</button>
      </div>
    {/if}
  {/if}
</div>
{/if}
