---
name: QuizPlatform
description: >
  Adaptive dark/light design system for a Vietnamese online quiz & exam platform.
  Deep-purple brand palette (Udemy-inspired), Inter typography, clean card surfaces
  with subtle rounded corners. Landing page is light-only; quiz app supports
  user-toggled dark mode via data-theme="dark" on <html>.
version: alpha

colors:
  # Brand
  primary:       "#5625d1"
  primary-dark:  "#4318b0"
  primary-light: "#ede6ff"
  accent:        "#6d29d3"

  # Semantic
  success:  "#22c55e"
  danger:   "#ef4444"
  warning:  "#f59e0b"
  info:     "#38bdf8"

  # Surfaces — light mode (default)
  bg:       "#f8f7ff"
  surface:  "#ffffff"
  border:   "#d0d2e1"

  # Text — light mode (default)
  text:     "#2b2a3f"
  muted:    "#595d72"
  on-brand: "#ffffff"

  # Surfaces — dark mode (applied via [data-theme="dark"])
  bg-dark:      "#202331"
  surface-dark: "#2d2b42"
  border-dark:  "#3d4055"
  text-dark:    "#f1f5f9"
  muted-dark:   "#94a3b8"

typography:
  body:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    fontSize:   "1rem"
    fontWeight: 400
    lineHeight: "1.6"
  body-sm:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    fontSize:   "0.875rem"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    fontSize:   "0.85rem"
    fontWeight: 500
    lineHeight: "1.4"
  label-sm:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    fontSize:   "0.78rem"
    fontWeight: 600
    letterSpacing: "0.02em"
  h1:
    fontFamily:    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    fontSize:      "clamp(2.1rem, 6vw, 3.75rem)"
    fontWeight:    900
    lineHeight:    "1.08"
    letterSpacing: "-0.05em"
  h2:
    fontFamily:    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    fontSize:      "1.6rem"
    fontWeight:    800
    letterSpacing: "-0.03em"
  h3:
    fontFamily:    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    fontSize:      "1.2rem"
    fontWeight:    700
    letterSpacing: "-0.02em"
  brand:
    fontFamily:    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    fontSize:      "1.2rem"
    fontWeight:    800
    letterSpacing: "-0.02em"
  code:
    fontFamily: "JetBrains Mono, 'Courier New', monospace"
    fontSize:   "0.875rem"
    fontWeight: 400

rounded:
  sm:   "8px"
  md:   "10px"
  lg:   "16px"
  xl:   "20px"
  full: "9999px"

spacing:
  xs:  "4px"
  sm:  "8px"
  md:  "16px"
  lg:  "24px"
  xl:  "32px"
  2xl: "48px"
  3xl: "64px"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor:       "{colors.on-brand}"
    rounded:         "{rounded.md}"
    padding:         "0.65rem 1.5rem"

  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"

  button-secondary:
    backgroundColor: "transparent"
    textColor:       "{colors.primary}"
    rounded:         "{rounded.md}"

  button-ghost:
    backgroundColor: "transparent"
    textColor:       "{colors.text}"
    rounded:         "{rounded.sm}"

  button-danger:
    backgroundColor: "{colors.danger}"
    textColor:       "{colors.on-brand}"
    rounded:         "{rounded.md}"

  card:
    backgroundColor: "{colors.surface}"
    textColor:       "{colors.text}"
    rounded:         "{rounded.lg}"

  card-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor:       "{colors.text-dark}"
    rounded:         "{rounded.lg}"

  input:
    backgroundColor: "{colors.surface}"
    textColor:       "{colors.text}"
    rounded:         "{rounded.sm}"

  input-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor:       "{colors.text-dark}"
    rounded:         "{rounded.sm}"

  nav:
    backgroundColor: "rgba(255,255,255,0.92)"
    textColor:       "{colors.muted}"
    height:          "60px"

  nav-dark:
    backgroundColor: "rgba(15,23,42,0.94)"
    textColor:       "{colors.muted-dark}"
    height:          "60px"

  badge-pill:
    backgroundColor: "{colors.primary-light}"
    textColor:       "{colors.primary}"
    rounded:         "{rounded.full}"
    padding:         "0.15rem 0.6rem"

  option-btn:
    backgroundColor: "{colors.surface}"
    textColor:       "{colors.text}"
    rounded:         "{rounded.sm}"

  option-btn-selected:
    backgroundColor: "{colors.primary-light}"
    textColor:       "{colors.primary}"
    rounded:         "{rounded.sm}"
---

## Overview

**QuizPlatform** là nền tảng thi trực tuyến cho người dùng Việt Nam — học sinh, giáo viên và admin. Bộ nhận diện thương hiệu xây dựng trên bộ màu deep-purple (`#5625d1 → #6d29d3`) lấy cảm hứng từ Udemy, phản ánh sự chuyên nghiệp, tin cậy và học thuật.

Nguyên tắc cốt lõi:
- **Nhất quán**: Cùng một bộ token áp dụng cho cả landing page và quiz app.
- **Adaptive**: Light mode là mặc định; dark mode kích hoạt bằng `data-theme="dark"` trên `<html>`.
- **Tối giản**: Ít màu sắc, nhiều không gian, text rõ ràng.

Logo / brand text dùng gradient: `linear-gradient(135deg, #5625d1, #6d29d3)` với `-webkit-background-clip: text`. Gradient gần như monochromatic (cùng hue purple) — đơn giản và chuyên nghiệp hơn so với gradient wide-hue cũ.

## Colors

### Brand gradient
Màu chính là cặp **Deep Purple `#5625d1` → Purple `#6d29d3`** (Udemy-inspired). Gradient này xuất hiện tại:
- Logo / brand text (background-clip: text)
- Nút CTA primary (background gradient)
- Avatar fallback (initials circle)
- Progress bar fill

