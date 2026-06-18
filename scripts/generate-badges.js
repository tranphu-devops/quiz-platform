#!/usr/bin/env node
// Run: node scripts/generate-badges.js
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dir, '../apps/frontend/static/badges')
mkdirSync(OUT, { recursive: true })

const badges = [
  // Stars
  { id:  1, name: 'Ngôi sao đồng',        emoji: '⭐', c1: '#7C5307', c2: '#C8930A', ring: '#E8A820' },
  { id:  2, name: 'Ngôi sao bạc',         emoji: '🌟', c1: '#6B7280', c2: '#A1A8B0', ring: '#D1D5DB' },
  { id:  3, name: 'Ngôi sao vàng',        emoji: '✨', c1: '#92610A', c2: '#D4A017', ring: '#FBBF24' },
  { id:  4, name: 'Ngôi sao bạch kim',    emoji: '💫', c1: '#1D4ED8', c2: '#3B82F6', ring: '#93C5FD' },
  { id:  5, name: 'Ngôi sao kim cương',   emoji: '💎', c1: '#0C4A6E', c2: '#0EA5E9', ring: '#BAE6FD' },
  // Medals/Trophy
  { id:  6, name: 'Huy chương đồng',      emoji: '🥉', c1: '#7C3313', c2: '#C2693A', ring: '#D4923A' },
  { id:  7, name: 'Huy chương bạc',       emoji: '🥈', c1: '#52525B', c2: '#9CA3AF', ring: '#D1D5DB' },
  { id:  8, name: 'Huy chương vàng',      emoji: '🥇', c1: '#78350F', c2: '#D97706', ring: '#FCD34D' },
  { id:  9, name: 'Cúp vô địch',          emoji: '🏆', c1: '#713F12', c2: '#CA8A04', ring: '#FDE68A' },
  { id: 10, name: 'Vương miện',           emoji: '👑', c1: '#3B0764', c2: '#7E22CE', ring: '#C084FC' },
  // Tech
  { id: 11, name: 'Điện toán đám mây',    emoji: '☁️', c1: '#1E3A5F', c2: '#1E6FA5', ring: '#7DD3FC' },
  { id: 12, name: 'Lập trình viên',       emoji: '💻', c1: '#0F172A', c2: '#1E293B', ring: '#475569' },
  { id: 13, name: 'Cơ sở dữ liệu',       emoji: '🗄️', c1: '#052E16', c2: '#15803D', ring: '#4ADE80' },
  { id: 14, name: 'Bảo mật',             emoji: '🔐', c1: '#450A0A', c2: '#B91C1C', ring: '#FCA5A5' },
  { id: 15, name: 'Mạng máy tính',        emoji: '🌐', c1: '#042F2E', c2: '#0F766E', ring: '#5EEAD4' },
  { id: 16, name: 'Ứng dụng di động',     emoji: '📱', c1: '#2E1065', c2: '#6D28D9', ring: '#C4B5FD' },
  { id: 17, name: 'Trí tuệ nhân tạo',     emoji: '🤖', c1: '#083344', c2: '#0E7490', ring: '#67E8F9' },
  { id: 18, name: 'Khoa học dữ liệu',     emoji: '📊', c1: '#431407', c2: '#C2410C', ring: '#FDBA74' },
  { id: 19, name: 'DevOps',              emoji: '⚙️', c1: '#1C1917', c2: '#44403C', ring: '#A8A29E' },
  { id: 20, name: 'Phát triển web',       emoji: '🕸️', c1: '#1E1B4B', c2: '#4338CA', ring: '#A5B4FC' },
  // Skill levels
  { id: 21, name: 'Người mới bắt đầu',    emoji: '🌱', c1: '#052E16', c2: '#166534', ring: '#86EFAC' },
  { id: 22, name: 'Người học ham học',    emoji: '📚', c1: '#7C2D12', c2: '#C2410C', ring: '#FED7AA' },
  { id: 23, name: 'Nhà khám phá',         emoji: '🧭', c1: '#042F2E', c2: '#0E7490', ring: '#67E8F9' },
  { id: 24, name: 'Chuyên gia',           emoji: '🎯', c1: '#450A0A', c2: '#DC2626', ring: '#FCA5A5' },
  { id: 25, name: 'Bậc thầy',            emoji: '🏅', c1: '#1E1B4B', c2: '#3730A3', ring: '#818CF8' },
  // Special achievements
  { id: 26, name: 'Chuỗi liên tiếp',      emoji: '🔥', c1: '#431407', c2: '#EA580C', ring: '#FED7AA' },
  { id: 27, name: 'Siêu nhanh',           emoji: '⚡', c1: '#713F12', c2: '#CA8A04', ring: '#FEF08A' },
  { id: 28, name: 'Điểm tuyệt đối',       emoji: '💯', c1: '#052E16', c2: '#15803D', ring: '#A7F3D0' },
  { id: 29, name: 'Kiên trì',             emoji: '🎖️', c1: '#1E3A5F', c2: '#1D4ED8', ring: '#93C5FD' },
  { id: 30, name: 'Nhận thử thách',       emoji: '⚔️', c1: '#3B0764', c2: '#9333EA', ring: '#E9D5FF' },
  // Animals
  { id: 31, name: 'Cú trí tuệ',           emoji: '🦉', c1: '#292524', c2: '#57534E', ring: '#D6D3D1' },
  { id: 32, name: 'Tên lửa',             emoji: '🚀', c1: '#0F172A', c2: '#1E3A5F', ring: '#818CF8' },
  { id: 33, name: 'Sư tử dũng mãnh',     emoji: '🦁', c1: '#78350F', c2: '#B45309', ring: '#FCD34D' },
  { id: 34, name: 'Đại bàng bay cao',     emoji: '🦅', c1: '#0C1A2E', c2: '#1E3A5F', ring: '#7DD3FC' },
  { id: 35, name: 'Rồng huyền thoại',     emoji: '🐉', c1: '#3B0764', c2: '#7E22CE', ring: '#F0ABFC' },
  // Symbols
  { id: 36, name: 'Lá chắn thép',         emoji: '🛡️', c1: '#1E3A5F', c2: '#1D4ED8', ring: '#BFDBFE' },
  { id: 37, name: 'Viên ngọc quý',        emoji: '💠', c1: '#042F2E', c2: '#0F766E', ring: '#99F6E4' },
  { id: 38, name: 'Thám tử',             emoji: '🔍', c1: '#1C1917', c2: '#292524', ring: '#A8A29E' },
  { id: 39, name: 'Phù thủy',            emoji: '🧙', c1: '#2E1065', c2: '#4C1D95', ring: '#DDD6FE' },
  { id: 40, name: 'Cầu vồng kỳ diệu',    emoji: '🌈', c1: '#4C1D95', c2: '#BE185D', ring: '#FBCFE8' },
  // Study
  { id: 41, name: 'Mọt sách',            emoji: '📖', c1: '#292524', c2: '#78716C', ring: '#D6D3D1' },
  { id: 42, name: 'Tốt nghiệp xuất sắc', emoji: '🎓', c1: '#0F172A', c2: '#1E3A5F', ring: '#C7D2FE' },
  { id: 43, name: 'Học sinh giỏi',        emoji: '✏️', c1: '#713F12', c2: '#D97706', ring: '#FEF08A' },
  { id: 44, name: 'Nhà khoa học',         emoji: '🔬', c1: '#052E16', c2: '#166534', ring: '#BBF7D0' },
  { id: 45, name: 'Nhà thiên văn',        emoji: '🔭', c1: '#0F172A', c2: '#1E1B4B', ring: '#C7D2FE' },
  // Lifestyle
  { id: 46, name: 'Cú đêm',              emoji: '🌙', c1: '#020617', c2: '#0F172A', ring: '#818CF8' },
  { id: 47, name: 'Chim sớm',            emoji: '🌅', c1: '#7C2D12', c2: '#C2410C', ring: '#FDBA74' },
  { id: 48, name: 'Bền bỉ marathon',      emoji: '🏃', c1: '#052E16', c2: '#166534', ring: '#86EFAC' },
  { id: 49, name: 'Nước rút sprint',      emoji: '💨', c1: '#0C4A6E', c2: '#0369A1', ring: '#7DD3FC' },
  { id: 50, name: 'Cộng đồng',           emoji: '🤝', c1: '#042F2E', c2: '#0F766E', ring: '#5EEAD4' },
]

