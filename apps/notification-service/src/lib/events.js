// Message templates keyed by the full event_type (including audience
// suffix), since admin/owner/teacher/reporter framing of the same business
// event reads differently.
//
// English is the default and only language here: a recipient's locale isn't
// stored anywhere (event_types.label_* is for the preferences UI, which reads
// the browser language), so picking per-recipient copy isn't possible yet.
//
// Each template returns a content object consumed by two renderers:
//   renderEmail()   -> branded HTML + plain-text alternative (emailLayout.js)
//   renderMessage() -> short single-message form for Pushover/Telegram
// Shape: { title, subject?, eyebrow?, heading?, intro, facts?, quote?,
//          cta?, note?, summary? }
//   title    short push/telegram title, also the fallback email subject
//   subject  email subject when it should differ (longer, more specific)
//   intro    lead paragraph — also the push/telegram body unless `summary` is set
//   facts    [[label, value], ...] label/value rows; empty values are dropped
//   quote    { label, text } verbatim user-authored content
//   cta      { label, url } primary button; dropped when url is undefined
import { renderEmailHtml, renderEmailText } from './emailLayout.js'
import { appUrl, examUrl, escapeHtml, formatDateTime, maskEmail, percent, credits } from './brand.js'

const REPORT_CATEGORIES = {
  question_wrong: 'Question is wrong',
  answer_wrong: 'Answer key is wrong',
  image_issue: 'Image problem',
  other: 'Other'
}

const DEDUCT_REASONS = {
  exam_or_generation: 'Starting an exam or generating one with AI',
  teacher_upgrade: 'Upgrading the account to teacher'
}

const KEY_SOURCES = {
  own: 'Your own OpenRouter key',
  platform: 'Platform key (credits deducted)'
}

const someone = (name, fallback = 'Someone') => (name && String(name).trim()) || fallback
const label = (map, key, fallback = '') => (key && map[key]) || key || fallback
const outcome = (passed) => (passed === true ? 'Passed' : passed === false ? 'Not passed' : '')

// Score line: "17/20 (85%)" — a bare percentage hides how much was at stake.
function scoreText(p) {
  const pctText = percent(p.percentage)
  if (p.score != null && p.totalPoints != null) {
    return pctText ? `${p.score}/${p.totalPoints} points (${pctText})` : `${p.score}/${p.totalPoints} points`
  }
  return pctText
}

