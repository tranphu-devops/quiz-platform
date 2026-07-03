<script>
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'

  const status = $derived($page.status ?? 500)
  const isNotFound = $derived(status === 404)
  const is5xx = $derived(status >= 500)

  const title = $derived(
    isNotFound ? 'Không tìm thấy trang'
    : is5xx    ? 'Máy chủ gặp sự cố'
    : 'Đã có lỗi xảy ra'
  )
  const subtitle = $derived(
    isNotFound ? 'Trang bạn tìm không tồn tại, đã bị di chuyển hoặc đường dẫn bị sai.'
    : is5xx    ? 'Hệ thống đang gặp trục trặc tạm thời. Vui lòng thử lại sau ít phút.'
    : ($page.error?.message || 'Yêu cầu của bạn không thể hoàn tất.')
  )
  const emoji = $derived(isNotFound ? '🧭' : is5xx ? '🛠️' : '⚠️')
</script>

<div class="err-wrap">
  <div class="err-card">
    <div class="err-emoji">{emoji}</div>
    <div class="err-code">{status}</div>
    <h1 class="err-title">{title}</h1>
    <p class="err-sub">{subtitle}</p>
    <div class="err-actions">
      <a href="/dashboard" class="err-btn err-btn-primary">← Về trang chủ</a>
      {#if is5xx}
        <button class="err-btn err-btn-ghost" onclick={() => location.reload()}>Thử lại</button>
      {:else}
        <button class="err-btn err-btn-ghost" onclick={() => history.length > 1 ? history.back() : goto('/dashboard')}>Quay lại</button>
      {/if}
    </div>
    <a href="/exams" class="err-link">Xem danh sách đề thi</a>
  </div>
</div>

<style>
  .err-wrap {
    min-height: 65vh;
    display: flex; align-items: center; justify-content: center;
    padding: 2rem 1rem;
  }
  .err-card {
    text-align: center; max-width: 460px; width: 100%;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-card); box-shadow: var(--shadow);
    padding: 2.75rem 2rem 2.25rem; position: relative; overflow: hidden;
  }
  .err-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px;
    background: linear-gradient(135deg, var(--primary), var(--accent));
  }
  .err-emoji { font-size: 2.6rem; margin-bottom: 0.4rem; }
  .err-code {
    font-size: clamp(3.5rem, 12vw, 5.5rem); font-weight: 900; line-height: 1;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
  }
  .err-title { font-size: 1.25rem; font-weight: 800; color: var(--text); margin-bottom: 0.5rem; }
  .err-sub { font-size: 0.92rem; color: var(--muted); line-height: 1.6; margin-bottom: 1.5rem; }
  .err-actions { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
  .err-btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0.65rem 1.3rem; border-radius: var(--radius-btn);
    font-size: 0.9rem; font-weight: 700; cursor: pointer; text-decoration: none;
    border: none; font-family: inherit; transition: all 0.15s;
  }
  .err-btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff;
    box-shadow: 0 4px 14px rgba(99,102,241,0.35);
  }
  .err-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.5); }
  .err-btn-ghost { background: var(--bg); color: var(--text); border: 1px solid var(--border); }
  .err-btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
  .err-link { font-size: 0.85rem; color: var(--muted); text-decoration: none; }
  .err-link:hover { color: var(--primary); text-decoration: underline; }
</style>
