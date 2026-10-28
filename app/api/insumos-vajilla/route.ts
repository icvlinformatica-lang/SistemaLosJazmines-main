export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { puedeEditarCatalogoVajilla, sectoresPermitidos } from "@/lib/stock-salones"
import {
  AVISO_SIN_TABLA_VAJILLA,
  articuloVajillaDesdeFila,
  faltaTablaVajilla,
  nombreRepetido,
  validarArticuloVajilla,
} from "@/lib/insumos-vajilla"

/**
 * Vajilla y utensilios de cocina (tabla insumos_vajilla, scripts/028).
 *
 * GET  — la lista. La ven quienes cuentan vajilla (Cocina, Administración y
 *        Soporte): es lo que muestra /stock para contar.
 * POST — alta de un artículo. Cocina, Administración y Soporte
 *        (puedeEditarCatalogoVajilla). Idempotente: el id lo genera la
 *        pantalla y un reintento no crea otro.
 *
 * Solo stock: sin precio, no mueve costos de eventos ni cajas.
 */

export async function GET(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!sectoresPermitidos(perfil).includes("vajilla")) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
    }
    const filas = (await sql`
      SELECT id, descripcion, unidad, categoria FROM insumos_vajilla ORDER BY descripcion ASC
    `) as unknown as Array<Parameters<typeof articuloVajillaDesdeFila>[0]>
    return NextResponse.json({ ok: true, articulos: filas.map(articuloVajillaDesdeFila) })
  } catch (err) {
    if (faltaTablaVajilla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA_VAJILLA }, { status: 503 })
    console.error("[API] Error en insumos-vajilla GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeEditarCatalogoVajilla(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede cargar artículos" }, { status: 403 })
    }
    const v = validarArticuloVajilla(await req.json().catch(() => ({})))
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })
    const a = v.articulo

    const existentes = (await sql`SELECT id, descripcion FROM insumos_vajilla`) as unknown as Array<{
      id: string
      descripcion: string
    }>
    // Un reintento del mismo alta no es un repetido: el id ya está.
    if (existentes.some((e) => e.id === a.id)) return NextResponse.json({ ok: true, articulo: a, duplicada: true })
    if (nombreRepetido(a.descripcion, existentes)) {
      return NextResponse.json({ ok: false, error: `Ya hay un artículo que se llama "${a.descripcion}"` }, { status: 409 })
    }

    const creada = (await sql`
      INSERT INTO insumos_vajilla (id, descripcion, unidad, categoria)
      VALUES (${a.id}, ${a.descripcion}, ${a.unidad}, ${a.categoria})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `) as unknown as Array<{ id: string }>
    if (creada.length) {
      const detalle = [`Unidad: ${a.unidad}`]
      if (a.categoria) detalle.push(`Categoría: ${a.categoria}`)
      await logActivity("insumo_vajilla", "creado", a.descripcion, detalle.join(" · "))
    }
    return NextResponse.json({ ok: true, articulo: a, duplicada: !creada.length })
  } catch (err) {
    if (faltaTablaVajilla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA_VAJILLA }, { status: 503 })
    console.error("[API] Error en insumos-vajilla POST:", err)
    return NextResponse.json({ ok: false, error: "No se pudo guardar el artículo" }, { status: 500 })
  }
}
