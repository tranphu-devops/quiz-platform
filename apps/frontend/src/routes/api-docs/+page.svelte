<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  import { t } from '$lib/i18n'

  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'

  const curlCreate = $derived(`curl -X POST ${base}/api/exams/exams \\
  -H "X-API-Key: qz_live_xxxxxxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "${$t('apiDocs.sampleExamTitle')}",
    "description": "<p>${$t('apiDocs.sampleExamDesc')}</p>",
    "time_limit": 30,
    "passing_score": 70,
    "tags": ["aws", "demo"]
  }'`)

  const curlAddQuestion = $derived(`curl -X POST ${base}/api/exams/exams/<EXAM_ID>/questions \\
  -H "X-API-Key: qz_live_xxxxxxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "${$t('apiDocs.sampleQuestion')}",
    "question_type": "single",
    "options": [
      { "key": "A", "text": "Amazon EC2" },
      { "key": "B", "text": "AWS Lambda" },
      { "key": "C", "text": "Amazon RDS" },
      { "key": "D", "text": "Amazon S3" }
    ],
    "correct_answer": "B",
    "points": 1,
    "explanation": "${$t('apiDocs.sampleExplanation')}",
    "image_url": null
  }'`)

  const curlPublish = $derived(`curl -X PUT ${base}/api/exams/exams/<EXAM_ID> \\
  -H "X-API-Key: qz_live_xxxxxxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{ "is_published": true }'`)

  const curlUpload = $derived(`curl -X POST ${base}/api/users/upload \\
  -H "X-API-Key: qz_live_xxxxxxxx..." \\
  -F "file=@/path/to/image.jpg" \\
  -F "type=exam-cover"

# ${$t('apiDocs.uploadResponseComment')}
# { "url": "https://..." }`)

  const endpoints = $derived([
    { m: 'POST',   p: '/api/users/upload',                      d: $t('apiDocs.epUpload') },
    { m: 'POST',   p: '/api/exams/exams',                       d: $t('apiDocs.epCreateExam') },
    { m: 'GET',    p: '/api/exams/exams?creator_id=<YOUR_ID>',  d: $t('apiDocs.epListExams') },
    { m: 'GET',    p: '/api/exams/exams/:id',                   d: $t('apiDocs.epGetExam') },
    { m: 'PUT',    p: '/api/exams/exams/:id',                   d: $t('apiDocs.epUpdateExam') },
    { m: 'DELETE', p: '/api/exams/exams/:id',                   d: $t('apiDocs.epDeleteExam') },
    { m: 'POST',   p: '/api/exams/exams/:id/questions',         d: $t('apiDocs.epAddQuestion') },
    { m: 'PUT',    p: '/api/exams/exams/:id/questions/:qid',    d: $t('apiDocs.epUpdateQuestion') },
    { m: 'DELETE', p: '/api/exams/exams/:id/questions/:qid',    d: $t('apiDocs.epDeleteQuestion') },
  ])
</script>

<svelte:head><title>API Docs · QuizPlatform</title></svelte:head>

<PageHeader title={$t('apiDocs.pageTitle')} subtitle={$t('apiDocs.pageSubtitle')} />

<div class="docs">
  <Card title={$t('apiDocs.section1Title')}>
    <p>
      {@html $t('apiDocs.authIntro')}
    </p>
    <pre><code>X-API-Key: qz_live_xxxxxxxxxxxxxxxxxxxx</code></pre>
    <ul class="notes">
      <li>{@html $t('apiDocs.authNote1')}</li>
      <li>{$t('apiDocs.authNote2')}</li>
      <li>{@html $t('apiDocs.authNote3')}</li>
      <li>{$t('apiDocs.authNote4')}</li>
    </ul>
  </Card>

  <Card title={$t('apiDocs.section2Title')}>
    <p>Base URL: <code>{base}/api/exams</code></p>
    <p class="notes">
      {@html $t('apiDocs.rateLimitNote')}
    </p>
  </Card>

  <Card title={$t('apiDocs.section3Title')}>
    <div class="ep-table">
      {#each endpoints as e}
        <div class="ep-row">
          <span class="ep-method m-{e.m.toLowerCase()}">{e.m}</span>
          <code class="ep-path">{e.p}</code>
          <span class="ep-desc">{e.d}</span>
        </div>
      {/each}
    </div>
  </Card>

  <Card title={$t('apiDocs.section4Title')}>
    <pre><code>{curlCreate}</code></pre>
    <p class="notes">{@html $t('apiDocs.createExamNote')}</p>
  </Card>

  <Card title={$t('apiDocs.section5Title')}>
    <pre><code>{curlAddQuestion}</code></pre>
    <ul class="notes">
      <li>{@html $t('apiDocs.addQuestionNote1')}</li>
      <li>{@html $t('apiDocs.addQuestionNote2')}</li>
      <li>{@html $t('apiDocs.addQuestionNote3')}</li>
    </ul>
  </Card>

  <Card title={$t('apiDocs.section6Title')}>
    <pre><code>{curlUpload}</code></pre>
    <ul class="notes">
      <li>{@html $t('apiDocs.uploadNote1')}</li>
      <li>{@html $t('apiDocs.uploadNote2')}</li>
      <li>{$t('apiDocs.uploadNote3')}</li>
      <li>{@html $t('apiDocs.uploadNote4')}</li>
    </ul>
  </Card>

  <Card title={$t('apiDocs.section7Title')}>
    <pre><code>{curlPublish}</code></pre>
    <p class="notes">{@html $t('apiDocs.publishNote')}</p>
  </Card>
</div>

<style>
  .docs {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 860px;
  }
  .docs p { margin: 0 0 10px; line-height: 1.6; }
  .docs a { color: var(--primary); font-weight: 500; }
  .notes {
    font-size: 0.9rem;
    color: var(--text-muted, #6b6a80);
  }
  ul.notes { margin: 8px 0 0; padding-left: 20px; }
  ul.notes li { margin-bottom: 6px; line-height: 1.5; }

  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85em;
    background: var(--primary-light);
    padding: 1px 6px;
    border-radius: 6px;
  }
  pre {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-btn, 10px);
    padding: 14px 16px;
    overflow-x: auto;
    margin: 4px 0 10px;
  }
  pre code {
    background: none;
    padding: 0;
    font-size: 0.82rem;
    line-height: 1.55;
    white-space: pre;
  }

  .ep-table { display: flex; flex-direction: column; gap: 2px; }
  .ep-row {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    grid-template-areas: "method path" "method desc";
    gap: 2px 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .ep-row:last-child { border-bottom: none; }
  .ep-method {
    grid-area: method;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    font-weight: 700;
    text-align: center;
    padding: 3px 0;
    border-radius: 6px;
    align-self: start;
  }
  .m-post   { background: rgba(34,197,94,0.15);  color: #16a34a; }
  .m-get    { background: rgba(59,130,246,0.15); color: #2563eb; }
  .m-put    { background: rgba(234,179,8,0.18);  color: #b7791f; }
  .m-delete { background: rgba(239,68,68,0.15);  color: #dc2626; }
  .ep-path {
    grid-area: path;
    background: none;
    padding: 0;
    font-size: 0.82rem;
    word-break: break-all;
  }
  .ep-desc {
    grid-area: desc;
    font-size: 0.85rem;
    color: var(--text-muted, #6b6a80);
  }
</style>
