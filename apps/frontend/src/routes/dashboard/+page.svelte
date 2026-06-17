<script>
  import { examApi, submissionApi, userApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let loading = $state(true)
  let error = $state('')

  // --- student ---
  let mySubmissions = $state([])
  let examMap = $state({})         // examId → exam

  // --- teacher / admin ---
  let myExams = $state([])
  let allSubs = $state([])
  let userMap = $state({})         // userId → user (admin only)

  function examStats(examId) {
    const subs = allSubs.filter(s => s.exam_id === examId)
    const exam = myExams.find(e => e.id === examId)
    const passed = subs.filter(s =>
      exam?.passing_score == null || s.percentage >= exam.passing_score
    ).length
    return { count: subs.length, passed, rate: subs.length > 0 ? Math.round(passed / subs.length * 100) : null }
  }

  const adminStats = $derived({
    exams: myExams.length,
    totalSubs: allSubs.length,
    passed: allSubs.filter(s => {
      const e = myExams.find(ex => ex.id === s.exam_id)
      return e?.passing_score == null || s.percentage >= e.passing_score
    }).length,
    users: Object.keys(userMap).length
  })

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    try {
      if ($user.role === 'student') {
        const [subRes, examRes] = await Promise.all([submissionApi.list(), examApi.list()])
        if (subRes.ok) mySubmissions = await subRes.json()
        if (examRes.ok) {
          const exams = await examRes.json()
          examMap = Object.fromEntries(exams.map(e => [e.id, e]))
        }
      } else {
        const [examRes, subRes] = await Promise.all([examApi.list(), submissionApi.list()])
        if (examRes.ok) myExams = await examRes.json()
        if (subRes.ok) allSubs = await subRes.json()

        if ($user.role === 'admin') {
          const uRes = await userApi.adminListUsers()
          if (uRes.ok) {
            const users = await uRes.json()
            userMap = Object.fromEntries(users.map(u => [u.id, u]))
          }
        }
      }
    } catch {
      error = 'Không thể tải dữ liệu'
    } finally {
      loading = false
    }
  })

  function isPassed(sub) {
    const exam = examMap[sub.exam_id]
    return exam?.passing_score == null || sub.percentage >= exam.passing_score
  }

  function fmtDate(s) {
    return new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  }

  // latest submission per exam (student)
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
  .page-header { margin-bottom: 1.5rem; }
  .page-header h1 { font-size: 1.5rem; margin-bottom: 0.3rem; }
  .role-badge { display: inline-block; padding: 0.2rem 0.75rem; border-radius: 999px; font-size: 0.82rem; font-weight: 600; }
  .badge-student { background: #dbeafe; color: #1e40af; }
  .badge-teacher { background: #fef9c3; color: #854d0e; }
  .badge-admin   { background: #fce7f3; color: #9d174d; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat { background: white; border-radius: 10px; padding: 1.25rem 1rem; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .stat-num { font-size: 2rem; font-weight: 800; color: #1e40af; line-height: 1; margin-bottom: 0.3rem; }
  .stat-num.green { color: #15803d; }
  .stat-num.red   { color: #dc2626; }
  .stat-label { font-size: 0.82rem; color: #6b7280; }

  .section-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.75rem; }
  .table-wrap { background: white; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; padding: 0.6rem 1rem; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
  td { padding: 0.7rem 1rem; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafafa; }

  .pass { color: #15803d; font-weight: 600; }
  .fail { color: #dc2626; }
  .link { color: #1e40af; text-decoration: none; }
  .link:hover { text-decoration: underline; }
  .error { color: #dc2626; }
  .empty { color: #9ca3af; text-align: center; padding: 2rem 1rem; }

  .bar-wrap { display: flex; align-items: center; gap: 0.5rem; }
  .bar-bg { flex: 1; height: 6px; background: #e5e7eb; border-radius: 99px; overflow: hidden; min-width: 50px; }
  .bar-fill { height: 100%; border-radius: 99px; background: #1e40af; }
  .bar-fill.good { background: #22c55e; }

  .btn { padding: 0.3rem 0.65rem; border-radius: 4px; font-size: 0.82rem; text-decoration: none; cursor: pointer; border: none; display: inline-block; }
  .btn-blue { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
  .btn-gray { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
</style>

{#if loading}
  <p>Đang tải...</p>
{:else if error}
  <p class="error">{error}</p>
{:else}

<!-- ===== STUDENT ===== -->
{#if $user.role === 'student'}
<div class="page-header">
  <h1>Xin chào, {$user.user_metadata?.full_name || $user.email}!</h1>
  <span class="role-badge badge-student">Học sinh</span>
</div>

<div class="stats">
  <div class="stat"><div class="stat-num">{studentRows.length}</div><div class="stat-label">Đề đã thi</div></div>
  <div class="stat"><div class="stat-num green">{studentPassed}</div><div class="stat-label">Đã pass</div></div>
  <div class="stat"><div class="stat-num red">{studentRows.length - studentPassed}</div><div class="stat-label">Chưa pass</div></div>
</div>

<p class="section-title">Bài thi của bạn</p>
<div class="table-wrap">
  {#if studentRows.length === 0}
    <p class="empty">Bạn chưa tham gia bài thi nào. <a href="/exams" class="link">Xem danh sách đề →</a></p>
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
          <td style="color:#6b7280; font-size:0.85rem">{fmtDate(sub.submitted_at)}</td>
          <td>
            {#if passed}
              <a href="/exams/{sub.exam_id}/result?submissionId={sub.id}" class="btn btn-blue">Xem KQ</a>
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

<!-- ===== TEACHER ===== -->
{:else if $user.role === 'teacher'}
{@const teacherSubs = allSubs.filter(s => myExams.some(e => e.id === s.exam_id))}
<div class="page-header">
  <h1>Xin chào, {$user.user_metadata?.full_name || $user.email}!</h1>
  <span class="role-badge badge-teacher">Giáo viên</span>
</div>

<div class="stats">
  <div class="stat"><div class="stat-num">{myExams.length}</div><div class="stat-label">Đề đã tạo</div></div>
  <div class="stat"><div class="stat-num">{teacherSubs.length}</div><div class="stat-label">Lượt thi</div></div>
  <div class="stat"><div class="stat-num">{myExams.filter(e => e.is_published).length}</div><div class="stat-label">Đã xuất bản</div></div>
</div>

<p class="section-title">Đề thi của bạn</p>
<div class="table-wrap">
  {#if myExams.length === 0}
    <p class="empty">Bạn chưa tạo đề thi nào. <a href="/exams/create" class="link">Tạo đề thi →</a></p>
  {:else}
    <table>
      <thead><tr><th>Tên đề</th><th>Lượt thi</th><th>Tỷ lệ pass</th><th>Chế độ</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        {#each myExams as exam}
        {@const s = examStats(exam.id)}
        <tr>
          <td>
            <a href="/exams/{exam.id}" class="link">{exam.title}</a>
            {#if exam.passing_score != null}<span style="font-size:0.78rem;color:#9ca3af"> · ≥{exam.passing_score}%</span>{/if}
          </td>
          <td>{s.count}</td>
          <td>
            {#if s.count > 0}
              <div class="bar-wrap">
                <div class="bar-bg"><div class="bar-fill {s.rate >= 60 ? 'good' : ''}" style="width:{s.rate}%"></div></div>
                <span style="font-size:0.82rem;min-width:2.5rem">{s.rate}%</span>
              </div>
            {:else}—{/if}
          </td>
          <td style="font-size:0.82rem;color:#6b7280">{exam.allow_retake ? 'Thực hành' : 'Chính thức'}</td>
          <td style="font-size:0.82rem">{exam.is_published ? '✓ Xuất bản' : 'Nháp'}</td>
          <td style="display:flex;gap:0.4rem">
            <a href="/exams/{exam.id}" class="btn btn-blue">Xem</a>
            <a href="/exams/{exam.id}/edit" class="btn btn-gray">Sửa</a>
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- ===== ADMIN ===== -->
{:else if $user.role === 'admin'}
<div class="page-header">
  <h1>Admin Dashboard</h1>
  <span class="role-badge badge-admin">Admin</span>
</div>

<div class="stats">
  <div class="stat"><div class="stat-num">{adminStats.exams}</div><div class="stat-label">Tổng đề thi</div></div>
  <div class="stat"><div class="stat-num">{adminStats.users}</div><div class="stat-label">Người dùng</div></div>
  <div class="stat"><div class="stat-num">{adminStats.totalSubs}</div><div class="stat-label">Lượt thi</div></div>
  <div class="stat">
    <div class="stat-num green">
      {adminStats.totalSubs > 0 ? Math.round(adminStats.passed / adminStats.totalSubs * 100) : 0}%
    </div>
    <div class="stat-label">Tỷ lệ pass</div>
  </div>
</div>

<p class="section-title">Tất cả đề thi</p>
<div class="table-wrap">
  {#if myExams.length === 0}
    <p class="empty">Chưa có đề thi nào.</p>
  {:else}
    <table>
      <thead><tr><th>Tên đề</th><th>Tác giả</th><th>Lượt thi</th><th>Tỷ lệ pass</th><th>Chế độ</th><th>XB</th><th></th></tr></thead>
      <tbody>
        {#each myExams as exam}
        {@const s = examStats(exam.id)}
        {@const author = userMap[exam.created_by]}
        <tr>
          <td>
            <a href="/exams/{exam.id}" class="link">{exam.title}</a>
            {#if exam.passing_score != null}<span style="font-size:0.78rem;color:#9ca3af"> · ≥{exam.passing_score}%</span>{/if}
          </td>
          <td style="font-size:0.85rem">
            <span style="display:block">{author?.full_name ?? ''}</span>
            <span style="color:#9ca3af;font-size:0.78rem">{author?.email ?? exam.created_by}</span>
          </td>
          <td>{s.count}</td>
          <td>
            {#if s.count > 0}
              <div class="bar-wrap">
                <div class="bar-bg"><div class="bar-fill {s.rate >= 60 ? 'good' : ''}" style="width:{s.rate}%"></div></div>
                <span style="font-size:0.82rem;min-width:2.5rem">{s.rate}%</span>
              </div>
            {:else}—{/if}
          </td>
          <td style="font-size:0.82rem;color:#6b7280">{exam.allow_retake ? 'Thực hành' : 'Chính thức'}</td>
          <td style="font-size:0.82rem">{exam.is_published ? '✓' : '—'}</td>
          <td><a href="/exams/{exam.id}" class="btn btn-blue">Xem</a></td>
        </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
{/if}

{/if}
