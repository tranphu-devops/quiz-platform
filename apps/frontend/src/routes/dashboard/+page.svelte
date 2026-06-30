<script>
  import { examApi, submissionApi, userApi } from '$lib/api'
  import { user, session } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let loading = $state(true)
  let error = $state('')

  // student
  let mySubmissions = $state([])
  let inProgressSubs = $state([])
  let examMap = $state({})

  // teacher / admin
  let myExams = $state([])
  let allSubs = $state([])
  let userMap = $state({})

  function examStats(examId) {
    const subs = allSubs.filter(s => s.exam_id === examId)
    const exam = myExams.find(e => e.id === examId)
    const passed = subs.filter(s => exam?.passing_score == null || s.percentage >= exam.passing_score).length
    return { count: subs.length, passed, rate: subs.length > 0 ? Math.round(passed / subs.length * 100) : null }
  }

  const adminStats = $derived({
    exams: myExams.length,
    totalSubs: allSubs.length,
    passed: allSubs.filter(s => { const e = myExams.find(ex => ex.id === s.exam_id); return e?.passing_score == null || s.percentage >= e.passing_score }).length,
    users: Object.keys(userMap).length
  })

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    try {
      if ($user.role === 'student') {
        const [subRes, ipRes, examRes] = await Promise.all([
          submissionApi.list(),
          submissionApi.list({ status: 'in_progress' }),
          examApi.list()
        ])
        if (subRes.ok)  mySubmissions = await subRes.json()
        if (ipRes.ok)   inProgressSubs = await ipRes.json()
        if (examRes.ok) { const exams = await examRes.json(); examMap = Object.fromEntries(exams.map(e => [e.id, e])) }
      } else {
        const [examRes, subRes] = await Promise.all([examApi.list(), submissionApi.list()])
        if (examRes.ok) myExams = await examRes.json()
        if (subRes.ok)  allSubs = await subRes.json()
        if ($user.role === 'admin') {
          const uRes = await userApi.adminListUsers()
          if (uRes.ok) { const users = await uRes.json(); userMap = Object.fromEntries(users.map(u => [u.id, u])) }
        }
      }
    } catch { error = 'Không thể tải dữ liệu' }
    finally  { loading = false }
  })

  function isPassed(sub) {
    const exam = examMap[sub.exam_id]
    return exam?.passing_score == null || sub.percentage >= exam.passing_score
  }

  function fmtDate(s) {
    return new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  }

  function timeRemaining(expiresAt) {
    const secs = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000))
    const m = Math.floor(secs / 60), s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const studentRows = $derived(
    Object.values(
      mySubmissions.reduce((acc, s) => {
        if (!acc[s.exam_id] || new Date(s.submitted_at) > new Date(acc[s.exam_id].submitted_at))
          acc[s.exam_id] = s
        return acc
      }, {})
    ).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
  )
  const studentPassed = $derived(studentRows.filter(s => isPassed(s)).length)
</script>

