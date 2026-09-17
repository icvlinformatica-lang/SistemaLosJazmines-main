export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Envía a revisión una cotización ya generada (botón directo en la tarjeta
 * de /vendedor/paquetes → "Mis cotizaciones generadas"). No recibe body:
 * solo cambia el estado, los datos ya quedaron guardados por
 * /api/vendedor/cotizaciones. Funciona desde "borrador" o "rechazada"
 * (Administración pidió un ajuste, el vendedor lo corrigió y la reenvía) —
 * nunca desde otro estado, para no reenviar algo que ya está en revisión o
 * ya fue procesado. Al reenviar se limpia comentario_admin: era sobre la
 * versión anterior, no sobre esta.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const filas = (await sql`
      UPDATE cotizaciones SET estado = 'lista_para_revisar', comentario_admin = NULL, updated_at = now()
      WHERE id = ${id} AND estado IN ('borrador', 'rechazada')
      RETURNING id, estado
    `) as unknown as Array<{ id: string; estado: string }>

    if (!filas.length) {
      return NextResponse.json(
        { ok: false, error: "Esta cotización no se puede enviar en su estado actual" },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true, id: filas[0].id, estado: filas[0].estado })
  } catch (err) {
    console.error("[API] Error en vendedor/cotizaciones/[id]/enviar:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
