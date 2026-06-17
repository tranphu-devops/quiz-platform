import { pool } from '../db.js'
import { verifyAuth } from '../middleware/auth.js'
import { uploadToS3, deleteFromS3 } from '../lib/s3.js'

const VALID_TYPES = ['avatar', 'exam-cover', 'question']

export default async function uploadRoutes(fastify) {
  fastify.addHook('preHandler', verifyAuth)

  fastify.post('/upload', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded', statusCode: 400 })

    const uploadType = data.fields?.type?.value ?? 'avatar'
    const oldUrl = data.fields?.old_url?.value ?? null
    if (!VALID_TYPES.includes(uploadType)) {
      return reply.status(400).send({ error: 'Invalid upload type', statusCode: 400 })
    }

    // Read validation settings from DB
    const { rows } = await pool.query(
      `SELECT key, value FROM admin_settings WHERE key IN ('upload_max_size_mb', 'upload_allowed_types')`
    )
    const settings = Object.fromEntries(rows.map(r => [r.key, r.value]))
    const maxSizeMb = Number(settings.upload_max_size_mb ?? 5)
    const allowedTypes = (settings.upload_allowed_types ?? 'image/jpeg,image/png,image/webp,image/gif').split(',').map(s => s.trim())

    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({
        error: `Loại file không được phép. Chỉ chấp nhận: ${allowedTypes.join(', ')}`,
        statusCode: 400
      })
    }

    // Buffer the file to check size
    const chunks = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    if (buffer.length > maxSizeMb * 1024 * 1024) {
      return reply.status(400).send({
        error: `File quá lớn. Tối đa ${maxSizeMb}MB`,
        statusCode: 400
      })
    }

    try {
      await deleteFromS3(oldUrl)
      const url = await uploadToS3(buffer, data.mimetype, uploadType)
      return { url }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Upload thất bại: ' + err.message, statusCode: 500 })
    }
  })
}
