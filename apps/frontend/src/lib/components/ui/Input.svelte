<script>
  let {
    label = '',
    hint = '',
    id = '',
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    style = '',
    min = undefined,
    max = undefined,
    step = undefined,
  } = $props()
</script>

<div class="ix-field">
  {#if label}
    <label class="ix-label" for={id}>{label}</label>
  {/if}
  <input
    {id}
    {type}
    class="ix-input"
    bind:value
    {placeholder}
    {disabled}
    {style}
    {min}
    {max}
    {step}
  />
  {#if hint}
    <p class="ix-hint">{hint}</p>
  {/if}
</div>

<style>
  .ix-field {
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

  .ix-input {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--ix-border);
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    color: var(--ix-text-primary);
    background: var(--ix-bg-surface);
    transition: border-color 0.1s, box-shadow 0.1s;
    outline: none;
    box-sizing: border-box;
  }

  .ix-input::placeholder {
    color: var(--ix-text-muted);
  }

  .ix-input:focus {
    border-color: var(--ix-text-primary);
    box-shadow: 0 0 0 3px var(--ix-focus-ring);
  }

  .ix-input:disabled {
    background: var(--ix-bg-app);
    color: var(--ix-text-muted);
    cursor: not-allowed;
  }

  .ix-hint {
    font-size: 12px;
    color: var(--ix-text-muted);
    margin: 0;
    line-height: 1.4;
  }
</style>
