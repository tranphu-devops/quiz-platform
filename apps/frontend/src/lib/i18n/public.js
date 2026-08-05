// Copy for the public pages.
//
// Not the $lib/i18n store: that one initialises from localStorage/navigator in
// the browser and always falls back to 'vi' on the server, so a server-rendered
// page would flip language after hydration and disagree with its own <html
// lang>. Here the language is a URL segment, so a plain lookup is both correct
// and identical on both sides. It also avoids writing `quiz-lang`, which would
// silently change the app's language for someone who only browsed the catalog.
//
// The nav/footer strings are not here: they come from CHROME_STRINGS, generated
// from landing/partials/i18n.json, so the shared chrome reads the same wording
// on the landing pages and on these. A key below overrides the shared one.

import { CHROME_STRINGS } from './chrome-strings.js'

const DICT = {
  vi: {
    'catalog.title': 'Đề thi trắc nghiệm online',
    'catalog.subtitle': 'Kho đề thi thử miễn phí — làm bài, chấm điểm tự động và xem giải thích ngay sau khi nộp.',
    'catalog.metaDescription': 'Kho đề thi trắc nghiệm online miễn phí trên NovaQuiz: làm bài trực tuyến, chấm điểm tự động, xem đáp án và giải thích ngay sau khi nộp bài.',
    'catalog.empty': 'Chưa có đề thi nào được đăng.',
    'catalog.topics': 'Chủ đề',
    'catalog.allExams': 'Tất cả đề thi',
    'topic.metaDescription': 'Tổng hợp {count} đề thi {label} trên NovaQuiz — làm bài online miễn phí, chấm điểm tự động.',
    'topic.heading': 'Đề thi {label}',
    'topic.count': '{count} đề thi',
    'topic.otherTopics': 'Chủ đề khác',
    'exam.questions': '{count} câu hỏi',
    'exam.minutes': '{count} phút',
    'exam.passingScore': 'Điểm đạt {score}%',
    'exam.attempts': '{count} lượt làm',
    'exam.author': 'Người soạn',
    'exam.sample': 'Câu hỏi mẫu',
    'exam.sampleNote': 'Đáp án và giải thích hiển thị sau khi bạn nộp bài.',
    'exam.cta': 'Vào thi trên NovaQuiz',
    'exam.ctaNote': 'Cần đăng nhập. Đăng ký miễn phí, không cần mật khẩu.',
    'exam.scheduled': 'Đề mở làm bài từ {date}',
    'exam.related': 'Đề thi liên quan',
    'exam.metaFallback': 'Đề thi trắc nghiệm online trên NovaQuiz — làm bài, chấm điểm tự động, xem giải thích.',
    'exam.multiple': 'Chọn nhiều đáp án',
    'exam.single': 'Chọn một đáp án',
    // Local because it labels a breadcrumb trail, not a link in the chrome.
    'nav.home': 'Trang chủ',
    'pager.prev': 'Trang trước',
    'pager.next': 'Trang sau',
    'pager.page': 'Trang {n}'
  },
  en: {
    'catalog.title': 'Online practice exams',
    'catalog.subtitle': 'A free library of practice tests — take one, get graded instantly and see the explanations the moment you submit.',
    'catalog.metaDescription': 'Free online practice exams on NovaQuiz: take a test in your browser, get graded automatically, and see the answers and explanations as soon as you submit.',
    'catalog.empty': 'No exams published yet.',
    'catalog.topics': 'Topics',
    'catalog.allExams': 'All exams',
    'topic.metaDescription': '{count} {label} practice exams on NovaQuiz — free to take online, graded automatically.',
    'topic.heading': '{label} exams',
    'topic.count': '{count} exams',
    'topic.otherTopics': 'Other topics',
    'exam.questions': '{count} questions',
    'exam.minutes': '{count} min',
    'exam.passingScore': 'Pass mark {score}%',
    'exam.attempts': '{count} attempts',
    'exam.author': 'Author',
    'exam.sample': 'Sample question',
    'exam.sampleNote': 'The answer and its explanation appear once you submit.',
    'exam.cta': 'Take this exam on NovaQuiz',
    'exam.ctaNote': 'Sign-in required. Free to join, no password needed.',
    'exam.scheduled': 'Opens {date}',
    'exam.related': 'Related exams',
    'exam.metaFallback': 'An online practice exam on NovaQuiz — take it, get graded automatically, read the explanations.',
    'exam.multiple': 'Select several answers',
    'exam.single': 'Select one answer',
    'nav.home': 'Home',
    'pager.prev': 'Previous',
    'pager.next': 'Next',
    'pager.page': 'Page {n}'
  }
}

/**
 * Translator for a language prefix. Unknown keys return the key itself so a
 * missing string is obvious rather than blank.
 */
export function publicT(lang) {
  const merged = (l) => ({ ...CHROME_STRINGS[l], ...DICT[l] })
  const fallback = merged('vi')
  const dict = DICT[lang] ? merged(lang) : fallback
  return (key, params) => {
    const raw = dict[key] ?? fallback[key] ?? key
    if (!params) return raw
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
  }
}
