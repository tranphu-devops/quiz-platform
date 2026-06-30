<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user, session, clearAuth } from '$lib/stores/auth'
  import { userApi, badgeApi } from '$lib/api'
  import ImageUpload from '$lib/components/ImageUpload.svelte'
  import Sidebar from '$lib/components/ui/Sidebar.svelte'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Input from '$lib/components/ui/Input.svelte'

  let full_name       = $state('')
  let avatar_url      = $state('')
  let credits         = $state(null)
  let badges          = $state([])
  let saving          = $state(false)
  let success         = $state(false)
  let error           = $state('')
  let mobileSidebarOpen = $state(false)

  // Teacher upgrade
  let upgradeLoading      = $state(false)
  let upgradeError        = $state('')
  let upgradeSuccess      = $state(false)
  let teacherUpgradeCost  = $state(100)
  let showUpgradeConfirm  = $state(false)

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    try {
      const [profileRes, settingsRes, badgeRes] = await Promise.all([
        userApi.getProfile($user.id),
        userApi.getPublicSettings(),
        badgeApi.list($user.id)
      ])
      if (profileRes.ok) {
        const profile = await profileRes.json()
        full_name  = profile.full_name ?? ''
        avatar_url = profile.avatar_url ?? ''
        credits    = profile.credits ?? 0
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json()
        teacherUpgradeCost = parseInt(s.teacher_upgrade_cost ?? '100', 10)
      }
      if (badgeRes.ok) badges = await badgeRes.json()
    } catch {}
  })

  async function save() {
    error = ''; success = false; saving = true
    try {
      const res = await userApi.updateProfile($user.id, { full_name, avatar_url })
      if (!res.ok) { const d = await res.json(); error = d.error ?? 'Lỗi cập nhật'; return }
      success = true
    } catch { error = 'Không thể kết nối server' } finally { saving = false }
  }

  async function upgradeToTeacher() {
    upgradeError = ''; upgradeLoading = true; showUpgradeConfirm = false
    try {
      const res = await userApi.upgradeToTeacher()
      const d = await res.json()
      if (!res.ok) { upgradeError = d.error ?? 'Lỗi nâng cấp'; return }
      credits = d.new_balance
      upgradeSuccess = true
    } catch { upgradeError = 'Không thể kết nối server' } finally { upgradeLoading = false }
  }

  async function logout() {
    await clearAuth()
    goto('/login')
  }

  // ── Icon strings ───────────────────────────────────────────────────────────
  const I = {
    home:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7L8 2l6 5v7H10.5v-4h-5v4H2z"/></svg>`,
    document: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="1.5" width="10" height="13" rx="1.5"/><line x1="5.5" y1="5.5" x2="10.5" y2="5.5"/><line x1="5.5" y1="8" x2="10.5" y2="8"/><line x1="5.5" y1="10.5" x2="8.5" y2="10.5"/></svg>`,
    folder:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 4a1 1 0 011-1H6l1.5 2H13a1 1 0 011 1v6.5a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4z"/></svg>`,
    person:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="5.5" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5"/></svg>`,
    shield:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5L2 4.5v3.5c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4.5z"/></svg>`,
    credit:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><line x1="1.5" y1="6.5" x2="14.5" y2="6.5"/><line x1="4" y1="10" x2="6.5" y2="10"/></svg>`,
    menu:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="5" x2="14" y2="5"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="11" x2="14" y2="11"/></svg>`,
  }

  // ── Sidebar sections ───────────────────────────────────────────────────────
  let sections = $derived([
    {
      label: 'ĐIỀU HƯỚNG',
      items: [
        { icon: I.home,     label: 'Dashboard', href: '/dashboard' },
        { icon: I.document, label: 'Đề thi',    href: '/exams' },
        ...($user?.role !== 'student' ? [{ icon: I.folder, label: 'Bộ đề', href: '/collections' }] : []),
        ...($user?.role === 'admin'   ? [{ icon: I.shield, label: 'Quản trị', href: '/admin' }]    : []),
      ]
    },
    {
      label: 'TÀI KHOẢN',
      items: [
        { icon: I.person, label: 'Hồ sơ', active: true },
      ]
    }
  ])

  let userInfo = $derived({
    name:  $session?.user?.user_metadata?.full_name ?? null,
    email: $user?.email ?? '',
    role:  $user?.role ?? '',
    avatarUrl: avatar_url || null,
  })

  let insufficientCredits = $derived(credits !== null && credits < teacherUpgradeCost)

  function roleBadgeStyle(role) {
    if (role === 'admin')   return 'background:rgba(220,38,38,0.1);color:#dc2626'
    if (role === 'teacher') return 'background:rgba(217,119,6,0.1);color:#b45309'
    if (role === 'banned')  return 'background:rgba(107,114,128,0.1);color:#6b7280'
    return 'background:rgba(37,99,235,0.1);color:#2563eb'
  }
</script>

