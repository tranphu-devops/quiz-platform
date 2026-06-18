<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { userApi, badgeApi } from '$lib/api'
  import ImageUpload from '$lib/components/ImageUpload.svelte'

  let full_name = $state('')
  let avatar_url = $state('')
  let credits = $state(null)
  let badges = $state([])
  let saving = $state(false)
  let success = $state(false)
  let error = $state('')

  // Teacher upgrade
  let upgradeLoading = $state(false)
  let upgradeError = $state('')
  let upgradeSuccess = $state(false)
  let teacherUpgradeCost = $state(100)
  let showUpgradeConfirm = $state(false)

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
        full_name = profile.full_name ?? ''
        avatar_url = profile.avatar_url ?? ''
        credits = profile.credits ?? 0
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json()
        teacherUpgradeCost = parseInt(s.teacher_upgrade_cost ?? '100', 10)
      }
      if (badgeRes.ok) badges = await badgeRes.json()
    } catch {}
  })

  async function save() {
    error = ''
    success = false
    saving = true
    try {
      const res = await userApi.updateProfile($user.id, { full_name, avatar_url })
      if (!res.ok) {
        const d = await res.json()
        error = d.error ?? 'Lỗi cập nhật'
        return
      }
      success = true
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      saving = false
    }
  }

  async function upgradeToTeacher() {
    upgradeError = ''
    upgradeLoading = true
    showUpgradeConfirm = false
    try {
      const res = await userApi.upgradeToTeacher()
      const d = await res.json()
      if (!res.ok) {
        upgradeError = d.error ?? 'Lỗi nâng cấp'
        return
      }
      credits = d.new_balance
      upgradeSuccess = true
    } catch {
      upgradeError = 'Không thể kết nối server'
    } finally {
      upgradeLoading = false
    }
  }
</script>

