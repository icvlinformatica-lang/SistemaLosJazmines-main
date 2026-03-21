import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Fix eventos_eliminados — recreate with correct columns (no "data")
const { error: dropErr } = await supabase.rpc("exec_sql", {
  sql: `
    DROP TABLE IF EXISTS eventos_eliminados;
    CREATE TABLE eventos_eliminados (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      fecha TEXT,
      salon TEXT,
      estado TEXT,
      tipo_evento TEXT,
      nombre_pareja TEXT,
      adultos INT DEFAULT 0,
      adolescentes INT DEFAULT 0,
      ninos INT DEFAULT 0,
      personas_dietas_especiales INT DEFAULT 0,
      motivo TEXT,
      evento_json JSONB,
      eliminado_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
})

if (dropErr) {
  // Try direct SQL via postgres
  const { Pool } = await import("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  await pool.query(`
    DROP TABLE IF EXISTS eventos_eliminados;
    CREATE TABLE IF NOT EXISTS eventos_eliminados (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      fecha TEXT,
      salon TEXT,
      estado TEXT,
      tipo_evento TEXT,
      nombre_pareja TEXT,
      adultos INT DEFAULT 0,
      adolescentes INT DEFAULT 0,
      ninos INT DEFAULT 0,
      personas_dietas_especiales INT DEFAULT 0,
      motivo TEXT,
      evento_json JSONB,
      eliminado_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  await pool.end()
  console.log("eventos_eliminados recreated via pg")
} else {
  console.log("eventos_eliminados recreated via supabase rpc")
}
