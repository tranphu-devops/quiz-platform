<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { userApi, examApi } from '$lib/api'
  import { htmlToText } from '$lib/sanitizeHtml'
  import { t, locale, localeCode } from '$lib/i18n'

  let profile   = $state(null)
  let exams     = $state([])
  let loading   = $state(true)
  let error     = $state('')

  const GRADIENTS = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#3b82f6,#6366f1)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'linear-gradient(135deg,#0ea5e9,#6366f1)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#10b981,#3b82f6)',
  ]
  function gradientFor(title) {
    return GRADIENTS[(title ?? '').charCodeAt(0) % GRADIENTS.length]
  }
  function initial(title) { return (title ?? '?').charAt(0).toUpperCase() }

  function fmtJoined(date) {
    if (!date) return ''
    return new Date(date).toLocaleDateString(localeCode($locale), { year: 'numeric', month: 'long' })
  }

  function roleBadge(role) {
    if (role === 'admin')   return { label: $t('roles.admin'),   color: '#dc2626', bg: 'rgba(220,38,38,0.1)' }
    if (role === 'teacher') return { label: $t('roles.teacher'), color: '#b45309', bg: 'rgba(217,119,6,0.1)' }
    return { label: $t('roles.student'), color: '#2563eb', bg: 'rgba(37,99,235,0.1)' }
  }

  function genderLabel(g) {
    if (g === 'male') return $t('profile.genderMale')
    if (g === 'female') return $t('profile.genderFemale')
    if (g === 'other') return $t('profile.genderOther')
    return null
  }

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    const userId = $page.params.id
    try {
      const [profileRes, examRes] = await Promise.all([
        userApi.getPublicProfile(userId),
        examApi.listByCreator(userId)
      ])
      if (!profileRes.ok) { error = $t('usersPublic.notFound'); return }
      profile = await profileRes.json()
      if (examRes.ok) exams = await examRes.json()
    } catch { error = $t('imageUpload.connectionError') } finally { loading = false }
  })

  const SOCIAL = [
    { key: 'facebook_url',  label: 'Facebook',   icon: '📘', prefix: '' },
    { key: 'zalo',          label: 'Zalo',        icon: '💬', prefix: 'https://zalo.me/' },
    { key: 'tiktok_url',    label: 'TikTok',      icon: '🎵', prefix: '' },
    { key: 'youtube_url',   label: 'YouTube',     icon: '▶️',  prefix: '' },
    { key: 'instagram_url', label: 'Instagram',   icon: '📸', prefix: '' },
    { key: 'linkedin_url',  label: 'LinkedIn',    icon: '💼', prefix: '' },
    { key: 'website_url',   label: 'Website',     icon: '🌐', prefix: '' },
  ]

  function socialHref(s, profile) {
    const val = profile[s.key]
    if (!val) return null
    if (s.prefix && !val.startsWith('http')) return s.prefix + val
    return val
  }
</script>

