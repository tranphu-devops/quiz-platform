import sharp from 'sharp'

const MAX_BYTES = 500 * 1024
const QUALITY_STEPS = [85, 75, 65, 55, 45, 35, 25]

async function resizeToJpeg(buffer, width, height) {
  const pipeline = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'attention' })

  let output
  for (const quality of QUALITY_STEPS) {
    output = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer()
    if (output.length <= MAX_BYTES) break
  }

  return { buffer: output, mimetype: 'image/jpeg' }
}

// Resizes/crops to a fixed 1024x560 JPEG, stepping quality down until under 500KB.
export async function normalizeToJpeg(buffer) {
  return resizeToJpeg(buffer, 1024, 560)
}

// Resizes/crops to a fixed 256x256 JPEG avatar, stepping quality down until under 500KB.
export async function normalizeAvatarToJpeg(buffer) {
  return resizeToJpeg(buffer, 256, 256)
}
