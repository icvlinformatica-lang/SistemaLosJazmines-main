export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { puedeEditarCatalogoLimpieza, sectoresPermitidos } from "@/lib/stock-salones"
import { AVISO_SIN_TABLA, faltaTabla, nombreRepetido, validarArticuloLimpieza } from "@/lib/insumos-limpieza"

/**
 * Catálogo de artículos de limpieza (tabla insumos_limpieza, scripts/026).
 *
 * GET  — la lista. La ven quienes cuentan limpieza (Mantenimiento,
 *        Administración y Soporte): es lo que muestra /stock para contar.
 * POST — alta de un artículo. Solo Administración y Soporte
 *        (puedeEditarCatalogoLimpieza). Idempotente: el id lo genera la
 *        pantalla y un reintento no crea otro.
 *
 * Sin precio: no mueve costos de eventos ni cajas.
 */

export async function GET(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!sectoresPermitidos(perfil).includes("limpieza")) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
    }
    const filas = (await sql`
      SELECT id, descripcion, unidad, categoria FROM insumos_limpieza ORDER BY descripcion ASC
    `) as unknown as Array<{ id: string; descripcion: string; unidad: string | null; categoria: string | null }>
    return NextResponse.json({
      ok: true,
      articulos: filas.map((f) => ({ id: f.id, descripcion: f.descripcion, unidad: f.unidad || "UN", categoria: f.categoria })),
    })
  } catch (err) {
    if (faltaTabla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA }, { status: 503 })
    console.error("[API] Error en insumos-limpieza GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeEditarCatalogoLimpieza(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede cargar artículos" }, { status: 403 })
    }
    const v = validarArticuloLimpieza(await req.json().catch(() => ({})))
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })
    const a = v.articulo

    const existentes = (await sql`SELECT id, descripcion FROM insumos_limpieza`) as unknown as Array<{
      id: string
      descripcion: string
    }>
    // Un reintento del mismo alta no es un repetido: el id ya está.
    if (existentes.some((e) => e.id === a.id)) return NextResponse.json({ ok: true, articulo: a, duplicada: true })
    if (nombreRepetido(a.descripcion, existentes)) {
      return NextResponse.json({ ok: false, error: `Ya hay un artículo que se llama "${a.descripcion}"` }, { status: 409 })
    }

    const creada = (await sql`
      INSERT INTO insumos_limpieza (id, descripcion, unidad, categoria)
      VALUES (${a.id}, ${a.descripcion}, ${a.unidad}, ${a.categoria})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `) as unknown as Array<{ id: string }>
    if (creada.length) await logActivity("insumo_limpieza", "creado", a.descripcion, `Unidad: ${a.unidad}`)
    return NextResponse.json({ ok: true, articulo: a, duplicada: !creada.length })
  } catch (err) {
    if (faltaTabla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA }, { status: 503 })
    console.error("[API] Error en insumos-limpieza POST:", err)
    return NextResponse.json({ ok: false, error: "No se pudo guardar el artículo" }, { status: 500 })
  }
}
