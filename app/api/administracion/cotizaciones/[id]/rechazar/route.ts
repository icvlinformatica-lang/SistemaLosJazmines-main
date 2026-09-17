export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * "Rechazar / pedir ajuste" (Etapa 5): pasa la cotización a "rechazada" con
 * un comentario para el vendedor. Solo funciona sobre una que esté
 * "lista_para_revisar" — evita rechazar algo ya aprobado/convertido.
 * El vendedor la ve y la puede corregir/reenviar desde /vendedor/paquetes.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const comentario = typeof body.comentario === "string" ? body.comentario.trim() : ""

    if (!comentario) {
      return NextResponse.json({ ok: false, error: "Falta el comentario para el vendedor" }, { status: 400 })
    }

    const filas = (await sql`
      UPDATE cotizaciones SET estado = 'rechazada', comentario_admin = ${comentario}, updated_at = now()
      WHERE id = ${id} AND estado = 'lista_para_revisar'
      RETURNING id, estado
    `) as unknown as Array<{ id: string; estado: string }>

    if (!filas.length) {
      return NextResponse.json({ ok: false, error: "Esta cotización ya no está en revisión" }, { status: 409 })
    }
    return NextResponse.json({ ok: true, id: filas[0].id, estado: filas[0].estado })
  } catch (err) {
    console.error("[API] Error en administracion/cotizaciones/[id]/rechazar:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
