import Redis from 'ioredis'

const DEFAULT_TTL_SECONDS = 60

const client = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: times => Math.min(times * 200, 2000)
    })
  : null

client?.on('error', err => console.warn('[cache] redis error:', err.message))

// Best-effort read-through cache: any Redis failure falls back to calling
// fetchFn directly, so a down/misconfigured cache never breaks a request.
export async function getOrSet(key, ttlSeconds, fetchFn) {
  if (!client) return fetchFn()

  try {
    const cached = await client.get(key)
    if (cached !== null) return JSON.parse(cached)
  } catch {
    return fetchFn()
  }

  const value = await fetchFn()
  client.set(key, JSON.stringify(value), 'EX', ttlSeconds ?? DEFAULT_TTL_SECONDS).catch(() => {})
  return value
}

export function invalidate(...keys) {
  if (!client || keys.length === 0) return
  client.del(...keys).catch(() => {})
}
