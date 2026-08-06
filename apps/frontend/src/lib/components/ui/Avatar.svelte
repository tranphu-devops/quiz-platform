<script>
  let { src = null, name = '', size = 32, square = false } = $props()

  const initial = $derived((name || '?').trim().charAt(0).toUpperCase())
</script>

<span class="ix-avatar" class:square style="--ix-avatar-size:{size}px">
  {#if src}
    <img {src} alt="" />
  {:else}
    {initial}
  {/if}
</span>

<style>
  .ix-avatar {
    width: var(--ix-avatar-size);
    height: var(--ix-avatar-size);
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    overflow: hidden;
    flex-shrink: 0;
    font-size: calc(var(--ix-avatar-size) * 0.42);
    line-height: 1;
  }

  .ix-avatar.square {
    border-radius: calc(var(--ix-avatar-size) * 0.25);
  }

  .ix-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
