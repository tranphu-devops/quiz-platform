<script>
  let {
    variant = 'primary',
    type = 'button',
    disabled = false,
    loading = false,
    size = 'md',
    onclick,
    children,
  } = $props()
</script>

<button
  {type}
  class="ix-btn ix-btn--{variant} ix-btn--{size}"
  disabled={disabled || loading}
  {onclick}
>
  {#if loading}
    <span class="ix-btn-spinner" aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</button>

<style>
  .ix-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.1s, background 0.1s, border-color 0.1s, color 0.1s;
    white-space: nowrap;
    font-family: inherit;
    line-height: 1;
  }

  .ix-btn:focus-visible {
    outline: 2px solid var(--ix-btn-black-bg);
    outline-offset: 2px;
  }

  .ix-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Sizes */
  .ix-btn--md { padding: 9px 16px; }
  .ix-btn--sm { padding: 5px 11px; font-size: 13px; }
  .ix-btn--xs { padding: 3px 8px; font-size: 12px; border-radius: 6px; }

  /* Primary — black */
  .ix-btn--primary {
    background: var(--ix-btn-black-bg);
    color: var(--ix-btn-black-fg);
  }
  .ix-btn--primary:hover:not(:disabled) { opacity: 0.82; }

  /* Secondary — outline */
  .ix-btn--secondary {
    background: var(--ix-bg-surface);
    color: var(--ix-text-primary);
    border: 1px solid var(--ix-border);
  }
  .ix-btn--secondary:hover:not(:disabled) { background: var(--ix-bg-hover); }

  /* CTA — green */
  .ix-btn--cta {
    background: var(--ix-cta-green-bg);
    color: var(--ix-cta-green-fg);
    width: 100%;
    justify-content: center;
    border-radius: 8px;
  }
  .ix-btn--cta:hover:not(:disabled) { opacity: 0.88; }

  /* Danger outline */
  .ix-btn--danger {
    background: var(--ix-bg-surface);
    color: var(--danger);
    border: 1px solid var(--ix-border);
  }
  .ix-btn--danger:hover:not(:disabled) {
    border-color: var(--danger);
    background: rgba(239, 68, 68, 0.06);
  }

  /* Success */
  .ix-btn--success {
    background: #16a34a;
    color: #fff;
  }
  .ix-btn--success:hover:not(:disabled) { opacity: 0.88; }

  /* Spinner */
  .ix-btn-spinner {
    width: 12px;
    height: 12px;
    border: 1.5px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: ix-spin 0.55s linear infinite;
    flex-shrink: 0;
  }

  @keyframes ix-spin {
    to { transform: rotate(360deg); }
  }
</style>
