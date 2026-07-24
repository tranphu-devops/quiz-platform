// Known Compose-service names this aggregator can reach over the internal
// Docker network. `grader-service` is a cron-only worker with no HTTP server,
// so it's intentionally absent here (container state alone still covers it).
export const HTTP_SERVICES = {
  'user-service': 'http://user-service:3002',
  'exam-service': 'http://exam-service:3003',
  'submission-service': 'http://submission-service:3004',
  'interaction-service': 'http://interaction-service:3005',
  'generator-service': 'http://generator-service:3006',
  'notification-service': 'http://notification-service:3007'
}

export const KNOWN_SERVICES = [...Object.keys(HTTP_SERVICES), 'grader-service']

export async function fetchHealth(serviceName, timeoutMs = 2000) {
  const url = HTTP_SERVICES[serviceName]
  if (!url) return { reachable: false, reason: 'no-http-endpoint' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal })
    if (!res.ok) return { reachable: false, reason: `http-${res.status}` }
    return { reachable: true, body: await res.json() }
  } catch (err) {
    return { reachable: false, reason: err.name === 'AbortError' ? 'timeout' : 'network-error' }
  } finally {
    clearTimeout(timer)
  }
}
