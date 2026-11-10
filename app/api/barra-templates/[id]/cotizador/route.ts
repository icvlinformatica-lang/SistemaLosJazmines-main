export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { puedeEditarCocteles, ERROR_SIN_PERMISO_COCTELES } from "@/lib/cocteles-permisos"
import { salonesDelCotizador } from "@/lib/barras-armadas"

// Interruptor "Cotizaciones" de Cócteles (pedido de Rodrigo, 10/11/2026).
// Qué barras ve el vendedor se guarda POR SALÓN (cotizador_salon_barra,
// scripts/015). Prender la agrega a todos los salones que se cotizan (con
// costo de salón); apagar la saca de todos. Es idempotente: repetirlo deja
// lo mismo. En Configuración se sigue pudiendo elegir salón por salón.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!puedeEditarCocteles(await perfilDesdeRequest(req))) {
    return NextResponse.json({ ok: false, error: ERROR_SIN_PERMISO_COCTELES }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    if (typeof body?.enCotizador !== "boolean") {
      return NextResponse.json({ ok: false, error: "Falta enCotizador" }, { status: 400 })
    }
    const resultado = await sql.begin(async (trx) => {
      const [barra] = await trx`SELECT id FROM barra_templates WHERE id = ${id} FOR UPDATE`
      if (!barra) return null
      if (body.enCotizador) {
        const filas = (await trx`SELECT salon, costo_salon FROM cotizador_salon`) as unknown as Array<{
          salon: string
          costo_salon: unknown
        }>
        const salones = salonesDelCotizador(filas.map((f) => ({ salon: f.salon, costoSalon: Number(f.costo_salon) || 0 })))
        for (const salon of salones) {
          await trx`
            INSERT INTO cotizador_salon_barra (salon, barra_template_id) VALUES (${salon}, ${id})
            ON CONFLICT (salon, barra_template_id) DO NOTHING
          `
        }
      } else {
        await trx`DELETE FROM cotizador_salon_barra WHERE barra_template_id = ${id}`
      }
      const quedan = (await trx`SELECT salon FROM cotizador_salon_barra WHERE barra_template_id = ${id}`) as unknown as Array<{
        salon: string
      }>
      return quedan.map((q) => q.salon)
    })
    if (resultado === null) return NextResponse.json({ ok: false, error: "No existe esa barra" }, { status: 404 })
    return NextResponse.json({ ok: true, salones: resultado })
  } catch (err) {
    console.error("[API] Error en barra-templates/[id]/cotizador PUT:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
