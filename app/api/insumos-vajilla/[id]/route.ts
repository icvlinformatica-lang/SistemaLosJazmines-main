export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { puedeEditarCatalogoVajilla } from "@/lib/stock-salones"
import {
  AVISO_SIN_TABLA_VAJILLA,
  articuloVajillaDesdeFila,
  faltaTablaVajilla,
  nombreRepetido,
  validarArticuloVajilla,
} from "@/lib/insumos-vajilla"

/**
 * PUT    — edita nombre, unidad o categoría de un artículo de vajilla.
 * DELETE — lo borra junto con sus conteos por salón (stock_salones). El
 *          historial de cargas (stock_sesion_items) queda: guarda una copia
 *          del nombre de ese día.
 * Cocina, Administración y Soporte (puedeEditarCatalogoVajilla).
 */

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeEditarCatalogoVajilla(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede editar artículos" }, { status: 403 })
    }
    const { id } = await params
    const v = validarArticuloVajilla(await req.json().catch(() => ({})), id)
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })
    const a = v.articulo

    const existentes = (
      (await sql`SELECT id, descripcion, unidad, categoria FROM insumos_vajilla`) as unknown as Array<
        Parameters<typeof articuloVajillaDesdeFila>[0]
      >
    ).map(articuloVajillaDesdeFila)
    const previo = existentes.find((e) => e.id === id)
    if (!previo) return NextResponse.json({ ok: false, error: "El artículo ya no existe" }, { status: 404 })
    if (nombreRepetido(a.descripcion, existentes, id)) {
      return NextResponse.json({ ok: false, error: `Ya hay un artículo que se llama "${a.descripcion}"` }, { status: 409 })
    }

    await sql`
      UPDATE insumos_vajilla
      SET descripcion = ${a.descripcion}, unidad = ${a.unidad}, categoria = ${a.categoria}, updated_at = NOW()
      WHERE id = ${id}
    `
    const cambios: string[] = []
    if (previo.descripcion !== a.descripcion) cambios.push(`Nombre: ${previo.descripcion} → ${a.descripcion}`)
    if (previo.unidad !== a.unidad) cambios.push(`Unidad: ${previo.unidad} → ${a.unidad}`)
    if ((previo.categoria || "") !== (a.categoria || "")) {
      cambios.push(`Categoría: ${previo.categoria || "sin categoría"} → ${a.categoria || "sin categoría"}`)
    }
    if (cambios.length) await logActivity("insumo_vajilla", "modificado", a.descripcion, cambios.join(" · "))
    return NextResponse.json({ ok: true, articulo: a })
  } catch (err) {
    if (faltaTablaVajilla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA_VAJILLA }, { status: 503 })
    console.error("[API] Error en insumos-vajilla PUT:", err)
    return NextResponse.json({ ok: false, error: "No se pudo guardar el artículo" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeEditarCatalogoVajilla(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede borrar artículos" }, { status: 403 })
    }
    const { id } = await params
    const borrado = await sql.begin(async (trx) => {
      // Los tipos de postgres.js no marcan la transacción como invocable
      // (TS2349), aunque en ejecución funciona igual que sql.
      const tx = trx as unknown as typeof sql
      await tx`DELETE FROM stock_salones WHERE insumo_tipo = 'vajilla' AND insumo_id = ${id}`
      return (await tx`DELETE FROM insumos_vajilla WHERE id = ${id} RETURNING descripcion`) as unknown as Array<{
        descripcion: string
      }>
    })
    // Ya no estaba (doble clic, reintento): no es un error.
    if (borrado.length) await logActivity("insumo_vajilla", "eliminado", borrado[0].descripcion)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (faltaTablaVajilla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA_VAJILLA }, { status: 503 })
    console.error("[API] Error en insumos-vajilla DELETE:", err)
    return NextResponse.json({ ok: false, error: "No se pudo borrar el artículo" }, { status: 500 })
  }
}
