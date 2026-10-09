export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

/**
 * GET /api/vendedor/salones-ocupados?fecha=YYYY-MM-DD
 *
 * Para el cotizador: qué salones ya tienen un evento ese día, así el
 * vendedor lo ve al elegir la fecha y no se entera recién cuando
 * Administración aprueba (y le da 409).
 *
 * Misma regla que el índice único eventos_un_evento_por_dia_y_salon
 * (scripts/019, el que traduce lib/salon-ocupado.ts): cuenta todo evento que
 * no esté en la papelera (deleted_at nulo), sea cual sea su estado — es lo
 * que de verdad frena la aprobación.
 *
 * Devuelve SOLO las claves de salón ("Quinta", "Casona"...). Nada del
 * evento: ni nombre, ni cliente, ni montos, ni ids (el vendedor no ve datos
 * de otros clientes). Solo perfiles que cotizan: Vendedor, Administración y
 * Soporte (el middleware ya exige sesión; esto mira el perfil).
 */
const PERFILES_QUE_COTIZAN = ["vendedor", "administracion", "soporte"]

export async function GET(req: Request) {
  const perfil = await perfilDesdeRequest(req)
  if (!perfil || !PERFILES_QUE_COTIZAN.includes(perfil)) {
    return NextResponse.json({ ok: false, error: "Sin permiso" }, { status: 403 })
  }
  const fecha = new URL(req.url).searchParams.get("fecha") ?? ""
  // eventos.fecha es texto "YYYY-MM-DD": se exige ese formato exacto.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: "Fecha inválida" }, { status: 400 })
  }
  try {
    const filas = (await sql`
      SELECT DISTINCT salon FROM eventos
      WHERE fecha = ${fecha} AND deleted_at IS NULL
    `) as unknown as Array<{ salon: string | null }>
    const salones = filas.map((f) => f.salon).filter((s): s is string => typeof s === "string" && s !== "")
    return NextResponse.json({ ok: true, salones })
  } catch (err) {
    console.error("[API] Error en vendedor/salones-ocupados GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
