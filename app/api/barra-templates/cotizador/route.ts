export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { puedeEditarCocteles, ERROR_SIN_PERMISO_COCTELES } from "@/lib/cocteles-permisos"
import { salonesDelCotizador } from "@/lib/barras-armadas"

// En qué salones del cotizador aparece cada barra armada, para el
// interruptor "Cotizaciones" de Cócteles (lib/barras-armadas.ts). Solo
// Administración y Soporte, como el resto de la configuración del cotizador.
export async function GET(req: Request) {
  if (!puedeEditarCocteles(await perfilDesdeRequest(req))) {
    return NextResponse.json({ ok: false, error: ERROR_SIN_PERMISO_COCTELES }, { status: 403 })
  }
  try {
    const [salones, filas] = (await Promise.all([
      sql`SELECT salon, costo_salon FROM cotizador_salon`,
      sql`SELECT salon, barra_template_id FROM cotizador_salon_barra`,
    ])) as unknown as [Array<{ salon: string; costo_salon: unknown }>, Array<{ salon: string; barra_template_id: string }>]
    return NextResponse.json({
      ok: true,
      salones: salonesDelCotizador(salones.map((s) => ({ salon: s.salon, costoSalon: Number(s.costo_salon) || 0 }))),
      filas: filas.map((f) => ({ salon: f.salon, barraTemplateId: f.barra_template_id })),
    })
  } catch (err) {
    console.error("[API] Error en barra-templates/cotizador GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