const TEMPLATES = {
  // ── Submissions ─────────────────────────────────────────────────────────
  'submission.completed.owner': (p) => ({
    title: 'Your exam result is ready',
    subject: `Your result for "${p.examTitle || 'your exam'}" — ${scoreText(p) || 'submitted'}`,
    eyebrow: 'Exam result',
    heading: `You finished "${p.examTitle || 'your exam'}"`,
    intro: `Your submission has been graded. ${p.passed === true ? 'Congratulations — you passed!' : p.passed === false ? 'You did not reach the passing score this time.' : ''}`.trim(),
    facts: [
      ['Exam', p.examTitle],
      ['Score', scoreText(p)],
      ['Result', outcome(p.passed)],
      ['Passing score', percent(p.passingScore)],
      ['Questions', p.questionCount],
      ['Submitted at', formatDateTime(p.submittedAt)]
    ],
    cta: { label: 'View detailed results', url: resultUrl(p) },
    note: p.passed === false ? 'You can review every question with its explanation on the result page, then retake the exam if the teacher allows retakes.' : undefined
  }),
  'submission.completed.teacher': (p) => ({
    title: 'New submission on your exam',
    subject: `${someone(p.studentName, 'A student')} completed "${p.examTitle || 'your exam'}" — ${scoreText(p) || 'submitted'}`,
    eyebrow: 'Your exam',
    heading: 'A student just completed your exam',
    intro: `${someone(p.studentName, 'A student')} finished "${p.examTitle || 'your exam'}".`,
    facts: [
      ['Exam', p.examTitle],
      ['Student', someone(p.studentName, '—')],
      ['Score', scoreText(p)],
      ['Result', outcome(p.passed)],
      ['Passing score', percent(p.passingScore)],
      ['Submitted at', formatDateTime(p.submittedAt)]
    ],
    cta: { label: 'Open exam', url: examUrl(p.examId) }
  }),
  'submission.completed.admin': (p) => ({
    title: 'Submission completed',
    subject: `[Ops] Submission completed — "${p.examTitle || 'exam'}" ${percent(p.percentage) || ''}`.trim(),
    eyebrow: 'Platform activity',
    heading: 'A submission was completed',
    intro: `${someone(p.studentName, 'A user')} completed "${p.examTitle || 'an exam'}".`,
    facts: [
      ['Exam', p.examTitle],
      ['Exam ID', p.examId],
      ['Student', someone(p.studentName, '—')],
      ['Score', scoreText(p)],
      ['Result', outcome(p.passed)],
      ['Submission ID', p.submissionId],
      ['Submitted at', formatDateTime(p.submittedAt)]
    ],
    cta: { label: 'Open exam', url: examUrl(p.examId) }
  }),

  'submission.timed_out.owner': (p) => ({
    title: 'Your exam ran out of time',
    subject: `Time is up — "${p.examTitle || 'your exam'}" was submitted automatically`,
    eyebrow: 'Exam result',
    heading: `Your attempt at "${p.examTitle || 'the exam'}" ran out of time`,
    intro: 'The time limit was reached, so your answers were submitted and graded automatically. Anything left unanswered was scored as incorrect.',
    facts: [
      ['Exam', p.examTitle],
      ['Score', scoreText(p)],
      ['Result', outcome(p.passed)],
      ['Passing score', percent(p.passingScore)],
      ['Auto-submitted at', formatDateTime(p.submittedAt)]
    ],
    cta: { label: 'View detailed results', url: resultUrl(p) }
  }),
  'submission.timed_out.teacher': (p) => ({
    title: 'A submission on your exam timed out',
    subject: `${someone(p.studentName, 'A student')} ran out of time on "${p.examTitle || 'your exam'}"`,
    eyebrow: 'Your exam',
    heading: 'A submission on your exam timed out',
    intro: `${someone(p.studentName, 'A student')} reached the time limit on "${p.examTitle || 'your exam'}" and the attempt was graded automatically.`,
    facts: [
      ['Exam', p.examTitle],
      ['Student', someone(p.studentName, '—')],
      ['Score', scoreText(p)],
      ['Result', outcome(p.passed)],
      ['Auto-submitted at', formatDateTime(p.submittedAt)]
    ],
    cta: { label: 'Open exam', url: examUrl(p.examId) }
  }),
  'submission.timed_out.admin': (p) => ({
    title: 'Submission auto-submitted (timed out)',
    subject: `[Ops] Timed-out submission on "${p.examTitle || 'exam'}"`,
    eyebrow: 'Platform activity',
    heading: 'A submission was auto-submitted after timing out',
    intro: `The batch grader closed out an expired attempt on "${p.examTitle || 'an exam'}".`,
    facts: [
      ['Exam', p.examTitle],
      ['Exam ID', p.examId],
      ['Student', someone(p.studentName, '—')],
      ['Score', scoreText(p)],
      ['Submission ID', p.submissionId],
      ['Auto-submitted at', formatDateTime(p.submittedAt)]
    ],
    cta: { label: 'Open exam', url: examUrl(p.examId) }
  }),

  // ── Badges ──────────────────────────────────────────────────────────────
  'badge.earned.owner': (p) => ({
    title: 'You earned a new badge',
    subject: `Badge unlocked: "${p.collectionTitle || 'a collection'}"`,
    eyebrow: 'Achievement',
    heading: 'Congratulations — you earned a badge! 🏅',
    intro: `You passed every exam in the "${p.collectionTitle || ''}" collection, so the badge is now yours. It appears on your profile and public profile page.`,
    facts: [
      ['Collection', p.collectionTitle],
      ['Exams passed', p.examCount],
      ['Earned at', formatDateTime(p.earnedAt)]
    ],
    cta: { label: 'See your badges', url: appUrl('/profile') },
    note: 'Keep going — every collection you complete adds another badge to your profile.'
  }),
  'badge.earned.admin': (p) => ({
    title: 'A student earned a badge',
    subject: `[Ops] Badge earned — "${p.collectionTitle || 'collection'}"`,
    eyebrow: 'Platform activity',
    heading: 'A student earned a collection badge',
    intro: `${someone(p.studentName, 'A student')} completed every exam in "${p.collectionTitle || 'a collection'}".`,
    facts: [
      ['Collection', p.collectionTitle],
      ['Collection ID', p.collectionId],
      ['Student', someone(p.studentName, '—')],
      ['Earned at', formatDateTime(p.earnedAt)]
    ]
  }),

  // ── Reports ─────────────────────────────────────────────────────────────
  'report.filed.teacher': (p) => ({
    title: 'Your exam was reported',
    subject: `Report on "${p.examTitle || 'your exam'}": ${label(REPORT_CATEGORIES, p.category, 'issue reported')}`,
    eyebrow: 'Exam report',
    heading: `Someone reported an issue in "${p.examTitle || 'your exam'}"`,
    intro: 'A student who completed this exam submitted a report. Please review it and reply — your answer is sent back to the reporter.',
    facts: [
      ['Exam', p.examTitle],
      ['Category', label(REPORT_CATEGORIES, p.category)],
      ['Reported by', maskEmail(p.reporterName) || someone(p.reporterName, '—')],
      ['Filed at', formatDateTime(p.filedAt)]
    ],
    quote: { label: 'What they reported', text: p.description },
    cta: { label: 'Open report inbox', url: appUrl('/profile') }
  }),
  'report.filed.admin': (p) => ({
    title: 'New exam report filed',
    subject: `[Ops] New report on "${p.examTitle || 'exam'}" — ${label(REPORT_CATEGORIES, p.category, 'issue')}`,
    eyebrow: 'Moderation',
    heading: 'A new exam report was filed',
    intro: `${someone(p.reporterName, 'A user')} reported "${p.examTitle || 'an exam'}".`,
    facts: [
      ['Exam', p.examTitle],
      ['Exam ID', p.examId],
      ['Category', label(REPORT_CATEGORIES, p.category)],
      ['Reported by', someone(p.reporterName, '—')],
      ['Report ID', p.reportId],
      ['Filed at', formatDateTime(p.filedAt)]
    ],
    quote: { label: 'What they reported', text: p.description },
    cta: { label: 'Open exam', url: examUrl(p.examId) }
  }),
  'report.resolved.reporter': (p) => ({
    title: 'Your report was answered',
    subject: `Your report on "${p.examTitle || 'an exam'}" has been answered`,
    eyebrow: 'Exam report',
    heading: 'Your report has been answered',
    intro: `Thanks for helping improve NovaQuiz. The owner of "${p.examTitle || 'the exam'}" reviewed your report and replied.`,
    facts: [
      ['Exam', p.examTitle],
      ['Category', label(REPORT_CATEGORIES, p.category)],
      ['Status', 'Resolved'],
      ['Answered at', formatDateTime(p.respondedAt)]
    ],
    quote: { label: 'Reply', text: p.response || 'The report was marked as resolved without a written reply.' },
    cta: { label: 'Open exam', url: examUrl(p.examId) }
  }),
  'report.resolved.admin': (p) => ({
    title: 'Report resolved',
    subject: `[Ops] Report on "${p.examTitle || 'exam'}" resolved`,
    eyebrow: 'Moderation',
    heading: 'An exam report was resolved',
    intro: `A report on "${p.examTitle || 'an exam'}" was answered and closed.`,
    facts: [
      ['Exam', p.examTitle],
      ['Exam ID', p.examId],
      ['Category', label(REPORT_CATEGORIES, p.category)],
      ['Report ID', p.reportId],
      ['Answered at', formatDateTime(p.respondedAt)]
    ],
    quote: { label: 'Reply', text: p.response },
    cta: { label: 'Open exam', url: examUrl(p.examId) }
  }),

  // ── AI exam generation ──────────────────────────────────────────────────
  'generation.completed.owner': (p) => ({
    title: 'Your AI-generated exam is ready',
    subject: `"${p.examTitle || 'Your exam'}" is ready to review (${p.questionCount ?? '?'} questions)`,
    eyebrow: 'AI generation',
    heading: 'Your AI-generated exam is ready',
    intro: `NovaQuiz drafted "${p.examTitle || 'your exam'}" from the document you uploaded. It was saved as a draft, so nothing is visible to students until you review and publish it.`,
    facts: [
      ['Exam', p.examTitle],
      ['Questions', p.questionCount],
      ['Source file', p.sourceFilename],
      ['Model', p.model],
      ['API key used', label(KEY_SOURCES, p.keySource)],
      ['Finished at', formatDateTime(p.completedAt)]
    ],
    cta: { label: 'Review and edit the exam', url: p.examId ? appUrl(`/exams/${p.examId}/edit`) : undefined },
    note: 'Always check the generated questions and answer keys before publishing — set the passing score, time limit and publish mode while you are there.'
  }),
  'generation.completed.admin': (p) => ({
    title: 'AI generation completed',
    subject: `[Ops] AI generation completed — "${p.examTitle || 'exam'}" (${p.questionCount ?? '?'} questions)`,
    eyebrow: 'AI generation',
    heading: 'An AI exam generation completed',
    intro: `${someone(p.teacherName, 'A teacher')} generated "${p.examTitle || 'an exam'}".`,
    facts: [
      ['Exam', p.examTitle],
      ['Exam ID', p.examId],
      ['Teacher', someone(p.teacherName, '—')],
      ['Questions', p.questionCount],
      ['Model', p.model],
      ['API key used', label(KEY_SOURCES, p.keySource)],
      ['Job ID', p.jobId],
      ['Finished at', formatDateTime(p.completedAt)]
    ],
    cta: { label: 'Open exam', url: examUrl(p.examId) }
  }),
  'generation.failed.owner': (p) => ({
    title: 'Your AI generation failed',
    subject: 'Your AI exam generation could not be completed',
    eyebrow: 'AI generation',
    heading: 'We could not generate your exam',
    intro: 'The generation attempt failed, so no exam was created. Nothing was published, and you can try again from the generator page.',
    facts: [
      ['Source file', p.sourceFilename],
      ['Model', p.model],
      ['API key used', label(KEY_SOURCES, p.keySource)],
      ['Failed at', formatDateTime(p.failedAt)]
    ],
    quote: { label: 'Error', text: p.errorMessage || 'Unknown error' },
    cta: { label: 'Try again', url: appUrl('/exams/generate') },
    note: p.keySource === 'platform'
      ? 'Credits for a failed platform-key generation are not refunded automatically — contact an admin if you believe you were charged in error.'
      : 'Common causes: a scanned PDF with no extractable text, a document that is too long, or an OpenRouter key without enough balance.'
  }),
  'generation.failed.admin': (p) => ({
    title: 'AI generation failed',
    subject: `[Ops] AI generation failed for ${someone(p.teacherName, 'a teacher')}`,
    eyebrow: 'AI generation',
    heading: 'An AI exam generation failed',
    intro: `${someone(p.teacherName, 'A teacher')}'s generation attempt failed.`,
    facts: [
      ['Teacher', someone(p.teacherName, '—')],
      ['Model', p.model],
      ['API key used', label(KEY_SOURCES, p.keySource)],
      ['Source file', p.sourceFilename],
      ['Job ID', p.jobId],
      ['Failed at', formatDateTime(p.failedAt)]
    ],
    quote: { label: 'Error', text: p.errorMessage || 'Unknown error' },
    cta: { label: 'Open admin panel', url: appUrl('/admin') }
  }),

  // ── Credits ─────────────────────────────────────────────────────────────
  'credit.deduct_failed.owner': (p) => ({
    title: 'Not enough credits',
    subject: `Not enough credits — ${credits(p.amount) || 'more credits'} needed`,
    eyebrow: 'Credits',
    heading: 'Your credit balance was too low',
    intro: `The action could not be completed because your balance is below the required amount. Nothing was charged.`,
    facts: [
      ['Required', credits(p.amount)],
      ['Your balance', credits(p.balance)],
      ['Action', label(DEDUCT_REASONS, p.reason)],
      ['Attempted at', formatDateTime(p.occurredAt)]
    ],
    cta: { label: 'Invite friends to earn credits', url: appUrl('/profile') },
    note: 'You can earn credits by inviting friends with your referral link — both of you get a bonus when they sign up.'
  }),
  'credit.deduct_failed.admin': (p) => ({
    title: 'Credit deduction failed',
    subject: `[Ops] Credit deduction failed — ${credits(p.amount) || 'unknown amount'}`,
    eyebrow: 'Credits',
    heading: 'A credit deduction failed',
    intro: `${someone(p.userName, 'A user')} did not have enough credits for an action.`,
    facts: [
      ['User', someone(p.userName, '—')],
      ['Required', credits(p.amount)],
      ['Balance', credits(p.balance)],
      ['Action', label(DEDUCT_REASONS, p.reason)],
      ['Attempted at', formatDateTime(p.occurredAt)]
    ],
    cta: { label: 'Open admin panel', url: appUrl('/admin') }
  }),

  // ── Teacher upgrade ─────────────────────────────────────────────────────
  'teacher_upgrade.succeeded.owner': (p) => ({
    title: 'You are now a teacher',
    subject: 'Welcome aboard — your NovaQuiz account is now a teacher account',
    eyebrow: 'Account',
    heading: 'Your account was upgraded to teacher 🎓',
    intro: 'You can now create and publish your own exams, build collections with badges, generate exams from documents with AI, and manage API keys for automation.',
    facts: [
      ['New role', 'Teacher'],
      ['Credits spent', credits(p.cost)],
      ['Remaining balance', credits(p.newBalance)],
      ['Upgraded at', formatDateTime(p.upgradedAt)]
    ],
    cta: { label: 'Create your first exam', url: appUrl('/exams/create') },
    note: 'Sign out and sign back in once to activate the new role in your session.'
  }),
  'teacher_upgrade.succeeded.admin': (p) => ({
    title: 'A user upgraded to teacher',
    subject: `[Ops] ${someone(p.userName, 'A user')} upgraded to teacher`,
    eyebrow: 'Platform activity',
    heading: 'A user upgraded to teacher',
    intro: `${someone(p.userName, 'A user')} spent credits to upgrade their account.`,
    facts: [
      ['User', someone(p.userName, '—')],
      ['Credits spent', credits(p.cost)],
      ['Remaining balance', credits(p.newBalance)],
      ['Upgraded at', formatDateTime(p.upgradedAt)]
    ],
    cta: { label: 'Open admin panel', url: appUrl('/admin') }
  }),

  // ── Referrals ───────────────────────────────────────────────────────────
  'referral.completed.owner': (p) => ({
    title: 'Someone joined with your invite link',
    subject: `${someone(p.referredName, 'Someone')} just joined NovaQuiz with your invite link`,
    eyebrow: 'Referral',
    heading: 'Your invite worked 🎉',
    intro: `${someone(p.referredName, 'Someone')} created a NovaQuiz account using your referral link. Your reward is waiting to be claimed on your profile page.`,
    facts: [
      ['Who signed up', someone(p.referredName, 'A new member')],
      ['Their email', maskEmail(p.referredEmail)],
      ['Signed up at', formatDateTime(p.referredAt)],
      ['Your reward', credits(p.rewardCredits)],
      ['Unclaimed rewards', p.unclaimedCredits != null ? `${credits(p.unclaimedCredits)} from ${p.unclaimedReferrals ?? 0} referral(s)` : undefined],
      ['Total people invited', p.totalReferrals]
    ],
    cta: { label: 'Claim your reward', url: appUrl('/profile') },
    note: 'Rewards are not added automatically — open your profile and claim them. Keep sharing your link: every new member earns you more credits, and they get a signup bonus too.'
  }),
  'referral.completed.admin': (p) => ({
    title: 'New referral signup',
    subject: `[Ops] New referral signup — ${someone(p.referredName, 'a new user')}`,
    eyebrow: 'Referral',
    heading: 'A new user signed up through a referral link',
    intro: `${someone(p.referredName, 'A new user')} joined via a referral link.`,
    facts: [
      ['New user', someone(p.referredName, '—')],
      ['Their email', p.referredEmail],
      ['Referrer', p.referrerName],
      ['Referral code', p.referralCode],
      ['Signup bonus granted', credits(p.signupBonus)],
      ['Referrer reward (claimable)', credits(p.rewardCredits)],
      ['Signed up at', formatDateTime(p.referredAt)]
    ],
    cta: { label: 'Open admin panel', url: appUrl('/admin') }
  })
}

