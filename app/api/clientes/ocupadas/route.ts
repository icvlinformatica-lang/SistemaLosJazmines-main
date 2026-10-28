export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { leerConfigTodosLosSalones } from "@/lib/cotizador-salon-servidor"
import { hoyArgentina, precioConGanancia } from "@/lib/cotizador-salon"
import { ocupadasPorSalon, rangoCalendario, salonListoParaClientes } from "@/lib/clientes-simulador"
import { puedeVerVistaClientes } from "@/lib/vista-clientes"

/**
 * GET /api/clientes/ocupadas — fechas ocupadas de los salones listos, desde
 * hoy hasta MESES_CALENDARIO meses, para tacharlas en el calendario del
 * simulador (decisión del 18/10/2026: se muestran antes de dejar los datos).
 *
 * Devuelve SOLO fechas, por salón: nada del evento (ni nombre, ni tipo, ni
 * estado, ni ids). Misma regla que el índice eventos_un_evento_por_dia_y_salon
 * y que /api/vendedor/salones-ocupados: cuenta todo evento que no esté en la
 * papelera, sea cual sea su estado.
 */
export async function GET(req: Request) {
  if (!puedeVerVistaClientes(await perfilDesdeRequest(req))) {
    return NextResponse.json({ ok: false, error: "Sin permiso" }, { status: 403 })
  }
  try {
    const { desde, hasta } = rangoCalendario(hoyArgentina())
    // Los mismos salones que muestra el catálogo (precio de salón y capacidad).
    const listos = (await leerConfigTodosLosSalones())
      .filter((c) =>
        salonListoParaClientes({
          precioSalon: precioConGanancia(c.costoSalon, c.gananciaSalon),
          capacidadMaxima: c.capacidadMaxima,
        }),
      )
      .map((c) => c.salon)
    if (!listos.length) return NextResponse.json({ ok: true, desde, hasta, ocupadas: {} })

    // eventos.fecha es texto "YYYY-MM-DD": compararlo como texto ordena bien.
    const filas = (await sql`
      SELECT DISTINCT salon, fecha FROM eventos
      WHERE deleted_at IS NULL AND fecha >= ${desde} AND fecha <= ${hasta}
    `) as unknown as Array<{ salon: string | null; fecha: string | null }>

    return NextResponse.json(
      { ok: true, desde, hasta, ocupadas: ocupadasPorSalon(filas, listos) },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    console.error("[API] Error en clientes/ocupadas:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