{#if loading}
  <div class="loading-wrap">{$t('common.loading')}</div>
{:else if error}
  <div class="error-wrap">{error}</div>
{:else if profile}
  {@const rb = roleBadge(profile.role)}
  {@const gl = genderLabel(profile.gender)}
  {@const socialLinks = SOCIAL.map(s => ({ ...s, href: socialHref(s, profile) })).filter(s => s.href)}

  <!-- ── Hero ───────────────────────────────────────────────────────────── -->
  <div class="hero">
    <div class="hero-inner">
      <div class="avatar-wrap">
        {#if profile.avatar_url}
          <img class="avatar" src={profile.avatar_url} alt={profile.full_name} />
        {:else}
          <div class="avatar avatar-ph" style="background:{gradientFor(profile.full_name)}">
            {initial(profile.full_name)}
          </div>
        {/if}
      </div>

      <div class="hero-info">
        <div class="name-row">
          <h1 class="display-name">{profile.full_name || profile.email}</h1>
          <span class="role-chip" style="background:{rb.bg};color:{rb.color}">{rb.label}</span>
        </div>
        <p class="hero-email">{profile.email}</p>

        {#if profile.bio}
          <p class="hero-bio">{profile.bio}</p>
        {/if}

        <div class="meta-row">
          {#if gl}
            <span class="meta-chip">👤 {gl}</span>
          {/if}
          {#if profile.birth_year}
            <span class="meta-chip">🎂 {profile.birth_year}</span>
          {/if}
          {#if profile.interests}
            <span class="meta-chip">✨ {profile.interests}</span>
          {/if}
          {#if profile.joined_at}
            <span class="meta-chip">📅 {$t('usersPublic.joined', { date: fmtJoined(profile.joined_at) })}</span>
          {/if}
        </div>

        {#if socialLinks.length > 0}
          <div class="social-row">
            {#each socialLinks as s}
              <a class="social-btn" href={s.href} target="_blank" rel="noopener noreferrer" title={s.label}>
                <span>{s.icon}</span>
                <span class="social-label">{s.label}</span>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- ── Exams ───────────────────────────────────────────────────────────── -->
  <section class="exams-section">
    <div class="section-heading">
      {$t('usersPublic.examsCreated')}
      <span class="count-pill">{exams.length}</span>
    </div>

    {#if exams.length === 0}
      <p class="empty">{$t('usersPublic.noExamsPublished')}</p>
    {:else}
      <div class="exam-grid">
        {#each exams as exam}
          <a class="exam-card" href="/exams/{exam.id}">
            <div class="exam-cover">
              {#if exam.cover_image_url}
                <img src={exam.cover_image_url} alt={exam.title} class="cover-img" />
              {:else}
                <div class="cover-ph" style="background:{gradientFor(exam.title)}">
                  <span class="cover-initial">{initial(exam.title)}</span>
                </div>
              {/if}
            </div>
            <div class="exam-body">
              <div class="exam-title">{exam.title}</div>
              {#if htmlToText(exam.description)}
                <p class="exam-desc">{htmlToText(exam.description)}</p>
              {/if}
              <div class="exam-meta">
                <span>{$t('exams.minutes', { n: exam.time_limit })}</span>
                {#if exam.passing_score != null}
                  <span>{$t('exams.passThreshold', { pct: exam.passing_score })}</span>
                {/if}
                {#if exam.submission_count > 0}
                  <span>{$t('exams.attemptsCount', { n: exam.submission_count })}</span>
                {/if}
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .loading-wrap, .error-wrap {
    text-align: center;
    padding: 4rem 1rem;
    color: var(--ix-text-muted);
    font-size: 15px;
  }

  /* ── Hero ─────────────────────────────────────────────────────────────── */
  .hero {
    background: var(--ix-bg-surface);
    border: 1px solid var(--ix-border);
    border-radius: var(--radius-card);
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .hero-inner {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }
  @media (max-width: 600px) {
    .hero-inner { flex-direction: column; align-items: center; text-align: center; }
  }

  .avatar-wrap { flex-shrink: 0; }

  .avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--ix-border);
  }
  .avatar-ph {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.2rem;
    font-weight: 800;
    color: #fff;
  }

  .hero-info { flex: 1; min-width: 0; }

  .name-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .display-name {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--ix-text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .role-chip {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 99px;
  }

  .hero-email {
    font-size: 13px;
    color: var(--ix-text-muted);
    margin: 0 0 10px;
  }

  .hero-bio {
    font-size: 14px;
    color: var(--ix-text-secondary);
    line-height: 1.6;
    margin: 0 0 12px;
    white-space: pre-wrap;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }

  .meta-chip {
    font-size: 12px;
    color: var(--ix-text-secondary);
    background: var(--ix-bg-app);
    border: 1px solid var(--ix-border);
    border-radius: 99px;
    padding: 3px 10px;
  }

  .social-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .social-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border: 1px solid var(--ix-border);
    border-radius: 8px;
    background: var(--ix-bg-app);
    color: var(--ix-text-primary);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    transition: border-color 0.15s, background 0.15s;
  }
  .social-btn:hover {
    border-color: var(--primary);
    background: var(--primary-light);
    color: var(--primary);
  }
  .social-label { font-size: 13px; }

  /* ── Exams section ────────────────────────────────────────────────────── */
  .exams-section { }

  .section-heading {
    font-size: 1rem;
    font-weight: 800;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--text);
  }
  .count-pill {
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--primary-light);
    color: var(--primary);
    padding: 0.1rem 0.5rem;
    border-radius: 99px;
  }

  .empty {
    font-size: 14px;
    color: var(--ix-text-muted);
    padding: 2rem 0;
  }

  .exam-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
  @media (max-width: 860px) { .exam-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 520px) { .exam-grid { grid-template-columns: 1fr; } }

  .exam-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    overflow: hidden;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
  }
  .exam-card:hover {
    box-shadow: var(--shadow-hover);
    transform: translateY(-2px);
    border-color: #c4b5fd;
  }

  .exam-cover {
    aspect-ratio: 4/3;
    overflow: hidden;
    flex-shrink: 0;
  }
  .cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cover-ph {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cover-initial {
    font-size: 2rem;
    font-weight: 800;
    color: rgba(255,255,255,0.9);
  }

  .exam-body {
    padding: 0.85rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .exam-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .exam-desc {
    font-size: 0.78rem;
    color: var(--muted);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
  }

  .exam-meta {
    margin-top: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .exam-meta span::after {
    content: '·';
    margin-left: 6px;
  }
  .exam-meta span:last-child::after { content: ''; }
</style>
