<script>
  import { publicT } from '$lib/i18n/public'
  import { catalogUrl } from '$lib/seo'
  import SeoHead from '$lib/components/public/SeoHead.svelte'
  import ExamGrid from '$lib/components/public/ExamGrid.svelte'
  import TopicChips from '$lib/components/public/TopicChips.svelte'
  import Pager from '$lib/components/public/Pager.svelte'

  let { data } = $props()
  const t = $derived(publicT(data.lang))
</script>

<SeoHead seo={data.seo} />

<h1 class="title">{t('catalog.title')}</h1>
<p class="subtitle">{t('catalog.subtitle')}</p>

<TopicChips
  topics={data.tags_available}
  lang={data.lang}
  heading={t('catalog.topics')}
/>

<h2 class="section">{t('catalog.allExams')}</h2>
<ExamGrid items={data.items} lang={data.lang} {t} empty={t('catalog.empty')} />

<Pager
  page={data.page}
  pageSize={data.page_size}
  total={data.total}
  basePath={catalogUrl(data.lang)}
  {t}
/>

<style>
  .title { margin: 0 0 0.5rem; font-size: 1.9rem; line-height: 1.2; }
  .subtitle { margin: 0 0 2rem; max-width: 60ch; opacity: 0.8; line-height: 1.6; }
  .section { margin: 0 0 1rem; font-size: 1rem; font-weight: 700; opacity: 0.85; }
</style>
