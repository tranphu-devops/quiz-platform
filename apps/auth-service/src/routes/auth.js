import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'

const VALID_ROLES = ['admin', 'teacher', 'student']

export default async function authRoutes(fastify) {
  fastify.post('/register', async (req, reply) => {
    const { email, password, role = 'student' } = req.body ?? {}

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required', statusCode: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
      return reply.status(400).send({ error: 'Invalid role', statusCode: 400 })
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10)
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
        [email, passwordHash, role]
      )
      return reply.status(201).send({ user: result.rows[0] })
    } catch (err) {
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Email already exists', statusCode: 409 })
      }
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required', statusCode: 400 })
    }

    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials', statusCode: 401 })
      }

      const user = result.rows[0]
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials', statusCode: 401 })
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      )

      return { token, user: { id: user.id, email: user.email, role: user.role } }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  fastify.post('/verify', async (req, reply) => {
    const { token } = req.body ?? {}
    if (!token) {
      return reply.status(400).send({ error: 'Token required', statusCode: 400 })
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      return { userId: payload.userId, role: payload.role }
    } catch {
      return reply.status(401).send({ error: 'Invalid token', statusCode: 401 })
    }
  })
}
