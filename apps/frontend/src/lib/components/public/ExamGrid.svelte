<script>
  import ExamCard from './ExamCard.svelte'

  let { items, lang, t, empty } = $props()
</script>

{#if items.length === 0}
  <p class="empty">{empty}</p>
{:else}
  <div class="grid">
    {#each items as exam (exam.slug)}
      <ExamCard {exam} {lang} {t} />
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.25rem;
  }

  .empty {
    padding: 2rem;
    text-align: center;
    opacity: 0.7;
    border: 1px dashed var(--border);
    border-radius: var(--radius-card, 16px);
  }
</style>
