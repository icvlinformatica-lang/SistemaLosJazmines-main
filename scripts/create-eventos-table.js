import postgres from 'postgres'

const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' })

async function main() {
  console.log('[v0] Creating eventos and eventos_eliminados tables...')

  await sql`
    CREATE TABLE IF NOT EXISTS eventos (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      nombre TEXT,
      fecha TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS eventos_eliminados (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      estado TEXT,
      nombre TEXT,
      fecha TEXT,
      eliminado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      motivo TEXT
    )
  `

  // Index for faster queries
  await sql`CREATE INDEX IF NOT EXISTS eventos_fecha_idx ON eventos (fecha)`
  await sql`CREATE INDEX IF NOT EXISTS eventos_estado_idx ON eventos (estado)`
  await sql`CREATE INDEX IF NOT EXISTS eventos_eliminados_at_idx ON eventos_eliminados (eliminado_at DESC)`

  console.log('[v0] Tables created successfully')
  await sql.end()
}

main().catch(console.error)
