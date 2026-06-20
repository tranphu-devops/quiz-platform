import cron from 'node-cron'
import { pool } from './db.js'
import { runAutoGrade } from './grade.js'

async function tick() {
  console.log('[grader] Auto-grade run started')
  try {
    const count = await runAutoGrade(pool)
    if (count > 0) console.log(`[grader] Graded ${count} timed-out submission(s)`)
    else console.log('[grader] Nothing to grade')
  } catch (err) {
    console.error('[grader] Run failed:', err.message)
  }
}

// Every 15 minutes
cron.schedule('*/15 * * * *', tick)

console.log('[grader] Scheduled — runs every 15 minutes')

// Also run once on startup to catch any submissions that expired while the service was down
tick()
