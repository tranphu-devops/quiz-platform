<script>
  import { examApi, submissionApi } from '$lib/api'
  import { user } from '$lib/stores/auth'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'

  let now = $state(Date.now())
  onMount(() => {
    const t = setInterval(() => { now = Date.now() }, 1000)
    return () => clearInterval(t)
  })

  function isScheduledLocked(exam) {
    return exam.scheduled_at && new Date(exam.scheduled_at).getTime() > now
  }

  function examCountdown(exam) {
    if (!exam.scheduled_at) return null
    const diff = new Date(exam.scheduled_at).getTime() - now
    if (diff <= 0) return null
    const s = Math.floor(diff / 1000)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (d > 0) return `${d}ng ${h}h ${m}p`
    if (h > 0) return `${h}h ${m}p ${sec}s`
    return `${m}p ${sec < 10 ? '0' : ''}${sec}s`
  }

  let exams = $state([])
  let latestSub = $state({})
  let loading = $state(true)
  let error = $state('')

  // Tag filter + sort (client-side; all exams are already loaded)
  let selectedTag = $state('')        // '' = tất cả
  let sortBy = $state('newest')       // 'newest' | 'popular'

  // Unique tags across all exams, ordered by frequency (most common first)
  const allTags = $derived.by(() => {
    const counts = new Map()
    for (const e of exams)
      for (const t of (e.tags ?? []))
        counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t]) => t)
  })

  // Popularity weight: likes > comments > lượt thi
  function popularity(e) {
    return (e.like_count ?? 0) * 3 + (e.comment_count ?? 0) * 2 + (e.submission_count ?? 0)
  }

  const displayedExams = $derived.by(() => {
    const list = selectedTag
      ? exams.filter(e => e.tags?.includes(selectedTag))
      : [...exams]
    return list.sort((a, b) =>
      sortBy === 'popular'
        ? popularity(b) - popularity(a)
        : new Date(b.created_at) - new Date(a.created_at)
    )
  })

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    try {
      const examRes = await examApi.list()
      if (!examRes.ok) { error = 'Không thể tải danh sách đề thi'; return }
      exams = await examRes.json()

      if ($user.role === 'student') {
        const subRes = await submissionApi.list()
        if (subRes.ok) {
          const subs = await subRes.json()
          const map = {}
          for (const s of subs) {
            if (!map[s.exam_id] || new Date(s.submitted_at) > new Date(map[s.exam_id].submitted_at))
              map[s.exam_id] = s
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

  function statusOf(exam) {
    if ($user?.role === 'student') {
      if (isScheduledLocked(exam)) return 'scheduled'
      if (isPassed(exam)) return 'passed'
      if (latestSub[exam.id]) return 'failed'
      return 'new'
    }
    if (isScheduledLocked(exam)) return 'scheduled'
    return exam.is_published ? 'published' : 'draft'
  }

  function initial(title) { return (title ?? '?').charAt(0).toUpperCase() }

  function fmtMeta(exam) {
    const parts = [`${exam.time_limit} phút`]
    if (exam.passing_score != null) parts.push(`Đạt ≥${exam.passing_score}%`)
    if (exam.allow_retake) parts.push('Thực hành')
    return parts.join(' · ')
  }

  function passRate(exam) {
    const total = exam.submission_count ?? 0
    if (total === 0) return null
    return Math.round(((exam.pass_count ?? 0) / total) * 100)
  }

  async function deleteExam(id) {
    if (!confirm('Xoá đề thi này?')) return
    await examApi.remove(id)
    exams = exams.filter(e => e.id !== id)
  }

  const GRADIENTS = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#3b82f6,#6366f1)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'linear-gradient(135deg,#0ea5e9,#6366f1)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#10b981,#3b82f6)',
  ]
  function gradientFor(title) {
    const i = (title ?? '').charCodeAt(0) % GRADIENTS.length
    return GRADIENTS[i]
  }

</script>

<style>
  .btn-create {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--ix-btn-black-bg);
    color: var(--ix-btn-black-fg);
    padding: 9px 16px;
    border: none; border-radius: 8px;
    cursor: pointer; text-decoration: none;
    font-size: 14px; font-weight: 500;
    font-family: inherit;
    transition: all 0.2s;
  }
  .btn-create:hover { opacity: 0.82; }

  /* ── Filter / sort toolbar ─────────────────────────────────────────────────── */
  .toolbar {
    display: flex; align-items: center; gap: 1rem;
    margin-bottom: 1.1rem; flex-wrap: wrap;
  }
  .tag-filter {
    display: flex; gap: 0.4rem; flex-wrap: wrap; flex: 1; min-width: 0;
  }
  .tag-chip {
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text); border-radius: 99px;
    padding: 0.3rem 0.85rem; font-size: 0.8rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    white-space: nowrap;
  }
  .tag-chip:hover { border-color: var(--primary); color: var(--primary); }
  .tag-chip.active {
    background: var(--primary); border-color: var(--primary); color: #fff;
    box-shadow: 0 2px 8px rgba(99,102,241,0.3);
  }
  .sort-wrap { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
  .sort-label { font-size: 0.8rem; color: var(--muted); font-weight: 600; }
  .sort-select {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 0.35rem 0.6rem; font-size: 0.8rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .sort-select:focus { outline: none; border-color: var(--primary); }

  /* ── Exam grid ─────────────────────────────────────────────────────────────── */
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1rem;
  }
  @media (max-width: 1600px) { .grid { grid-template-columns: repeat(5, 1fr); } }
  @media (max-width: 1300px) { .grid { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 1000px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 680px)  { .grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 420px)  { .grid { grid-template-columns: 1fr; } }

  .card {
    background: var(--surface); border-radius: var(--radius-card);
    overflow: hidden; display: flex; flex-direction: column;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    transition: all 0.2s;
  }
  .card:hover {
    box-shadow: var(--shadow-hover);
    transform: translateY(-3px);
    border-color: #c4b5fd;
  }

  .cover-wrap {
    position: relative; width: 100%; aspect-ratio: 16/9;
    overflow: hidden; flex-shrink: 0;
  }
  .cover-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cover-placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: clamp(1.2rem, 3vw, 3rem); font-weight: 800; color: rgba(255,255,255,0.9);
    user-select: none; letter-spacing: -0.05em;
  }
  .cover-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.25), transparent);
    opacity: 0; transition: opacity 0.2s;
  }
  .card:hover .cover-overlay { opacity: 1; }

  .badge {
    position: absolute; top: 0.65rem; left: 0.65rem;
    padding: 0.2rem 0.6rem; border-radius: 99px;
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .badge.passed   { background: #dcfce7; color: #15803d; }
  .badge.failed   { background: #fee2e2; color: #dc2626; }
  .badge.published{ background: rgba(255,255,255,0.9); color: #15803d; }
  .badge.draft    { background: rgba(255,255,255,0.85); color: #92400e; }
  .badge.new      { display: none; }
  .badge.scheduled{ background: rgba(124,58,237,0.9); color: #fff; }

  .countdown-overlay {
    position: absolute; inset: 0;
    background: rgba(15,23,42,0.55);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 0.3rem;
    border-radius: 0;
  }
  .countdown-lock { font-size: 1.6rem; }
  .countdown-timer {
    font-size: 0.88rem; font-weight: 800;
    color: #fff; letter-spacing: 0.03em;
    background: rgba(0,0,0,0.4); border-radius: 6px;
    padding: 0.15rem 0.5rem;
  }
  .countdown-label { font-size: 0.7rem; color: rgba(255,255,255,0.75); }

  .card-body { padding: 1rem 1.1rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
  .card-title {
    font-size: 0.98rem; font-weight: 700; line-height: 1.4; color: var(--text);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .card-desc {
    font-size: 0.82rem; color: var(--muted); line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 2.4em;
  }
  .card-meta { font-size: 0.77rem; color: #a0aec0; }
  .card-creator { font-size: 0.75rem; color: var(--muted); display: flex; align-items: center; gap: 0.25rem; margin-top: 0.1rem; }
  .creator-link { color: var(--muted); text-decoration: none; }
  .creator-link:hover { color: var(--primary); text-decoration: underline; }
  .card-stats { font-size: 0.75rem; color: var(--muted); display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-top: auto; padding-top: 0.4rem; }
  .stat-pill { background: var(--bg); border: 1px solid var(--border); border-radius: 99px; padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 600; color: var(--text); }
  .stat-pill.pass { color: #15803d; background: #f0fdf4; border-color: #bbf7d0; }
  .stat-pill.like { color: #dc2626; background: #fef2f2; border-color: #fecaca; }
  .stat-pill.comment { color: var(--primary); background: var(--primary-light); border-color: transparent; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.3rem; }
  .tag {
    background: var(--primary-light); color: var(--primary);
    border-radius: 99px; padding: 0.1rem 0.55rem;
    font-size: 0.7rem; font-weight: 600;
  }

  .card-footer {
    padding: 0.75rem 1.1rem; border-top: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
  }

  .score-wrap { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
  .score-text { font-size: 0.78rem; font-weight: 600; }
  .score-text.passed { color: #15803d; }
  .score-text.failed { color: var(--danger); }
  .score-bar { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 99px; transition: width 0.4s; }
  .score-bar-fill.passed { background: var(--success); }
  .score-bar-fill.failed { background: var(--danger); }

  .actions { display: flex; gap: 0.35rem; flex-shrink: 0; }
  .btn {
    padding: 0.35rem 0.7rem; border-radius: 8px;
    font-size: 0.8rem; font-weight: 600; cursor: pointer;
    text-decoration: none; border: none; transition: all 0.15s;
  }
  .btn-primary { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(99,102,241,0.3); }
  .btn-primary:hover { background: var(--primary-dark); }
  .btn-ghost { background: var(--bg); color: var(--text); border: 1px solid var(--border); }
  .btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
  .btn-danger { background: #fee2e2; color: var(--danger); border: 1px solid #fecaca; }
  .btn-danger:hover { background: #fecaca; }

  /* Loading */
  .loading-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; }
  @media (max-width: 1600px) { .loading-grid { grid-template-columns: repeat(5, 1fr); } }
  @media (max-width: 1300px) { .loading-grid { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 1000px) { .loading-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 680px)  { .loading-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 420px)  { .loading-grid { grid-template-columns: 1fr; } }
  .skeleton-card { background: var(--surface); border-radius: var(--radius-card); border: 1px solid var(--border); overflow: hidden; }
  .skeleton-cover { aspect-ratio: 16/9; background: linear-gradient(90deg,#f0eeff,#e9e4ff,#f0eeff); background-size: 200%; animation: shimmer 1.5s infinite; }
  .skeleton-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .skeleton-line { height: 12px; border-radius: 6px; background: linear-gradient(90deg,#f0eeff,#e9e4ff,#f0eeff); background-size: 200%; animation: shimmer 1.5s infinite; }
  @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

  .empty { text-align: center; padding: 4rem 2rem; background: var(--surface); border-radius: var(--radius-card); border: 1px solid var(--border); }
  .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
  .empty h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.4rem; }
  .empty p { color: var(--muted); font-size: 0.9rem; }
  .error { color: var(--danger); }
</style>

<PageHeader title="Đề thi">
  {#if $user && $user.role !== 'student'}
    <a href="/exams/create" class="btn-create">+ Tạo đề thi</a>
  {/if}
</PageHeader>

{#if loading}
  <div class="loading-grid">
    {#each Array(6) as _}
      <div class="skeleton-card">
        <div class="skeleton-cover"></div>
        <div class="skeleton-body">
          <div class="skeleton-line" style="width:80%"></div>
          <div class="skeleton-line" style="width:60%"></div>
          <div class="skeleton-line" style="width:40%"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if error}
  <p class="error">{error}</p>
{:else}

  {#if exams.length === 0}
    <div class="empty">
      <div class="empty-icon">📋</div>
      <h3>Chưa có đề thi nào</h3>
      <p>
        {#if $user?.role !== 'student'}
          Nhấn <strong>Tạo đề thi</strong> để bắt đầu.
        {:else}
          Hiện chưa có đề thi nào được xuất bản.
        {/if}
      </p>
    </div>
  {:else}
    <div class="toolbar">
      {#if allTags.length}
        <div class="tag-filter">
          <button class="tag-chip {selectedTag === '' ? 'active' : ''}" onclick={() => selectedTag = ''}>Tất cả</button>
          {#each allTags as tag}
            <button class="tag-chip {selectedTag === tag ? 'active' : ''}" onclick={() => selectedTag = tag}>{tag}</button>
          {/each}
        </div>
      {:else}
        <div class="tag-filter"></div>
      {/if}
      <div class="sort-wrap">
        <span class="sort-label">Sắp xếp:</span>
        <select class="sort-select" bind:value={sortBy}>
          <option value="newest">Mới nhất</option>
          <option value="popular">Phổ biến nhất</option>
        </select>
      </div>
    </div>

    <div class="grid">
      {#each displayedExams as exam}
        {@const st = statusOf(exam)}
        {@const sub = latestSub[exam.id]}
        {@const pct = sub?.percentage ?? 0}
        {@const rate = passRate(exam)}
        <div class="card">
          <div class="cover-wrap">
            {#if exam.cover_image_url}
              <img src={exam.cover_image_url} alt={exam.title} />
            {:else}
              <div class="cover-placeholder" style="background:{gradientFor(exam.title)}">{initial(exam.title)}</div>
            {/if}
            <div class="cover-overlay"></div>
            {#if st === 'scheduled'}
              {@const cd = examCountdown(exam)}
              <div class="countdown-overlay">
                <span class="countdown-lock">🔒</span>
                {#if cd}
                  <span class="countdown-timer">{cd}</span>
                  <span class="countdown-label">Sắp mở</span>
                {:else}
                  <span class="countdown-label">Đang mở...</span>
                {/if}
              </div>
              <span class="badge scheduled">🔒 Sắp mở</span>
            {:else if st !== 'new'}
              <span class="badge {st}">
                {st === 'passed' ? '✓ Đã pass' : st === 'failed' ? '✗ Chưa đạt' : st === 'published' ? '✓ Xuất bản' : 'Nháp'}
              </span>
            {/if}
          </div>

          <div class="card-body">
            <div class="card-title">{exam.title}</div>
            <div class="card-desc">{exam.description ?? 'Không có mô tả'}</div>
            <div class="card-meta">{fmtMeta(exam)}</div>
            {#if exam.creator_name}
              <div class="card-creator">
                👤
                {#if exam.created_by}
                  <a href="/users/{exam.created_by}" class="creator-link" onclick={(e) => e.stopPropagation()}>
                    {exam.creator_name}
                  </a>
                {:else}
                  {exam.creator_name}
                {/if}
              </div>
            {/if}
            {#if exam.tags?.length}
              <div class="tags">
                {#each exam.tags.slice(0, 3) as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            {/if}
            <div class="card-stats">
              {#if (exam.submission_count ?? 0) > 0}
                <span class="stat-pill">👥 {exam.submission_count} lượt thi</span>
                {#if rate !== null}
                  <span class="stat-pill pass">✓ {rate}% pass</span>
                {/if}
              {:else}
                <span class="stat-pill">Chưa có lượt thi</span>
              {/if}
              {#if (exam.like_count ?? 0) > 0}
                <span class="stat-pill like">❤️ {exam.like_count}</span>
              {/if}
              {#if (exam.comment_count ?? 0) > 0}
                <span class="stat-pill comment">💬 {exam.comment_count}</span>
              {/if}
            </div>
          </div>

          <div class="card-footer">
            <div class="score-wrap">
              {#if sub}
                <span class="score-text {isPassed(exam) ? 'passed' : 'failed'}">
                  {isPassed(exam) ? '✓' : '✗'} {pct.toFixed(0)}%
                </span>
                <div class="score-bar">
                  <div class="score-bar-fill {isPassed(exam) ? 'passed' : 'failed'}" style="width:{pct}%"></div>
                </div>
              {/if}
            </div>
            <div class="actions">
              <a href="/exams/{exam.id}" class="btn btn-primary">Xem</a>
              {#if $user?.role !== 'student' && (exam.created_by === $user?.id || $user?.role === 'admin')}
                <a href="/exams/{exam.id}/edit" class="btn btn-ghost">Sửa</a>
                <button class="btn btn-danger" onclick={() => deleteExam(exam.id)}>Xoá</button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

{/if}
