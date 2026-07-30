// Copy for the public pages.
//
// Not the $lib/i18n store: that one initialises from localStorage/navigator in
// the browser and always falls back to 'vi' on the server, so a server-rendered
// page would flip language after hydration and disagree with its own <html
// lang>. Here the language is a URL segment, so a plain lookup is both correct
// and identical on both sides. It also avoids writing `quiz-lang`, which would
// silently change the app's language for someone who only browsed the catalog.

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
    'nav.home': 'Trang chủ',
    'nav.exams': 'Đề thi',
    'nav.brand': 'Thương hiệu',
    'nav.contact': 'Liên hệ',
    'footer.tagline': 'Nền tảng thi trực tuyến thông minh.',
    'pager.prev': 'Trang trước',
    'pager.next': 'Trang sau',
    'pager.page': 'Trang {n}'
  }
}

/**
 * Translator for a language prefix. Unknown keys return the key itself so a
 * missing string is obvious rather than blank.
 */
export function publicT(lang) {
  const dict = DICT[lang] ?? DICT.vi
  return (key, params) => {
    const raw = dict[key] ?? DICT.vi[key] ?? key
    if (!params) return raw
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
  }
}
