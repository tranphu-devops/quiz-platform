import cron from 'node-cron'
import { pool } from './db.js'
import { runAutoGrade } from './grade.js'

// One run at a time: a slow run (exam-service down, big backlog) must not
// overlap the next tick and grade the same rows twice over.
let running = false
async function tick() {
  if (running) return
  running = true
  try {
    const count = await runAutoGrade(pool)
    if (count > 0) console.log(`[grader] Graded ${count} timed-out submission(s)`)
  } catch (err) {
    console.error('[grader] Run failed:', err.message)
  } finally {
    running = false
  }
}

// Every minute — an expired attempt should show its result promptly, and the
// query is a cheap indexed-status scan capped at 200 rows per run.
cron.schedule('* * * * *', tick)

console.log('[grader] Scheduled — runs every minute')

// Also run once on startup to catch any submissions that expired while the service was down
tick()
