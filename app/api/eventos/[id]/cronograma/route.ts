export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { normalizarCronograma, PERFILES_EDITAN_CRONOGRAMA } from "@/lib/staff-evento"

/**
 * Guarda el cronograma de la noche de un evento (scripts/022).
 *
 * Es una ruta aparte, y no un campo más del PATCH del evento, por dos razones:
 * - Coordinación puede cargar el cronograma y nada más del evento. El chequeo
 *   del perfil está acá, en el servidor (lib/staff-evento.ts,
 *   PERFILES_EDITAN_CRONOGRAMA).
 * - Guardar el evento entero desde el planificador no pisa el cronograma que
 *   Coordinación cargó mientras tanto.
 *
 * Reemplaza el cronograma entero (es idempotente: reintentar da lo mismo). Lo
 * que llega se valida con normalizarCronograma: horas válidas, texto, oficios
 * conocidos y un máximo de líneas.
 *
 * body: { cronograma: MomentoCronograma[] }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await perfilDesdeRequest(req)
  if (!perfil || !PERFILES_EDITAN_CRONOGRAMA.includes(perfil)) {
    return NextResponse.json({ error: "Solo Administración y Coordinación pueden cambiar el cronograma" }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    if (!Array.isArray(body.cronograma)) {
      return NextResponse.json({ error: "Falta el cronograma" }, { status: 400 })
    }
    const filas = (await sql`
      SELECT nombre, horario FROM eventos WHERE id = ${id} AND deleted_at IS NULL
    `) as unknown as Array<{ nombre: string | null; horario: string | null }>
    const evento = filas[0]
    if (!evento) return NextResponse.json({ error: "No se encontró el evento" }, { status: 404 })

    const cronograma = normalizarCronograma(body.cronograma, evento.horario)
    await sql`
      UPDATE eventos SET cronograma = ${cronograma.length ? sql.json(cronograma as unknown as Parameters<typeof sql.json>[0]) : null},
        updated_at = NOW()
      WHERE id = ${id} AND deleted_at IS NULL
    `
    await logActivity("evento", "modificado", evento.nombre || "Sin nombre", `Cronograma: ${cronograma.length} momentos`)
    return NextResponse.json({ ok: true, cronograma })
  } catch (err) {
    console.error("[API] Error guardando cronograma:", err)
    return NextResponse.json({ error: "No se pudo guardar el cronograma. Volvé a intentar." }, { status: 500 })
  }
}
