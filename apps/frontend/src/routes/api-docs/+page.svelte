<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte'
  import Card from '$lib/components/ui/Card.svelte'

  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'

  const curlCreate = `curl -X POST ${base}/api/exams/exams \\
  -H "X-API-Key: qz_live_xxxxxxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Đề thi tạo qua API",
    "description": "<p>Mô tả có thể chứa HTML cơ bản</p>",
    "time_limit": 30,
    "passing_score": 70,
    "tags": ["aws", "demo"]
  }'`

  const curlAddQuestion = `curl -X POST ${base}/api/exams/exams/<EXAM_ID>/questions \\
  -H "X-API-Key: qz_live_xxxxxxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Dịch vụ nào là serverless compute của AWS?",
    "question_type": "single",
    "options": [
      { "key": "A", "text": "Amazon EC2" },
      { "key": "B", "text": "AWS Lambda" },
      { "key": "C", "text": "Amazon RDS" },
      { "key": "D", "text": "Amazon S3" }
    ],
    "correct_answer": "B",
    "points": 1,
    "explanation": "Lambda chạy code không cần quản lý server.",
    "image_url": null
  }'`

  const curlPublish = `curl -X PUT ${base}/api/exams/exams/<EXAM_ID> \\
  -H "X-API-Key: qz_live_xxxxxxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{ "is_published": true }'`

  const curlUpload = `curl -X POST ${base}/api/users/upload \\
  -H "X-API-Key: qz_live_xxxxxxxx..." \\
  -F "file=@/path/to/image.jpg" \\
  -F "type=exam-cover"

# Dùng URL trả về làm cover_image_url / image_url:
# { "url": "https://..." }`

  const endpoints = [
    { m: 'POST',   p: '/api/users/upload',                      d: 'Upload ảnh lên S3 — trả về URL (dùng cho cover_image_url, image_url).' },
    { m: 'POST',   p: '/api/exams/exams',                       d: 'Tạo đề thi mới (bạn là chủ sở hữu).' },
    { m: 'GET',    p: '/api/exams/exams?creator_id=<YOUR_ID>',  d: 'Liệt kê đề thi (kèm bản nháp của chính bạn).' },
    { m: 'GET',    p: '/api/exams/exams/:id',                   d: 'Xem chi tiết một đề thi.' },
    { m: 'PUT',    p: '/api/exams/exams/:id',                   d: 'Cập nhật đề thi (kể cả is_published để publish).' },
    { m: 'DELETE', p: '/api/exams/exams/:id',                   d: 'Xoá đề thi.' },
    { m: 'POST',   p: '/api/exams/exams/:id/questions',         d: 'Thêm câu hỏi vào đề.' },
    { m: 'PUT',    p: '/api/exams/exams/:id/questions/:qid',    d: 'Sửa câu hỏi.' },
    { m: 'DELETE', p: '/api/exams/exams/:id/questions/:qid',    d: 'Xoá câu hỏi.' },
  ]
</script>

<svelte:head><title>API Docs · QuizPlatform</title></svelte:head>

<PageHeader title="API dành cho giáo viên" subtitle="Quản lý đề thi bằng chương trình qua API key" />

<div class="docs">
  <Card title="1. Xác thực">
    <p>
      Mọi request đính kèm header <code>X-API-Key</code> với key bạn tạo ở
      <a href="/profile">trang Hồ sơ → API Access</a>. Không cần đăng nhập hay lấy JWT —
      key chính là thông tin xác thực, hoạt động bất kể bạn đăng ký bằng Google hay email.
    </p>
    <pre><code>X-API-Key: qz_live_xxxxxxxxxxxxxxxxxxxx</code></pre>
    <ul class="notes">
      <li>Key được lưu dưới dạng băm (SHA-256); phần plaintext chỉ hiện <strong>một lần</strong> khi tạo.</li>
      <li>Thu hồi key bất cứ lúc nào ở trang Hồ sơ — có hiệu lực ngay lập tức.</li>
      <li>Key chỉ thao tác được trên đề thi <strong>do chính bạn tạo</strong> (trừ admin). Gọi lên đề của người khác → <code>403</code>.</li>
      <li>Key sai hoặc đã thu hồi → <code>401</code>.</li>
    </ul>
  </Card>

  <Card title="2. Base URL & giới hạn">
    <p>Base URL: <code>{base}/api/exams</code></p>
    <p class="notes">
      Chịu giới hạn tần suất chung của Nginx (khoảng 2 request/giây, cho phép burst).
      Với thao tác import hàng loạt, hãy thêm độ trễ nhỏ giữa các request để tránh <code>429</code>.
    </p>
  </Card>

  <Card title="3. Các endpoint">
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

  <Card title="4. Ví dụ — tạo đề thi">
    <pre><code>{curlCreate}</code></pre>
    <p class="notes">Phản hồi <code>201</code> trả về đối tượng đề thi kèm <code>id</code>. Dùng <code>id</code> đó cho các bước sau.</p>
  </Card>

  <Card title="5. Ví dụ — thêm câu hỏi">
    <pre><code>{curlAddQuestion}</code></pre>
    <ul class="notes">
      <li><code>question_type</code>: <code>single</code> (1 đáp án) hoặc <code>multiple</code> (nhiều đáp án).</li>
      <li>Với <code>multiple</code>, gửi <code>correct_answer</code> là mảng, ví dụ <code>["A","C"]</code>.</li>
      <li>Ảnh câu hỏi: upload file trước qua <code>POST /api/users/upload</code> (xem mục 6), rồi dùng URL trả về làm <code>image_url</code>. Hoặc truyền thẳng URL công khai có sẵn.</li>
    </ul>
  </Card>

  <Card title="6. Ví dụ — upload ảnh lên S3">
    <pre><code>{curlUpload}</code></pre>
    <ul class="notes">
      <li>Field <code>type</code>: <code>exam-cover</code> (ảnh bìa đề thi) hoặc <code>question</code> (ảnh câu hỏi) hoặc <code>avatar</code>.</li>
      <li>Định dạng chấp nhận: <code>image/jpeg</code>, <code>image/png</code>, <code>image/webp</code>, <code>image/gif</code> (admin có thể thay đổi).</li>
      <li>Kích thước tối đa mặc định: 5 MB.</li>
      <li>Trả về <code>{"{ url: \"https://...\" }"}</code> — dùng URL này cho <code>cover_image_url</code> hoặc <code>image_url</code> trong các API khác.</li>
    </ul>
  </Card>

  <Card title="7. Ví dụ — publish đề thi">
    <pre><code>{curlPublish}</code></pre>
    <p class="notes">Đặt <code>is_published: true</code> để học viên có thể thấy và làm bài.</p>
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
