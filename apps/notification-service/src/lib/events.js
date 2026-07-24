// Message templates keyed by the full event_type (including audience
// suffix), since admin/owner/teacher framing of the same business event
// reads differently. Each template returns { title, body, url? } — url is
// only used by Pushover today (opened when the notification is tapped).

const SITE_URL = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || ''

function examUrl(examId) {
  return examId && SITE_URL ? `${SITE_URL}/exams/${examId}` : undefined
}

const pct = (p) => (p.percentage != null ? `${p.percentage}%` : '')

const TEMPLATES = {
  'submission.completed.admin': (p) => ({
    title: 'Có bài nộp mới hoàn thành',
    body: `${p.studentName || 'Một học sinh'} vừa hoàn thành đề "${p.examTitle || ''}" — ${pct(p)}`,
    url: examUrl(p.examId)
  }),
  'submission.completed.owner': (p) => ({
    title: 'Kết quả bài thi của bạn',
    body: `Bạn đạt ${pct(p)} trong đề "${p.examTitle || ''}"${p.passed === true ? ' — Đạt' : p.passed === false ? ' — Chưa đạt' : ''}`,
    url: examUrl(p.examId)
  }),
  'submission.completed.teacher': (p) => ({
    title: 'Học sinh vừa nộp bài đề của bạn',
    body: `${p.studentName || 'Một học sinh'} vừa hoàn thành đề "${p.examTitle || ''}" — ${pct(p)}`,
    url: examUrl(p.examId)
  }),
  'submission.timed_out.admin': (p) => ({
    title: 'Có bài thi hết giờ tự động nộp',
    body: `Bài của ${p.studentName || 'một học sinh'} trong đề "${p.examTitle || ''}" đã hết giờ và được tự động nộp`,
    url: examUrl(p.examId)
  }),
  'submission.timed_out.owner': (p) => ({
    title: 'Bài thi của bạn đã hết giờ',
    body: `Bài thi "${p.examTitle || ''}" của bạn đã hết giờ và được tự động nộp — ${pct(p)}`,
    url: examUrl(p.examId)
  }),
  'submission.timed_out.teacher': (p) => ({
    title: 'Bài thi đề của bạn vừa hết giờ',
    body: `Bài của ${p.studentName || 'một học sinh'} trong đề "${p.examTitle || ''}" đã hết giờ và được tự động nộp`,
    url: examUrl(p.examId)
  }),
  'badge.earned.admin': (p) => ({
    title: 'Có học sinh đạt huy hiệu mới',
    body: `${p.studentName || 'Một học sinh'} vừa đạt huy hiệu "${p.collectionTitle || ''}"`
  }),
  'badge.earned.owner': (p) => ({
    title: 'Bạn vừa đạt huy hiệu mới',
    body: `Chúc mừng! Bạn vừa đạt huy hiệu "${p.collectionTitle || ''}"`
  }),
  'report.filed.admin': (p) => ({
    title: 'Có báo cáo đề thi mới',
    body: `${p.reporterName || 'Một người dùng'} vừa báo cáo đề "${p.examTitle || ''}" (${p.category || ''})`,
    url: examUrl(p.examId)
  }),
  'report.filed.teacher': (p) => ({
    title: 'Đề thi của bạn bị báo cáo',
    body: `Đề "${p.examTitle || ''}" của bạn vừa bị báo cáo (${p.category || ''})`,
    url: examUrl(p.examId)
  }),
  'report.resolved.admin': (p) => ({
    title: 'Báo cáo đã được xử lý',
    body: `Báo cáo trên đề "${p.examTitle || ''}" đã được phản hồi`,
    url: examUrl(p.examId)
  }),
  'report.resolved.reporter': (p) => ({
    title: 'Báo cáo của bạn đã được phản hồi',
    body: p.response ? `Phản hồi: ${p.response}` : 'Báo cáo của bạn đã được xử lý',
    url: examUrl(p.examId)
  }),
  'generation.completed.admin': (p) => ({
    title: 'Có đề thi AI tạo thành công',
    body: `${p.teacherName || 'Một giáo viên'} vừa tạo đề "${p.examTitle || ''}" bằng AI (${p.questionCount ?? '?'} câu)`,
    url: examUrl(p.examId)
  }),
  'generation.completed.owner': (p) => ({
    title: 'Đề thi AI của bạn đã tạo xong',
    body: `Đề "${p.examTitle || ''}" (${p.questionCount ?? '?'} câu) đã sẵn sàng để bạn xem lại`,
    url: examUrl(p.examId)
  }),
  'generation.failed.admin': (p) => ({
    title: 'Có phiên tạo đề AI thất bại',
    body: `Lượt tạo đề của ${p.teacherName || 'một giáo viên'} thất bại: ${p.errorMessage || 'lỗi không xác định'}`
  }),
  'generation.failed.owner': (p) => ({
    title: 'Tạo đề AI của bạn thất bại',
    body: p.errorMessage || 'Đã có lỗi xảy ra, vui lòng thử lại'
  }),
  'credit.deduct_failed.admin': (p) => ({
    title: 'Có giao dịch trừ credit thất bại',
    body: `${p.userName || 'Một người dùng'} không đủ credit (cần ${p.amount ?? '?'})${p.reason ? ` — ${p.reason}` : ''}`
  }),
  'credit.deduct_failed.owner': (p) => ({
    title: 'Không đủ credit để thực hiện',
    body: `Bạn không đủ credit (cần ${p.amount ?? '?'})${p.reason ? ` — ${p.reason}` : ''}`
  }),
  'teacher_upgrade.succeeded.admin': (p) => ({
    title: 'Có tài khoản nâng cấp lên giáo viên',
    body: `${p.userName || 'Một người dùng'} vừa nâng cấp lên giáo viên`
  }),
  'teacher_upgrade.succeeded.owner': (p) => ({
    title: 'Bạn đã nâng cấp thành công lên giáo viên',
    body: `Số dư credit còn lại: ${p.newBalance ?? '?'}`
  })
}

export function renderMessage(eventType, payload = {}) {
  const template = TEMPLATES[eventType]
  if (!template) return { title: eventType, body: JSON.stringify(payload) }
  return template(payload)
}
