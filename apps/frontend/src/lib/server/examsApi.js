// Server-only client for exam-service's public read API.
//
// Deliberately not $lib/api.js: that module fetches relative URLs against the
// global fetch (which has no origin in Node) and memoises an ECDH handshake in
// module scope — fine per browser tab, wrong for a long-lived server process
// shared by every visitor.
//
// Calls go straight to exam-service over the Docker network. Routing them back
// through nginx would put every visitor into a single rate-limit bucket, since
// that zone is keyed on the caller's IP and the caller would be this container.

import { env } from '$env/dynamic/private'
import { error } from '@sveltejs/kit'

const BASE = env.EXAM_SERVICE_URL ?? 'http://exam-service:3003'
const TIMEOUT_MS = 5000

/**
 * The visitor's IP, or undefined when it cannot be determined.
 *
 * adapter-node's getClientAddress() *throws* when ADDRESS_HEADER is configured
 * but the header is missing — which is every request that does not come through
 * nginx (a health probe, a direct container hit, `node build` in local dev).
 * Losing the rate-limit key is not worth a 500, so this degrades instead.
 */
export function clientIpOf(event) {
  try {
    return event.getClientAddress()
  } catch {
    return undefined
  }
}

/**
 * GET a /public/* endpoint. Returns null on 404 so callers can decide between
 * a 404 page and a fallback; throws a SvelteKit 503 on anything else.
 *
 * @param {string} path e.g. '/public/exams?lang=vi'
 * @param {{ clientIp?: string }} [opts]
 */
export async function publicGet(path, { clientIp } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        // Lets exam-service rate-limit per visitor instead of per SSR process.
        // Never send x-client-pubkey (would turn on response encryption) or
        // x-internal-key (that key opens /exams/internal/:id, which returns the
        // answer key for every question — it must not live in this container).
        ...(clientIp ? { 'x-forwarded-for': clientIp } : {})
      }
    })
  } catch (err) {
    throw error(503, 'Không kết nối được tới máy chủ đề thi')
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 404) return null
  if (!res.ok) throw error(503, 'Máy chủ đề thi đang bận, thử lại sau')
  return res.json()
}

/** Same as publicGet but turns a missing resource into a real 404 page. */
export async function publicGetOr404(path, opts) {
  const data = await publicGet(path, opts)
  // A soft 404 — a 200 page saying "not found" — gets indexed as a real page.
  if (data === null) throw error(404, 'Không tìm thấy nội dung')
  return data
}
