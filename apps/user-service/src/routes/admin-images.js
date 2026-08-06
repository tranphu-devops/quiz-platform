import sharp from 'sharp'
import { verifyAuth } from '../middleware/auth.js'
import { uploadToS3, deleteFromS3 } from '../lib/s3.js'
import { normalizeToJpeg } from '../lib/imageNormalize.js'

const TARGET_WIDTH = 1024
const TARGET_HEIGHT = 560

export default async function adminImageRoutes(fastify) {
  // Backfill: re-normalize exam cover images uploaded before the fixed 1024x560
  // JPEG pipeline (PR #57) existed, so old data displays consistently too.
  fastify.post('/admin/normalize-cover-images', { config: { rateLimit: { max: 2, timeWindow: '5 minutes' } } }, async (req, reply) => {
    await verifyAuth(req, reply)
    if (reply.sent) return
    if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', statusCode: 403 })

    const examServiceUrl = process.env.EXAM_SERVICE_URL
    if (!examServiceUrl) {
      return reply.status(500).send({ error: 'EXAM_SERVICE_URL not configured', statusCode: 500 })
    }

    let exams
    try {
      const listRes = await fetch(`${examServiceUrl}/exams/internal/covers`, {
        headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }
      })
      if (!listRes.ok) throw new Error(`exam-service trả về ${listRes.status}`)
      ;({ exams } = await listRes.json())
    } catch (err) {
      fastify.log.error(err)
      return reply.status(502).send({ error: 'Không lấy được danh sách exam từ exam-service', statusCode: 502 })
    }

    const result = { total: exams.length, normalized: 0, skipped: 0, failed: [] }

    for (const exam of exams) {
      try {
        const imgRes = await fetch(exam.cover_image_url)
        if (!imgRes.ok) throw new Error(`Tải ảnh thất bại (${imgRes.status})`)
        const buffer = Buffer.from(await imgRes.arrayBuffer())

        const meta = await sharp(buffer).metadata()
        if (meta.width === TARGET_WIDTH && meta.height === TARGET_HEIGHT && meta.format === 'jpeg') {
          result.skipped++
          continue
        }

        const normalized = await normalizeToJpeg(buffer)
        const newUrl = await uploadToS3(normalized.buffer, normalized.mimetype, 'exam-cover')

        const patchRes = await fetch(`${examServiceUrl}/exams/internal/${exam.id}/cover-image`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY },
          body: JSON.stringify({ cover_image_url: newUrl })
        })
        if (!patchRes.ok) {
          await deleteFromS3(newUrl)
          throw new Error(`Cập nhật exam-service thất bại (${patchRes.status})`)
        }

        await deleteFromS3(exam.cover_image_url)
        result.normalized++
      } catch (err) {
        fastify.log.error(err)
        result.failed.push({ id: exam.id, title: exam.title, error: err.message })
      }
    }

    return result
  })
}
