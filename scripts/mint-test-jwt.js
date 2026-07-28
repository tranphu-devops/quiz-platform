#!/usr/bin/env node
// DEV/TEST ONLY — mints a JWT signed with JWT_SECRET, bypassing GoTrue and the
// real login flow entirely (no magic link, no OAuth). Lets an automated agent
// or a developer test the UI/API as a real seeded user without going through
// email delivery. Never point this at a production JWT_SECRET or database.
//
// Requires the local docker compose stack running (`docker compose up`) —
// looks up the user via `docker compose exec postgres psql`, same approach
// as scripts/clear-db.sh, so no npm dependency (pg/jsonwebtoken) is needed.
//
// Run: node --env-file=.env scripts/mint-test-jwt.js [--email hs.minh@quiz.test]
import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function signJwt(payload, secret) {
  const encHeader = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const encPayload = b64url(JSON.stringify(payload))
  const signature = createHmac('sha256', secret)
    .update(`${encHeader}.${encPayload}`)
    .digest('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${encHeader}.${encPayload}.${signature}`
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]])
    return acc
  }, [])
)
const email = args.email ?? 'hs.minh@quiz.test'

const secret = process.env.JWT_SECRET
if (!secret) {
  console.error('JWT_SECRET is not set. Run with: node --env-file=.env scripts/mint-test-jwt.js')
  process.exit(1)
}

console.warn('⚠️  DEV-ONLY TOOL — mints a token using whatever JWT_SECRET this process loaded.')
console.warn('⚠️  Never run this against a production JWT_SECRET / database.\n')

const escapedEmail = email.replace(/'/g, "''")
let row
try {
  row = execFileSync('docker', [
    'compose', 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'quizdb', '-tAc',
    `SELECT u.id || '|' || COALESCE(u.raw_user_meta_data->>'role', 'student') FROM auth.users u WHERE u.email = '${escapedEmail}'`
  ], { encoding: 'utf8' }).trim()
} catch {
  console.error('Failed to query Postgres via `docker compose exec` — is the local stack running (`docker compose up`)?')
  process.exit(1)
}

if (!row) {
  console.error(`No user found for "${email}" — check infra/postgres/seed.sql for available seeded accounts.`)
  process.exit(1)
}

const [id, role] = row.split('|')
const now = Math.floor(Date.now() / 1000)
const payload = { sub: id, email, user_metadata: { role }, role: 'authenticated', iat: now, exp: now + 3600 }
const access_token = signJwt(payload, secret)

const session = {
  access_token,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: now + 3600,
  refresh_token: 'dev-mint-no-refresh',
  user: { id, email, role: 'authenticated', user_metadata: { role } }
}

console.log('── Bearer token (curl / API testing) ───────────────────────────────')
console.log(access_token)
console.log('\n── Full session object (matches GoTrueClient persistSession shape) ──')
console.log(JSON.stringify(session, null, 2))
console.log('\n── Browser console one-liner — paste on the app tab to log in as this user ──')
console.log(`localStorage.setItem('quiz_session', ${JSON.stringify(JSON.stringify(session))}); location.reload()`)
