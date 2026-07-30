<script>
  import { topicUrl } from '$lib/seo'

  // The hub links that make the catalog a tree rather than a flat list.
  let { topics, lang, current = null, heading } = $props()
</script>

{#if topics?.length}
  <section class="topics">
    <h2 class="topics-title">{heading}</h2>
    <nav class="topics-list">
      {#each topics as topic}
        {#if topic.slug !== current}
          <a href={topicUrl(lang, topic.slug)}>
            {topic.label}<span class="count">{topic.count ?? topic.exam_count}</span>
          </a>
        {/if}
      {/each}
    </nav>
  </section>
{/if}

<style>
  .topics { margin: 0 0 2rem; }

  .topics-title {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 700;
    opacity: 0.85;
  }

  .topics-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }

  .topics-list a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-size: 0.88rem;
  }

  .topics-list a:hover { border-color: var(--primary); color: var(--primary); }

  .count { font-size: 0.75rem; opacity: 0.6; }
</style>
