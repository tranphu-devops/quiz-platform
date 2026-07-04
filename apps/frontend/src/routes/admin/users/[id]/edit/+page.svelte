<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { user } from '$lib/stores/auth'
  import { userApi } from '$lib/api'
  import ImageUpload from '$lib/components/ImageUpload.svelte'
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Input from '$lib/components/ui/Input.svelte'

  const userId = $derived($page.params.id)

  let loading     = $state(true)
  let saving      = $state(false)
  let success     = $state(false)
  let error       = $state('')
  let targetEmail = $state('')

  // Profile fields (mirror /profile)
  let full_name     = $state('')
  let avatar_url    = $state('')
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

  // Admin-only fields
  let role    = $state('student')
  let credits = $state(0)

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    if ($user.role !== 'admin') { goto('/dashboard'); return }

    try {
      const res = await userApi.adminGetUser(userId)
      if (!res.ok) {
        const d = await res.json()
        error = d.error ?? 'Không tìm thấy người dùng'
        loading = false
        return
      }
      const p = await res.json()
      targetEmail   = p.email ?? ''
      full_name     = p.full_name ?? ''
      avatar_url    = p.avatar_url ?? ''
      role          = p.role ?? 'student'
      credits       = p.credits ?? 0
      bio           = p.bio ?? ''
      birth_year    = p.birth_year ? String(p.birth_year) : ''
      gender        = p.gender ?? ''
      interests     = p.interests ?? ''
      facebook_url  = p.facebook_url ?? ''
      zalo          = p.zalo ?? ''
      tiktok_url    = p.tiktok_url ?? ''
      youtube_url   = p.youtube_url ?? ''
      instagram_url = p.instagram_url ?? ''
      linkedin_url  = p.linkedin_url ?? ''
      website_url   = p.website_url ?? ''
    } catch {
      error = 'Không thể tải thông tin người dùng'
    } finally {
      loading = false
    }
  })

  async function save() {
    error = ''; success = false; saving = true
    try {
      // 1. Update profile fields
      const profileRes = await userApi.updateProfile(userId, {
        full_name, avatar_url, bio,
        birth_year: birth_year ? parseInt(birth_year, 10) : null,
        gender, interests,
        facebook_url, zalo, tiktok_url,
        youtube_url, instagram_url, linkedin_url, website_url
      })
      if (!profileRes.ok) {
        const d = await profileRes.json()
        error = d.error ?? 'Lỗi cập nhật hồ sơ'
        return
      }

      // 2. Update role
      const roleRes = await userApi.adminUpdateRole(userId, role)
      if (!roleRes.ok) {
        const d = await roleRes.json()
        error = d.error ?? 'Lỗi cập nhật vai trò'
        return
      }

      // 3. Update credits
      const creditsVal = parseInt(String(credits), 10)
      if (!isNaN(creditsVal) && creditsVal >= 0) {
        const credRes = await userApi.adminUpdateCredits(userId, creditsVal)
        if (!credRes.ok) {
          const d = await credRes.json()
          error = d.error ?? 'Lỗi cập nhật credits'
          return
        }
      }

      success = true
      setTimeout(() => success = false, 3000)
    } catch {
      error = 'Không thể kết nối server'
    } finally {
      saving = false
    }
  }
</script>

<PageHeader
  title="Chỉnh sửa người dùng"
  breadcrumbs={[
    { label: 'Admin', href: '/admin' },
    { label: 'Người dùng', href: '/admin' },
    { label: targetEmail || userId }
  ]}
/>

