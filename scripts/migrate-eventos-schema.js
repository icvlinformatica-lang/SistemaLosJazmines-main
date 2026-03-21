// Migration: replace blob-based eventos table with proper column schema
import postgres from 'postgres'

const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' })

async function migrate() {
  console.log('[migrate] Starting eventos schema migration...')

  // 1. Save existing data from blob table if it exists
  let existingData = []
  try {
    const rows = await sql`SELECT data FROM eventos`
    existingData = rows.map(r => r.data).filter(Boolean)
    console.log(`[migrate] Found ${existingData.length} existing events to preserve`)
  } catch {
    console.log('[migrate] No existing eventos data to preserve (or table does not exist)')
  }

  // 2. Drop old table and recreate with proper schema
  await sql`DROP TABLE IF EXISTS eventos CASCADE`

  await sql`
    CREATE TABLE eventos (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      fecha TEXT,
      horario TEXT,
      horario_fin TEXT,
      salon TEXT,
      tipo_evento TEXT,
      nombre_pareja TEXT,
      dni_novio1 TEXT,
      dni_novio2 TEXT,
      adultos INTEGER NOT NULL DEFAULT 0,
      adolescentes INTEGER NOT NULL DEFAULT 0,
      ninos INTEGER NOT NULL DEFAULT 0,
      personas_dietas_especiales INTEGER NOT NULL DEFAULT 0,
      recetas_adultos TEXT[] DEFAULT '{}',
      recetas_adolescentes TEXT[] DEFAULT '{}',
      recetas_ninos TEXT[] DEFAULT '{}',
      recetas_dietas_especiales TEXT[] DEFAULT '{}',
      multipliers_adultos JSONB DEFAULT '{}',
      multipliers_adolescentes JSONB DEFAULT '{}',
      multipliers_ninos JSONB DEFAULT '{}',
      multipliers_dietas_especiales JSONB DEFAULT '{}',
      descripcion_personalizada TEXT DEFAULT '',
      barras JSONB DEFAULT '[]',
      servicios JSONB DEFAULT '[]',
      paquetes_seleccionados TEXT[] DEFAULT '{}',
      condicion_iva TEXT,
      contrato JSONB,
      plan_de_cuotas JSONB,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      color_tag TEXT,
      precio_venta NUMERIC,
      costo_personal NUMERIC,
      costo_insumos NUMERIC,
      costo_servicios NUMERIC,
      costo_operativo NUMERIC,
      notas_internas TEXT,
      pagos JSONB DEFAULT '[]',
      asignaciones JSONB DEFAULT '[]',
      costos_calculados JSONB,
      stock_descontado BOOLEAN DEFAULT false,
      fecha_impresion TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha)`
  await sql`CREATE INDEX IF NOT EXISTS idx_eventos_estado ON eventos(estado)`
  await sql`CREATE INDEX IF NOT EXISTS idx_eventos_deleted_at ON eventos(deleted_at)`

  console.log('[migrate] Table recreated with proper schema')

  // 3. Recreate eventos_eliminados if needed
  await sql`DROP TABLE IF EXISTS eventos_eliminados CASCADE`
  await sql`
    CREATE TABLE eventos_eliminados (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      fecha TEXT,
      estado TEXT,
      motivo TEXT,
      data JSONB,
      eliminado_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('[migrate] eventos_eliminados recreated')

  // 4. Re-insert preserved data
  if (existingData.length > 0) {
    for (const ev of existingData) {
      try {
        await sql`
          INSERT INTO eventos (
            id, nombre, fecha, horario, horario_fin, salon, tipo_evento, nombre_pareja,
            dni_novio1, dni_novio2, adultos, adolescentes, ninos, personas_dietas_especiales,
            recetas_adultos, recetas_adolescentes, recetas_ninos, recetas_dietas_especiales,
            multipliers_adultos, multipliers_adolescentes, multipliers_ninos, multipliers_dietas_especiales,
            descripcion_personalizada, barras, servicios, paquetes_seleccionados,
            condicion_iva, contrato, plan_de_cuotas, estado, color_tag,
            precio_venta, costo_personal, costo_insumos, costo_servicios, costo_operativo,
            notas_internas, pagos, asignaciones, costos_calculados,
            stock_descontado, fecha_impresion
          ) VALUES (
            ${ev.id}, ${ev.nombrePareja || ev.nombre || 'Sin nombre'}, ${ev.fecha || null},
            ${ev.horario || null}, ${ev.horarioFin || null}, ${ev.salon || null},
            ${ev.tipoEvento || null}, ${ev.nombrePareja || null},
            ${ev.dniNovio1 || null}, ${ev.dniNovio2 || null},
            ${ev.adultos || 0}, ${ev.adolescentes || 0}, ${ev.ninos || 0}, ${ev.personasDietasEspeciales || 0},
            ${ev.recetasAdultos || []}, ${ev.recetasAdolescentes || []},
            ${ev.recetasNinos || []}, ${ev.recetasDietasEspeciales || []},
            ${JSON.stringify(ev.multipliersAdultos || {})}, ${JSON.stringify(ev.multipliersAdolescentes || {})},
            ${JSON.stringify(ev.multipliersNinos || {})}, ${JSON.stringify(ev.multipliersDietasEspeciales || {})},
            ${ev.descripcionPersonalizada || ''}, ${JSON.stringify(ev.barras || [])},
            ${JSON.stringify(ev.servicios || [])}, ${ev.paquetesSeleccionados || []},
            ${ev.condicionIva || null}, ${JSON.stringify(ev.contrato || null)},
            ${JSON.stringify(ev.planDeCuotas || null)}, ${ev.estado || 'pendiente'},
            ${ev.colorTag || null}, ${ev.precioVenta || null},
            ${ev.costoPersonal || null}, ${ev.costoInsumos || null},
            ${ev.costoServicios || null}, ${ev.costoOperativo || null},
            ${ev.notasInternas || null}, ${JSON.stringify(ev.pagos || [])},
            ${JSON.stringify(ev.asignaciones || [])}, ${JSON.stringify(ev.costosCalculados || null)},
            ${ev.stockDescontado || false}, ${ev.fechaImpresion || null}
          )
          ON CONFLICT (id) DO NOTHING
        `
      } catch (err) {
        console.error(`[migrate] Failed to re-insert event ${ev.id}:`, err.message)
      }
    }
    console.log(`[migrate] Re-inserted ${existingData.length} events`)
  }

  console.log('[migrate] Done!')
  await sql.end()
}

migrate().catch((err) => { console.error('[migrate] Fatal:', err); process.exit(1) })
