import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

function createS3Client() {
  const config = {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
  if (process.env.AWS_ENDPOINT) {
    config.endpoint = process.env.AWS_ENDPOINT
    config.forcePathStyle = true
  }
  return new S3Client(config)
}

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

export async function deleteFromS3(oldUrl) {
  if (!oldUrl) return
  const bucket = process.env.AWS_BUCKET
  if (!bucket) return
  // Key always starts with "uploads/" — extract it from anywhere in the URL
  const idx = oldUrl.indexOf('uploads/')
  if (idx === -1) return
  const key = oldUrl.slice(idx)
  try {
    const client = createS3Client()
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch {}
}

export async function uploadToS3(fileBuffer, mimeType, uploadType) {
  const bucket = process.env.AWS_BUCKET
  if (!bucket) throw new Error('AWS_BUCKET not configured')

  const ext = MIME_TO_EXT[mimeType] ?? 'bin'
  const key = `uploads/${uploadType}/${Date.now()}-${randomUUID()}.${ext}`

  const client = createS3Client()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    ACL: 'public-read'
  }))

  const publicBase = process.env.AWS_PUBLIC_URL
    || (process.env.AWS_ENDPOINT
      ? `${process.env.AWS_ENDPOINT}/${bucket}`
      : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`)

  return `${publicBase}/${key}`
}