function resultUrl(p) {
  return p.examId ? appUrl(`/exams/${p.examId}/result`) : undefined
}

// Turns a template's content object into the block list emailLayout expects.
function toBlocks(content) {
  const blocks = []
  if (content.facts?.length) blocks.push({ type: 'facts', facts: content.facts })
  if (content.quote?.text) blocks.push({ type: 'quote', label: content.quote.label, text: content.quote.text })
  return blocks
}

// Last-resort content for an event_type with no template — a producer can
// ship a new event before the template lands, and that must still deliver a
// readable email rather than a raw JSON dump.
function fallbackContent(eventType, payload) {
  const [domain, event, audience] = String(eventType).split('.')
  const humanized = `${event || eventType}`.replace(/_/g, ' ')
  const facts = Object.entries(payload || {})
    .filter(([, v]) => v != null && typeof v !== 'object')
    .map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), String(v)])
  return {
    title: `NovaQuiz: ${humanized}`,
    subject: `NovaQuiz notification: ${humanized}`,
    eyebrow: domain || 'Notification',
    heading: `${humanized.charAt(0).toUpperCase()}${humanized.slice(1)}`,
    intro: audience === 'admin'
      ? 'A platform event was recorded. Details below.'
      : 'There is an update on your NovaQuiz account. Details below.',
    facts: [...facts, ['Event', eventType]],
    cta: { label: 'Open NovaQuiz', url: appUrl('/dashboard') }
  }
}