<div class="edit-layout">
  {#if loading}
    <p class="loading-msg">Đang tải...</p>
  {:else if error && !targetEmail}
    <div class="error-box">{error}</div>
    <div style="margin-top:1rem"><Button variant="ghost" onclick={() => goto('/admin')}>← Quay lại Admin</Button></div>
  {:else}
    {#if error}
      <div class="error-box">{error}</div>
    {/if}
    {#if success}
      <div class="success-box">Đã lưu thành công!</div>
    {/if}

    <div class="two-col">
      <!-- Left column -->
      <div class="col-left">
        <!-- Avatar + basic info -->
        <Card title="Thông tin cơ bản">
          <div class="avatar-wrap">
            <ImageUpload bind:value={avatar_url} type="avatar" label="Ảnh đại diện" />
          </div>

          <div class="field-group">
            <label for="full_name">Họ tên</label>
            <Input id="full_name" bind:value={full_name} placeholder="Nguyễn Văn A" />
          </div>

          <div class="field-group">
            <label for="email-ro">Email <span class="readonly-tag">chỉ đọc</span></label>
            <Input id="email-ro" value={targetEmail} disabled />
          </div>
        </Card>

        <!-- Admin controls -->
        <Card title="Quyền & Credits">
          <div class="field-group">
            <label for="role-sel">Vai trò</label>
            <select id="role-sel" class="field-select" bind:value={role}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="banned">Banned</option>
            </select>
            <p class="field-hint">Thay đổi có hiệu lực sau lần đăng nhập tiếp theo của người dùng.</p>
          </div>

          <div class="field-group">
            <label for="credits-inp">Credits</label>
            <Input id="credits-inp" type="number" bind:value={credits} min="0" step="1" />
          </div>
        </Card>
      </div>

      <!-- Right column -->
      <div class="col-right">
        <!-- Personal info -->
        <Card title="Thông tin cá nhân">
          <div class="field-group">
            <label for="bio">Giới thiệu</label>
            <textarea id="bio" class="field-textarea" bind:value={bio} placeholder="Vài dòng giới thiệu..."></textarea>
          </div>

          <div class="field-row-2">
            <div class="field-group">
              <label for="birth_year">Năm sinh</label>
              <Input id="birth_year" type="number" bind:value={birth_year} min="1940" max="2010" placeholder="1990" />
            </div>

            <div class="field-group">
              <label for="gender">Giới tính</label>
              <select id="gender" class="field-select" bind:value={gender}>
                <option value="">Không hiển thị</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
          </div>

          <div class="field-group">
            <label for="interests">Sở thích</label>
            <Input id="interests" bind:value={interests} placeholder="Lập trình, thiết kế, âm nhạc..." />
          </div>
        </Card>

        <!-- Social links -->
        <Card title="Mạng xã hội">
          <div class="social-grid">
            <div class="field-group">
              <label for="facebook_url">Facebook</label>
              <Input id="facebook_url" type="url" bind:value={facebook_url} placeholder="https://facebook.com/..." />
            </div>
            <div class="field-group">
              <label for="zalo">Zalo</label>
              <Input id="zalo" bind:value={zalo} placeholder="Số điện thoại Zalo" />
            </div>
            <div class="field-group">
              <label for="tiktok_url">TikTok</label>
              <Input id="tiktok_url" type="url" bind:value={tiktok_url} placeholder="https://tiktok.com/@..." />
            </div>
            <div class="field-group">
              <label for="youtube_url">YouTube</label>
              <Input id="youtube_url" type="url" bind:value={youtube_url} placeholder="https://youtube.com/@..." />
            </div>
            <div class="field-group">
              <label for="instagram_url">Instagram</label>
              <Input id="instagram_url" type="url" bind:value={instagram_url} placeholder="https://instagram.com/..." />
            </div>
            <div class="field-group">
              <label for="linkedin_url">LinkedIn</label>
              <Input id="linkedin_url" type="url" bind:value={linkedin_url} placeholder="https://linkedin.com/in/..." />
            </div>
            <div class="field-group full-width">
              <label for="website_url">Website</label>
              <Input id="website_url" type="url" bind:value={website_url} placeholder="https://example.com" />
            </div>
          </div>
        </Card>
      </div>
    </div>

    <!-- Action bar -->
    <div class="action-bar">
      <Button variant="ghost" onclick={() => goto('/admin')}>← Quay lại</Button>
      <Button onclick={save} disabled={saving}>
        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </Button>
    </div>
  {/if}
</div>

<style>
  .edit-layout {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .loading-msg {
    text-align: center;
    color: var(--text);
    opacity: 0.6;
    padding: 3rem 0;
  }

  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    border-radius: 10px;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
  :global([data-theme="dark"]) .error-box {
    background: rgba(220,38,38,0.15);
    border-color: rgba(220,38,38,0.35);
    color: #fca5a5;
  }

  .success-box {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #16a34a;
    border-radius: 10px;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
  :global([data-theme="dark"]) .success-box {
    background: rgba(22,163,74,0.15);
    border-color: rgba(22,163,74,0.35);
    color: #86efac;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 1.25rem;
    align-items: start;
  }
  @media (max-width: 768px) {
    .two-col { grid-template-columns: 1fr; }
  }

  .col-left, .col-right {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .avatar-wrap { margin-bottom: 1rem; }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.85rem;
  }
  .field-group:last-child { margin-bottom: 0; }
  .field-group label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text);
    opacity: 0.7;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .readonly-tag {
    font-size: 0.72rem;
    font-weight: 500;
    background: var(--primary-light);
    color: var(--primary);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    opacity: 1;
  }

  .field-select {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .field-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-light);
  }

  .field-hint {
    font-size: 0.78rem;
    color: var(--text);
    opacity: 0.55;
    margin: 0.2rem 0 0;
  }

  .field-textarea {
    width: 100%;
    min-height: 90px;
    padding: 0.6rem 0.75rem;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.9rem;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }
  .field-textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-light);
  }

  .field-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .social-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .social-grid .full-width { grid-column: 1 / -1; }
  @media (max-width: 480px) {
    .social-grid { grid-template-columns: 1fr; }
    .field-row-2 { grid-template-columns: 1fr; }
  }

  .action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }
</style>
