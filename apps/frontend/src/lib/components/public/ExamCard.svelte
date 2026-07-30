<script>
  import { examUrl, topicUrl } from '$lib/seo'

  let { exam, lang, t } = $props()
  const href = $derived(examUrl(lang, exam.slug))
</script>

<article class="card">
  <a class="card-cover" {href} aria-hidden="true" tabindex="-1">
    {#if exam.cover_image_url}
      <img src={exam.cover_image_url} alt="" loading="lazy" />
    {:else}
      <span class="card-initial">{exam.title.slice(0, 1)}</span>
    {/if}
  </a>

  <div class="card-body">
    <h3 class="card-title"><a {href}>{exam.title}</a></h3>

    {#if exam.excerpt}
      <p class="card-excerpt">{exam.excerpt}</p>
    {/if}

    <p class="card-meta">
      <span>{t('exam.questions', { count: exam.question_count })}</span>
      <span>·</span>
      <span>{t('exam.minutes', { count: exam.time_limit })}</span>
      {#if exam.passing_score}
        <span>·</span>
        <span>{t('exam.passingScore', { score: exam.passing_score })}</span>
      {/if}
    </p>

    {#if exam.tags?.length}
      <p class="card-tags">
        {#each exam.tags.slice(0, 4) as tag}
          <a class="tag" href={topicUrl(lang, tag.slug)}>{tag.label}</a>
        {/each}
      </p>
    {/if}
  </div>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card, 16px);
    overflow: hidden;
  }

  .card-cover {
    display: block;
    aspect-ratio: 16 / 9;
    background: linear-gradient(135deg, #5625d1, #6d29d3);
    display: grid;
    place-items: center;
  }

  .card-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .card-initial {
    font-size: 2.25rem;
    font-weight: 800;
    color: #fff;
    opacity: 0.9;
  }

  .card-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }

  .card-title { margin: 0; font-size: 1.05rem; line-height: 1.35; }
  .card-title a { color: var(--text); text-decoration: none; }
  .card-title a:hover { color: var(--primary); }

  .card-excerpt {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
    opacity: 0.8;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-meta {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .card-tags { margin: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }

  .tag {
    font-size: 0.78rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: var(--primary-light);
    color: var(--primary);
    text-decoration: none;
  }

  .tag:hover { text-decoration: underline; }
</style>