`primary-dark` (`#4318b0`) dùng cho hover state của nút primary.
`primary-light` (`#ede6ff`) dùng làm nền highlight (active nav link, selected option, hover background).

### Semantic colors
- **success** `#22c55e` — pass, badge earned, form success
- **danger** `#ef4444` — fail, delete confirm, ban state, error
- **warning** `#f59e0b` — cooldown notice, credit low, approaching limit
- **info** `#38bdf8` — neutral info chips, countdown badge

### Light/dark surfaces
Dark mode chỉ thay thế surface và text tokens; brand colors không đổi. Không tạo riêng màu brand cho dark.

## Typography

Font duy nhất cho UI text: **Inter** (load từ Google Fonts). Dùng **JetBrains Mono** cho code và placeholders kiểu monospace (ví dụ URL bar trong mockup).

Không dùng font hệ thống cho headings — `-webkit-font-smoothing: antialiased` bắt buộc trên `body`.

Heading `h1` dùng `clamp()` để scale responsive, không fixed breakpoint.  
Brand text selalu `font-weight: 800`, `letter-spacing: -0.02em`.

## Layout

- **Max content width**: `1100px`, `margin: 0 auto`, `padding: 0 1.5rem`
- **Nav height**: `60px` (sticky, backdrop-blur)
- **Main padding**: `2rem 1.5rem` (desktop) / `1.25rem 1rem` (mobile < 768px)
- **Mobile breakpoint**: `768px` — nav links ẩn, hamburger menu hiện
- **Card grid**: CSS Grid với `auto-fill, minmax(280px, 1fr)`

## Elevation & Depth

Hai mức shadow chính (theo token `--shadow` / `--shadow-hover`):

| State   | Light mode                              | Dark mode                             |
|---------|-----------------------------------------|---------------------------------------|
| Default | `0 4px 20px rgba(86,37,209,0.08)`      | `0 4px 20px rgba(0,0,0,0.4)`         |
| Hover   | `0 12px 36px rgba(86,37,209,0.18)`     | `0 12px 36px rgba(0,0,0,0.55)`       |

Nav bar dùng `backdrop-filter: blur(12px)` thay vì shadow.  
Card hover: `transform: translateY(-2px)` kết hợp tăng shadow.

## Shapes

- `rounded.sm` (`8px`) — buttons, inputs, nav links
- `rounded.md` (`10px`) — hero CTA buttons, select, textarea
- `rounded.lg` (`16px`) — cards, modal overlays, mockup frame
- `rounded.xl` (`20px`) — login card, large feature panels
- `rounded.full` (`9999px`) — pills, tags, avatar, eyebrow badge

## Components

### Buttons
- **Primary**: gradient background `linear-gradient(135deg, #5625d1, #6d29d3)`. Hover: solid `#4318b0` + `translateY(-1px)`.
- **Ghost**: transparent + `border: 1.5px solid {border}`. Hover: border đổi sang `{primary}`.
- **Danger**: `#ef4444` background, dùng cho xoá và hành động không thể hoàn tác.

Tất cả buttons: `font-weight: 600+`, `transition: all 0.15s`, không có outline focus ring mặc định (thêm `:focus-visible` nếu cần a11y).

### Cards
Background `{surface}` / `{surface-dark}`, border `1px solid {border}`, `border-radius: {rounded.lg}`.  
Dùng shadow default, tăng lên shadow-hover khi hover.

### Inputs / Form controls
Border `1px solid {border}`, `border-radius: {rounded.sm}`. Focus: `border-color: {primary}` + `box-shadow: 0 0 0 3px rgba(86,37,209,0.15)`.  
Dark mode: background `{surface-dark}`, text `{text-dark}`.

### Nav
Sticky top, `backdrop-filter: blur(12px)`. Active link: `color: {primary}`, `background: {primary-light}`.  
Mobile (< 768px): nav links ẩn, hamburger + slide-in sidebar từ phải.

### Option buttons (take exam)
Mặc định: `border: 1.5px solid {border}`, background `{surface}`.  
Selected: `border-color: {primary}`, background `{primary-light}`, text `{primary}`.  
Correct (result view): `border-color: {success}`, background `rgba(34,197,94,0.08)`.  
Wrong: `border-color: {danger}`, background `rgba(239,68,68,0.08)`.

### Chips / Pills
Role badges và labels dùng 15% opacity background của màu tương ứng:
- student: `rgba(86,37,209,0.15)` / `{primary}`
- teacher: `rgba(234,179,8,0.15)` / `#a16207`
- admin: `rgba(236,72,153,0.15)` / `#9d174d`
- banned: `rgba(239,68,68,0.15)` / `{danger}`

## Do's and Don'ts

**Do:**
- Dùng brand gradient đồng nhất trên cả landing page và quiz app — không dùng plain `#4318b0` solid cho brand text hay logo.
- Dùng `{primary-light}` làm hover/active background — không dùng opacity trực tiếp trên primary.
- Giữ dark mode bằng cách swap surface/text tokens — không tạo thêm màu brand riêng cho dark.
- Radius `16px` cho cards, `10px` cho buttons, `8px` cho inputs — không mix tuỳ tiện.

**Don't:**
- Đừng dùng màu `#6366f1` (indigo cũ) hay `#1d4ed8` (blue-700 cũ) làm brand primary — đã thống nhất về `#5625d1` (Udemy-style deep purple).
- Đừng hard-code hex màu trong component styles; luôn dùng CSS custom properties `var(--primary)`, v.v.
- Đừng tạo shadow nặng (`blur > 40px`) cho card thường — chỉ dùng cho modal/overlay.
- Đừng dùng `font-weight: 400` cho button text — min là `600`.
