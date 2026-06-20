import pg from 'pg'
const { Pool } = pg

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

pool.on('connect', client => {
  const url = new URL(process.env.DATABASE_URL)
  const searchPath = url.searchParams.get('search_path')
  if (searchPath) client.query(`SET search_path TO ${searchPath}`)
})
