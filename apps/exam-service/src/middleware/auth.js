export async function verifyAuth(req, reply, fastify) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 })
  }

  try {
    const res = await fetch(`${process.env.AUTH_SERVICE_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: auth.slice(7) })
    })
    if (!res.ok) return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 })
    req.user = await res.json()
  } catch (err) {
    fastify.log.error(err)
    return reply.status(503).send({ error: 'Auth service unavailable', statusCode: 503 })
  }
}
