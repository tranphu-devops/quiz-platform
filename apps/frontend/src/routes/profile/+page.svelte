<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { userApi, badgeApi, reportApi } from '$lib/api'
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

  // Personal info
  let bio           = $state('')
  let birth_year    = $state('')
  let gender        = $state('')
  let interests     = $state('')
  let facebook_url  = $state('')
  let zalo          = $state('')
  let tiktok_url    = $state('')
  let youtube_url   = $state('')
  let instagram_url = $state('')
  let linkedin_url  = $state('')
  let website_url   = $state('')

  // Teacher upgrade
  // Reports: my filed reports + (teacher/admin) inbox
  let myReports    = $state([])
  let inboxReports = $state([])
  let respondingId = $state(null)
  let respondText  = $state('')
  const REPORT_CAT_LABEL = {
    question_wrong: 'Câu hỏi sai',
    answer_wrong:   'Đáp án sai',
    image_issue:    'Hình ảnh lỗi',
    other:          'Khác'
  }
  const isStaff = $derived($user?.role === 'teacher' || $user?.role === 'admin')

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
        full_name     = profile.full_name ?? ''
        avatar_url    = profile.avatar_url ?? ''
        credits       = profile.credits ?? 0
        bio           = profile.bio ?? ''
        birth_year    = profile.birth_year ? String(profile.birth_year) : ''
        gender        = profile.gender ?? ''
        interests     = profile.interests ?? ''
        facebook_url  = profile.facebook_url ?? ''
        zalo          = profile.zalo ?? ''
        tiktok_url    = profile.tiktok_url ?? ''
        youtube_url   = profile.youtube_url ?? ''
        instagram_url = profile.instagram_url ?? ''
        linkedin_url  = profile.linkedin_url ?? ''
        website_url   = profile.website_url ?? ''
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json()
        teacherUpgradeCost = parseInt(s.teacher_upgrade_cost ?? '100', 10)
      }
      if (badgeRes.ok) badges = await badgeRes.json()
    } catch {}

    // Reports (independent of the profile fetch above)
    try {
      const mineRes = await reportApi.mine()
      if (mineRes.ok) myReports = (await mineRes.json()).reports ?? []
    } catch {}
    if ($user.role === 'teacher' || $user.role === 'admin') {
      try {
        const inboxRes = await reportApi.inbox()
        if (inboxRes.ok) inboxReports = (await inboxRes.json()).reports ?? []
      } catch {}
    }
  })

  function startRespond(r) {
    respondingId = r.id
    respondText = r.response ?? ''
  }

  async function submitRespond(r) {
    const text = respondText.trim()
    if (!text) return
    const res = await reportApi.respond(r.id, text, 'resolved')
    if (res.ok) {
      const updated = await res.json()
      inboxReports = inboxReports.map(x => x.id === r.id ? { ...x, ...updated } : x)
      respondingId = null
      respondText = ''
    }
  }

  const openInboxCount = $derived(inboxReports.filter(r => r.status === 'open').length)

  async function save() {
    error = ''; success = false; saving = true
    try {
      const res = await userApi.updateProfile($user.id, {
        full_name, avatar_url,
        bio: bio || null,
        birth_year: birth_year ? parseInt(birth_year, 10) : null,
        gender: gender || null,
        interests: interests || null,
        facebook_url: facebook_url || null,
        zalo: zalo || null,
        tiktok_url: tiktok_url || null,
        youtube_url: youtube_url || null,
        instagram_url: instagram_url || null,
        linkedin_url: linkedin_url || null,
        website_url: website_url || null
      })
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

    <div class="profile-layout">

      <!-- ── Cột trái: tài khoản ─────────────────────────────────────────── -->
      <div class="profile-col">

        <!-- Avatar + thông tin cơ bản -->
        <Card title="Thông tin cơ bản">
          {#if error}<p class="ix-error">{error}</p>{/if}
          {#if success}<p class="ix-success">Đã lưu thành công!</p>{/if}

          <div class="form-stack">
            <div class="avatar-section">
              <ImageUpload bind:value={avatar_url} type="avatar" label="ảnh đại diện" previewClass="preview-avatar-lg" />
              <div class="avatar-meta">
                <span class="role-badge" style={roleBadgeStyle($user?.role)}>{$user?.role ?? ''}</span>
                <span class="avatar-email">{$user?.email ?? ''}</span>
              </div>
            </div>

            <Input
              id="fname"
              label="Họ và tên"
              type="text"
              bind:value={full_name}
              placeholder="Nhập họ tên..."
            />

            <div>
              <Button onclick={save} loading={saving} disabled={saving}>
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </Card>

        <!-- Credits & nâng cấp -->
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

      </div>

      <!-- ── Cột phải: chi tiết ──────────────────────────────────────────── -->
      <div class="profile-col">

        <!-- Thông tin cá nhân + mạng xã hội -->
        <Card title="Thông tin cá nhân" subtitle="Thông tin hiển thị trên trang hồ sơ công khai của bạn.">
          <div class="form-stack">
            <div class="field-group">
              <label class="ix-label" for="bio">Giới thiệu bản thân</label>
              <textarea id="bio" class="ix-textarea" rows="3" bind:value={bio} placeholder="Viết vài dòng giới thiệu về bản thân..."></textarea>
            </div>

            <div class="two-col">
              <div class="field-group">
                <label class="ix-label" for="birth_year">Năm sinh</label>
                <input id="birth_year" class="ix-input" type="number" min="1940" max="2010" bind:value={birth_year} placeholder="1990" />
              </div>
              <div class="field-group">
                <label class="ix-label" for="gender">Giới tính</label>
                <select id="gender" class="ix-input ix-select" bind:value={gender}>
                  <option value="">-- Không hiển thị --</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
            </div>

            <div class="field-group">
              <label class="ix-label" for="interests">Sở thích / Lĩnh vực</label>
              <input id="interests" class="ix-input" type="text" bind:value={interests} placeholder="Lập trình, AWS, DevOps, ..." />
            </div>

            <div class="social-section-label">Mạng xã hội</div>

            <div class="social-grid">
              <div class="field-group">
                <label class="ix-label" for="facebook_url"><span class="social-icon">📘</span> Facebook</label>
                <input id="facebook_url" class="ix-input" type="url" bind:value={facebook_url} placeholder="https://facebook.com/username" />
              </div>
              <div class="field-group">
                <label class="ix-label" for="zalo"><span class="social-icon">💬</span> Zalo</label>
                <input id="zalo" class="ix-input" type="text" bind:value={zalo} placeholder="0901234567" />
              </div>
              <div class="field-group">
                <label class="ix-label" for="tiktok_url"><span class="social-icon">🎵</span> TikTok</label>
                <input id="tiktok_url" class="ix-input" type="url" bind:value={tiktok_url} placeholder="https://tiktok.com/@username" />
              </div>
              <div class="field-group">
                <label class="ix-label" for="youtube_url"><span class="social-icon">▶️</span> YouTube</label>
                <input id="youtube_url" class="ix-input" type="url" bind:value={youtube_url} placeholder="https://youtube.com/@channel" />
              </div>
              <div class="field-group">
                <label class="ix-label" for="instagram_url"><span class="social-icon">📸</span> Instagram</label>
                <input id="instagram_url" class="ix-input" type="url" bind:value={instagram_url} placeholder="https://instagram.com/username" />
              </div>
              <div class="field-group">
                <label class="ix-label" for="linkedin_url"><span class="social-icon">💼</span> LinkedIn</label>
                <input id="linkedin_url" class="ix-input" type="url" bind:value={linkedin_url} placeholder="https://linkedin.com/in/username" />
              </div>
              <div class="field-group social-full">
                <label class="ix-label" for="website_url"><span class="social-icon">🌐</span> Website / Blog</label>
                <input id="website_url" class="ix-input" type="url" bind:value={website_url} placeholder="https://yoursite.com" />
              </div>
            </div>
          </div>
        </Card>

        <!-- Huy hiệu (student only) -->
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

        <!-- Teacher/admin: report inbox -->
        {#if isStaff}
          <Card
            title="Báo lỗi cần xử lý"
            subtitle={openInboxCount > 0 ? `${openInboxCount} báo lỗi chưa xử lý` : 'Không có báo lỗi mới'}
          >
            {#if inboxReports.length === 0}
              <p class="reports-empty">Chưa có báo lỗi nào về đề thi của bạn.</p>
            {:else}
              <div class="reports-list">
                {#each inboxReports as r (r.id)}
                  <div class="report-row {r.status}">
                    <div class="report-row-head">
                      <span class="report-cat">{REPORT_CAT_LABEL[r.category] ?? r.category}</span>
                      <span class="report-status {r.status}">
                        {r.status === 'open' ? '⏳ Chưa xử lý' : '✅ Đã xử lý'}
                      </span>
                    </div>
                    <div class="report-exam">Đề: <strong>{r.exam_title ?? '—'}</strong> · bởi {r.reporter_name ?? 'Người dùng'}</div>
                    <div class="report-desc">{r.description}</div>
                    {#if r.response}
                      <div class="report-response"><strong>Phản hồi:</strong> {r.response}</div>
                    {/if}
                    {#if respondingId === r.id}
                      <textarea class="report-textarea" bind:value={respondText} rows="3" placeholder="Nhập phản hồi..."></textarea>
                      <div class="report-row-actions">
                        <Button variant="secondary" onclick={() => (respondingId = null)}>Huỷ</Button>
                        <Button variant="primary" onclick={() => submitRespond(r)}>Gửi phản hồi</Button>
                      </div>
                    {:else}
                      <div class="report-row-actions">
                        <Button variant="secondary" onclick={() => startRespond(r)}>
                          {r.status === 'open' ? 'Trả lời' : 'Sửa phản hồi'}
                        </Button>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </Card>
        {/if}

        <!-- My filed reports (tracking) -->
        {#if myReports.length > 0}
          <Card title="Báo lỗi của tôi" subtitle="Theo dõi trạng thái xử lý">
            <div class="reports-list">
              {#each myReports as r (r.id)}
                <div class="report-row {r.status}">
                  <div class="report-row-head">
                    <span class="report-cat">{REPORT_CAT_LABEL[r.category] ?? r.category}</span>
                    <span class="report-status {r.status}">
                      {r.status === 'open' ? '⏳ Đang chờ' : '✅ Đã trả lời'}
                    </span>
                  </div>
                  <div class="report-exam">Đề: <strong>{r.exam_title ?? '—'}</strong></div>
                  <div class="report-desc">{r.description}</div>
                  {#if r.response}
                    <div class="report-response"><strong>Phản hồi từ giáo viên:</strong> {r.response}</div>
                  {/if}
                </div>
              {/each}
            </div>
          </Card>
        {/if}

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
  /* ── Layout ────────────────────────────────────────────────────────────── */
  .profile-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 20px;
    align-items: start;
  }

  .profile-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  @media (max-width: 860px) {
    .profile-layout {
      grid-template-columns: 1fr;
    }
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* ── Avatar section ────────────────────────────────────────────────────── */
  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding-bottom: 4px;
  }

  .avatar-meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .avatar-email {
    font-size: 12px;
    color: var(--ix-text-muted);
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

  .role-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
    width: fit-content;
  }

  /* ── Personal info ───────────────────────────────────────────────────── */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .social-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .social-full {
    grid-column: 1 / -1;
  }

  @media (max-width: 600px) {
    .social-grid { grid-template-columns: 1fr; }
    .social-full { grid-column: auto; }
  }

  .ix-textarea {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--ix-border);
    border-radius: 8px;
    background: var(--ix-bg-app);
    color: var(--ix-text-primary);
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
    transition: border-color 0.15s;
    line-height: 1.5;
  }
  .ix-textarea:focus {
    outline: none;
    border-color: var(--primary);
  }

  .ix-input {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--ix-border);
    border-radius: 8px;
    background: var(--ix-bg-app);
    color: var(--ix-text-primary);
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .ix-input:focus {
    outline: none;
    border-color: var(--primary);
  }
  .ix-select {
    appearance: auto;
    cursor: pointer;
  }

  .social-section-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ix-text-muted);
    padding-top: 4px;
  }

  .social-icon {
    font-size: 14px;
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

  /* ── Reports ──────────────────────────────────────────────────────────────*/
  .reports-empty { font-size: 13px; color: var(--ix-text-muted); margin: 0; }
  .reports-list { display: flex; flex-direction: column; gap: 12px; }
  .report-row {
    border: 1px solid var(--ix-border); border-radius: 10px;
    padding: 12px 14px; background: var(--ix-bg-app);
  }
  .report-row.open { border-left: 3px solid var(--danger); }
  .report-row.resolved { border-left: 3px solid #16a34a; }
  .report-row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .report-cat { font-size: 12px; font-weight: 700; color: var(--ix-text-primary); }
  .report-status { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
  .report-status.open { background: rgba(239,68,68,0.12); color: var(--danger); }
  .report-status.resolved { background: rgba(22,163,74,0.14); color: #16a34a; }
  .report-exam { font-size: 12px; color: var(--ix-text-secondary); margin-bottom: 6px; }
  .report-desc { font-size: 13px; color: var(--ix-text-primary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .report-response {
    margin-top: 8px; padding: 8px 10px; border-radius: 8px;
    background: var(--ix-bg-surface); border: 1px solid var(--ix-border);
    font-size: 12.5px; color: var(--ix-text-secondary); line-height: 1.5;
  }
  .report-textarea {
    width: 100%; box-sizing: border-box; resize: vertical; margin-top: 8px;
    background: var(--ix-bg-surface); color: var(--ix-text-primary);
    border: 1px solid var(--ix-border); border-radius: 8px;
    padding: 8px 10px; font: inherit; font-size: 13px;
  }
  .report-textarea:focus { outline: none; border-color: var(--primary); }
  .report-row-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

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
