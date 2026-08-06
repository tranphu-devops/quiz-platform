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
  },
  ja: {
    'catalog.title': 'オンライン練習問題集',
    'catalog.subtitle': '無料の練習問題ライブラリ — 受験するとすぐに自動採点され、提出直後に解説が確認できます。',
    'catalog.metaDescription': 'NovaQuizの無料オンライン練習問題集：ブラウザで受験し、自動採点、提出直後に解答と解説を確認できます。',
    'catalog.empty': 'まだ公開されている問題集はありません。',
    'catalog.topics': 'トピック',
    'catalog.allExams': 'すべての問題集',
    'topic.metaDescription': 'NovaQuizの{label}に関する練習問題{count}件 — オンラインで無料受験、自動採点。',
    'topic.heading': '{label}の問題集',
    'topic.count': '{count}件の問題集',
    'topic.otherTopics': '他のトピック',
    'exam.questions': '{count}問',
    'exam.minutes': '{count}分',
    'exam.passingScore': '合格基準 {score}%',
    'exam.attempts': '{count}回受験',
    'exam.author': '作成者',
    'exam.sample': 'サンプル問題',
    'exam.sampleNote': '解答と解説は提出後に表示されます。',
    'exam.cta': 'NovaQuizでこの問題集を受験する',
    'exam.ctaNote': 'ログインが必要です。無料登録、パスワード不要。',
    'exam.scheduled': '{date}に開始',
    'exam.related': '関連する問題集',
    'exam.metaFallback': 'NovaQuizのオンライン練習問題集 — 受験して自動採点、解説を確認できます。',
    'exam.multiple': '複数選択',
    'exam.single': '単一選択',
    'nav.home': 'ホーム',
    'pager.prev': '前へ',
    'pager.next': '次へ',
    'pager.page': '{n}ページ'
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
