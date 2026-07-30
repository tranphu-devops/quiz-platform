<script>
  import { publicT } from '$lib/i18n/public'
  import { catalogUrl, topicUrl, examUrl, takeExamUrl } from '$lib/seo'
  import SeoHead from '$lib/components/public/SeoHead.svelte'
  import Breadcrumbs from '$lib/components/public/Breadcrumbs.svelte'

  let { data } = $props()
  const t = $derived(publicT(data.lang))
  const exam = $derived(data.exam)
  const q = $derived(exam.sample_question)

  const crumbs = $derived([
    { name: t('nav.exams'), path: catalogUrl(data.lang) },
    ...(exam.tags?.[0]
      ? [{ name: exam.tags[0].label, path: topicUrl(data.lang, exam.tags[0].slug) }]
      : []),
    { name: exam.title, path: examUrl(data.lang, exam.slug) }
  ])

  const scheduled = $derived(
    exam.scheduled_at && new Date(exam.scheduled_at) > new Date() ? exam.scheduled_at : null
  )

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })

  // options is JSONB: [{ key, text }] authored order.
  const options = $derived(Array.isArray(q?.options) ? q.options : [])
</script>

<SeoHead seo={data.seo} />

<Breadcrumbs {crumbs} />

<article>
  <header class="head">
    {#if exam.cover_image_url}
      <img class="cover" src={exam.cover_image_url} alt="" />
    {/if}

    <h1 class="title">{exam.title}</h1>

    <p class="meta">
      <span>{t('exam.questions', { count: exam.question_count })}</span>
      <span>·</span>
      <span>{t('exam.minutes', { count: exam.time_limit })}</span>
      {#if exam.passing_score}
        <span>·</span>
        <span>{t('exam.passingScore', { score: exam.passing_score })}</span>
      {/if}
      {#if exam.submission_count > 0}
        <span>·</span>
        <span>{t('exam.attempts', { count: exam.submission_count })}</span>
      {/if}
    </p>

    <p class="author">{t('exam.author')}: {exam.creator_name}</p>

    {#if exam.tags?.length}
      <p class="tags">
        {#each exam.tags as tag}
          <a class="tag" href={topicUrl(data.lang, tag.slug)}>{tag.label}</a>
        {/each}
      </p>
    {/if}
  </header>

  {#if exam.description}
    <!-- Already sanitized by exam-service (lib/sanitizeDescription.js). It must
         NOT be passed through $lib/sanitizeHtml.js, which returns '' without a
         DOM — the page would look right in a browser and be empty to a crawler. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div class="prose">{@html exam.description}</div>
  {/if}

  <section class="cta">
    {#if scheduled}
      <p class="cta-scheduled">{t('exam.scheduled', { date: fmtDate(scheduled) })}</p>
    {/if}
    <a class="cta-btn" href={takeExamUrl(exam.id)} rel="nofollow">{t('exam.cta')}</a>
    <p class="cta-note">{t('exam.ctaNote')}</p>
  </section>

  {#if q}
    <section class="sample">
      <h2>{t('exam.sample')}</h2>
      <div class="q">
        <p class="q-type">
          {q.question_type === 'multiple' ? t('exam.multiple') : t('exam.single')}
        </p>
        <p class="q-content">{q.content}</p>
        {#if q.image_url}
          <img class="q-img" src={q.image_url} alt="" loading="lazy" />
        {/if}
        {#if options.length}
          <ol class="q-options">
            {#each options as opt}
              <li><b>{opt.key}.</b> {opt.text}</li>
            {/each}
          </ol>
        {/if}
      </div>
      <p class="sample-note">{t('exam.sampleNote')}</p>
    </section>
  {/if}

  {#if exam.related?.length}
    <section class="related">
      <h2>{t('exam.related')}</h2>
      <ul>
        {#each exam.related as rel}
          <li>
            <a href={examUrl(data.lang, rel.slug)}>{rel.title}</a>
            <span class="related-meta">{t('exam.questions', { count: rel.question_count })}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</article>

<style>
  .head { margin-bottom: 1.5rem; }

  .cover {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    border-radius: var(--radius-card, 16px);
    margin-bottom: 1.25rem;
    display: block;
  }

  .title { margin: 0 0 0.75rem; font-size: 2rem; line-height: 1.2; }

  .meta {
    margin: 0 0 0.4rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.92rem;
    opacity: 0.75;
  }

  .author { margin: 0 0 0.85rem; font-size: 0.92rem; opacity: 0.75; }

  .tags { margin: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }

  .tag {
    font-size: 0.8rem;
    padding: 0.22rem 0.6rem;
    border-radius: 999px;
    background: var(--primary-light);
    color: var(--primary);
    text-decoration: none;
  }

  .tag:hover { text-decoration: underline; }

  .prose {
    line-height: 1.7;
    margin-bottom: 2rem;
  }

  .prose :global(h3), .prose :global(h4) { margin: 1.4rem 0 0.5rem; }
  .prose :global(ul), .prose :global(ol) { padding-left: 1.35rem; }
  .prose :global(a) { color: var(--primary); }

  .cta {
    padding: 1.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card, 16px);
    background: var(--surface);
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .cta-scheduled { margin: 0 0 0.85rem; font-weight: 600; }

  .cta-btn {
    display: inline-block;
    padding: 0.8rem 1.8rem;
    border-radius: var(--radius-btn, 10px);
    background: linear-gradient(135deg, #5625d1, #6d29d3);
    color: #fff;
    font-weight: 700;
    text-decoration: none;
  }

  .cta-note { margin: 0.75rem 0 0; font-size: 0.85rem; opacity: 0.7; }

  .sample h2, .related h2 { font-size: 1.15rem; margin: 0 0 0.9rem; }

  .q {
    padding: 1.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card, 16px);
    background: var(--surface);
  }

  .q-type {
    margin: 0 0 0.5rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.6;
  }

  .q-content { margin: 0 0 0.9rem; font-weight: 600; line-height: 1.55; }

  .q-img { max-width: 100%; border-radius: 8px; margin-bottom: 0.9rem; display: block; }

  .q-options { margin: 0; padding-left: 1.1rem; list-style: none; }
  .q-options li { padding: 0.35rem 0; line-height: 1.5; }

  .sample-note { margin: 0.75rem 0 2.5rem; font-size: 0.85rem; opacity: 0.7; }

  .related ul { margin: 0; padding: 0; list-style: none; }

  .related li {
    padding: 0.65rem 0;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: baseline;
  }

  .related a { color: var(--primary); text-decoration: none; font-weight: 600; }
  .related a:hover { text-decoration: underline; }
  .related-meta { font-size: 0.82rem; opacity: 0.65; }
</style>
