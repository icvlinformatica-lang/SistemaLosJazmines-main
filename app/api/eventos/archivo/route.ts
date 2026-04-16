export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value as T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: Record<string, any>) {
  return {
    id: r.id,
    nombre: r.nombre,
    fecha: r.fecha,
    horario: r.horario,
    horarioFin: r.horario_fin,
    salon: r.salon,
    tipoEvento: r.tipo_evento,
    nombrePareja: r.nombre_pareja,
    adultos: r.adultos ?? 0,
    adolescentes: r.adolescentes ?? 0,
    ninos: r.ninos ?? 0,
    personasDietasEspeciales: r.personas_dietas_especiales ?? 0,
    estado: r.estado ?? "finalizado",
    precioVenta: r.precio_venta != null ? Number(r.precio_venta) : undefined,
    recetasAdultos: parseJsonField(r.recetas_adultos, []),
    recetasAdolescentes: parseJsonField(r.recetas_adolescentes, []),
    recetasNinos: parseJsonField(r.recetas_ninos, []),
    recetasDietasEspeciales: parseJsonField(r.recetas_dietas_especiales, []),
    pagos: parseJsonField(r.pagos, []),
    notasInternas: r.notas_internas,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// GET — eventos finalizados (archivo)
export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id, nombre, fecha, horario, horario_fin, salon, tipo_evento, nombre_pareja,
        adultos, adolescentes, ninos, personas_dietas_especiales,
        recetas_adultos, recetas_adolescentes, recetas_ninos, recetas_dietas_especiales,
        estado, precio_venta, pagos, notas_internas, created_at, updated_at
      FROM eventos
      WHERE estado = 'finalizado' AND deleted_at IS NULL
      ORDER BY fecha DESC NULLS LAST, updated_at DESC
    `
    return NextResponse.json(rows.map(fromRow))
  } catch (err) {
    console.error("[API] Error fetching archivo:", err)
    return NextResponse.json([], { status: 200 })
  }
}
