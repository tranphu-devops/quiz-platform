import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const schema = new URL(process.env.DATABASE_URL).searchParams.get('search_path')
if (schema) {
  pool.on('connect', client => client.query(`SET search_path TO "${schema}"`))
}
