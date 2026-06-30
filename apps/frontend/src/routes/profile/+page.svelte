<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { userApi, badgeApi } from '$lib/api'
  import ImageUpload from '$lib/components/ImageUpload.svelte'
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

  let insufficientCredits = $derived(credits !== null && credits < teacherUpgradeCost)

  function roleBadgeStyle(role) {
    if (role === 'admin')   return 'background:rgba(220,38,38,0.1);color:#dc2626'
    if (role === 'teacher') return 'background:rgba(217,119,6,0.1);color:#b45309'
    if (role === 'banned')  return 'background:rgba(107,114,128,0.1);color:#6b7280'
    return 'background:rgba(37,99,235,0.1);color:#2563eb'
  }
</script>

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

</style>
