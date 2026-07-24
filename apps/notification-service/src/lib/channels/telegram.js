export async function sendTelegram({ chatId, text }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')
  if (!chatId) throw new Error('missing Telegram chat id')

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Telegram ${res.status}: ${errText.slice(0, 300)}`)
  }
}