<style>
  h1 { margin-bottom: 1.5rem; }
  .card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); max-width: 480px; }
  .form-group { margin-bottom: 1.25rem; }
  label { display: block; margin-bottom: 0.3rem; font-size: 0.9rem; font-weight: 500; }
  input[type=text] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
  .actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
  .btn { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; font-weight: 600; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-success { background: #16a34a; color: white; }
  .btn-success:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-outline { background: white; border: 1px solid #d1d5db; color: #374151; }
  .error { color: #dc2626; margin-bottom: 1rem; font-size: 0.9rem; }
  .success { color: #16a34a; margin-bottom: 1rem; font-size: 0.9rem; }
  .role-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; color: white; background: #1e40af; }
  /* Credits section */
  .credits-section { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
  .credits-display { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
  .credits-number { font-size: 2rem; font-weight: 800; color: #1e40af; }
  .credits-label { font-size: 0.9rem; color: #6b7280; }
  .upgrade-box {
    background: linear-gradient(135deg, #eff6ff, #f0fdf4);
    border: 1px solid #bfdbfe; border-radius: 10px;
    padding: 1.25rem; margin-top: 1rem;
  }
  .upgrade-title { font-weight: 700; font-size: 1rem; margin-bottom: 0.3rem; color: #1e40af; }
  .upgrade-desc { font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem; line-height: 1.5; }
  .upgrade-cost { font-weight: 700; color: #16a34a; }
  /* Modal overlay */
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 100;
  }
  .modal {
    background: white; border-radius: 16px; padding: 2rem;
    max-width: 380px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  }
  .modal h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
  .modal p { color: #6b7280; font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5; }
  .modal-actions { display: flex; gap: 0.75rem; }
  .modal-actions .btn { flex: 1; }
  /* Badges section */
  .badges-section { margin-top: 2rem; }
  .badges-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem; }
  .badges-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 0.75rem; max-width: 480px; }
  .badge-item {
    background: var(--surface); border-radius: 12px;
    border: 1px solid var(--border); padding: 0.75rem 0.5rem;
    display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
    box-shadow: var(--shadow); transition: transform 0.15s, box-shadow 0.15s;
  }
  .badge-item:hover { transform: translateY(-2px); box-shadow: var(--shadow-hover); }
  .badge-item img { width: 52px; height: 52px; border-radius: 50%; }
  .badge-item-placeholder {
    width: 52px; height: 52px; border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    display: flex; align-items: center; justify-content: center; font-size: 1.5rem;
  }
  .badge-name { font-size: 0.72rem; font-weight: 600; text-align: center; color: var(--text); line-height: 1.3; }
  .badge-date { font-size: 0.65rem; color: var(--muted); text-align: center; }
  .badges-empty { font-size: 0.875rem; color: var(--muted); max-width: 480px; }
</style>

<h1>Hồ sơ cá nhân</h1>

<div class="card">
  {#if error}<p class="error">{error}</p>{/if}
  {#if success}<p class="success">Đã lưu thành công!</p>{/if}

  <div class="form-group">
    <label>Ảnh đại diện</label>
    <ImageUpload bind:value={avatar_url} type="avatar" label="ảnh đại diện" />
  </div>

  <div class="form-group">
    <label for="fname">Họ và tên</label>
    <input id="fname" type="text" bind:value={full_name} placeholder="Nhập họ tên..." />
  </div>

  <div class="form-group">
    <label>Email</label>
    <input type="text" value={$user?.email ?? ''} disabled style="background:#f9fafb; color:#6b7280" />
  </div>

  <div class="form-group">
    <label>Vai trò</label>
    <div><span class="role-badge">{$user?.role ?? ''}</span></div>
  </div>

  <div class="actions">
    <button class="btn btn-primary" onclick={save} disabled={saving}>
      {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
    </button>
  </div>

  <!-- Credits section -->
  <div class="credits-section">
    <div class="credits-display">
      <span class="credits-number">💳 {credits ?? '—'}</span>
      <span class="credits-label">credit hiện tại</span>
    </div>

    {#if $user?.role === 'student'}
      {#if upgradeSuccess}
        <div class="success">
          Nâng cấp thành công! Vui lòng đăng xuất và đăng nhập lại để kích hoạt role Teacher.
        </div>
      {:else}
        <div class="upgrade-box">
          <div class="upgrade-title">Nâng cấp lên Teacher</div>
          <div class="upgrade-desc">
            Trở thành giáo viên để tạo và quản lý bài thi của riêng bạn.
            Chi phí: <span class="upgrade-cost">{teacherUpgradeCost} credit</span>
          </div>
          {#if upgradeError}<p class="error" style="margin-bottom:0.75rem">{upgradeError}</p>{/if}
          <button
            class="btn btn-success"
            onclick={() => showUpgradeConfirm = true}
            disabled={upgradeLoading || (credits !== null && credits < teacherUpgradeCost)}
          >
            {upgradeLoading ? 'Đang xử lý...' : `Mua gói Teacher (${teacherUpgradeCost} credit)`}
          </button>
          {#if credits !== null && credits < teacherUpgradeCost}
            <p style="font-size:0.82rem; color:#dc2626; margin-top:0.5rem">
              Bạn cần thêm {teacherUpgradeCost - credits} credit để nâng cấp.
            </p>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Badges section (student only) -->
{#if $user?.role === 'student'}
<div class="badges-section">
  <h2>🏅 Huy hiệu đã đạt được ({badges.length})</h2>
  {#if badges.length === 0}
    <p class="badges-empty">
      Bạn chưa có huy hiệu nào. Hoàn thành tất cả đề thi trong một bộ đề để nhận huy hiệu!
    </p>
  {:else}
    <div class="badges-grid">
      {#each badges as b}
        <div class="badge-item" title={b.collection_title}>
          {#if b.badge_image_url}
            <img src={b.badge_image_url} alt={b.collection_title} />
          {:else}
            <div class="badge-item-placeholder">🎖️</div>
          {/if}
          <div class="badge-name">{b.collection_title}</div>
          <div class="badge-date">{new Date(b.earned_at).toLocaleDateString('vi-VN')}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>
{/if}

{#if showUpgradeConfirm}
<div class="overlay" role="dialog" aria-modal="true">
  <div class="modal">
    <h3>Xác nhận nâng cấp</h3>
    <p>
      Bạn sẽ dùng <strong>{teacherUpgradeCost} credit</strong> để nâng cấp tài khoản lên Teacher.
      Sau khi nâng cấp, vui lòng đăng xuất và đăng nhập lại để kích hoạt.
    </p>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick={() => showUpgradeConfirm = false}>Hủy</button>
      <button class="btn btn-success" onclick={upgradeToTeacher}>Xác nhận</button>
    </div>
  </div>
</div>
{/if}
