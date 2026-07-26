// Branded HTML email shell shared by every notification email (and the
// contact form). Deliberately old-school: nested tables, inline styles,
// no external CSS/webfonts/images. Gmail strips <style> blocks in some
// views and Outlook ignores flexbox/border-radius, so anything that must
// survive is expressed as a table cell with inline attributes; anything
// cosmetic (radius, letter-spacing) degrades gracefully.
//
// Light-mode only, with explicit colours on every element — clients that
// auto-invert dark mode do so on their own, and half-declared themes look
// worse than a single well-defined one.
import { BRAND, appUrl, siteUrl, escapeHtml } from './brand.js'

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif"

// A "block" is one piece of body content. Templates pass an ordered list so
// they can interleave prose, fact tables and callouts freely:
//   { type: 'text',  text }
//   { type: 'facts', facts: [[label, value], ...] }
//   { type: 'note',  text }
//   { type: 'quote', text }        // verbatim user-authored content
export function renderEmailHtml({
  preheader = '',
  eyebrow = '',
  heading = '',
  intro = '',
  blocks = [],
  cta,
  note = '',
  footerReason = ''
} = {}) {
  const body = [
    intro ? textBlock(intro) : '',
    ...blocks.map(renderBlock),
    cta ? ctaBlock(cta) : '',
    note ? noteBlock(note) : ''
  ].filter(Boolean).join('\n')

  return `<!-- ${escapeHtml(BRAND.name)} notification -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bg};margin:0;padding:24px 12px;font-family:${FONT};">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

        <!-- header -->
        <tr>
          <td style="background-color:${BRAND.primary};background-image:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});border-radius:16px 16px 0 0;padding:26px 32px;">
            <a href="${siteUrl('/')}" style="text-decoration:none;color:#ffffff;">
              <span style="display:inline-block;font-size:21px;font-weight:700;letter-spacing:-0.3px;color:#ffffff;">${escapeHtml(BRAND.name)}</span>
            </a>
            <div style="margin-top:4px;font-size:12px;color:#e5dcff;letter-spacing:0.2px;">${escapeHtml(BRAND.tagline)}</div>
          </td>
        </tr>

        <!-- body -->
        <tr>
          <td style="background-color:${BRAND.surface};padding:32px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
            ${eyebrow ? `<div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.accent};margin:0 0 10px;">${escapeHtml(eyebrow)}</div>` : ''}
            ${heading ? `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.35;font-weight:700;color:${BRAND.text};">${escapeHtml(heading)}</h1>` : ''}
            ${body}
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="background-color:#faf9ff;padding:24px 32px 28px;border:1px solid ${BRAND.border};border-radius:0 0 16px 16px;">
            <p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(BRAND.blurb)}</p>
            <p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:${BRAND.muted};">
              ${footerLinks()}
            </p>
            ${footerReason ? `<p style="margin:0 0 8px;font-size:11px;line-height:1.6;color:#8a8a9e;">${escapeHtml(footerReason)} You can change which notifications you receive at any time on your <a href="${appUrl('/profile') || siteUrl('/')}" style="color:${BRAND.accent};">profile page</a>.</p>` : ''}
            <p style="margin:0;font-size:11px;color:#a0a0b4;">© ${new Date().getFullYear()} ${escapeHtml(BRAND.name)}. This is an automated message — please do not reply.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`
}

function footerLinks() {
  const links = [
    ['Dashboard', appUrl('/dashboard')],
    ['Browse exams', appUrl('/exams')],
    ['Notification settings', appUrl('/profile')],
    ['novaquiz.net', siteUrl('/')],
    ['Contact', siteUrl('/contact')]
  ].filter(([, href]) => Boolean(href))
  return links
    .map(([label, href]) => `<a href="${href}" style="color:${BRAND.accent};text-decoration:none;">${escapeHtml(label)}</a>`)
    .join(`<span style="color:#c9c6dd;"> &nbsp;·&nbsp; </span>`)
}

function renderBlock(block) {
  if (!block) return ''
  if (block.type === 'facts') return factsBlock(block.facts)
  if (block.type === 'note') return noteBlock(block.text)
  if (block.type === 'quote') return quoteBlock(block.text, block.label)
  return textBlock(block.text)
}

function textBlock(text) {
  if (!text) return ''
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BRAND.text};">${escapeHtml(text)}</p>`
}

