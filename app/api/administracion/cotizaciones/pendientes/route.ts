export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Solo el conteo de cotizaciones "lista_para_revisar" — lo usa el puntito
 * rojo del sidebar (ver components/sidebar.tsx). Liviano a propósito: no
 * trae ningún dato de la cotización, se consulta seguido (polling).
 */
export async function GET() {
  try {
    const filas = (await sql`
      SELECT count(*)::int AS count FROM cotizaciones WHERE estado = 'lista_para_revisar'
    `) as unknown as Array<{ count: number }>
    return NextResponse.json({ ok: true, count: filas[0]?.count || 0 })
  } catch (err) {
    console.error("[API] Error en administracion/cotizaciones/pendientes:", err)
    return NextResponse.json({ ok: false, count: 0 }, { status: 500 })
  }
}
