import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { normalizeToJpeg, normalizeAvatarToJpeg } from '../src/lib/imageNormalize.js'

const png = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 90, g: 40, b: 200 } } }).png().toBuffer()

test('cover/question images become 1024x560 JPEG under 500KB', async () => {
  const out = await normalizeToJpeg(await png(3000, 1200))
  const meta = await sharp(out.buffer).metadata()
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1024, 560])
  assert.equal(out.mimetype, 'image/jpeg')
  assert.ok(out.buffer.length <= 500 * 1024)
})

test('avatars become 256x256 JPEG', async () => {
  const meta = await sharp((await normalizeAvatarToJpeg(await png(90, 400))).buffer).metadata()
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 256, 256])
})
