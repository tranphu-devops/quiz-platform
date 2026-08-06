import sharp from 'sharp'

const TARGET_WIDTH = 1024
const TARGET_HEIGHT = 560
const MAX_BYTES = 500 * 1024
const QUALITY_STEPS = [85, 75, 65, 55, 45, 35, 25]

// Resizes/crops to a fixed 1024x560 JPEG, stepping quality down until under 500KB.
export async function normalizeToJpeg(buffer) {
  const pipeline = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'cover', position: 'attention' })

  let output
  for (const quality of QUALITY_STEPS) {
    output = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer()
    if (output.length <= MAX_BYTES) break
  }

  return { buffer: output, mimetype: 'image/jpeg' }
}
