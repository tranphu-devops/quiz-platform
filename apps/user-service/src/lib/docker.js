import Docker from 'dockerode'

const docker = new Docker({
  host: process.env.DOCKER_PROXY_HOST || 'docker-socket-proxy',
  port: Number(process.env.DOCKER_PROXY_PORT) || 2375,
  protocol: 'http'
})

// Compose stamps this label on every container it manages. Matching by label
// (not container name) because the container name embeds the Compose project
// name, which is derived from the checkout directory and must never be
// guessed by app code.
const COMPOSE_PROJECT = process.env.COMPOSE_PROJECT_NAME || 'quiz-platform'

export async function findComposeContainer(serviceName) {
  const containers = await docker.listContainers({
    all: true,
    filters: JSON.stringify({
      label: [
        `com.docker.compose.service=${serviceName}`,
        `com.docker.compose.project=${COMPOSE_PROJECT}`
      ]
    })
  })
  return containers[0] ?? null
}

export async function inspectContainer(id) {
  return docker.getContainer(id).inspect()
}

// Docker multiplexes stdout/stderr into a single stream when TTY is disabled
// (the default for Compose-managed containers): each frame is an 8-byte
// header (byte 0 = stream type: 1=stdout, 2=stderr; bytes 4-7 = payload
// length, big-endian) followed by that many payload bytes.
function demuxDockerLogBuffer(buf) {
  const lines = []
  let offset = 0
  while (offset + 8 <= buf.length) {
    const streamType = buf.readUInt8(offset)
    const size = buf.readUInt32BE(offset + 4)
    const payload = buf.subarray(offset + 8, offset + 8 + size)
    offset += 8 + size
    const stream = streamType === 2 ? 'stderr' : 'stdout'
    for (const line of payload.toString('utf8').split('\n')) {
      if (line.length > 0) lines.push({ stream, line })
    }
  }
  return lines
}

export async function getContainerLogs(id, tail = 200) {
  const container = docker.getContainer(id)
  const buffer = await container.logs({ stdout: true, stderr: true, tail })
  return demuxDockerLogBuffer(buffer)
}
