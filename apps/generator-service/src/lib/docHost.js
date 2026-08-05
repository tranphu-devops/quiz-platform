import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

// Temporary document hosting, used by exactly one caller: the `firecrawl` PDF
// engine. Firecrawl's API only accepts a URL — there is no file-upload or
// base64 path — so the teacher's PDF has to be fetchable for the duration of
// one scrape.
//
// Deliberately NOT reusing user-service's lib/s3.js: that helper hardcodes
// `ACL: 'public-read'` for the image pipeline, which would leave a teacher's
// source document world-readable. Here the object is private and the URL is
// presigned with a short TTL, so only the holder of that one signed URL can
// read it, and only until it expires.
const SIGNED_URL_TTL_SECONDS = 300

// Separate prefix from the image pipeline so these are trivially identifiable
// (and sweepable) if a delete is ever missed. Still under `uploads/` to match
// the repo-wide key convention.
const KEY_PREFIX = 'uploads/generator-tmp'

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

export function isDocHostConfigured() {
  return Boolean(process.env.AWS_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
}

// Uploads the PDF privately and returns a short-lived signed GET URL plus the
// key, so the caller can delete the object as soon as the scrape returns.
export async function putTempDoc(buffer) {
  const bucket = process.env.AWS_BUCKET
  if (!bucket) throw new Error('AWS_BUCKET not configured')

  const key = `${KEY_PREFIX}/${Date.now()}-${randomUUID()}.pdf`
  const client = createS3Client()

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf'
    // No ACL — the object stays private; access is via the signed URL only.
  }))

  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: SIGNED_URL_TTL_SECONDS
  })

  return { url, key }
}

export async function deleteTempDoc(key) {
  const bucket = process.env.AWS_BUCKET
  if (!bucket || !key) return
  try {
    const client = createS3Client()
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch {
    // Best-effort: a failed cleanup must not fail an otherwise-successful
    // generation. The object is private and its signed URL expires in
    // SIGNED_URL_TTL_SECONDS regardless.
  }
}