for (const b of badges) {
  const num = String(b.id).padStart(2, '0')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <radialGradient id="bg${num}" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="${b.c2}"/>
      <stop offset="100%" stop-color="${b.c1}"/>
    </radialGradient>
    <filter id="sh${num}" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="${b.c1}" flood-opacity="0.5"/>
    </filter>
  </defs>
  <circle cx="32" cy="32" r="31" fill="${b.ring}" opacity="0.25"/>
  <circle cx="32" cy="32" r="28" fill="url(#bg${num})" filter="url(#sh${num})"/>
  <circle cx="26" cy="23" r="9" fill="white" opacity="0.10"/>
  <circle cx="32" cy="32" r="28" fill="none" stroke="${b.ring}" stroke-width="2"/>
  <text x="32" y="42" text-anchor="middle" font-size="26" font-family="Apple Color Emoji,Noto Color Emoji,Segoe UI Emoji,sans-serif">${b.emoji}</text>
</svg>`
  writeFileSync(join(OUT, `badge-${num}.svg`), svg, 'utf8')
}

console.log(`✓ Generated ${badges.length} badge SVGs → apps/frontend/static/badges/`)

// Also export badge metadata as JSON for the frontend picker
const meta = badges.map(b => ({ id: b.id, name: b.name, url: `/badges/badge-${String(b.id).padStart(2,'0')}.svg` }))
writeFileSync(join(__dir, '../apps/frontend/src/lib/badge-presets.json'), JSON.stringify(meta, null, 2), 'utf8')
console.log('✓ Wrote badge-presets.json')