function contentFor(eventType, payload = {}) {
  const template = TEMPLATES[eventType]
  return template ? template(payload) : fallbackContent(eventType, payload)
}

// Short single-message form for Pushover/Telegram, where there is no HTML
// body and no room for a fact table — the two or three most useful facts are
// appended as plain lines instead.
export function renderMessage(eventType, payload = {}) {
  const c = contentFor(eventType, payload)
  const facts = (c.facts ?? [])
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${v}`)
  const body = [c.summary || c.intro, facts.join('\n')].filter(Boolean).join('\n\n')
  return { title: c.title, body, url: c.cta?.url }
}

// Full branded email. `reasonLabel` (the recipient-facing event label) is
// woven into the footer so it's clear which preference produced this mail.
export function renderEmail(eventType, payload = {}, { reasonLabel } = {}) {
  const c = contentFor(eventType, payload)
  const content = {
    preheader: c.summary || c.intro || c.title,
    eyebrow: c.eyebrow,
    heading: c.heading || c.title,
    intro: c.intro,
    blocks: toBlocks(c),
    cta: c.cta?.url ? c.cta : undefined,
    note: c.note,
    footerReason: reasonLabel
      ? `You received this email because "${reasonLabel}" notifications are enabled for your account.`
      : 'You received this email because notifications are enabled for your NovaQuiz account.'
  }
  // Several subjects embed an exam title, which has no length limit — clamp so
  // a 300-character title doesn't produce a subject line clients truncate
  // mid-word with no ellipsis.
  const subject = c.subject || c.title
  return {
    subject: subject.length > 150 ? `${subject.slice(0, 147).trimEnd()}…` : subject,
    html: renderEmailHtml(content),
    text: renderEmailText(content)
  }
}

// Re-exported for callers that render one-off emails outside the queue
// (routes/contact.js) so they share this module's layout.
export { renderEmailHtml, renderEmailText, escapeHtml }
