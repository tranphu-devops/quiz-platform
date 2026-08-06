import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
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

// Key always starts with "uploads/" — extract it from anywhere in the URL
export function keyFromUrl(url) {
  if (!url) return null
  const idx = url.indexOf('uploads/')
  if (idx === -1) return null
  return url.slice(idx)
}

export function publicUrlForKey(key) {
  const bucket = process.env.AWS_BUCKET
  const publicBase = process.env.AWS_PUBLIC_URL
    || (process.env.AWS_ENDPOINT
      ? `${process.env.AWS_ENDPOINT}/${bucket}`
      : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`)
  return `${publicBase}/${key}`
}

export async function deleteFromS3(oldUrl) {
  const key = keyFromUrl(oldUrl)
  if (!key) return
  const bucket = process.env.AWS_BUCKET
  if (!bucket) return
  try {
    const client = createS3Client()
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch {}
}

// Lists every object under uploads/ (paginated), across the whole bucket.
export async function listUploadedObjects() {
  const bucket = process.env.AWS_BUCKET
  if (!bucket) throw new Error('AWS_BUCKET not configured')

  const client = createS3Client()
  const objects = []
  let ContinuationToken
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'uploads/',
      ContinuationToken
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key.endsWith('/')) continue // skip folder markers
      objects.push({ key: obj.Key, size: obj.Size, lastModified: obj.LastModified })
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (ContinuationToken)

  return objects
}

// Batch-deletes S3 objects by key (max 1000 per API call, per S3 limits).
export async function deleteS3ObjectsByKeys(keys) {
  const bucket = process.env.AWS_BUCKET
  if (!bucket || keys.length === 0) return { deleted: [], errors: [] }

  const client = createS3Client()
  const deleted = []
  const errors = []
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000)
    const res = await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: chunk.map(Key => ({ Key })), Quiet: false }
    }))
    for (const d of res.Deleted ?? []) deleted.push(d.Key)
    for (const e of res.Errors ?? []) errors.push({ key: e.Key, message: e.Message })
  }
  return { deleted, errors }
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

  return publicUrlForKey(key)
}
