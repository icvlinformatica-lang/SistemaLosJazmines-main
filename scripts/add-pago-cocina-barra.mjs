import postgres from "postgres"

const connectionString = process.env.POSTGRES_URL
if (!connectionString) {
  console.error("POSTGRES_URL no está definida")
  process.exit(1)
}

const sql = postgres(connectionString, { ssl: "require", max: 1 })

try {
  await sql`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS cocina_pagada BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS barra_pagada BOOLEAN NOT NULL DEFAULT FALSE`
  console.log("OK: columnas cocina_pagada y barra_pagada agregadas")
} catch (err) {
  console.error("Error en migración:", err)
  process.exit(1)
} finally {
  await sql.end()
}
