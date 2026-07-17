import postgres from "postgres"

const sql = postgres(process.env.POSTGRES_URL, { ssl: "require" })

async function main() {
  // Paquetes de salones — objeto complejo anidado, se guarda como JSONB
  await sql`
    CREATE TABLE IF NOT EXISTS paquetes_salones (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  // Temporadas de precios — objeto complejo anidado, se guarda como JSONB
  await sql`
    CREATE TABLE IF NOT EXISTS temporadas (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  // RLS: mismas políticas abiertas que el resto de las tablas del sistema
  // (la app usa la anon key; el acceso está protegido por el login con PIN)
  await sql`ALTER TABLE paquetes_salones ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE temporadas ENABLE ROW LEVEL SECURITY`
  await sql`DROP POLICY IF EXISTS "allow_all_paquetes" ON paquetes_salones`
  await sql`CREATE POLICY "allow_all_paquetes" ON paquetes_salones FOR ALL USING (true) WITH CHECK (true)`
  await sql`DROP POLICY IF EXISTS "allow_all_temporadas" ON temporadas`
  await sql`CREATE POLICY "allow_all_temporadas" ON temporadas FOR ALL USING (true) WITH CHECK (true)`

  console.log("Tablas paquetes_salones y temporadas creadas correctamente")
  await sql.end()
}

main().catch((e) => {
  console.error("Error:", e.message)
  process.exit(1)
})
