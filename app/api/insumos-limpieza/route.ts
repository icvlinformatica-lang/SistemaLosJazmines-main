export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { puedeAgregarArticuloLimpieza, sectoresPermitidos } from "@/lib/stock-salones"
import { AVISO_SIN_TABLA, articuloDesdeFila, describirContenido, faltaTabla, nombreRepetido, validarArticuloLimpieza } from "@/lib/insumos-limpieza"

/**
 * Catálogo de artículos de limpieza (tabla insumos_limpieza, scripts/026).
 *
 * GET  — la lista. La ven quienes cuentan limpieza (Mantenimiento,
 *        Administración y Soporte): es lo que muestra /stock para contar.
 * POST — alta de un artículo. Administración, Soporte y Mantenimiento
 *        (puedeAgregarArticuloLimpieza). Idempotente: el id lo genera la
 *        pantalla y un reintento no crea otro.
 *
 * El precio y el contenido por unidad se guardan, pero por ahora no mueven
 * costos de eventos ni cajas.
 */

export async function GET(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!sectoresPermitidos(perfil).includes("limpieza")) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
    }
    const filas = (await sql`
      SELECT id, descripcion, unidad, categoria, precio_unitario, contenido_cantidad, contenido_unidad
      FROM insumos_limpieza ORDER BY descripcion ASC
    `) as unknown as Array<Parameters<typeof articuloDesdeFila>[0]>
    return NextResponse.json({ ok: true, articulos: filas.map(articuloDesdeFila) })
  } catch (err) {
    if (faltaTabla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA }, { status: 503 })
    console.error("[API] Error en insumos-limpieza GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeAgregarArticuloLimpieza(perfil)) {
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
      INSERT INTO insumos_limpieza (id, descripcion, unidad, categoria, precio_unitario, contenido_cantidad, contenido_unidad)
      VALUES (${a.id}, ${a.descripcion}, ${a.unidad}, ${a.categoria}, ${a.precioUnitario}, ${a.contenidoCantidad}, ${a.contenidoUnidad})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `) as unknown as Array<{ id: string }>
    if (creada.length) {
      const detalle = [`Unidad: ${a.unidad}`]
      if (a.contenidoCantidad) detalle.push(`Trae: ${describirContenido(a.contenidoCantidad, a.contenidoUnidad)}`)
      if (a.precioUnitario > 0) detalle.push(`Precio: $${a.precioUnitario}`)
      await logActivity("insumo_limpieza", "creado", a.descripcion, detalle.join(" · "))
    }
    return NextResponse.json({ ok: true, articulo: a, duplicada: !creada.length })
  } catch (err) {
    if (faltaTabla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA }, { status: 503 })
    console.error("[API] Error en insumos-limpieza POST:", err)
    return NextResponse.json({ ok: false, error: "No se pudo guardar el artículo" }, { status: 500 })
  }
}
