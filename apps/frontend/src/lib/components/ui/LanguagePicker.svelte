<script>
  import { t } from '$lib/i18n'

  // `value[0]` is the primary language: it decides which /{lang}/exams/{slug}
  // public page the exam gets, so the order is meaningful and the list can
  // never be empty. Everything else is a secondary language, used only by the
  // in-app catalog filter.
  let { value = $bindable(['vi']) } = $props()

  const LANGS = ['vi', 'en', 'ja']

  function toggle(code) {
    if (!value.includes(code)) {
      value = [...value, code]
      return
    }
    // Deselecting the last one would leave the exam with no language at all.
    if (value.length === 1) return
    value = value.filter(c => c !== code)
  }

  function setPrimary(code) {
    value = [code, ...value.filter(c => c !== code)]
  }
</script>

<div class="lang-chips">
  {#each LANGS as code}
    {@const on = value.includes(code)}
    <button
      type="button"
      class="lang-chip"
      class:on
      aria-pressed={on}
      onclick={() => toggle(code)}
    >
      {#if on}✓ {/if}{$t(`langSwitcher.${code}`)}
    </button>
  {/each}
</div>

{#if value.length > 1}
  <div class="primary-row">
    <label for="primary_language">{$t('examForm.primaryLanguageLabel')}</label>
    <select id="primary_language" value={value[0]} onchange={(e) => setPrimary(e.currentTarget.value)}>
      {#each value as code}
        <option value={code}>{$t(`langSwitcher.${code}`)}</option>
      {/each}
    </select>
  </div>
{/if}

<style>
  .lang-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .lang-chip {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 99px;
    padding: 0.35rem 0.9rem;
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }
  .lang-chip:hover {
    border-color: var(--primary);
    color: var(--primary);
  }
  .lang-chip.on {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
  }

  .primary-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.55rem;
  }
  .primary-row label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
    margin: 0;
  }
  .primary-row select {
    width: auto;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    border-radius: 8px;
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .primary-row select:focus {
    outline: none;
    border-color: var(--primary);
  }
</style>