<style>
  /* ── Header ─────────────────────────────────────────────────────────────────── */
  .page-header { margin-bottom: 2rem; }
  .greeting {
    font-size: 1.7rem; font-weight: 800; letter-spacing: -0.02em;
    color: var(--text); margin-bottom: 0.3rem;
  }
  .greeting span {
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .role-pill {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.25rem 0.8rem; border-radius: 99px;
    font-size: 0.8rem; font-weight: 700;
  }
  .role-pill.student { background: var(--primary-light); color: var(--primary); }
  .role-pill.teacher { background: rgba(234,179,8,0.15); color: #a16207; }
  .role-pill.admin   { background: rgba(236,72,153,0.15); color: #9d174d; }

  /* ── Stats ───────────────────────────────────────────────────────────────────── */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat {
    background: var(--surface); border-radius: var(--radius-card);
    padding: 1.35rem 1.1rem;
    box-shadow: var(--shadow); border: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 0.35rem;
    transition: all 0.2s;
  }
  .stat:hover { box-shadow: var(--shadow-hover); transform: translateY(-2px); }
  .stat-icon { font-size: 1.4rem; }
  .stat-num {
    font-size: 2rem; font-weight: 800; line-height: 1; color: var(--text);
    letter-spacing: -0.03em;
  }
  .stat-num.indigo { color: var(--primary); }
  .stat-num.green  { color: #15803d; }
  .stat-num.red    { color: var(--danger); }
  .stat-num.amber  { color: #92400e; }
  .stat-label { font-size: 0.82rem; color: var(--muted); font-weight: 500; }
  .stat-bar { height: 3px; border-radius: 99px; background: var(--border); margin-top: 0.25rem; overflow: hidden; }
  .stat-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--primary), var(--accent)); }

  /* ── Section ─────────────────────────────────────────────────────────────────── */
  .section-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1rem;
  }
  .section-title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .section-link { font-size: 0.85rem; color: var(--primary); font-weight: 600; text-decoration: none; }
  .section-link:hover { text-decoration: underline; }

  /* ── Table ───────────────────────────────────────────────────────────────────── */
  .table-wrap {
    background: var(--surface); border-radius: var(--radius-card);
    box-shadow: var(--shadow); border: 1px solid var(--border); overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th {
    text-align: left; padding: 0.75rem 1.1rem;
    border-bottom: 2px solid var(--border); color: var(--muted);
    font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;
    font-weight: 700; white-space: nowrap; background: var(--bg);
  }
  td { padding: 0.8rem 1.1rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--primary-light); }
  .link { color: var(--primary); text-decoration: none; font-weight: 600; }
  .link:hover { text-decoration: underline; }
  .pass { color: #15803d; font-weight: 700; }
  .fail { color: var(--danger); font-weight: 600; }

  /* ── Bar ─────────────────────────────────────────────────────────────────────── */
  .bar-wrap { display: flex; align-items: center; gap: 0.5rem; }
  .bar-bg { flex: 1; height: 6px; background: var(--border); border-radius: 99px; overflow: hidden; min-width: 60px; }
  .bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--primary), var(--accent)); }
  .bar-fill.good { background: linear-gradient(90deg, #22c55e, #16a34a); }

  /* ── Buttons ────────────────────────────────────────────────────────────────── */
  .btn {
    padding: 0.3rem 0.7rem; border-radius: 8px; font-size: 0.8rem;
    font-weight: 600; text-decoration: none; cursor: pointer; border: none;
    display: inline-block; transition: all 0.15s;
  }
  .btn-indigo { background: var(--primary-light); color: var(--primary); border: 1px solid #c4b5fd; }
  .btn-indigo:hover { background: #ddd6fe; }
  .btn-gray  { background: var(--bg); color: var(--text); border: 1px solid var(--border); }
  .btn-gray:hover  { border-color: var(--primary); color: var(--primary); }

  .empty { color: var(--muted); text-align: center; padding: 2.5rem 1rem; font-size: 0.9rem; }
  .empty a { color: var(--primary); font-weight: 600; }
  .error { color: var(--danger); }

  /* ── In-progress cards ──────────────────────────────────────────────────────── */
  .ip-cards { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; }
  .ip-card {
    background: var(--surface); border-radius: var(--radius-card);
    border: 1px solid #f59e0b44; box-shadow: 0 2px 8px #f59e0b18;
    padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem;
  }
  .ip-icon { font-size: 1.6rem; flex-shrink: 0; }
  .ip-body { flex: 1; min-width: 0; }
  .ip-title { font-weight: 700; color: var(--text); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ip-meta { font-size: 0.8rem; color: var(--muted); margin-top: 0.2rem; }
  .ip-timer { font-size: 0.78rem; font-weight: 700; color: #d97706; background: rgba(245,158,11,0.15); border-radius: 6px; padding: 0.15rem 0.5rem; }
  .btn-amber { background: rgba(245,158,11,0.15); color: #d97706; border: 1px solid rgba(245,158,11,0.4); }
  .btn-amber:hover { background: rgba(245,158,11,0.25); }

  @media (max-width: 600px) {
    .stats { grid-template-columns: repeat(2, 1fr); }
    th:nth-child(n+4), td:nth-child(n+4) { display: none; }
  }
</style>

{#if loading}
  <div style="color:var(--muted);padding:2rem 0">Đang tải...</div>
{:else if error}
  <p class="error">{error}</p>
{:else}

<!-- ── STUDENT ─────────────────────────────────────────────────────────────── -->
{#if $user.role === 'student'}
<div class="page-header">
  <h1 class="greeting">Xin chào, <span>{$session?.user?.user_metadata?.full_name?.split(' ').pop() || 'bạn'}!</span></h1>
  <span class="role-pill student">🎓 Học sinh</span>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-icon">📝</div>
    <div class="stat-num indigo">{studentRows.length}</div>
    <div class="stat-label">Đề đã thi</div>
  </div>
  <div class="stat">
    <div class="stat-icon">✅</div>
    <div class="stat-num green">{studentPassed}</div>
    <div class="stat-label">Đã pass</div>
    {#if studentRows.length > 0}
      <div class="stat-bar"><div class="stat-bar-fill" style="width:{Math.round(studentPassed/studentRows.length*100)}%"></div></div>
    {/if}
  </div>
  <div class="stat">
    <div class="stat-icon">⏳</div>
    <div class="stat-num red">{studentRows.length - studentPassed}</div>
    <div class="stat-label">Chưa pass</div>
  </div>
  {#if inProgressSubs.length > 0}
  <div class="stat">
    <div class="stat-icon">▶️</div>
    <div class="stat-num amber">{inProgressSubs.length}</div>
    <div class="stat-label">Đang thi dở</div>
  </div>
  {/if}
</div>

{#if inProgressSubs.length > 0}
<div class="section-header">
  <span class="section-title">Bài thi đang làm dở</span>
</div>
<div class="ip-cards">
  {#each inProgressSubs as sub}
  {@const exam = examMap[sub.exam_id]}
  <div class="ip-card">
    <div class="ip-icon">📋</div>
    <div class="ip-body">
      <div class="ip-title">{exam?.title ?? 'Đề thi'}</div>
      <div class="ip-meta">Còn lại: <span class="ip-timer">{timeRemaining(sub.expires_at)}</span></div>
    </div>
    <a href="/exams/{sub.exam_id}/take" class="btn btn-amber">Tiếp tục →</a>
  </div>
  {/each}
</div>
{/if}

<div class="section-header">
  <span class="section-title">Bài thi của bạn</span>
  <a href="/exams" class="section-link">Xem tất cả đề →</a>
</div>
<div class="table-wrap">
  {#if studentRows.length === 0}
    <p class="empty">Bạn chưa tham gia bài thi nào. <a href="/exams">Xem danh sách đề →</a></p>
  {:else}
    <table>
      <thead><tr><th>Đề thi</th><th>Điểm</th><th>%</th><th>Kết quả</th><th>Ngày nộp</th><th></th></tr></thead>
      <tbody>
        {#each studentRows as sub}
        {@const exam = examMap[sub.exam_id]}
        {@const passed = isPassed(sub)}
        <tr>
          <td><a href="/exams/{sub.exam_id}" class="link">{exam?.title ?? '—'}</a></td>
          <td>{sub.score}/{sub.total_points}</td>
          <td>{sub.percentage?.toFixed(1)}%</td>
          <td class="{passed ? 'pass' : 'fail'}">{passed ? '✓ Đạt' : '✗ Chưa đạt'}</td>
          <td style="color:var(--muted);font-size:0.83rem">{fmtDate(sub.submitted_at)}</td>
          <td>
            {#if passed}
              <a href="/exams/{sub.exam_id}/result?submissionId={sub.id}" class="btn btn-indigo">Xem KQ</a>
            {:else}
              <a href="/exams/{sub.exam_id}/take" class="btn btn-gray">Làm lại</a>
            {/if}
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- ── TEACHER ────────────────────────────────────────────────────────────── -->
{:else if $user.role === 'teacher'}
{@const teacherSubs = allSubs.filter(s => myExams.some(e => e.id === s.exam_id))}
<div class="page-header">
  <h1 class="greeting">Xin chào, <span>{$session?.user?.user_metadata?.full_name?.split(' ').pop() || 'giáo viên'}!</span></h1>
  <span class="role-pill teacher">👨‍🏫 Giáo viên</span>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-icon">📚</div>
    <div class="stat-num indigo">{myExams.length}</div>
    <div class="stat-label">Đề đã tạo</div>
  </div>
  <div class="stat">
    <div class="stat-icon">✅</div>
    <div class="stat-num green">{myExams.filter(e => e.is_published).length}</div>
    <div class="stat-label">Đã xuất bản</div>
  </div>
  <div class="stat">
    <div class="stat-icon">👥</div>
    <div class="stat-num indigo">{teacherSubs.length}</div>
    <div class="stat-label">Lượt thi</div>
  </div>
</div>

<div class="section-header">
  <span class="section-title">Đề thi của bạn</span>
  <a href="/exams/create" class="section-link">＋ Tạo đề mới</a>
</div>
<div class="table-wrap">
  {#if myExams.length === 0}
    <p class="empty">Bạn chưa tạo đề thi nào. <a href="/exams/create">Tạo đề thi →</a></p>
  {:else}
    <table>
      <thead><tr><th>Tên đề</th><th>Lượt thi</th><th>Tỷ lệ pass</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        {#each myExams as exam}
        {@const s = examStats(exam.id)}
        <tr>
          <td>
            <a href="/exams/{exam.id}" class="link">{exam.title}</a>
            {#if exam.passing_score != null}<span style="font-size:0.77rem;color:var(--muted)"> · ≥{exam.passing_score}%</span>{/if}
          </td>
          <td>{s.count}</td>
          <td>
            {#if s.count > 0}
              <div class="bar-wrap">
                <div class="bar-bg"><div class="bar-fill {s.rate >= 60 ? 'good' : ''}" style="width:{s.rate}%"></div></div>
                <span style="font-size:0.82rem;min-width:2.5rem;color:var(--muted)">{s.rate}%</span>
              </div>
            {:else}—{/if}
          </td>
          <td style="font-size:0.83rem">
            {#if exam.is_published}
              <span style="color:#15803d">✓ Xuất bản</span>
            {:else}
              <span style="color:var(--muted)">Nháp</span>
            {/if}
          </td>
          <td style="display:flex;gap:0.4rem">
            <a href="/exams/{exam.id}" class="btn btn-indigo">Xem</a>
            <a href="/exams/{exam.id}/edit" class="btn btn-gray">Sửa</a>
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- ── ADMIN ───────────────────────────────────────────────────────────────── -->
{:else if $user.role === 'admin'}
<div class="page-header">
  <h1 class="greeting">Admin <span>Dashboard</span></h1>
  <span class="role-pill admin">⚙️ Admin</span>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-icon">📚</div>
    <div class="stat-num indigo">{adminStats.exams}</div>
    <div class="stat-label">Tổng đề thi</div>
  </div>
  <div class="stat">
    <div class="stat-icon">👥</div>
    <div class="stat-num indigo">{adminStats.users}</div>
    <div class="stat-label">Người dùng</div>
  </div>
  <div class="stat">
    <div class="stat-icon">🎯</div>
    <div class="stat-num indigo">{adminStats.totalSubs}</div>
    <div class="stat-label">Lượt thi</div>
  </div>
  <div class="stat">
    <div class="stat-icon">📈</div>
    <div class="stat-num green">{adminStats.totalSubs > 0 ? Math.round(adminStats.passed / adminStats.totalSubs * 100) : 0}%</div>
    <div class="stat-label">Tỷ lệ pass</div>
    {#if adminStats.totalSubs > 0}
      <div class="stat-bar"><div class="stat-bar-fill" style="width:{Math.round(adminStats.passed/adminStats.totalSubs*100)}%"></div></div>
    {/if}
  </div>
</div>

<div class="section-header">
  <span class="section-title">Tất cả đề thi</span>
  <a href="/admin" class="section-link">Quản lý →</a>
</div>
<div class="table-wrap">
  {#if myExams.length === 0}
    <p class="empty">Chưa có đề thi nào.</p>
  {:else}
    <table>
      <thead><tr><th>Tên đề</th><th>Tác giả</th><th>Lượt thi</th><th>Tỷ lệ pass</th><th>XB</th><th></th></tr></thead>
      <tbody>
        {#each myExams as exam}
        {@const s = examStats(exam.id)}
        {@const author = userMap[exam.created_by]}
        <tr>
          <td>
            <a href="/exams/{exam.id}" class="link">{exam.title}</a>
            {#if exam.passing_score != null}<span style="font-size:0.77rem;color:var(--muted)"> · ≥{exam.passing_score}%</span>{/if}
          </td>
          <td style="font-size:0.85rem">
            <span style="font-weight:600">{author?.full_name ?? ''}</span>
            <span style="display:block;color:var(--muted);font-size:0.78rem">{author?.email ?? exam.created_by.slice(0,8)+'…'}</span>
          </td>
          <td>{s.count}</td>
          <td>
            {#if s.count > 0}
              <div class="bar-wrap">
                <div class="bar-bg"><div class="bar-fill {s.rate >= 60 ? 'good' : ''}" style="width:{s.rate}%"></div></div>
                <span style="font-size:0.82rem;min-width:2.5rem;color:var(--muted)">{s.rate}%</span>
              </div>
            {:else}—{/if}
          </td>
          <td style="font-size:0.85rem">{exam.is_published ? '✓' : '—'}</td>
          <td><a href="/exams/{exam.id}" class="btn btn-indigo">Xem</a></td>
        </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
{/if}

{/if}
