export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { puedeEditarCatalogoLimpieza } from "@/lib/stock-salones"
import { AVISO_SIN_TABLA, articuloDesdeFila, describirContenido, faltaTabla, nombreRepetido, validarArticuloLimpieza } from "@/lib/insumos-limpieza"

/**
 * PUT    — edita nombre, unidad, categoría, precio o contenido de un artículo
 *          de limpieza.
 * DELETE — lo borra junto con sus conteos por salón (stock_salones). El
 *          historial de cargas (stock_sesion_items) queda: guarda una copia
 *          del nombre de ese día.
 * Solo Administración y Soporte.
 */

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeEditarCatalogoLimpieza(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede editar artículos" }, { status: 403 })
    }
    const { id } = await params
    const v = validarArticuloLimpieza(await req.json().catch(() => ({})), id)
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })
    const a = v.articulo

    const existentes = (
      (await sql`
        SELECT id, descripcion, unidad, categoria, precio_unitario, contenido_cantidad, contenido_unidad
        FROM insumos_limpieza
      `) as unknown as Array<Parameters<typeof articuloDesdeFila>[0]>
    ).map(articuloDesdeFila)
    const previo = existentes.find((e) => e.id === id)
    if (!previo) return NextResponse.json({ ok: false, error: "El artículo ya no existe" }, { status: 404 })
    if (nombreRepetido(a.descripcion, existentes, id)) {
      return NextResponse.json({ ok: false, error: `Ya hay un artículo que se llama "${a.descripcion}"` }, { status: 409 })
    }

    await sql`
      UPDATE insumos_limpieza
      SET descripcion = ${a.descripcion}, unidad = ${a.unidad}, categoria = ${a.categoria},
          precio_unitario = ${a.precioUnitario}, contenido_cantidad = ${a.contenidoCantidad},
          contenido_unidad = ${a.contenidoUnidad}, updated_at = NOW()
      WHERE id = ${id}
    `
    const cambios: string[] = []
    if (previo.descripcion !== a.descripcion) cambios.push(`Nombre: ${previo.descripcion} → ${a.descripcion}`)
    if (previo.unidad !== a.unidad) cambios.push(`Unidad: ${previo.unidad} → ${a.unidad}`)
    if ((previo.categoria || "") !== (a.categoria || "")) {
      cambios.push(`Categoría: ${previo.categoria || "sin categoría"} → ${a.categoria || "sin categoría"}`)
    }
    if (Math.abs(previo.precioUnitario - a.precioUnitario) > 0.005) {
      cambios.push(`Precio: $${previo.precioUnitario} → $${a.precioUnitario}`)
    }
    const contenidoAntes = describirContenido(previo.contenidoCantidad, previo.contenidoUnidad)
    const contenidoAhora = describirContenido(a.contenidoCantidad, a.contenidoUnidad)
    if (contenidoAntes !== contenidoAhora) cambios.push(`Trae: ${contenidoAntes} → ${contenidoAhora}`)
    if (cambios.length) await logActivity("insumo_limpieza", "modificado", a.descripcion, cambios.join(" · "))
    return NextResponse.json({ ok: true, articulo: a })
  } catch (err) {
    if (faltaTabla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA }, { status: 503 })
    console.error("[API] Error en insumos-limpieza PUT:", err)
    return NextResponse.json({ ok: false, error: "No se pudo guardar el artículo" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeEditarCatalogoLimpieza(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede borrar artículos" }, { status: 403 })
    }
    const { id } = await params
    const borrado = await sql.begin(async (trx) => {
      // Los tipos de postgres.js no marcan la transacción como invocable
      // (TS2349), aunque en ejecución funciona igual que sql.
      const tx = trx as unknown as typeof sql
      await tx`DELETE FROM stock_salones WHERE insumo_tipo = 'limpieza' AND insumo_id = ${id}`
      return (await tx`DELETE FROM insumos_limpieza WHERE id = ${id} RETURNING descripcion`) as unknown as Array<{
        descripcion: string
      }>
    })
    // Ya no estaba (doble clic, reintento): no es un error.
    if (borrado.length) await logActivity("insumo_limpieza", "eliminado", borrado[0].descripcion)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (faltaTabla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA }, { status: 503 })
    console.error("[API] Error en insumos-limpieza DELETE:", err)
    return NextResponse.json({ ok: false, error: "No se pudo borrar el artículo" }, { status: 500 })
  }
}
