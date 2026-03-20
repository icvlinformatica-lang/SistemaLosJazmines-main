const postgres = require('postgres')

const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' })

async function run() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo TEXT NOT NULL,
        accion TEXT NOT NULL,
        nombre TEXT NOT NULL,
        detalle TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC)
    `
    console.log('[v0] activity_log table ready')
  } catch (err) {
    console.error('[v0] Error:', err.message)
  } finally {
    await sql.end()
  }
}

run()