// Label/value rows — the "full information" part of every notification.
// Falsy values are dropped so a template can list optional fields
// unconditionally without emitting empty rows.
function factsBlock(facts = []) {
  const rows = facts
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `
            <tr>
              <td style="padding:9px 14px;font-size:13px;color:${BRAND.muted};white-space:nowrap;border-bottom:1px solid ${BRAND.border};vertical-align:top;">${escapeHtml(label)}</td>
              <td style="padding:9px 14px;font-size:14px;font-weight:600;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};">${escapeHtml(value)}</td>
            </tr>`)
  if (rows.length === 0) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 20px;background-color:#faf9ff;border:1px solid ${BRAND.border};border-radius:12px;">${rows.join('')}
          </table>`
}

function ctaBlock({ label, url }) {
  if (!label || !url) return ''
  // The href is escaped too: some CTA urls are built from payload data
  // (a mailto: for a contact-form reply), not just from our own constants.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
            <tr>
              <td align="center" style="background-color:${BRAND.primary};border-radius:10px;">
                <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
              </td>
            </tr>
          </table>`
}

function noteBlock(text) {
  if (!text) return ''
  return `<p style="margin:0 0 12px;padding:12px 14px;background-color:#f3efff;border-left:3px solid ${BRAND.accent};border-radius:6px;font-size:13px;line-height:1.6;color:#4a4560;">${escapeHtml(text)}</p>`
}

// Verbatim user-authored content (a report description, a teacher's reply).
// Visually separated so it's obvious what NovaQuiz wrote vs. what a person did.
function quoteBlock(text, label) {
  if (!text) return ''
  return `${label ? `<div style="margin:0 0 6px;font-size:12px;font-weight:600;color:${BRAND.muted};">${escapeHtml(label)}</div>` : ''}
          <blockquote style="margin:0 0 18px;padding:12px 16px;background-color:#f7f6fd;border-left:3px solid ${BRAND.border};border-radius:6px;font-size:14px;line-height:1.65;color:${BRAND.text};white-space:pre-wrap;">${escapeHtml(text)}</blockquote>`
}

// Plain-text alternative, from the same content object. Resend sends both
// parts; clients that prefer text (and spam filters, which score
// HTML-only mail worse) get something readable rather than stripped tags.
export function renderEmailText({ heading = '', intro = '', blocks = [], cta, note = '', footerReason = '' } = {}) {
  const lines = []
  if (heading) lines.push(heading, '')
  if (intro) lines.push(intro, '')
  for (const block of blocks) {
    if (!block) continue
    if (block.type === 'facts') {
      for (const [label, value] of block.facts ?? []) {
        if (value === undefined || value === null || String(value).trim() === '') continue
        lines.push(`${label}: ${value}`)
      }
      lines.push('')
    } else if (block.type === 'quote') {
      if (block.label) lines.push(`${block.label}:`)
      if (block.text) lines.push(String(block.text).split('\n').map(l => `> ${l}`).join('\n'), '')
    } else if (block.text) {
      lines.push(block.text, '')
    }
  }
  if (cta?.url) lines.push(`${cta.label || 'Open'}: ${cta.url}`, '')
  if (note) lines.push(note, '')
  lines.push('—', `${BRAND.name} — ${BRAND.tagline}`, BRAND.blurb)
  const prefs = appUrl('/profile')
  if (footerReason) lines.push('', footerReason + (prefs ? ` Manage your notifications: ${prefs}` : ''))
  lines.push('', `${siteUrl('/')} · automated message, please do not reply.`)
  return lines.join('\n')
}
