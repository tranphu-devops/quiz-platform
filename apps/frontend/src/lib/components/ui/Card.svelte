<script>
  let { title = '', subtitle = '', noPad = false, children } = $props()
</script>

<div class="ix-card">
  {#if title}
    <div class="ix-card-header">
      <div class="ix-card-title">{title}</div>
      {#if subtitle}
        <p class="ix-card-subtitle">{subtitle}</p>
      {/if}
    </div>
  {/if}
  <div class="ix-card-body" class:no-pad={noPad}>
    {@render children()}
  </div>
</div>

<style>
  .ix-card {
    background: var(--ix-bg-surface);
    border: 1px solid var(--ix-border);
    border-radius: 12px;
    box-shadow: var(--ix-shadow-card);
    overflow: hidden;
  }

  .ix-card-header {
    padding: 18px 24px 14px;
    border-bottom: 1px solid var(--ix-border);
  }

  .ix-card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--ix-text-primary);
    margin: 0;
  }

  .ix-card-subtitle {
    font-size: 13px;
    color: var(--ix-text-muted);
    margin: 3px 0 0;
    line-height: 1.4;
  }

  .ix-card-body {
    padding: 24px;
  }

  .ix-card-body.no-pad {
    padding: 0;
  }
</style>
