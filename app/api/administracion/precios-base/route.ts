export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Precio base de RESPALDO por salón (tabla precios_base_salones), distinto
 * del Calendario de Precios (/admin/precios, tabla precios_venta) que fija
 * un precio por fecha exacta. Este valor entra en juego cuando una fecha
 * todavía no tiene precio cargado ahí — sin esto, esas cotizaciones salían
 * con precio base $0 (ver lib/store.ts getPrecioVenta). Se edita desde la
 * tarjeta en Eventos > Cotizaciones (/eventos/cotizaciones).
 */

export async function GET() {
  try {
    const filas = (await sql`SELECT salon, precio FROM precios_base_salones`) as unknown as Array<{
      salon: string
      precio: number
    }>
    const precios: Record<string, number> = {}
    for (const f of filas) precios[f.salon] = Number(f.precio) || 0
    return NextResponse.json({ ok: true, precios })
  } catch (err) {
    console.error("[API] Error en administracion/precios-base GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const precios = body?.precios
    if (!precios || typeof precios !== "object") {
      return NextResponse.json({ ok: false, error: "Falta el objeto de precios" }, { status: 400 })
    }

    for (const [salon, precio] of Object.entries(precios)) {
      const valor = Number(precio) || 0
      await sql`
        INSERT INTO precios_base_salones (salon, precio, updated_at)
        VALUES (${salon}, ${valor}, now())
        ON CONFLICT (salon) DO UPDATE SET precio = ${valor}, updated_at = now()
      `
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en administracion/precios-base POST:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
