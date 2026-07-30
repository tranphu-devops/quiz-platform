<script>
  import { publicT } from '$lib/i18n/public'
  import { topicUrl, catalogUrl } from '$lib/seo'
  import SeoHead from '$lib/components/public/SeoHead.svelte'
  import ExamGrid from '$lib/components/public/ExamGrid.svelte'
  import TopicChips from '$lib/components/public/TopicChips.svelte'
  import Pager from '$lib/components/public/Pager.svelte'
  import Breadcrumbs from '$lib/components/public/Breadcrumbs.svelte'

  let { data } = $props()
  const t = $derived(publicT(data.lang))
  const crumbs = $derived([
    { name: t('nav.exams'), path: catalogUrl(data.lang) },
    { name: data.topic.label, path: topicUrl(data.lang, data.topic.slug) }
  ])
</script>

<SeoHead seo={data.seo} />

<Breadcrumbs {crumbs} />

<h1 class="title">{t('topic.heading', { label: data.topic.label })}</h1>
<p class="subtitle">
  {t('topic.metaDescription', { count: data.topic.exam_count, label: data.topic.label })}
</p>

<ExamGrid items={data.items} lang={data.lang} {t} empty={t('catalog.empty')} />

<Pager
  page={data.page}
  pageSize={data.page_size}
  total={data.total}
  basePath={topicUrl(data.lang, data.topic.slug)}
  {t}
/>

<TopicChips
  topics={data.tags_available}
  lang={data.lang}
  current={data.topic.slug}
  heading={t('topic.otherTopics')}
/>

<style>
  .title { margin: 0 0 0.5rem; font-size: 1.9rem; line-height: 1.2; }
  .subtitle { margin: 0 0 2rem; max-width: 60ch; opacity: 0.8; line-height: 1.6; }
</style>
