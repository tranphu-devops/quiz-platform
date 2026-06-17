<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/auth'
  import { userApi } from '$lib/api'
  import ImageUpload from '$lib/components/ImageUpload.svelte'

  let full_name = $state('')
  let avatar_url = $state('')
  let saving = $state(false)
  let success = $state(false)
  let error = $state('')

  onMount(async () => {
    if (!$user) { goto('/login'); return }
    try {
      const res = await userApi.getProfile($user.id)
      if (res.ok) {
        const profile = await res.json()
        full_name = profile.full_name ?? ''
        avatar_url = profile.avatar_url ?? ''
      }
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
</script>

<style>
  h1 { margin-bottom: 1.5rem; }
  .card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); max-width: 480px; }
  .form-group { margin-bottom: 1.25rem; }
  label { display: block; margin-bottom: 0.3rem; font-size: 0.9rem; font-weight: 500; }
  input[type=text] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
  .actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
  .btn { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
  .btn-primary { background: #1e40af; color: white; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .error { color: #dc2626; margin-bottom: 1rem; font-size: 0.9rem; }
  .success { color: #16a34a; margin-bottom: 1rem; font-size: 0.9rem; }
  .role-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; color: white; background: #1e40af; }
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
</div>