<!-- Mobile sidebar overlay -->
{#if mobileSidebarOpen}
  <div
    class="ix-overlay"
    role="presentation"
    onclick={() => mobileSidebarOpen = false}
    onkeydown={() => mobileSidebarOpen = false}
  ></div>
{/if}

<div class="profile-shell">
  <Sidebar
    {sections}
    {userInfo}
    onLogout={logout}
    mobileOpen={mobileSidebarOpen}
    onMobileClose={() => mobileSidebarOpen = false}
  >
    <!-- Credits display in sidebar -->
    {#if credits !== null}
      <div class="sidebar-credits">
        <div class="sidebar-credits-num">{@html I.credit} {credits}</div>
        <div class="sidebar-credits-lbl">credits</div>
        {#if $user?.role === 'student' && !upgradeSuccess}
          <Button variant="cta" size="sm" onclick={() => showUpgradeConfirm = true} disabled={upgradeLoading || insufficientCredits}>
            Nâng cấp Teacher
          </Button>
        {/if}
      </div>
    {/if}
  </Sidebar>

  <div class="profile-content">
    <!-- Mobile topbar -->
    <div class="mobile-topbar">
      <button
        class="mobile-menu-btn"
        onclick={() => mobileSidebarOpen = true}
        aria-label="Mở menu điều hướng"
      >
        {@html I.menu}
      </button>
      <span class="mobile-title">Hồ sơ cá nhân</span>
    </div>

    <PageHeader title="Hồ sơ cá nhân" subtitle="Quản lý thông tin tài khoản và cài đặt cá nhân" />

    <div class="profile-grid">

      <!-- ── Profile form card ─────────────────────────────────────────── -->
      <Card title="Thông tin cơ bản" subtitle="Cập nhật ảnh đại diện và họ tên hiển thị của bạn.">
        {#if error}<p class="ix-error">{error}</p>{/if}
        {#if success}<p class="ix-success">Đã lưu thành công!</p>{/if}

        <div class="form-stack">
          <div class="field-group">
            <span class="ix-label">Ảnh đại diện</span>
            <ImageUpload bind:value={avatar_url} type="avatar" label="ảnh đại diện" />
          </div>

          <Input
            id="fname"
            label="Họ và tên"
            type="text"
            bind:value={full_name}
            placeholder="Nhập họ tên..."
          />

          <Input
            id="email"
            label="Email"
            type="text"
            value={$user?.email ?? ''}
            disabled={true}
          />

          <div class="role-row">
            <span class="ix-label">Vai trò</span>
            <span class="role-badge" style={roleBadgeStyle($user?.role)}>{$user?.role ?? ''}</span>
          </div>

          <div>
            <Button onclick={save} loading={saving} disabled={saving}>
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </Card>

      <!-- ── Credits card ──────────────────────────────────────────────── -->
      <Card title="Credits & Nâng cấp" subtitle="Số dư credit và tuỳ chọn nâng cấp tài khoản.">
        <div class="credits-display">
          <div class="credits-num">{credits ?? '—'}</div>
          <div class="credits-lbl">credits hiện tại</div>
        </div>

        {#if $user?.role === 'student'}
          {#if upgradeSuccess}
            <div class="ix-success" style="margin-top:16px">
              Nâng cấp thành công! Vui lòng đăng xuất và đăng nhập lại để kích hoạt role Teacher.
            </div>
          {:else}
            <div class="upgrade-box">
              <div class="upgrade-title">Nâng cấp lên Teacher</div>
              <p class="upgrade-desc">
                Tạo và quản lý bài thi của riêng bạn. Chi phí:
                <strong style="color:var(--ix-cta-green-bg)">{teacherUpgradeCost} credit</strong>
              </p>
              {#if upgradeError}<p class="ix-error">{upgradeError}</p>{/if}
              {#if insufficientCredits}
                <p class="ix-note">Bạn cần thêm {teacherUpgradeCost - credits} credit để nâng cấp.</p>
              {/if}
              <Button
                variant="cta"
                onclick={() => showUpgradeConfirm = true}
                disabled={upgradeLoading || insufficientCredits}
                loading={upgradeLoading}
              >
                Mua gói Teacher ({teacherUpgradeCost} credit)
              </Button>
            </div>
          {/if}
        {:else}
          <p class="ix-note" style="margin-top:12px">Tài khoản <strong>{$user?.role}</strong> — không cần nâng cấp.</p>
        {/if}
      </Card>

      <!-- ── Badges card (student only) ───────────────────────────────── -->
      {#if $user?.role === 'student'}
        <Card
          title="Huy hiệu đã đạt được"
          subtitle={badges.length > 0 ? `${badges.length} huy hiệu` : 'Chưa có huy hiệu nào'}
        >
          {#if badges.length === 0}
            <p class="badges-empty">
              Hoàn thành tất cả đề thi trong một bộ đề để nhận huy hiệu!
            </p>
          {:else}
            <div class="badges-grid">
              {#each badges as b}
                <div class="badge-item" title={b.collection_title}>
                  <div class="badge-img-wrap">
                    {#if b.badge_image_url}
                      <img src={b.badge_image_url} alt={b.collection_title} />
                    {:else}
                      <div class="badge-ph">🎖️</div>
                    {/if}
                  </div>
                  <div class="badge-name">{b.collection_title}</div>
                  <div class="badge-date">{new Date(b.earned_at).toLocaleDateString('vi-VN')}</div>
                </div>
              {/each}
            </div>
          {/if}
        </Card>
      {/if}
    </div>
  </div>
</div>

<!-- Confirm upgrade modal -->
{#if showUpgradeConfirm}
  <div class="ix-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="ix-modal">
      <h3 class="ix-modal-title" id="modal-title">Xác nhận nâng cấp</h3>
      <p class="ix-modal-body">
        Bạn sẽ dùng <strong>{teacherUpgradeCost} credit</strong> để nâng cấp tài khoản lên Teacher.
        Sau khi nâng cấp, vui lòng đăng xuất và đăng nhập lại để kích hoạt.
      </p>
      <div class="ix-modal-actions">
        <Button variant="secondary" onclick={() => showUpgradeConfirm = false}>Hủy</Button>
        <Button variant="success" onclick={upgradeToTeacher} loading={upgradeLoading}>Xác nhận</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Shell layout ─────────────────────────────────────────────────────── */
  .profile-shell {
    display: flex;
    margin: -2rem -1.5rem;
    min-height: calc(100vh - 60px);
    background: var(--ix-bg-app);
  }

  .profile-content {
    flex: 1;
    min-width: 0;
    padding: 32px 40px;
    overflow: auto;
  }

  /* ── Shared overlay ───────────────────────────────────────────────────── */
  :global(.ix-overlay) {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 199;
    backdrop-filter: blur(2px);
  }

  /* ── Mobile topbar ────────────────────────────────────────────────────── */
  .mobile-topbar {
    display: none;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .mobile-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--ix-border);
    border-radius: 8px;
    background: var(--ix-bg-surface);
    color: var(--ix-text-secondary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .mobile-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--ix-text-primary);
  }

  /* ── Sidebar credits block ────────────────────────────────────────────── */
  .sidebar-credits {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sidebar-credits-num {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--ix-text-primary);
  }

  .sidebar-credits-lbl {
    font-size: 12px;
    color: var(--ix-text-muted);
    margin-top: -4px;
  }

  /* ── Form layout ──────────────────────────────────────────────────────── */
  .profile-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 560px;
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .ix-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--ix-text-secondary);
    line-height: 1;
  }

  .role-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .role-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
    width: fit-content;
  }

  /* ── Credits card ─────────────────────────────────────────────────────── */
  .credits-display {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 20px;
  }

  .credits-num {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--ix-text-primary);
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .credits-lbl {
    font-size: 14px;
    color: var(--ix-text-muted);
  }

  .upgrade-box {
    background: var(--ix-bg-app);
    border: 1px solid var(--ix-border);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .upgrade-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--ix-text-primary);
  }

  .upgrade-desc {
    font-size: 13px;
    color: var(--ix-text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Badges grid ──────────────────────────────────────────────────────── */
  .badges-empty {
    font-size: 13px;
    color: var(--ix-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .badges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 12px;
  }

  .badge-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 8px;
    border: 1px solid var(--ix-border);
    border-radius: 10px;
    background: var(--ix-bg-app);
    transition: border-color 0.15s, transform 0.15s;
    cursor: default;
  }

  .badge-item:hover {
    border-color: var(--ix-text-muted);
    transform: translateY(-2px);
  }

  .badge-img-wrap {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .badge-ph {
    font-size: 1.4rem;
    line-height: 1;
  }

  .badge-name {
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    color: var(--ix-text-primary);
    line-height: 1.3;
  }

  .badge-date {
    font-size: 10px;
    color: var(--ix-text-muted);
    text-align: center;
  }

  /* ── Feedback ─────────────────────────────────────────────────────────── */
  .ix-error   { color: var(--danger); font-size: 14px; margin: 0 0 4px; }
  .ix-success { color: #16a34a; font-size: 14px; margin: 0 0 4px; }
  .ix-note    { font-size: 12px; color: var(--ix-text-muted); margin: 0; }

  /* ── Confirm modal ────────────────────────────────────────────────────── */
  .ix-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: 1rem;
  }

  .ix-modal {
    background: var(--ix-bg-surface);
    border: 1px solid var(--ix-border);
    border-radius: 14px;
    padding: 28px;
    max-width: 380px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  }

  .ix-modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--ix-text-primary);
    margin: 0 0 8px;
  }

  .ix-modal-body {
    font-size: 14px;
    color: var(--ix-text-secondary);
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .ix-modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* ── Mobile ───────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .profile-shell {
      margin: -1.25rem -1rem;
      flex-direction: column;
    }

    .profile-content {
      padding: 20px 16px;
    }

    .mobile-topbar {
      display: flex;
    }
  }
</style>
