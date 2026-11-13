import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ??= 'postgres://test@localhost:5432/test?search_path=quiz_notifications'
process.env.SITE_URL = 'https://app.example.test'

const { escapeHtml, maskEmail, percent, credits, formatDateTime } = await import('../src/lib/brand.js')
const { renderEmail, renderMessage } = await import('../src/lib/events.js')
const { channelsForRole, needsChannelTargets } = await import('../src/lib/subscriptions.js')

test('escapeHtml covers the 5 HTML-significant chars', () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  assert.equal(escapeHtml(null), '')
})

test('maskEmail hides the local part', () => {
  assert.equal(maskEmail('phu.tran@gmail.com'), 'ph•••@gmail.com')
  assert.equal(maskEmail('a@b.co'), 'a•••@b.co')
  assert.equal(maskEmail('not-an-email'), '')
  assert.equal(maskEmail(null), '')
})

test('formatters', () => {
  assert.equal(percent(66.6666), '66.67%')
  assert.equal(percent(null), '')
  assert.equal(credits(1), '1 credit')
  assert.equal(credits(20), '20 credits')
  assert.equal(formatDateTime(null), '')
  assert.equal(formatDateTime('garbage'), 'garbage')
  assert.match(formatDateTime('2026-07-26T09:05:00Z'), /26 Jul 2026, 16:05/)
})

test('renderEmail: user-controlled text is escaped in HTML (report description, exam title)', () => {
  const evil = '<img src=x onerror=alert(1)>'
  const { html } = renderEmail('report.filed.teacher', { examTitle: evil, description: evil, reporterName: 'r@x.com', category: 'other' })
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;img src=x/)
})

test('renderEmail: reporter email masked for the teacher', () => {
  const { html, text } = renderEmail('report.filed.teacher', { reporterName: 'student@school.edu', category: 'other' })
  assert.doesNotMatch(html + text, /student@school\.edu/)
})

test('renderEmail: subject clamped to 150 chars', () => {
  const { subject } = renderEmail('report.filed.teacher', { examTitle: 'x'.repeat(400), category: 'other' })
  assert.ok(subject.length <= 150)
})

test('unknown event renders via fallback, never a raw JSON dump', () => {
  const { html, text } = renderEmail('nope.unknown.owner', { secretField: 'abc' })
  assert.ok(html.length > 0 && text.length > 0)
  assert.doesNotMatch(text, /^\{/)
})

test('renderMessage: short form for push channels', () => {
  const m = renderMessage('submission.completed.owner', { examTitle: 'E', percentage: 80, passed: true, examId: 'id', submissionId: 's' })
  assert.ok(m.title)
  assert.ok(m.body.split('\n').length <= 8)
})

test('every templated event renders with an empty payload', async () => {
  const events = ['submission.completed.owner', 'submission.timed_out.teacher', 'badge.earned.owner', 'report.resolved.reporter',
    'generation.failed.owner', 'credit.deduct_failed.owner', 'teacher_upgrade.succeeded.owner', 'referral.completed.owner', 'referral.completed.admin']
  for (const e of events) {
    const r = renderEmail(e, {})
    assert.ok(r.subject && r.html && r.text, e)
    assert.doesNotMatch(r.html, /undefined|NaN|\[object Object\]/, e)
  }
})

test('channelsForRole: only admins get push channels', () => {
  assert.deepEqual(channelsForRole('student'), ['email'])
  assert.deepEqual(channelsForRole('teacher'), ['email'])
  assert.ok(channelsForRole('admin').includes('telegram'))
  assert.equal(needsChannelTargets(['email']), false)
  assert.equal(needsChannelTargets(['email', 'pushover']), true)
})
